import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { savingsEntrySchema } from "@/lib/validations/savings";

async function ownsPlan(userId: string, planId: string) {
  return prisma.savingsPlan.findFirst({ where: { id: planId, userId } });
}

// Upsert a single month entry (used for the V checkmark toggle)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id: planId } = await params;
    const plan = await ownsPlan(user.id, planId);
    if (!plan) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = savingsEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    const paid = d.paid ?? false;

    const entry = await prisma.savingsEntry.upsert({
      where: {
        planId_periodYear_periodMonth: {
          planId,
          periodYear: d.periodYear,
          periodMonth: d.periodMonth,
        },
      },
      create: {
        planId,
        periodYear: d.periodYear,
        periodMonth: d.periodMonth,
        amount: d.amount,
        paid,
        isPayout: d.isPayout ?? false,
        paidAt: paid ? new Date() : null,
        notes: d.notes || null,
      },
      update: {
        amount: d.amount,
        paid,
        ...(d.isPayout !== undefined ? { isPayout: d.isPayout } : {}),
        paidAt: paid ? new Date() : null,
        ...(d.notes !== undefined ? { notes: d.notes || null } : {}),
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    return handleApiError(error);
  }
}
