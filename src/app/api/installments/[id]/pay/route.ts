import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { InstallmentStatus, TransactionType } from "@/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await req.json()) as { occurredAt?: string };

    const installment = await prisma.projectInstallment.findFirst({
      where: { id, plan: { userId: user.id } },
      include: { plan: { include: { project: true } } },
    });
    if (!installment || installment.status === InstallmentStatus.PAID) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const buildCategory = await prisma.category.findFirst({
      where: { userId: user.id, name: "بناء" },
    });

    const occurredAt = body.occurredAt
      ? new Date(body.occurredAt)
      : installment.dueDate;

    const tx = await prisma.transaction.create({
      data: {
        userId: user.id,
        projectId: installment.plan.projectId,
        categoryId: buildCategory?.id,
        paymentMethodId: installment.plan.paymentMethodId,
        type: TransactionType.EXPENSE,
        amount: installment.amount,
        occurredAt,
        description: `${installment.label ?? `قسط ${installment.sequence}`} — ${installment.plan.project.title}`,
      },
    });

    const updated = await prisma.projectInstallment.update({
      where: { id },
      data: {
        status: InstallmentStatus.PAID,
        transactionId: tx.id,
      },
    });

    return NextResponse.json({ installment: updated, transaction: tx });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
