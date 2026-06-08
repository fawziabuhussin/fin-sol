import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { subscriptionPaidAtForPeriod } from "@/lib/savings-schedule";
import { ensureSubscriptionCategoryId } from "@/lib/subscription-category";
import { subscriptionPaymentSchema } from "@/lib/validations/subscriptions";
import { decimalToNumber } from "@/lib/utils";
import { TransactionType } from "@/generated/prisma/client";

async function owns(userId: string, subscriptionId: string) {
  return prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    include: { category: true },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: subscriptionId } = await params;
    const sub = await owns(user.id, subscriptionId);
    if (!sub) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = subscriptionPaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const amount = d.amount ?? decimalToNumber(sub.amount);
    const paid = d.paid ?? false;
    const paidAt = paid
      ? d.paidAt
        ? new Date(d.paidAt)
        : subscriptionPaidAtForPeriod(d.periodYear, d.periodMonth)
      : null;

    const existing = await prisma.subscriptionPayment.findUnique({
      where: {
        subscriptionId_periodYear_periodMonth: {
          subscriptionId,
          periodYear: d.periodYear,
          periodMonth: d.periodMonth,
        },
      },
    });

    if (paid && !existing?.transactionId) {
      const categoryId =
        sub.categoryId ?? (await ensureSubscriptionCategoryId(user.id));
      const tx = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: TransactionType.EXPENSE,
          amount,
          occurredAt: paidAt!,
          categoryId,
          paymentMethodId: sub.paymentMethodId,
          description: sub.title,
          notes: `اشتراك شهري — ${d.periodYear}/${d.periodMonth}`,
          currency: "ILS",
        },
      });

      const entry = await prisma.subscriptionPayment.upsert({
        where: {
          subscriptionId_periodYear_periodMonth: {
            subscriptionId,
            periodYear: d.periodYear,
            periodMonth: d.periodMonth,
          },
        },
        create: {
          subscriptionId,
          periodYear: d.periodYear,
          periodMonth: d.periodMonth,
          amount,
          paid: true,
          paidAt,
          transactionId: tx.id,
        },
        update: {
          amount,
          paid: true,
          paidAt,
          transactionId: tx.id,
        },
      });
      return NextResponse.json(entry);
    }

    if (!paid && existing?.transactionId) {
      await prisma.transaction
        .delete({ where: { id: existing.transactionId } })
        .catch(() => null);
    }

    const entry = await prisma.subscriptionPayment.upsert({
      where: {
        subscriptionId_periodYear_periodMonth: {
          subscriptionId,
          periodYear: d.periodYear,
          periodMonth: d.periodMonth,
        },
      },
      create: {
        subscriptionId,
        periodYear: d.periodYear,
        periodMonth: d.periodMonth,
        amount,
        paid,
        paidAt,
      },
      update: {
        amount,
        paid,
        paidAt,
        ...(paid ? {} : { transactionId: null }),
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}
