import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { transactionSchema } from "@/lib/validations/transactions";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const created = await prisma.transaction.create({
      data: {
        userId: user.id,
        type: data.type,
        amount: data.amount,
        occurredAt: new Date(data.occurredAt),
        description: data.description || null,
        notes: data.notes || null,
        projectId: data.projectId || null,
        categoryId: data.categoryId || null,
        payeeId: data.payeeId || null,
        paymentMethodId: data.paymentMethodId || null,
        currency: data.currency || "ILS",
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
