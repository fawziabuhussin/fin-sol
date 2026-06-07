import { z } from "zod";

export const subscriptionSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  billingDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  categoryId: z.string().optional().or(z.literal("")),
  paymentMethodId: z.string().optional().or(z.literal("")),
  notes: z.string().max(300).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const subscriptionPatchSchema = subscriptionSchema.partial();

export const subscriptionPaymentSchema = z.object({
  periodYear: z.coerce.number().int().min(2020).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0).optional(),
  paid: z.coerce.boolean().optional(),
  paidAt: z.string().optional().or(z.literal("")),
});

export type SubscriptionInput = z.infer<typeof subscriptionSchema>;
