import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER", "SAVINGS_CONTRIBUTION"]),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  occurredAt: z.string().min(1, "التاريخ مطلوب"),
  description: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  projectId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  payeeId: z.string().optional().nullable(),
  paymentMethodId: z.string().optional().nullable(),
  currency: z.string().default("ILS"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

/** Partial update — used for quick category assignment from dashboard */
export const transactionPatchSchema = transactionSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "لا توجد حقول للتحديث" }
);

export const transactionCategorizeSchema = z.object({
  categoryId: z.string().min(1, "الفئة مطلوبة"),
});
