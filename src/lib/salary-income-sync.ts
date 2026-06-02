import {
  CategoryKind,
  PrismaClient,
  TransactionType,
} from "@/generated/prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import { incomeDateFromSalaryPeriod } from "@/lib/dates";
import { decimalToNumber } from "@/lib/utils";

export function slipEffectiveNet(slip: {
  net: { toString(): string };
  bonus: { toString(): string };
  fees: { toString(): string };
}) {
  return (
    decimalToNumber(slip.net) +
    decimalToNumber(slip.bonus) -
    decimalToNumber(slip.fees)
  );
}

async function ensureIncomeCategory(userId: string, db: PrismaClient) {
  let incomeCat = await db.category.findFirst({
    where: { userId, name: "دخل" },
  });
  if (!incomeCat) {
    incomeCat = await db.category.create({
      data: { userId, name: "دخل", kind: CategoryKind.INCOME },
    });
  }
  return incomeCat;
}

async function ensurePayee(userId: string, name: string, db: PrismaClient) {
  let payee = await db.payee.findFirst({ where: { userId, name } });
  if (!payee) {
    payee = await db.payee.create({ data: { userId, name } });
  }
  return payee;
}

/** Create/update/delete the income transaction linked to a salary slip. */
export async function syncSalarySlipIncome(
  slipId: string,
  db: PrismaClient = defaultPrisma
) {
  const slip = await db.salarySlip.findUnique({
    where: { id: slipId },
    include: { employer: true },
  });
  if (!slip) return null;

  const existing = await db.transaction.findUnique({
    where: { salarySlipId: slipId },
  });

  if (!slip.worked) {
    if (existing) {
      await db.transaction.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const amount = slipEffectiveNet(slip);
  if (amount <= 0) {
    if (existing) {
      await db.transaction.delete({ where: { id: existing.id } });
    }
    return null;
  }

  const incomeCat = await ensureIncomeCategory(slip.userId, db);
  const payee = await ensurePayee(slip.userId, slip.employer.name, db);
  const occurredAt = incomeDateFromSalaryPeriod(slip.periodYear, slip.periodMonth);

  const data = {
    userId: slip.userId,
    type: TransactionType.INCOME,
    amount,
    occurredAt,
    categoryId: incomeCat.id,
    payeeId: payee.id,
    description: slip.employer.name,
    salarySlipId: slip.id,
  };

  if (existing) {
    return db.transaction.update({
      where: { id: existing.id },
      data: {
        amount: data.amount,
        occurredAt: data.occurredAt,
        description: data.description,
        payeeId: data.payeeId,
        categoryId: data.categoryId,
      },
    });
  }

  return db.transaction.create({ data });
}

export async function removeSalarySlipIncome(
  slipId: string,
  db: PrismaClient = defaultPrisma
) {
  await db.transaction.deleteMany({ where: { salarySlipId: slipId } });
}

/** Re-link all slips for a user (fixes legacy same-month income rows). */
export async function syncAllSalaryIncomeForUser(
  userId: string,
  db: PrismaClient = defaultPrisma
) {
  const slips = await db.salarySlip.findMany({
    where: { userId },
    include: { employer: true },
  });

  for (const slip of slips) {
    const nextMonth =
      slip.periodMonth === 12
        ? { year: slip.periodYear + 1, month: 1 }
        : { year: slip.periodYear, month: slip.periodMonth + 1 };
    const shiftedDate = new Date(
      Date.UTC(nextMonth.year, nextMonth.month - 1, 1)
    );
    await db.transaction.deleteMany({
      where: {
        userId,
        type: TransactionType.INCOME,
        salarySlipId: null,
        description: slip.employer.name,
        occurredAt: shiftedDate,
      },
    });
    await syncSalarySlipIncome(slip.id, db);
  }
}
