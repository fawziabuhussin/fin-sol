import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { salarySchema } from "@/lib/validations/salary";

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
        periodYear: data.periodYear,
        periodMonth: data.periodMonth,
        worked: data.worked ?? true,
        gross: data.gross,
        net: data.net,
        tax: data.tax,
        pension: data.pension,
        kerenHishtalmut: data.kerenHishtalmut,
        fees: data.fees ?? 0,
        bonus: data.bonus ?? 0,
        paid: data.paid ?? false,
        paidAt: data.paid ? new Date() : null,
        notes: data.notes || null,
        slipFileUrl: data.slipFileUrl || null,
      },
      update: {
        ...(data.worked !== undefined ? { worked: data.worked } : {}),
        ...(data.paid !== undefined
          ? { paid: data.paid, paidAt: data.paid ? new Date() : null }
          : {}),
        gross: data.gross,
        net: data.net,
        tax: data.tax,
        pension: data.pension,
        kerenHishtalmut: data.kerenHishtalmut,
        fees: data.fees ?? 0,
        bonus: data.bonus ?? 0,
        notes: data.notes || null,
        slipFileUrl: data.slipFileUrl || null,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
