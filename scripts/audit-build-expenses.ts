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

  const build = await prisma.category.findFirst({
    where: { userId: user.id, name: "بناء" },
  });

  const txs = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      OR: [
        { categoryId: build?.id },
        { projectId: { not: null } },
      ],
    },
    include: { project: { select: { title: true } } },
    orderBy: { occurredAt: "desc" },
  });

  const byDescAmt = new Map<string, typeof txs>();
  for (const t of txs) {
    const amt = decimalToNumber(t.amount);
    if (amt <= 0) continue;
    const key = `${normalize(t.description)}|${amt.toFixed(2)}|${t.occurredAt.toISOString().slice(0, 7)}`;
    const list = byDescAmt.get(key) ?? [];
    list.push(t);
    byDescAmt.set(key, list);
  }

  let dupGroups = 0;
  for (const [, list] of byDescAmt) {
    if (list.length < 2) continue;
    dupGroups++;
    console.log(`\n--- ${list.length}× ${list[0].description} @ ${decimalToNumber(list[0].amount)} (${list[0].occurredAt.toISOString().slice(0, 10)})`);
    for (const t of list) {
      console.log(
        `  proj=${t.project?.title ?? "—"} cat=${t.categoryId === build?.id ? "بناء" : "other"} id=…${t.id.slice(-8)}`
      );
    }
  }

  console.log(`\n${dupGroups} duplicate groups (desc+amount+month), ${txs.length} build/project expenses`);

  await prisma.$disconnect();
  await pool.end();
}

function normalize(s: string | null) {
  return (s ?? "").trim().replace(/[–—−]/g, "—");
}

main();
