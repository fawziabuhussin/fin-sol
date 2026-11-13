import { prisma } from "@/lib/db";
import {
  buildInstallmentSchedule,
  recurringFromSplit,
} from "@/lib/payment-plan";
import { markInstallmentPaid } from "@/lib/installment-transactions";
import { localTodayIso } from "@/lib/dates";
import { isWeddingProjectTitle } from "@/lib/wedding-title";
import {
  PaymentPlanMode,
  ProjectKind,
  ProjectStatus,
  CategoryKind,
} from "@/generated/prisma/client";

export { isWeddingProjectTitle } from "@/lib/wedding-title";
export const ARABON_LABEL = "عربون";

/** Next calendar May after `from` (May this year if still before May). */
export function nextMayUtc(from: Date) {
  const year =
    from.getUTCMonth() > 4 ? from.getUTCFullYear() + 1 : from.getUTCFullYear();
  return new Date(Date.UTC(year, 4, 1));
}

export const WEDDING_VENDORS = [
  {
    title: "مصورة",
    profession: "مصورة",
    total: 6500,
    arabon: 500,
    arabonPaid: true,
  },
  {
    title: "مصور",
    profession: "مصور",
    total: 2800,
    arabon: null,
    arabonPaid: false,
  },
  {
    title: "منسقة أصوات DJ",
    profession: "DJ",
    total: 4000,
    arabon: 500,
    arabonPaid: true,
  },
  {
    title: "القاعة",
    profession: "قاعة",
    total: 12000,
    arabon: null,
    arabonPaid: false,
  },
  {
    title: "الطباخ",
    profession: "طباخ",
    total: 8500,
    arabon: null,
    arabonPaid: false,
  },
  {
    title: "مكاتيب مطبعة الفاتح",
    profession: "مطبعة",
    total: 1000,
    arabon: null,
    arabonPaid: false,
  },
] as const;

function utcDateFromIso(iso: string) {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

export async function seedWeddingVendorsIfEmpty(
  userId: string,
  masterId: string
) {
  const master = await prisma.project.findFirst({
    where: { id: masterId, userId, parentProjectId: null },
    select: {
      id: true,
      title: true,
      _count: { select: { children: true } },
    },
  });
  if (!master || !isWeddingProjectTitle(master.title)) {
    return { seeded: 0 };
  }
  if (master._count.children > 0) {
    return { seeded: 0 };
  }
  return seedWeddingVendors(userId, master.id);
}

export async function seedWeddingVendors(userId: string, masterId: string) {
  const today = utcDateFromIso(localTodayIso());
  const remainderDate = nextMayUtc(today);
  const remainderLabel = `المتبقي — أيار ${remainderDate.getUTCFullYear()}`;
  const category = await prisma.category.findFirst({
    where: {
      userId,
      kind: CategoryKind.EXPENSE,
      isActive: true,
      name: { in: ["عرس", "أخرى"] },
    },
    select: { id: true },
  });
  let seeded = 0;

  for (const vendor of WEDDING_VENDORS) {
    try {
      const existing = await prisma.project.findFirst({
        where: { userId, parentProjectId: masterId, title: vendor.title },
        select: { id: true },
      });
      if (existing) continue;

    const hasArabon = vendor.arabon != null && vendor.arabon > 0;
    const child = await prisma.project.create({
      data: {
        userId,
        parentProjectId: masterId,
        kind: ProjectKind.BUILD_CONTRACTOR,
        title: vendor.title,
        profession: vendor.profession,
        totalBudget: vendor.total,
        targetDate: remainderDate,
        status: vendor.arabonPaid
          ? ProjectStatus.ACTIVE
          : ProjectStatus.PLANNED,
      },
    });

    const count = hasArabon ? 2 : 1;
    const down = hasArabon ? vendor.arabon : null;
    const startDate = hasArabon ? today : remainderDate;
    const dueDates = hasArabon ? [today, remainderDate] : [remainderDate];
    const labels = hasArabon
      ? [ARABON_LABEL, remainderLabel]
      : [remainderLabel];
    const schedule = buildInstallmentSchedule({
      mode: count === 1 ? PaymentPlanMode.FULL : PaymentPlanMode.INSTALLMENTS,
      totalAmount: vendor.total,
      installmentCount: count,
      firstPaymentAmount: down,
      startDate,
      dueDates,
      labels,
      firstLabel: ARABON_LABEL,
    });

    const plan = await prisma.projectPaymentPlan.create({
      data: {
        userId,
        projectId: child.id,
        title: vendor.title,
        mode:
          count === 1 ? PaymentPlanMode.FULL : PaymentPlanMode.INSTALLMENTS,
        totalAmount: vendor.total,
        installmentCount: count,
        firstPaymentAmount: down,
        recurringAmount: recurringFromSplit(vendor.total, count, down),
        payeeName: vendor.title,
        startDate,
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

    if (vendor.arabonPaid && plan.installments[0]) {
      await markInstallmentPaid({
        userId,
        installmentId: plan.installments[0].id,
        occurredAt: today,
        categoryId: category?.id,
      });
    }

    seeded += 1;
    } catch (error) {
      console.error(`[wedding] failed to seed ${vendor.title}`, error);
    }
  }

  return { seeded };
}
