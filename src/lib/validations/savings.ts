import { z } from "zod";

export const savingsSchema = z.object({
  title: z.string().min(1).max(120),
  type: z.enum(["JAMIYA", "PERSONAL"]),
  monthlyContribution: z.coerce.number().min(0),
  targetAmount: z.coerce.number().min(0).optional(),
  payoutDate: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  durationMonths: z.coerce.number().int().min(1).max(120).optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "COMPLETED", "PAUSED", "CANCELLED"]),
});

export const savingsPatchSchema = savingsSchema.partial();

export type SavingsInput = z.infer<typeof savingsSchema>;

export const savingsEntrySchema = z.object({
  periodYear: z.coerce.number().int().min(2020).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  amount: z.coerce.number().min(0),
  paid: z.coerce.boolean().optional(),
  isPayout: z.coerce.boolean().optional(),
  notes: z.string().max(300).optional().or(z.literal("")),
});

export type SavingsEntryInput = z.infer<typeof savingsEntrySchema>;

export const savingsAssetSchema = z.object({
  kind: z.enum(["GOLD", "USD"]),
  title: z.string().min(1).max(120),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  priceCurrency: z.enum(["ILS", "USD"]).default("ILS"),
  notes: z.string().max(300).optional().or(z.literal("")),
});

export const savingsAssetPatchSchema = savingsAssetSchema.partial();

export type SavingsAssetInput = z.infer<typeof savingsAssetSchema>;
