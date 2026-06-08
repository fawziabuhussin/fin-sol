import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { createSavingsContributionTransaction } from "@/lib/savings-contribution";
import {
  paidAtForPeriod,
  parsePaymentIntoMonths,
  periodsFromPaymentCount,
} from "@/lib/savings-schedule";
import { decimalToNumber } from "@/lib/utils";
import { savingsBulkEntrySchema, savingsEntrySchema } from "@/lib/validations/savings";

async function ownsPlan(userId: string, planId: string) {
  return prisma.savingsPlan.findFirst({ where: { id: planId, userId } });
}

// Upsert a single month entry (used for the V checkmark toggle)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: planId } = await params;
    const plan = await ownsPlan(user.id, planId);
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = savingsEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const paid = d.paid ?? false;
    const paidAt = paid
      ? d.paidAt
        ? new Date(d.paidAt)
        : paidAtForPeriod(d.periodYear, d.periodMonth)
      : null;

    const existing = await prisma.savingsEntry.findUnique({
      where: {
        planId_periodYear_periodMonth: {
          planId,
          periodYear: d.periodYear,
          periodMonth: d.periodMonth,
        },
      },
    });

    let transactionId = existing?.transactionId ?? null;

    if (paid && !transactionId) {
      const tx = await createSavingsContributionTransaction({
        userId: user.id,
        planTitle: plan.title,
        amount: d.amount,
        occurredAt: paidAt!,
        notes: d.notes ?? null,
      });
      transactionId = tx.id;
    } else if (!paid && transactionId) {
      await prisma.transaction
        .delete({ where: { id: transactionId } })
        .catch(() => null);
      transactionId = null;
    } else if (paid && transactionId) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          amount: d.amount,
          occurredAt: paidAt!,
          ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        },
      });
    }

    const entry = await prisma.savingsEntry.upsert({
      where: {
        planId_periodYear_periodMonth: {
          planId,
          periodYear: d.periodYear,
          periodMonth: d.periodMonth,
        },
      },
      create: {
        planId,
        periodYear: d.periodYear,
        periodMonth: d.periodMonth,
        amount: d.amount,
        paid,
        isPayout: d.isPayout ?? false,
        paidAt,
        notes: d.notes || null,
        transactionId,
      },
      update: {
        amount: d.amount,
        paid,
        ...(d.isPayout !== undefined ? { isPayout: d.isPayout } : {}),
        paidAt,
        transactionId,
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Apply one payment across consecutive schedule months (e.g. ₪15,000 = 3×₪5,000). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: planId } = await params;
    const plan = await ownsPlan(user.id, planId);
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = savingsBulkEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const monthly =
      parsed.data.monthlyAmount ?? decimalToNumber(plan.monthlyContribution);
    const { fullMonths, remainder } = parsePaymentIntoMonths(
      parsed.data.totalPaid,
      monthly
    );

    const periods = periodsFromPaymentCount(
      parsed.data.startPeriodYear,
      parsed.data.startPeriodMonth,
      fullMonths + (remainder > 0 ? 1 : 0)
    );

    const updated = [];
    for (let i = 0; i < periods.length; i++) {
      const { year, month } = periods[i]!;
      const amount =
        i < fullMonths ? monthly : remainder > 0 ? remainder : monthly;
      if (amount <= 0) continue;

      const paidAt = paidAtForPeriod(year, month);

      const existing = await prisma.savingsEntry.findUnique({
        where: {
          planId_periodYear_periodMonth: {
            planId,
            periodYear: year,
            periodMonth: month,
          },
        },
      });

      let transactionId = existing?.transactionId ?? null;
      if (!transactionId) {
        const tx = await createSavingsContributionTransaction({
          userId: user.id,
          planTitle: plan.title,
          amount,
          occurredAt: paidAt,
          notes: `دفعة مجمّعة — ${parsed.data.totalPaid} ₪`,
        });
        transactionId = tx.id;
      }

      const entry = await prisma.savingsEntry.upsert({
        where: {
          planId_periodYear_periodMonth: {
            planId,
            periodYear: year,
            periodMonth: month,
          },
        },
        create: {
          planId,
          periodYear: year,
          periodMonth: month,
          amount,
          paid: true,
          paidAt,
          notes: `دفعة مجمّعة — ${parsed.data.totalPaid} ₪`,
          transactionId,
        },
        update: {
          amount,
          paid: true,
          paidAt,
          transactionId,
        },
      });
      updated.push(entry);
    }

    return NextResponse.json({ months: updated.length, entries: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
