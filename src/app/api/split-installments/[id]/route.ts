import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { installmentEditSchema } from "@/lib/validations/payment-plan";
import { InstallmentStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import {
  markSplitInstallmentPaid,
  syncSplitInstallmentTransaction,
  unpaySplitInstallment,
} from "@/lib/split-payments";
import { ensureDbSchema } from "@/lib/ensure-schema";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    await ensureDbSchema();
    const { id } = await params;

    const parsed = installmentEditSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.data;

    const installment = await prisma.splitPaymentInstallment.findFirst({
      where: { id, plan: { userId: user.id } },
      include: { plan: true },
    });
    if (!installment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Prisma.SplitPaymentInstallmentUpdateInput = {};
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.dueDate !== undefined) data.dueDate = new Date(body.dueDate);
    if (body.label !== undefined) data.label = body.label || null;
    if (body.notes !== undefined) data.notes = body.notes || null;

    const wasPaid = installment.status === InstallmentStatus.PAID;

    if (body.paid === true && !wasPaid) {
      const result = await markSplitInstallmentPaid({
        userId: user.id,
        installmentId: id,
        occurredAt: body.occurredAt
          ? new Date(body.occurredAt)
          : body.dueDate
            ? new Date(body.dueDate)
            : undefined,
        notes: body.notes,
      });
      if (!result) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (Object.keys(data).length > 0) {
        await prisma.splitPaymentInstallment.update({ where: { id }, data });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.paid === false && wasPaid) {
      await unpaySplitInstallment(installment);
      if (Object.keys(data).length > 0) {
        await prisma.splitPaymentInstallment.update({ where: { id }, data });
      }
      return NextResponse.json({ ok: true });
    }

    if (wasPaid && installment.transactionId) {
      await syncSplitInstallmentTransaction(installment, {
        amount: body.amount,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        label: body.label,
        notes: body.notes,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      });
    }

    const updated = await prisma.splitPaymentInstallment.update({
      where: { id },
      data,
    });
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
    await ensureDbSchema();
    const { id } = await params;

    const installment = await prisma.splitPaymentInstallment.findFirst({
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
    await prisma.splitPaymentInstallment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
