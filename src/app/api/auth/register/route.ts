import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { emailSchema, hashPassword, passwordSchema } from "@/lib/security/password";
import { MINUTE, clientIp, consumeRateLimit } from "@/lib/security/rate-limit";
import { createStarterCategories } from "@/lib/starter-categories";

const registerSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(80),
  email: emailSchema,
  password: passwordSchema,
});

export async function POST(req: Request) {
  try {
    if (await consumeRateLimit(`register:ip:${clientIp(req)}`, 10, 60 * MINUTE)) {
      return NextResponse.json(
        { error: "محاولات كثيرة — حاول مرة أخرى بعد قليل" },
        { status: 429 }
      );
    }

    const parsed = registerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "بيانات غير صالحة";
      return NextResponse.json({ error: first }, { status: 400 });
    }
    const { name, email, password } = parsed.data;

    const exists = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (exists) {
      return NextResponse.json({ error: "البريد مستخدم مسبقاً" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    await createStarterCategories(user.id, prisma);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[register] failed:", error);
    return NextResponse.json({ error: "فشل التسجيل" }, { status: 500 });
  }
}
