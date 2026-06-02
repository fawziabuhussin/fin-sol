/**
 * Import Isracard Mastercard Gold (8841) — March 2026 billing (20/03/26).
 * Usage: npx tsx scripts/import-isracard-march-2026-gold.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  CategoryKind,
  PrismaClient,
  TransactionType,
} from "../src/generated/prisma/client";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const PAYMENT_METHOD = "אשראי";
const IMPORT_NOTE = "ייבוא ישראכרט גולד 8841 — חיוב 03/2026";
const MARCH_CHARGE = "20/03/26";

const SECTOR_TO_CATEGORY: Record<string, string> = {
  "מכולת/סופר": "طعام خارج",
  שונות: "أخرى",
  "תש' רשויות": "فواتير",
  ביטוח: "فواتير",
};

type Row = {
  merchant: string;
  sector: string;
  amount: number;
  installmentNote?: string;
};

/** Unknown-2.pdf — billed 20/03/26 */
const ROWS: Row[] = [
  {
    merchant: "חברת החשמל לישראל",
    sector: "תש' רשויות",
    amount: 490.24,
    installmentNote: "קרדיט תשלום 2 מתוך 3",
  },
  {
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 444.33,
    installmentNote: "תשלום 2 מתוך 3",
  },
  {
    merchant: "דרך ארץ — הוראת קבע",
    sector: "תש' רשויות",
    amount: 363.53,
  },
  {
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 592.71,
    installmentNote: "תשלום 1 מתוך 2",
  },
  {
    merchant: "פועלים — דמי כרטיס",
    sector: "שונות",
    amount: 19.25,
  },
  {
    merchant: "חברת החשמל לישראל",
    sector: "תש' רשויות",
    amount: 1000,
  },
  {
    merchant: "AIG ביטוח רכב",
    sector: "ביטוח",
    amount: 348.35,
  },
];

function parseDdMmYy(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  let pm = await prisma.paymentMethod.findFirst({
    where: { userId: user.id, name: PAYMENT_METHOD },
  });
  if (!pm && !dryRun) {
    pm = await prisma.paymentMethod.create({
      data: { userId: user.id, name: PAYMENT_METHOD },
    });
  }

  const occurredAt = parseDdMmYy(MARCH_CHARGE);
  const marchStart = new Date(Date.UTC(2026, 2, 1));
  const marchEnd = new Date(Date.UTC(2026, 3, 1));

  const existing = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: marchStart, lt: marchEnd },
    },
  });

  let imported = 0;
  let skippedDup = 0;

  for (const row of ROWS) {
    const catName = SECTOR_TO_CATEGORY[row.sector] ?? "أخرى";
    const description = row.merchant.trim();
    const notes = [IMPORT_NOTE, row.installmentNote].filter(Boolean).join(" · ");

    const dup = existing.find(
      (t) =>
        Math.abs(Number(t.amount) - row.amount) < 0.02 &&
        t.description === description &&
        t.occurredAt.toISOString().slice(0, 10) ===
          occurredAt.toISOString().slice(0, 10)
    );
    if (dup) {
      skippedDup++;
      continue;
    }

    let categoryId = catByName[catName]?.id;
    if (!categoryId && !dryRun) {
      const created = await prisma.category.create({
        data: { userId: user.id, name: catName, kind: CategoryKind.EXPENSE },
      });
      categoryId = created.id;
      catByName[catName] = created;
    }

    if (!dryRun) {
      const tx = await prisma.transaction.create({
        data: {
          userId: user.id,
          categoryId: categoryId!,
          paymentMethodId: pm?.id,
          type: TransactionType.EXPENSE,
          amount: row.amount,
          occurredAt,
          description,
          notes,
        },
      });
      existing.push(tx);
    }
    imported++;
  }

  const total = ROWS.reduce((s, r) => s + r.amount, 0);

  console.log(
    dryRun ? "[dry-run] " : "",
    `March 2026 Isracard Gold (8841) for ${userEmail}:`,
    { imported, skippedDup, statementTotal: total.toFixed(2) }
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
