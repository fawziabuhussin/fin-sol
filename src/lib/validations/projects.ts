import { z } from "zod";

const projectFieldsSchema = z.object({
  title: z.string().min(2, "العنوان مطلوب"),
  description: z.string().max(500).optional().or(z.literal("")),
  profession: z.string().max(80).optional().or(z.literal("")),
  totalBudget: z.coerce.number().positive().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
});

export const projectSchema = projectFieldsSchema.extend({
  parentProjectId: z.string().optional().or(z.literal("")),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const projectPatchSchema = projectFieldsSchema.partial();
