import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { paymentPlanSchema } from "@/lib/validations/payment-plan";
import {
  buildInstallmentSchedule,
  normalizeDownPayment,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { markInstallmentPaid } from "@/lib/installment-transactions";
import { syncProjectStatusAfterFinancialChange } from "@/lib/project-completion";
import { PaymentPlanMode, ProjectKind } from "@/generated/prisma/client";
import {
  childKindForParent,
  childTitleFromPaymentPlan,
  isTopLevelMaster,
} from "@/lib/project-tree";

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
    let targetProjectId = projectId;

    // Payment plans belong on nested items, not the container (like Building).
    if (isTopLevelMaster(project) && project.kind === ProjectKind.GENERAL) {
      const child = await prisma.project.create({
        data: {
          userId: user.id,
          parentProjectId: project.id,
          kind: childKindForParent(),
          title: childTitleFromPaymentPlan(data, project.title),
          totalBudget: data.totalAmount,
          status: project.status,
          targetDate: project.targetDate,
        },
      });
      targetProjectId = child.id;
    }

    const downPayment = normalizeDownPayment(data.firstPaymentAmount);
    const recurring =
      data.mode === PaymentPlanMode.INSTALLMENTS
        ? recurringFromSplit(
            data.totalAmount,
            data.installmentCount ?? 1,
            downPayment
          )
        : null;

    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const schedule = buildInstallmentSchedule({
      mode: data.mode as PaymentPlanMode,
      totalAmount: data.totalAmount,
      installmentCount: data.installmentCount,
      firstPaymentAmount: downPayment,
      startDate,
    });

    await prisma.project.update({
      where: { id: targetProjectId },
      data: { totalBudget: data.totalAmount },
    });

    const plan = await prisma.projectPaymentPlan.create({
      data: {
        userId: user.id,
        projectId: targetProjectId,
        title: data.title || null,
        mode: data.mode as PaymentPlanMode,
        totalAmount: data.totalAmount,
        installmentCount: data.installmentCount ?? null,
        firstPaymentAmount: downPayment,
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
      include: { installments: { orderBy: { sequence: "asc" } } },
    });

    if (data.payFirstNow && plan.installments[0]) {
      await markInstallmentPaid({
        userId: user.id,
        installmentId: plan.installments[0].id,
        occurredAt: startDate,
        categoryId: data.categoryId,
        paymentMethodId: data.paymentMethodId,
      });
    }

    await syncProjectStatusAfterFinancialChange(targetProjectId, prisma, {
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
