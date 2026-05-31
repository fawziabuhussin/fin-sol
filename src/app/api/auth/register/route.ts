import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password || body.password.length < 6) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) {
      return NextResponse.json({ error: "البريد مستخدم مسبقاً" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.user.create({
      data: {
        name: body.name ?? null,
        email: body.email,
        passwordHash,
      },
    });

    const [expense, income, savings] = await Promise.all([
      prisma.category.create({ data: { userId: user.id, name: "مصروفات", kind: "EXPENSE", sortOrder: 1 } }),
      prisma.category.create({ data: { userId: user.id, name: "دخل", kind: "INCOME", sortOrder: 2 } }),
      prisma.category.create({ data: { userId: user.id, name: "ادخار", kind: "SAVINGS", sortOrder: 3 } }),
    ]);

    void expense;
    void income;
    void savings;

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "فشل التسجيل" }, { status: 500 });
  }
}
