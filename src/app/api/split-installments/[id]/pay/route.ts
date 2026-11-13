import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { markSplitInstallmentPaid } from "@/lib/split-payments";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = (await req.json()) as { occurredAt?: string };

    const result = await markSplitInstallmentPaid({
      userId: user.id,
      installmentId: id,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
    });
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
