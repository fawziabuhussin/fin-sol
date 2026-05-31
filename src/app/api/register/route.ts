import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { seedHouseholdLookups } from "@/lib/seed-household";
import { HouseholdRole } from "@/generated/prisma/client";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  householdName: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, password, name, householdName } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: name ?? null,
        passwordHash,
      },
    });

    const household = await prisma.household.create({
      data: {
        name: householdName ?? "المنزل",
        members: {
          create: { userId: user.id, role: HouseholdRole.OWNER },
        },
      },
    });

    await seedHouseholdLookups(prisma, household.id);
    await prisma.kerenHishtalmutProfile.create({
      data: { householdId: household.id },
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
