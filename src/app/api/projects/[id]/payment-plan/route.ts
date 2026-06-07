import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { paymentPlanSchema } from "@/lib/validations/payment-plan";
import { buildInstallmentSchedule } from "@/lib/payment-plan";
import { syncProjectStatusAfterFinancialChange } from "@/lib/project-completion";
import { PaymentPlanMode } from "@/generated/prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: projectId } = await params;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = paymentPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const recurring =
      data.mode === PaymentPlanMode.INSTALLMENTS && data.installmentCount
        ? Math.round(
            ((data.totalAmount - (data.firstPaymentAmount ?? 0)) /
              (data.installmentCount - 1)) *
              100
          ) / 100
        : null;

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const schedule = buildInstallmentSchedule({
      mode: data.mode as PaymentPlanMode,
      totalAmount: data.totalAmount,
      installmentCount: data.installmentCount,
      firstPaymentAmount: data.firstPaymentAmount,
      startDate,
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { totalBudget: data.totalAmount },
    });

    const plan = await prisma.projectPaymentPlan.create({
      data: {
        userId: user.id,
        projectId,
        title: data.title || null,
        mode: data.mode as PaymentPlanMode,
        totalAmount: data.totalAmount,
        installmentCount: data.installmentCount ?? null,
        firstPaymentAmount: data.firstPaymentAmount ?? null,
        recurringAmount: recurring,
        payeeName: data.payeeName || null,
        startDate: startDate,
        paymentMethodId: data.paymentMethodId || null,
        installments: {
          create: schedule.map((s) => ({
            sequence: s.sequence,
            label: s.label,
            dueDate: s.dueDate,
            amount: s.amount,
            status: s.status,
          })),
        },
      },
      include: { installments: true },
    });

    await syncProjectStatusAfterFinancialChange(projectId, prisma, {
      totalBudget: data.totalAmount,
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: projectId } = await params;
    const plans = await prisma.projectPaymentPlan.findMany({
      where: { projectId, userId: user.id },
      include: { installments: { orderBy: { sequence: "asc" } }, paymentMethod: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(plans);
  } catch (error) {
    return handleApiError(error);
  }
}
