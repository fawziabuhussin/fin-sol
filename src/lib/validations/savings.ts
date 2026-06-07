import { z } from "zod";

export const savingsSchema = z.object({
  title: z.string().min(1).max(120),
  type: z.enum(["JAMIYA", "PERSONAL", "KUPOT"]),
  employerId: z.string().optional().or(z.literal("")),
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
  /** ISO date; defaults to last day of period month when marking paid */
  paidAt: z.string().optional().or(z.literal("")),
  notes: z.string().max(300).optional().or(z.literal("")),
});

/** Mark multiple schedule months paid in one request (e.g. one transfer covering several months). */
export const savingsBulkEntrySchema = z.object({
  startPeriodYear: z.coerce.number().int().min(2020).max(2100),
  startPeriodMonth: z.coerce.number().int().min(1).max(12),
  totalPaid: z.coerce.number().positive(),
  monthlyAmount: z.coerce.number().positive().optional(),
});

export type SavingsEntryInput = z.infer<typeof savingsEntrySchema>;

export const savingsAssetSchema = z.object({
  kind: z.enum(["GOLD", "USD"]),
  title: z.string().min(1).max(120),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  goldKarat: z.coerce.number().int().min(14).max(24).optional(),
  priceCurrency: z.enum(["ILS", "USD"]).default("ILS"),
  notes: z.string().max(300).optional().or(z.literal("")),
});

export const savingsAssetPatchSchema = savingsAssetSchema.partial();

export type SavingsAssetInput = z.infer<typeof savingsAssetSchema>;

export const savingsAssetPurchaseSchema = z
  .object({
    kind: z.enum(["GOLD", "USD"]),
    quantity: z.coerce.number().positive(),
    unitPrice: z.coerce.number().min(0).optional(),
    goldKarat: z.coerce.number().int().min(14).max(24).optional(),
    purchasedAt: z.string().min(1),
    notes: z.string().max(300).optional().or(z.literal("")),
    title: z.string().max(120).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (
      data.kind === "GOLD" &&
      (data.unitPrice === undefined || data.unitPrice <= 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gold requires unit price",
        path: ["unitPrice"],
      });
    }
  });
