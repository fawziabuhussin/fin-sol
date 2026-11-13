import { prisma } from "@/lib/db";
import type { ProjectInput } from "@/lib/validations/projects";
import { ProjectKind } from "@/generated/prisma/client";

/** A project is a container dashboard iff it has no parent — same as Building. */
export const topLevelProjectWhere = {
  parentProjectId: null,
};

export function isTopLevelMaster(project: {
  kind?: string;
  parentProjectId?: string | null;
}) {
  return !project.parentProjectId;
}

export function childKindForParent() {
  return ProjectKind.BUILD_CONTRACTOR;
}

export function childTitleFromPaymentPlan(
  plan: { title?: string | null; payeeName?: string | null },
  masterTitle: string
) {
  const title = plan.title?.trim();
  if (title) return title;
  const payee = plan.payeeName?.trim();
  if (payee && payee !== masterTitle.trim()) return payee;
  return "بند";
}

export class ParentProjectNotFoundError extends Error {
  constructor() {
    super("PARENT_NOT_FOUND");
    this.name = "ParentProjectNotFoundError";
  }
}

export async function createUserProject(userId: string, data: ProjectInput) {
  let kind: ProjectKind = ProjectKind.GENERAL;
  let parentProjectId: string | null = null;

  if (data.parentProjectId) {
    const parent = await prisma.project.findFirst({
      where: {
        id: data.parentProjectId,
        userId,
        ...topLevelProjectWhere,
      },
      select: { id: true, kind: true },
    });
    if (!parent) throw new ParentProjectNotFoundError();
    parentProjectId = parent.id;
    kind = childKindForParent();
  }

  return prisma.project.create({
    data: {
      userId,
      parentProjectId,
      kind,
      title: data.title,
      profession: data.profession || null,
      description: data.description || null,
      totalBudget: data.totalBudget ?? null,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      status: data.status,
      imageUrl: parentProjectId ? null : "/placeholders/banner.svg",
    },
  });
}

/**
 * Leaf "mini-projects" used to be created as a single GENERAL project with a
 * payment plan on it. Container projects (like Building) keep plans on children.
 * Move leftover plans on a GENERAL master into nested items so العرس/DJ etc.
 * show up as items inside the project.
 */
export async function promoteMasterPaymentPlansToChildren(
  userId: string,
  masterId: string
) {
  const master = await prisma.project.findFirst({
    where: { id: masterId, userId, ...topLevelProjectWhere },
    select: {
      id: true,
      kind: true,
      title: true,
      status: true,
      targetDate: true,
      paymentPlans: {
        select: {
          id: true,
          title: true,
          payeeName: true,
          totalAmount: true,
          installments: { select: { transactionId: true } },
        },
      },
    },
  });

  if (!master || master.kind === ProjectKind.MASTER_BUILD) return;
  if (master.paymentPlans.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const plan of master.paymentPlans) {
      const child = await tx.project.create({
        data: {
          userId,
          parentProjectId: master.id,
          kind: childKindForParent(),
          title: childTitleFromPaymentPlan(plan, master.title),
          totalBudget: plan.totalAmount,
          status: master.status,
          targetDate: master.targetDate,
        },
      });

      await tx.projectPaymentPlan.update({
        where: { id: plan.id },
        data: { projectId: child.id },
      });

      const txIds = plan.installments
        .map((inst) => inst.transactionId)
        .filter((id): id is string => Boolean(id));
      if (txIds.length > 0) {
        await tx.transaction.updateMany({
          where: { id: { in: txIds }, userId },
          data: { projectId: child.id },
        });
      }
    }
  });
}

export function masterBudgetFromChildren(
  declaredBudget: number,
  childrenBudgets: number[]
) {
  const childrenSum = childrenBudgets.reduce((sum, n) => sum + n, 0);
  if (declaredBudget > 0) return Math.max(declaredBudget, childrenSum);
  return childrenSum;
}
