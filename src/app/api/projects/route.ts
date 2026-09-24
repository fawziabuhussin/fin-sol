import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { projectSchema } from "@/lib/validations/projects";
import { handleApiError } from "@/lib/api-error";
import {
  createUserProject,
  ParentProjectNotFoundError,
} from "@/lib/project-tree";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = projectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const created = await createUserProject(user.id, parsed.data);
    return NextResponse.json(
      {
        id: created.id,
        title: created.title,
        kind: created.kind,
        parentProjectId: created.parentProjectId,
        status: created.status,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ParentProjectNotFoundError) {
      return NextResponse.json({ error: "Parent not found" }, { status: 404 });
    }
    return handleApiError(error);
  }
}
