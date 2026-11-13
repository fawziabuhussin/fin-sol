import { prisma } from "@/lib/db";
import { TransactionType } from "@/generated/prisma/client";
import { subscriptionPaidAtForPeriod } from "@/lib/savings-schedule";
import { ensureSubscriptionCategoryId } from "@/lib/subscription-category";
import { decimalToNumber } from "@/lib/utils";

type SubscriptionRow = {
  id: string;
  title: string;
  amount: { toString(): string } | number;
  categoryId: string | null;
  paymentMethodId: string | null;
  billingCycle: "MONTHLY" | "YEARLY";
};

/**
 * Marks one subscription period paid/unpaid. Paying creates (or updates) the
 * linked EXPENSE transaction so the charge shows up in every report; un-paying
 * removes it. Both writes happen in one DB transaction.
 */
export async function setSubscriptionPaid(params: {
  userId: string;
  sub: SubscriptionRow;
  periodYear: number;
  periodMonth: number;
  paid: boolean;
  amount?: number;
  paidAt?: string | null;
}) {
  const { userId, sub, periodYear, periodMonth, paid } = params;
  const amount = params.amount ?? decimalToNumber(sub.amount);
  const paidAt = paid
    ? params.paidAt
      ? new Date(params.paidAt)
      : subscriptionPaidAtForPeriod(periodYear, periodMonth)
    : null;
  const categoryId = paid
    ? (sub.categoryId ?? (await ensureSubscriptionCategoryId(userId)))
    : null;
  const key = {
    subscriptionId_periodYear_periodMonth: {
      subscriptionId: sub.id,
      periodYear,
      periodMonth,
    },
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.subscriptionPayment.findUnique({ where: key });
    let transactionId = existing?.transactionId ?? null;

    if (paid) {
      const txData = {
        amount,
        occurredAt: paidAt!,
        description: sub.title,
      };
      if (transactionId) {
        await tx.transaction.updateMany({
          where: { id: transactionId, userId },
          data: txData,
        });
      } else {
        const created = await tx.transaction.create({
          data: {
            ...txData,
            userId,
            type: TransactionType.EXPENSE,
            categoryId,
            paymentMethodId: sub.paymentMethodId,
            notes: `${sub.billingCycle === "YEARLY" ? "اشتراك سنوي" : "اشتراك شهري"} — ${periodYear}/${periodMonth}`,
            currency: "ILS",
          },
        });
        transactionId = created.id;
      }
    } else if (transactionId) {
      await tx.transaction.deleteMany({ where: { id: transactionId, userId } });
      transactionId = null;
    }

    return tx.subscriptionPayment.upsert({
      where: key,
      create: {
        subscriptionId: sub.id,
        periodYear,
        periodMonth,
        amount,
        paid,
        paidAt,
        transactionId,
      },
      update: { amount, paid, paidAt, transactionId },
    });
  });
}
