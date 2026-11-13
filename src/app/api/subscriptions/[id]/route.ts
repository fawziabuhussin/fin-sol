import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { assertOwnedRefs } from "@/lib/security/owned-refs";
import { optionalDate, subscriptionPatchSchema } from "@/lib/validations/subscriptions";
import { Prisma } from "@/generated/prisma/client";

async function owns(userId: string, id: string) {
  return prisma.subscription.findFirst({ where: { id, userId } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const sub = await owns(user.id, id);
    if (!sub) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = subscriptionPatchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    await assertOwnedRefs(user.id, d);

    const cycle = d.billingCycle ?? sub.billingCycle;
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.billingDay !== undefined ? { billingDay: d.billingDay } : {}),
        ...(d.billingCycle !== undefined ? { billingCycle: d.billingCycle } : {}),
        ...(d.billingMonth !== undefined || d.billingCycle !== undefined
          ? {
              billingMonth:
                cycle === "YEARLY"
                  ? (d.billingMonth ?? sub.billingMonth ?? new Date().getMonth() + 1)
                  : null,
            }
          : {}),
        ...(d.startDate !== undefined ? { startDate: optionalDate(d.startDate) } : {}),
        ...(d.endDate !== undefined ? { endDate: optionalDate(d.endDate) } : {}),
        ...(d.categoryId !== undefined ? { categoryId: d.categoryId || null } : {}),
        ...(d.paymentMethodId !== undefined
          ? { paymentMethodId: d.paymentMethodId || null }
          : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "لديك اشتراك بنفس الاسم" }, { status: 409 });
    }
    return handleApiError(error);
  }
}

/**
 * scope=month hides the subscription from one month (or restores it with
 * restore=1); the default deletes the subscription and the expenses it created.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const sub = await owns(user.id, id);
    if (!sub) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));

    if (scope === "month") {
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return NextResponse.json({ error: "Invalid period" }, { status: 400 });
      }
      const key = {
        subscriptionId_periodYear_periodMonth: {
          subscriptionId: id,
          periodYear: year,
          periodMonth: month,
        },
      };
      if (url.searchParams.get("restore") === "1") {
        await prisma.subscriptionMonthSkip.deleteMany({
          where: { subscriptionId: id, periodYear: year, periodMonth: month },
        });
        return NextResponse.json({ ok: true, scope: "month", restored: true });
      }
      await prisma.subscriptionMonthSkip.upsert({
        where: key,
        create: { subscriptionId: id, periodYear: year, periodMonth: month },
        update: {},
      });
      return NextResponse.json({ ok: true, scope: "month" });
    }

    const payments = await prisma.subscriptionPayment.findMany({
      where: { subscriptionId: id },
      select: { transactionId: true },
    });
    const txIds = payments
      .map((p) => p.transactionId)
      .filter((x): x is string => Boolean(x));

    await prisma.$transaction([
      prisma.transaction.deleteMany({ where: { id: { in: txIds }, userId: user.id } }),
      prisma.subscription.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true, scope: "all" });
  } catch (error) {
    return handleApiError(error);
  }
}
