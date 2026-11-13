import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { verifyPassword } from "@/lib/security/password";
import { MINUTE, consumeRateLimit } from "@/lib/security/rate-limit";

const profileSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(80),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const parsed = profileSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { name: parsed.data.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

const deleteSchema = z.object({
  password: z.string().min(1).max(200),
  confirm: z.literal("DELETE"),
});

/** Permanently deletes the account and every row owned by it (cascade). */
export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    if (await consumeRateLimit(`account-delete:${user.id}`, 5, 15 * MINUTE)) {
      return NextResponse.json({ error: "محاولات كثيرة — حاول لاحقاً" }, { status: 429 });
    }
    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "اكتب DELETE للتأكيد" }, { status: 400 });
    }
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(parsed.data.password, dbUser?.passwordHash))) {
      return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 403 });
    }

    // Every user-owned model has onDelete: Cascade on its userId relation.
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
