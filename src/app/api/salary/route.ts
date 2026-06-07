import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { salarySchema } from "@/lib/validations/salary";
import { syncSalarySlipIncome } from "@/lib/salary-income-sync";
import { resolveEmployerPaidSlip } from "@/lib/employer-paid-slip";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = salarySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const employer = await prisma.employer.findFirst({
      where: { id: data.employerId, userId: user.id },
    });
    if (!employer) {
      return NextResponse.json({ error: "Employer not found" }, { status: 404 });
    }

    let slip = { ...data };
    if (data.paid) {
      const template = resolveEmployerPaidSlip(
        employer.name,
        data.periodYear,
        data.periodMonth
      );
      if (template) {
        slip = {
          ...data,
          worked: true,
          paid: true,
          gross: template.gross,
          net: template.net,
          tax: template.tax,
          pension: template.pension,
          kerenHishtalmut: template.kerenHishtalmut,
          fees: template.fees,
          bonus: template.bonus,
          notes: template.notes,
          slipBreakdown: template.slipBreakdown,
        };
      }
    }

    const created = await prisma.salarySlip.upsert({
      where: {
        userId_employerId_periodYear_periodMonth: {
          userId: user.id,
          employerId: data.employerId,
          periodYear: data.periodYear,
          periodMonth: data.periodMonth,
        },
      },
      create: {
        userId: user.id,
        employerId: data.employerId,
        periodYear: slip.periodYear,
        periodMonth: slip.periodMonth,
        worked: slip.worked ?? true,
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: slip.fees ?? 0,
        bonus: slip.bonus ?? 0,
        paid: slip.paid ?? false,
        paidAt: slip.paid ? new Date() : null,
        notes: slip.notes || null,
        slipFileUrl: slip.slipFileUrl || null,
        slipBreakdown: slip.slipBreakdown ?? undefined,
      },
      update: {
        ...(slip.worked !== undefined ? { worked: slip.worked } : {}),
        ...(slip.paid !== undefined
          ? { paid: slip.paid, paidAt: slip.paid ? new Date() : null }
          : {}),
        gross: slip.gross,
        net: slip.net,
        tax: slip.tax,
        pension: slip.pension,
        kerenHishtalmut: slip.kerenHishtalmut,
        fees: slip.fees ?? 0,
        bonus: slip.bonus ?? 0,
        notes: slip.notes || null,
        slipFileUrl: slip.slipFileUrl || null,
        ...(slip.slipBreakdown !== undefined
          ? { slipBreakdown: slip.slipBreakdown }
          : {}),
      },
    });

    await syncSalarySlipIncome(created.id);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
