import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { subscriptionPatchSchema } from "@/lib/validations/subscriptions";

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
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.amount !== undefined ? { amount: d.amount } : {}),
        ...(d.billingDay !== undefined ? { billingDay: d.billingDay } : {}),
        ...(d.categoryId !== undefined
          ? { categoryId: d.categoryId || null }
          : {}),
        ...(d.paymentMethodId !== undefined
          ? { paymentMethodId: d.paymentMethodId || null }
          : {}),
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/** scope=month hides from one month; default deletes the recurring subscription entirely */
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

    if (scope === "month" && year && month) {
      await prisma.subscriptionMonthSkip.upsert({
        where: {
          subscriptionId_periodYear_periodMonth: {
            subscriptionId: id,
            periodYear: year,
            periodMonth: month,
          },
        },
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

    if (txIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { id: { in: txIds } } });
    }
    await prisma.subscription.delete({ where: { id } });

    return NextResponse.json({ ok: true, scope: "all" });
  } catch (error) {
    return handleApiError(error);
  }
}
