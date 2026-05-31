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
