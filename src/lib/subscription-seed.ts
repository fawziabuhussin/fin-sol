import type { PrismaClient } from "@/generated/prisma/client";
import { TransactionType } from "@/generated/prisma/client";
import {
  DEFAULT_SUBSCRIPTION_PAID_THROUGH_MONTH,
  DEFAULT_SUBSCRIPTION_START_YEAR,
  DEFAULT_SUBSCRIPTIONS,
} from "@/lib/default-subscriptions";
import { ensureSubscriptionCategoryId } from "@/lib/subscription-category";
import { subscriptionPaidAtForPeriod } from "@/lib/savings-schedule";
import { decimalToNumber } from "@/lib/utils";

export async function markSubscriptionMonthPaid(
  userId: string,
  prisma: PrismaClient,
  subscriptionId: string,
  periodYear: number,
  periodMonth: number,
  amount: number,
  title: string,
  categoryId: string,
  paymentMethodId: string | null
) {
  const paidAt = subscriptionPaidAtForPeriod(periodYear, periodMonth);

  const existing = await prisma.subscriptionPayment.findUnique({
    where: {
      subscriptionId_periodYear_periodMonth: {
        subscriptionId,
        periodYear,
        periodMonth,
      },
    },
  });

  if (existing?.paid && existing.transactionId) {
    return existing;
  }

  let transactionId = existing?.transactionId ?? null;
  if (!transactionId) {
    const tx = await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.EXPENSE,
        amount,
        occurredAt: paidAt,
        categoryId,
        paymentMethodId,
        description: title,
        notes: `اشتراك شهري — ${periodYear}/${periodMonth}`,
        currency: "ILS",
      },
    });
    transactionId = tx.id;
  }

  return prisma.subscriptionPayment.upsert({
    where: {
      subscriptionId_periodYear_periodMonth: {
        subscriptionId,
        periodYear,
        periodMonth,
      },
    },
    create: {
      subscriptionId,
      periodYear,
      periodMonth,
      amount,
      paid: true,
      paidAt,
      transactionId,
    },
    update: {
      amount,
      paid: true,
      paidAt,
      transactionId,
    },
  });
}

export async function seedDefaultSubscriptions(
  userId: string,
  prisma: PrismaClient,
  options?: {
    startYear?: number;
    paidThroughMonth?: number;
    forceRepay?: boolean;
  }
) {
  const startYear = options?.startYear ?? DEFAULT_SUBSCRIPTION_START_YEAR;
  const paidThroughMonth =
    options?.paidThroughMonth ?? DEFAULT_SUBSCRIPTION_PAID_THROUGH_MONTH;

  const categoryId = await ensureSubscriptionCategoryId(userId);
  const created: string[] = [];
  const paid: number[] = [];

  for (const sub of DEFAULT_SUBSCRIPTIONS) {
    const row = await prisma.subscription.upsert({
      where: { userId_title: { userId, title: sub.title } },
      create: {
        userId,
        title: sub.title,
        amount: sub.amount,
        billingDay: sub.billingDay,
        categoryId,
        isActive: true,
        isDefault: true,
      },
      update: {
        amount: sub.amount,
        billingDay: sub.billingDay,
        isActive: true,
        isDefault: true,
        categoryId,
      },
    });
    created.push(row.id);

    for (let m = 1; m <= paidThroughMonth; m++) {
      await markSubscriptionMonthPaid(
        userId,
        prisma,
        row.id,
        startYear,
        m,
        decimalToNumber(row.amount),
        row.title,
        categoryId,
        row.paymentMethodId
      );
      paid.push(m);
    }
  }

  return {
    subscriptions: created.length,
    paidMonths: paidThroughMonth,
    startYear,
  };
}
