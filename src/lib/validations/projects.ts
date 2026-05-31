import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().max(500).optional().or(z.literal("")),
  totalBudget: z.coerce.number().positive().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const projectPatchSchema = projectSchema.partial();
