import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, CategoryKind } from "../src/generated/prisma/client";

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] ?? "Fawzi";

if (!email || !password) {
  console.error("Usage: npx tsx scripts/update-user.ts <email> <password> [name]");
  process.exit(1);
}

async function seedDefaults(prisma: PrismaClient, userId: string) {
  const defaults: { name: string; kind: CategoryKind }[] = [
    { name: "مصروفات", kind: CategoryKind.EXPENSE },
    { name: "دخل", kind: CategoryKind.INCOME },
    { name: "ادخار", kind: CategoryKind.SAVINGS },
    { name: "أخرى", kind: CategoryKind.EXPENSE },
    { name: "قهوة", kind: CategoryKind.EXPENSE },
    { name: "طعام خارج", kind: CategoryKind.EXPENSE },
    { name: "اشتراكات", kind: CategoryKind.EXPENSE },
    { name: "فواتير", kind: CategoryKind.EXPENSE },
    { name: "بناء", kind: CategoryKind.EXPENSE },
  ];

  for (const [i, c] of defaults.entries()) {
    await prisma.category.upsert({
      where: { userId_name_kind: { userId, name: c.name, kind: c.kind } },
      create: { userId, name: c.name, kind: c.kind, sortOrder: i },
      update: {},
    });
  }

  for (const pm of ["مزومان", "شيكات", "אשראי", "كاش", "העברה בנקאית", "اشراي"]) {
    await prisma.paymentMethod.upsert({
      where: { userId_name: { userId, name: pm } },
      create: { userId, name: pm },
      update: {},
    });
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const hash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, name },
    });
    console.log("Updated:", email);
  } else {
    const user = await prisma.user.create({
      data: { email, name, passwordHash: hash },
    });
    await seedDefaults(prisma, user.id);
    console.log("Created:", email);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
