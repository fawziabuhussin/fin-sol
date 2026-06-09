import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { syncLinkedInstallmentTransaction } from "@/lib/installment-transactions";
import { transactionSchema } from "@/lib/validations/transactions";
import { InstallmentStatus } from "@/generated/prisma/client";

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

    const linkedAssetEntry = await prisma.savingsAssetEntry.findFirst({
      where: { transactionId: id },
    });
    if (linkedAssetEntry) {
      return NextResponse.json(
        {
          error: "ASSET_LINKED",
          message: "هذه المعاملة مرتبطة بشراء أو سحب أصول — عدّلها من صفحة الادخار",
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

    const linkedInstallment = await prisma.projectInstallment.findFirst({
      where: { transactionId: id },
      include: { plan: { include: { project: true } } },
    });

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

    if (linkedInstallment) {
      await prisma.projectInstallment.update({
        where: { id: linkedInstallment.id },
        data: {
          amount: data.amount,
          dueDate: new Date(data.occurredAt),
        },
      });
      await syncLinkedInstallmentTransaction(linkedInstallment, {
        amount: data.amount,
        dueDate: new Date(data.occurredAt),
        notes: data.notes ?? undefined,
        occurredAt: new Date(data.occurredAt),
      });
    }

    return NextResponse.json(updated);
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

    const linkedAssetEntry = await prisma.savingsAssetEntry.findFirst({
      where: { transactionId: id },
    });
    if (linkedAssetEntry) {
      return NextResponse.json(
        {
          error: "ASSET_LINKED",
          message: "لا يمكن حذف شراء أو سحب أصول من هنا — عدّله من صفحة الادخار",
        },
        { status: 403 }
      );
    }

    const linkedInstallment = await prisma.projectInstallment.findFirst({
      where: { transactionId: id },
    });

    if (linkedInstallment) {
      await prisma.projectInstallment.update({
        where: { id: linkedInstallment.id },
        data: {
          status: InstallmentStatus.PENDING,
          transactionId: null,
        },
      });
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
