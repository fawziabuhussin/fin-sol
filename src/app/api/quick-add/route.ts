import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { transactionSchema } from "@/lib/validations/transactions";
import { projectSchema } from "@/lib/validations/projects";

const quickAddSchema = {
  TRANSACTION: transactionSchema,
  PROJECT: projectSchema,
} as const;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json()) as { kind?: keyof typeof quickAddSchema; payload?: unknown };

    if (!body.kind || !(body.kind in quickAddSchema)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }

    if (body.kind === "TRANSACTION") {
      const parsed = quickAddSchema.TRANSACTION.safeParse(body.payload);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const d = parsed.data;
      const item = await prisma.transaction.create({
        data: {
          userId: user.id,
          type: d.type,
          amount: d.amount,
          occurredAt: new Date(d.occurredAt),
          description: d.description || null,
          notes: d.notes || null,
          projectId: d.projectId || null,
          categoryId: d.categoryId || null,
          payeeId: d.payeeId || null,
          paymentMethodId: d.paymentMethodId || null,
          currency: d.currency || "ILS",
        },
      });
      return NextResponse.json(item, { status: 201 });
    }

    const parsed = quickAddSchema.PROJECT.safeParse(body.payload);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const d = parsed.data;
    const item = await prisma.project.create({
      data: {
        userId: user.id,
        title: d.title,
        description: d.description || null,
        totalBudget: d.totalBudget ?? null,
        targetDate: d.targetDate ? new Date(d.targetDate) : null,
        status: d.status,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
