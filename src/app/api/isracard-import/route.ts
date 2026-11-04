import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import {
  importIsracardStatementPack,
  listIsracardStatementPacks,
  reconcileIsracardStatementBilling,
} from "@/lib/isracard-import";

const postSchema = z.object({
  packId: z.string().min(1),
  dryRun: z.boolean().optional(),
  reconcileBilling: z.boolean().optional(),
});

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json({ packs: listIsracardStatementPacks() });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = parsed.data.reconcileBilling
      ? await reconcileIsracardStatementBilling(prisma, user.id, parsed.data.packId, {
          dryRun: parsed.data.dryRun,
        })
      : await importIsracardStatementPack(prisma, user.id, parsed.data.packId, {
          dryRun: parsed.data.dryRun,
        });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
