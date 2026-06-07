import { z } from "zod";

export const paymentPlanSchema = z
  .object({
    title: z.string().max(120).optional().or(z.literal("")),
    mode: z.enum(["FULL", "INSTALLMENTS"]),
    totalAmount: z.coerce.number().positive(),
    installmentCount: z.coerce.number().int().min(2).optional(),
    firstPaymentAmount: z.coerce.number().min(0).optional(),
    payeeName: z.string().max(120).optional().or(z.literal("")),
    paymentMethodId: z.string().optional().or(z.literal("")),
    startDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "INSTALLMENTS") {
      if (!data.installmentCount || data.installmentCount < 2) {
        ctx.addIssue({
          code: "custom",
          message: "عدد الأقساط مطلوب",
          path: ["installmentCount"],
        });
      }
      if (data.firstPaymentAmount == null) {
        ctx.addIssue({
          code: "custom",
          message: "الدفعة الأولى مطلوبة",
          path: ["firstPaymentAmount"],
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
  startDate: z.string().optional(),
  mode: z.enum(["FULL", "INSTALLMENTS"]).optional(),
  totalAmount: z.coerce.number().positive().optional(),
  installmentCount: z.coerce.number().int().min(2).optional(),
  firstPaymentAmount: z.coerce.number().min(0).optional(),
});

export function calcRecurringInstallment(
  total: number,
  first: number,
  count: number
) {
  if (count <= 1) return 0;
  return (total - first) / (count - 1);
}
