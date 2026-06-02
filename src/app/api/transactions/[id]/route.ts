import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { transactionSchema } from "@/lib/validations/transactions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.salarySlipId) {
      return NextResponse.json(
        {
          error: "SALARY_LINKED",
          message: "هذا الدخل مرتبط بالراتب — عدّله من صفحة الراتب",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const updated = await prisma.transaction.update({
      where: { id },
      data: {
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

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.transaction.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (existing.salarySlipId) {
      return NextResponse.json(
        {
          error: "SALARY_LINKED",
          message: "لا يمكن حذف دخل مرتبط بالراتب — عدّله من صفحة الراتب",
        },
        { status: 403 }
      );
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
