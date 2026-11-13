import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { ensureSubscriptionCategoryId } from "@/lib/subscription-category";
import { seedDefaultSubscriptions } from "@/lib/subscription-seed";
import { assertOwnedRefs } from "@/lib/security/owned-refs";
import { isOwnerEmail } from "@/lib/security/owner";
import { optionalDate, subscriptionSchema } from "@/lib/validations/subscriptions";
import { Prisma } from "@/generated/prisma/client";

export async function GET() {
  try {
    const user = await requireUser();
    const items = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: "desc" }, { title: "asc" }],
      include: {
        category: true,
        paymentMethod: true,
      },
    });
    return NextResponse.json(items);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (body?.action === "seed-defaults") {
      // The default list is the original owner's personal subscriptions.
      if (!isOwnerEmail(user.email)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const result = await seedDefaultSubscriptions(user.id, prisma, {
        startYear: body.startYear,
        paidThroughMonth: body.paidThroughMonth,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    await assertOwnedRefs(user.id, d);
    const categoryId = d.categoryId || (await ensureSubscriptionCategoryId(user.id));
    const startDate = optionalDate(d.startDate);
    const billingCycle = d.billingCycle ?? "MONTHLY";

    const created = await prisma.subscription.create({
      data: {
        userId: user.id,
        title: d.title,
        amount: d.amount,
        billingDay: d.billingDay ?? null,
        billingCycle,
        billingMonth:
          billingCycle === "YEARLY"
            ? (d.billingMonth ??
              (startDate ? startDate.getUTCMonth() + 1 : new Date().getMonth() + 1))
            : null,
        startDate,
        endDate: optionalDate(d.endDate),
        categoryId,
        paymentMethodId: d.paymentMethodId || null,
        notes: d.notes || null,
        isActive: d.isActive ?? true,
        isDefault: false,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "لديك اشتراك بنفس الاسم" }, { status: 409 });
    }
    return handleApiError(error);
  }
}
