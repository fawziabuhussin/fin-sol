import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { DEFAULT_SUBSCRIPTIONS } from "@/lib/default-subscriptions";
import { ensureSubscriptionCategoryId } from "@/lib/subscription-category";
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
      const count = await prisma.subscription.count({ where: { userId: user.id } });
      if (count > 0) {
        return NextResponse.json({ error: "Already has subscriptions" }, { status: 400 });
      }
      const categoryId = await ensureSubscriptionCategoryId(user.id);
      const created = await prisma.$transaction(
        DEFAULT_SUBSCRIPTIONS.map((sub) =>
          prisma.subscription.create({
            data: {
              userId: user.id,
              title: sub.title,
              amount: sub.amount,
              billingDay: sub.billingDay,
              categoryId,
              isActive: true,
            },
          })
        )
      );
      return NextResponse.json({ count: created.length }, { status: 201 });
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
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
