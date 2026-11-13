import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { assertOwnedRefs } from "@/lib/security/owned-refs";
import { handleApiError } from "@/lib/api-error";
import { savingsSchema } from "@/lib/validations/savings";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = savingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    await assertOwnedRefs(user.id, { employerId: data.employerId });
    const created = await prisma.savingsPlan.create({
      data: {
        userId: user.id,
        title: data.title,
        type: data.type,
        employerId: data.employerId || null,
        monthlyContribution: data.monthlyContribution,
        targetAmount: data.targetAmount ?? null,
        payoutDate: data.payoutDate ? new Date(data.payoutDate) : null,
        startDate: data.startDate ? new Date(data.startDate) : null,
        durationMonths: data.durationMonths ?? null,
        notes: data.notes || null,
        status: data.status,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
