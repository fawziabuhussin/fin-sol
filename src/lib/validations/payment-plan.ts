import { z } from "zod";
import { recurringFromSplit } from "@/lib/payment-plan";

export const paymentPlanSchema = z
  .object({
    title: z.string().max(120).optional().or(z.literal("")),
    mode: z.enum(["FULL", "INSTALLMENTS"]),
    totalAmount: z.coerce.number().positive(),
    installmentCount: z.coerce.number().int().min(1).max(24).optional(),
    firstPaymentAmount: z.coerce.number().min(0).optional(),
    payeeName: z.string().max(120).optional().or(z.literal("")),
    paymentMethodId: z.string().optional().or(z.literal("")),
    categoryId: z.string().optional().or(z.literal("")),
    startDate: z.string().optional(),
    payFirstNow: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "INSTALLMENTS") {
      if (!data.installmentCount || data.installmentCount < 1) {
        ctx.addIssue({
          code: "custom",
          message: "عدد الأقساط مطلوب (1–24)",
          path: ["installmentCount"],
        });
      }
    }
  });

export type PaymentPlanInput = z.infer<typeof paymentPlanSchema>;

export const installmentEditSchema = z.object({
  paid: z.boolean().optional(),
  occurredAt: z.string().optional(),
  amount: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional(),
  label: z.string().max(120).optional(),
  notes: z.string().max(300).optional().or(z.literal("")),
});

export const installmentCreateSchema = z.object({
  label: z.string().max(120).optional().or(z.literal("")),
  dueDate: z.string().min(1),
  amount: z.coerce.number().min(0),
  notes: z.string().max(300).optional().or(z.literal("")),
});

export const planEditSchema = z.object({
  title: z.string().max(120).optional().or(z.literal("")),
  payeeName: z.string().max(120).optional().or(z.literal("")),
  paymentMethodId: z.string().optional().or(z.literal("")),
  categoryId: z.string().optional().or(z.literal("")),
  startDate: z.string().optional(),
  mode: z.enum(["FULL", "INSTALLMENTS"]).optional(),
  totalAmount: z.coerce.number().positive().optional(),
  installmentCount: z.coerce.number().int().min(1).max(24).optional(),
  firstPaymentAmount: z.coerce.number().min(0).optional(),
});

export const expenseInstallmentSchema = z.object({
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  occurredAt: z.string().min(1, "التاريخ مطلوب"),
  description: z.string().max(200).optional().or(z.literal("")),
  installmentCount: z.coerce.number().int().min(1).max(24),
  downPayment: z.coerce.number().min(0).optional().nullable(),
  payDownPaymentNow: z.boolean().optional(),
  categoryId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
});

export type ExpenseInstallmentInput = z.infer<typeof expenseInstallmentSchema>;

export function calcRecurringInstallment(
  total: number,
  first: number,
  count: number
) {
  return recurringFromSplit(total, count, first) ?? 0;
}
