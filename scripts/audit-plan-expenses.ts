import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, TransactionType } from "../src/generated/prisma/client";
import { decimalToNumber } from "../src/lib/utils";

const email = process.argv[2] || "foze820@gmail.com";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) throw new Error("no user");

  const txs = await prisma.transaction.findMany({
    where: { userId: user.id, type: TransactionType.EXPENSE, projectId: { not: null } },
    include: { project: { select: { title: true } } },
    orderBy: [{ projectId: "asc" }, { amount: "asc" }],
  });

  const byKey = new Map<string, typeof txs>();
  for (const t of txs) {
    const key = `${t.projectId}|${decimalToNumber(t.amount).toFixed(2)}`;
    const list = byKey.get(key) ?? [];
    list.push(t);
    byKey.set(key, list);
  }

  let groups = 0;
  for (const [, list] of byKey) {
    if (list.length < 2) continue;
    groups++;
    console.log(`\n--- ${list[0].project?.title} ×${list.length} @ ${decimalToNumber(list[0].amount)}`);
    for (const t of list) {
      console.log(`  ${t.occurredAt.toISOString().slice(0, 10)} | ${t.description ?? "(no desc)"}`);
    }
  }
  console.log(`\n${groups} groups with same project+amount (${txs.length} project expenses total)`);

  await prisma.$disconnect();
  await pool.end();
}

main();
