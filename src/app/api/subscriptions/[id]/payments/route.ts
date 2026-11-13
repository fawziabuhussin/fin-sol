import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { setSubscriptionPaid } from "@/lib/subscription-payments";
import { subscriptionPaymentSchema } from "@/lib/validations/subscriptions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: subscriptionId } = await params;
    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: user.id },
    });
    if (!sub) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = subscriptionPaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    const entry = await setSubscriptionPaid({
      userId: user.id,
      sub,
      periodYear: d.periodYear,
      periodMonth: d.periodMonth,
      paid: d.paid ?? false,
      amount: d.amount,
      paidAt: d.paidAt || null,
    });
    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}
