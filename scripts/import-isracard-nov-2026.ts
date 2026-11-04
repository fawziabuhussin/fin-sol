/**
 * Import Isracard Gold 8841 statement — billing 11/2026 (01.11.26 cycle).
 * Skips rows already in the DB (e.g. first six + מיי עירון entered manually).
 *
 * Usage: npx tsx scripts/import-isracard-nov-2026.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  CategoryKind,
  PrismaClient,
  TransactionType,
} from "../src/generated/prisma/client";
import { categorizeExpense } from "../src/lib/expense-categories";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const PAYMENT_METHOD = "אשראי";
const IMPORT_NOTE = "ייבוא ישראכרט 8841 — חיוב 11/2026";

type Row = {
  txnDate: string;
  merchant: string;
  sector?: string;
  amount: number;
  installmentNote?: string;
  standingOrder?: boolean;
};

/** Parsed from Isracard statement — Nov 2026 billing */
const ROWS: Row[] = [
  { txnDate: "02/11/26", merchant: "כונסים", sector: "שונות", amount: 249 },
  { txnDate: "02/11/26", merchant: "קפה נאפולי", sector: "מסעדות/קפה", amount: 10 },
  {
    txnDate: "01/11/26",
    merchant: "אילנס רכבת באר שבע צ",
    sector: "מסעדות/קפה",
    amount: 21,
  },
  {
    txnDate: "01/11/26",
    merchant: "ארומה אוניברסיטת בן",
    sector: "מסעדות/קפה",
    amount: 14,
  },
  {
    txnDate: "01/11/26",
    merchant: 'פלאפון תקשורת בע"מ',
    sector: "שונות",
    amount: 259.62,
  },
  { txnDate: "01/11/26", merchant: "תחנת ענבר", sector: "דלק", amount: 370.29 },
  {
    txnDate: "29/10/26",
    merchant: 'מיי עירון בע"מ',
    sector: "תש' רשויות",
    amount: 2253,
    installmentNote: "תשלום 1 מתוך 2",
  },
  { txnDate: "29/10/26", merchant: "טייק ברייק", sector: "מסעדות/קפה", amount: 297 },
  {
    txnDate: "28/10/26",
    merchant: "רוזה קפה בוטיק - טיר",
    sector: "מסעדות/קפה",
    amount: 77,
  },
  { txnDate: "28/10/26", merchant: "דגי פרדיס באקה", sector: "שונות", amount: 350 },
  { txnDate: "28/10/26", merchant: "סטאר קפה", sector: "מסעדות/קפה", amount: 34 },
  {
    txnDate: "26/10/26",
    merchant: "כלל רכב/דירה/עסק",
    sector: "ביטוח",
    amount: 150.08,
    standingOrder: true,
  },
  {
    txnDate: "25/10/26",
    merchant: "חברת החשמל לישראל בע",
    sector: "תש' רשויות",
    amount: 2692.36,
  },
  {
    txnDate: "25/10/26",
    merchant: "מנהרות הכרמל-זיכוי",
    sector: "תחבורה",
    amount: -12.08,
  },
  {
    txnDate: "25/10/26",
    merchant: "מ.תחבורה - רב-פס",
    sector: "תש' רשויות",
    amount: 70,
    standingOrder: true,
  },
  { txnDate: "24/10/26", merchant: "FROSTY SHAKES", sector: "מסעדות/קפה", amount: 62 },
  {
    txnDate: "23/10/26",
    merchant: "פז אפליקצית-YELLOW",
    sector: "דלק",
    amount: 431.59,
  },
  { txnDate: "20/10/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 180.6 },
  { txnDate: "20/10/26", merchant: "חשמל וצבע הכפר", sector: "שונות", amount: 120 },
  {
    txnDate: "20/10/26",
    merchant: "חלקי חילוף מואסי גוד",
    sector: "שונות",
    amount: 400,
  },
  {
    txnDate: "20/10/26",
    merchant: "סופרמרקט תאופיק חלף",
    sector: "מכולת/סופר",
    amount: 36,
  },
  { txnDate: "20/10/26", merchant: "לנה פארם", sector: "פארמה", amount: 169.54 },
  {
    txnDate: "20/10/26",
    merchant: 'סופר אלביאן בע"מ',
    sector: "מכולת/סופר",
    amount: 274.74,
  },
];

function parseDdMmYy(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

function normalizeDescription(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function descriptionsMatch(a: string, b: string | null | undefined): boolean {
  const left = normalizeDescription(a);
  const right = normalizeDescription(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.includes(right) || right.includes(left)) return true;
  const minLen = Math.min(left.length, right.length, 10);
  if (minLen >= 6 && left.slice(0, minLen) === right.slice(0, minLen)) return true;
  return false;
}

function amountsMatch(a: number, b: number) {
  return Math.abs(a - b) < 0.02;
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

  const windowStart = new Date(Date.UTC(2026, 9, 1));
  const windowEnd = new Date(Date.UTC(2026, 11, 1));

  const existing = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: windowStart, lt: windowEnd },
    },
  });

  let imported = 0;
  let skippedDup = 0;

  for (const row of ROWS) {
    const occurredAt = parseDdMmYy(row.txnDate);
    const description = row.merchant.trim();
    const amount = row.amount;
    const notes = [
      IMPORT_NOTE,
      row.installmentNote,
      row.standingOrder ? "הוראת קבע" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const dup = existing.find(
      (t) =>
        amountsMatch(Number(t.amount), amount) &&
        descriptionsMatch(description, t.description) &&
        t.occurredAt.toISOString().slice(0, 10) === occurredAt.toISOString().slice(0, 10)
    );
    if (dup) {
      skippedDup++;
      continue;
    }

    const catName = categorizeExpense(row.merchant, row.sector);
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
          amount,
          occurredAt,
          description,
          notes,
        },
      });
      existing.push(tx);
    }
    imported++;
  }

  const statementTotal = ROWS.reduce((s, r) => s + r.amount, 0);

  console.log(
    dryRun ? "[dry-run] " : "",
    `Nov 2026 Isracard import for ${userEmail}:`,
    {
      imported,
      skippedDup,
      statementTotal: statementTotal.toFixed(2),
      rows: ROWS.length,
    }
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
