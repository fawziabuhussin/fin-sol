import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");

export const subscriptionSchema = z.object({
  title: z.string().trim().min(1, "اسم الخدمة مطلوب").max(120),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر").max(1_000_000),
  billingDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).optional(),
  billingMonth: z.coerce.number().int().min(1).max(12).optional().nullable(),
  startDate: isoDate.optional().nullable().or(z.literal("")),
  endDate: isoDate.optional().nullable().or(z.literal("")),
  categoryId: z.string().optional().nullable().or(z.literal("")),
  paymentMethodId: z.string().optional().nullable().or(z.literal("")),
  notes: z.string().max(300).optional().nullable().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const subscriptionPatchSchema = subscriptionSchema.partial();

export const subscriptionPaymentSchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0).max(1_000_000).optional(),
  paid: z.boolean().optional(),
  paidAt: isoDate.optional().or(z.literal("")),
});

export const subscriptionBulkPaymentSchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  ids: z.array(z.string().min(1)).min(1).max(200),
  paid: z.boolean(),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

/** "" / undefined / null → null; "YYYY-MM-DD" → Date (for @db.Date columns). */
export function optionalDate(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}
