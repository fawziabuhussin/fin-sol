import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { ensureBuildCategoryId } from "@/lib/build-category";
import { installmentEditSchema } from "@/lib/validations/payment-plan";
import { InstallmentStatus, TransactionType } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const parsed = installmentEditSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const installment = await prisma.projectInstallment.findFirst({
      where: { id, plan: { userId: user.id } },
      include: { plan: { include: { project: true } } },
    });
    if (!installment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Field edits (amount / dueDate / label / notes)
    const data: Prisma.ProjectInstallmentUpdateInput = {};
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.dueDate !== undefined) data.dueDate = new Date(body.dueDate);
    if (body.label !== undefined) data.label = body.label || null;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const newAmount = body.amount ?? Number(installment.amount);
    const wasPaid = installment.status === InstallmentStatus.PAID;

    // Paid state transitions
    if (body.paid === true && !wasPaid) {
      const categoryId = await ensureBuildCategoryId(user.id);
      const occurredAt = body.occurredAt
        ? new Date(body.occurredAt)
        : (body.dueDate ? new Date(body.dueDate) : installment.dueDate);
      const payee = installment.plan.payeeName;
      const label = body.label ?? installment.label ?? `قسط ${installment.sequence}`;

      const tx = await prisma.transaction.create({
        data: {
          userId: user.id,
          projectId: installment.plan.projectId,
          categoryId,
          paymentMethodId: installment.plan.paymentMethodId,
          type: TransactionType.EXPENSE,
          amount: newAmount,
          occurredAt,
          description: `${label} — ${payee ?? installment.plan.project.title}`,
        },
      });
      data.status = InstallmentStatus.PAID;
      data.transaction = { connect: { id: tx.id } };
    } else if (body.paid === false && wasPaid) {
      if (installment.transactionId) {
        await prisma.transaction
          .delete({ where: { id: installment.transactionId } })
          .catch(() => null);
      }
      data.status = InstallmentStatus.PENDING;
      data.transaction = { disconnect: true };
    } else if (wasPaid && installment.transactionId && body.amount !== undefined) {
      // Keep the linked building-outcome transaction in sync with edited amount
      await prisma.transaction.update({
        where: { id: installment.transactionId },
        data: { amount: newAmount },
      });
    }

    const updated = await prisma.projectInstallment.update({ where: { id }, data });
    return NextResponse.json({ installment: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const installment = await prisma.projectInstallment.findFirst({
      where: { id, plan: { userId: user.id } },
    });
    if (!installment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (installment.transactionId) {
      await prisma.transaction
        .delete({ where: { id: installment.transactionId } })
        .catch(() => null);
    }
    await prisma.projectInstallment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
