import { z } from "zod";

export const salarySchema = z.object({
  employerId: z.string().min(1),
  periodYear: z.coerce.number().int().min(2020).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  worked: z.coerce.boolean().optional(),
  gross: z.coerce.number().min(0),
  net: z.coerce.number().min(0),
  tax: z.coerce.number().min(0),
  pension: z.coerce.number().min(0),
  kerenHishtalmut: z.coerce.number().min(0),
  fees: z.coerce.number().min(0).optional(),
  bonus: z.coerce.number().min(0).optional(),
  paid: z.coerce.boolean().optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
  slipFileUrl: z.string().optional().or(z.literal("")),
});

export type SalaryInput = z.infer<typeof salarySchema>;

export const salaryPatchSchema = salarySchema.partial();

export const employerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.string().max(120).optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  startDate: z.string().optional().or(z.literal("")),
  active: z.coerce.boolean().optional(),
  baseGross: z.coerce.number().min(0).optional(),
  baseNet: z.coerce.number().min(0).optional(),
  baseTax: z.coerce.number().min(0).optional(),
  basePension: z.coerce.number().min(0).optional(),
  baseKeren: z.coerce.number().min(0).optional(),
});

export type EmployerInput = z.infer<typeof employerSchema>;

export const employerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  role: z.string().max(120).optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
});
