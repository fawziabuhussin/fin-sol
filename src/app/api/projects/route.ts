import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { projectSchema } from "@/lib/validations/projects";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const created = await prisma.project.create({
      data: {
        userId: user.id,
        title: data.title,
        description: data.description || null,
        totalBudget: data.totalBudget ?? null,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        status: data.status,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
