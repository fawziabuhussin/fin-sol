import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-error";
import { seedWeddingVendors } from "@/lib/wedding-vendors";
import { isTopLevelMaster } from "@/lib/project-tree";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const project = await prisma.project.findFirst({
      where: { id, userId: user.id },
      select: { id: true, parentProjectId: true },
    });
    if (!project || !isTopLevelMaster(project)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await seedWeddingVendors(user.id, project.id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
