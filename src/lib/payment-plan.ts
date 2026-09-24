import { PaymentPlanMode, InstallmentStatus } from "@/generated/prisma/enums";

export const DOWN_PAYMENT_LABEL = "מקדימה / مقدّمة";

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
  "الدفعة الحادية عشر",
  "الدفعة الثانية عشر",
];

export function installmentLabel(sequence: number): string {
  return INSTALLMENT_LABELS[sequence - 1] ?? `الدفعة ${sequence}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function clampInstallmentCount(count?: number) {
  const n = Math.trunc(count ?? 1);
  return Math.min(24, Math.max(1, n));
}

/** Treat 0 / empty as “no מקדימה” so the total is split evenly. */
export function normalizeDownPayment(amount?: number | null) {
  if (amount == null || Number.isNaN(amount) || amount <= 0) return null;
  return round2(amount);
}

/**
 * Split `totalAmount` into `installmentCount` (1–24) monthly amounts.
 * If `firstPaymentAmount` is set, that is the מקדימה / مقدّمة and the rest
 * is split across the remaining months. Otherwise every month is even.
 */
export function resolveInstallmentAmounts(
  totalAmount: number,
  installmentCount: number,
  firstPaymentAmount?: number | null
): number[] {
  const count = clampInstallmentCount(installmentCount);
  const total = round2(totalAmount);
  if (count === 1) return [total];

  const even = round2(total / count);
  const firstSpecified = normalizeDownPayment(firstPaymentAmount) != null;
  const first = firstSpecified ? round2(firstPaymentAmount!) : even;
  const remaining = Math.max(0, round2(total - first));
  const recurringCount = count - 1;
  const base = round2(remaining / recurringCount);
  const amounts = [first];
  let allocated = 0;
  for (let i = 1; i <= recurringCount; i++) {
    const isLast = i === recurringCount;
    const amount = isLast ? round2(remaining - allocated) : base;
    allocated = round2(allocated + base);
    amounts.push(amount);
  }
  return amounts;
}

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
  firstPaymentAmount?: number | null;
  startDate: Date;
  dueDates?: Date[];
  recurringAmount?: number;
}) {
  const count =
    params.mode === PaymentPlanMode.FULL
      ? 1
      : clampInstallmentCount(params.installmentCount);
  const down =
    params.mode === PaymentPlanMode.FULL
      ? null
      : normalizeDownPayment(params.firstPaymentAmount);
  const amounts = resolveInstallmentAmounts(params.totalAmount, count, down);
  const explicitDown = down != null;

  return amounts.map((amount, i) => ({
    sequence: i + 1,
    label:
      i === 0 && explicitDown ? DOWN_PAYMENT_LABEL : installmentLabel(i + 1),
    dueDate: params.dueDates?.[i] ?? (i === 0 ? params.startDate : addMonthsUTC(params.startDate, i)),
    amount,
    status: InstallmentStatus.PENDING,
  }));
}

/** Due date for installment `sequence` (1-based) from the plan start point. */
export function dueDateForSequence(startDate: Date, sequence: number): Date {
  if (sequence <= 1) return startDate;
  return addMonthsUTC(startDate, sequence - 1);
}

/** Map sequence → amount for an installment plan. */
export function amountsBySequence(
  totalAmount: number,
  firstPaymentAmount: number | null | undefined,
  installmentCount: number
): Map<number, number> {
  const amounts = resolveInstallmentAmounts(
    totalAmount,
    installmentCount,
    normalizeDownPayment(firstPaymentAmount)
  );
  return new Map(amounts.map((amount, i) => [i + 1, amount]));
}

/** Monthly amount after the מקדימה (or the even monthly amount). */
export function recurringFromSplit(
  totalAmount: number,
  installmentCount: number,
  firstPaymentAmount?: number | null
) {
  const count = clampInstallmentCount(installmentCount);
  if (count <= 1) return null;
  const amounts = resolveInstallmentAmounts(
    totalAmount,
    count,
    firstPaymentAmount
  );
  return amounts[1] ?? null;
}
