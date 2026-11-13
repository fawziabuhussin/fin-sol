import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { setSubscriptionPaid } from "@/lib/subscription-payments";
import { subscriptionBulkPaymentSchema } from "@/lib/validations/subscriptions";

/** Mark several subscriptions paid (or unpaid) for one month in a single request. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = subscriptionBulkPaymentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { periodYear, periodMonth, ids, paid } = parsed.data;

    // Only the caller's own subscriptions — foreign ids are silently ignored.
    const subs = await prisma.subscription.findMany({
      where: { id: { in: ids }, userId: user.id },
    });

    for (const sub of subs) {
      await setSubscriptionPaid({ userId: user.id, sub, periodYear, periodMonth, paid });
    }
    return NextResponse.json({ ok: true, updated: subs.length });
  } catch (error) {
    return handleApiError(error);
  }
}
