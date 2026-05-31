import { PaymentPlanMode, InstallmentStatus } from "@/generated/prisma/client";

const INSTALLMENT_LABELS = [
  "الدفعة الأولى",
  "الدفعة الثانية",
  "الدفعة الثالثة",
  "الدفعة الرابعة",
  "الدفعة الخامسة",
  "الدفعة السادسة",
  "الدفعة السابعة",
  "الدفعة الثامنة",
  "الدفعة التاسعة",
  "الدفعة العاشرة",
];

export function installmentLabel(sequence: number): string {
  return INSTALLMENT_LABELS[sequence - 1] ?? `الدفعة ${sequence}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Adds `months` to a date while keeping the same day-of-month, clamping to the
 * last valid day (so a start on the 31st doesn't roll over into the next month).
 */
export function addMonthsUTC(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function buildInstallmentSchedule(params: {
  mode: PaymentPlanMode;
  totalAmount: number;
  installmentCount?: number;
  firstPaymentAmount?: number;
  startDate: Date;
  dueDates?: Date[];
  recurringAmount?: number;
}) {
  if (params.mode === PaymentPlanMode.FULL) {
    return [
      {
        sequence: 1,
        label: installmentLabel(1),
        dueDate: params.startDate,
        amount: params.totalAmount,
        status: InstallmentStatus.PENDING,
      },
    ];
  }

  const count = Math.max(2, params.installmentCount ?? 2);
  const first = round2(params.firstPaymentAmount ?? 0);
  const recurringCount = count - 1;
  const remaining = Math.max(0, round2(params.totalAmount - first));

  // Even split of the remainder across the recurring installments; any rounding
  // drift is absorbed by the last installment so the schedule sums to the total.
  const baseRecurring =
    params.recurringAmount != null
      ? round2(params.recurringAmount)
      : round2(remaining / recurringCount);

  const schedule: {
    sequence: number;
    label: string;
    dueDate: Date;
    amount: number;
    status: typeof InstallmentStatus.PENDING;
  }[] = [];

  // 1) First payment (down payment) on the start point.
  schedule.push({
    sequence: 1,
    label: installmentLabel(1),
    dueDate: params.dueDates?.[0] ?? params.startDate,
    amount: first,
    status: InstallmentStatus.PENDING,
  });

  // 2) Remaining installments, one per month starting the month after the start.
  let allocated = 0;
  for (let i = 1; i <= recurringCount; i++) {
    const isLast = i === recurringCount;
    const amount = isLast ? round2(remaining - allocated) : baseRecurring;
    allocated = round2(allocated + baseRecurring);
    schedule.push({
      sequence: i + 1,
      label: installmentLabel(i + 1),
      dueDate: params.dueDates?.[i] ?? addMonthsUTC(params.startDate, i),
      amount,
      status: InstallmentStatus.PENDING,
    });
  }

  return schedule;
}
