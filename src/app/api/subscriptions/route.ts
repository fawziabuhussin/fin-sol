import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { ensureSubscriptionCategoryId } from "@/lib/subscription-category";
import { seedDefaultSubscriptions } from "@/lib/subscription-seed";
import { subscriptionSchema } from "@/lib/validations/subscriptions";

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

    if (body.action === "seed-defaults") {
      const result = await seedDefaultSubscriptions(user.id, prisma, {
        startYear: body.startYear,
        paidThroughMonth: body.paidThroughMonth,
      });
      return NextResponse.json(result, { status: 201 });
    }

    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const categoryId =
      d.categoryId || (await ensureSubscriptionCategoryId(user.id));

    const created = await prisma.subscription.create({
      data: {
        userId: user.id,
        title: d.title,
        amount: d.amount,
        billingDay: d.billingDay ?? null,
        categoryId,
        paymentMethodId: d.paymentMethodId || null,
        notes: d.notes || null,
        isActive: d.isActive ?? true,
        isDefault: false,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
