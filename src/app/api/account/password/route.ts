import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/security/password";
import { MINUTE, consumeRateLimit } from "@/lib/security/rate-limit";

const schema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

/**
 * Changes the password and bumps tokenVersion, which signs out every other
 * device. The client signs back in with the new password right after.
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (await consumeRateLimit(`password-change:${user.id}`, 5, 15 * MINUTE)) {
      return NextResponse.json({ error: "محاولات كثيرة — حاول لاحقاً" }, { status: 429 });
    }
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" },
        { status: 400 }
      );
    }
    const { currentPassword, newPassword } = parsed.data;
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "كلمة المرور الجديدة يجب أن تختلف عن الحالية" },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(currentPassword, dbUser?.passwordHash))) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 403 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        tokenVersion: { increment: 1 },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
