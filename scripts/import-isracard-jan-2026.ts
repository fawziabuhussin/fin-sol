/**
 * Import Isracard Jan 2026 statements (Direct 6934 + Gold 8841).
 * Usage: npx tsx scripts/import-isracard-jan-2026.ts [--dry-run]
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

const SECTOR_TO_CATEGORY: Record<string, string> = {
  "מכולת/סופר": "طعام خارج",
  מעדניות: "طعام خارج",
  דלק: "أخرى",
  "מסעדות/קפה": "قهوة",
  שונות: "أخرى",
  "תש' רשויות": "فواتير",
  פארמה: "أخرى",
  הלבשה: "ملابس",
  תחבורה: "أخرى",
  "שירותי רכב": "أخرى",
  ביטוח: "فواتير",
  צעצועים: "أخرى",
};

type Row = {
  txnDate: string;
  chargeDate?: string;
  merchant: string;
  sector?: string;
  amount: number;
  note: string;
  installmentNote?: string;
};

/** Unknown-5.pdf — MC Direct 6934, billing 20/01/26 */
const DIRECT_ROWS: Row[] = [
  { txnDate: "31/12/25", chargeDate: "02/01/26", merchant: "VERCEL DOMAINS", amount: 36.93, note: "6934" },
  { txnDate: "01/01/26", chargeDate: "04/01/26", merchant: "CURSOR USAGE MID", amount: 67.57, note: "6934" },
  { txnDate: "04/01/26", chargeDate: "06/01/26", merchant: "GITHUB", amount: 55.25, note: "6934" },
  { txnDate: "06/01/26", chargeDate: "07/01/26", merchant: "GENSPARK.AI", amount: 81.36, note: "6934" },
  { txnDate: "07/01/26", chargeDate: "08/01/26", merchant: "APPLE.COM/BILL", amount: 31.9, note: "6934" },
  { txnDate: "11/01/26", chargeDate: "12/01/26", merchant: "APPLE.COM/BILL", amount: 11.9, note: "6934" },
  { txnDate: "17/01/26", chargeDate: "19/01/26", merchant: "GOOGLE YOUTUBE PREM", amount: 45.9, note: "6934" },

  { txnDate: "31/12/25", chargeDate: "02/01/26", merchant: "מינימרקט אלערין", sector: "מכולת/סופר", amount: 48, note: "6934" },
  { txnDate: "01/01/26", chargeDate: "04/01/26", merchant: "אלון ג'ת", sector: "דלק", amount: 376.75, note: "6934" },
  { txnDate: "02/01/26", chargeDate: "05/01/26", merchant: "מ. התחבורה ר. רכב", sector: "תש' רשויות", amount: 1590, note: "6934" },
  { txnDate: "02/01/26", chargeDate: "05/01/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 58, note: "6934" },
  { txnDate: "04/01/26", chargeDate: "06/01/26", merchant: "FASHION 21", sector: "הלבשה", amount: 200, note: "6934" },
  { txnDate: "04/01/26", chargeDate: "06/01/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 65, note: "6934" },
  { txnDate: "06/01/26", chargeDate: "08/01/26", merchant: "KRUNCHY CHICKEN", sector: "מסעדות/קפה", amount: 70, note: "6934" },
  { txnDate: "06/01/26", chargeDate: "08/01/26", merchant: "חברת החשמל לישראל", sector: "תש' רשויות", amount: 312.41, note: "6934" },
  { txnDate: "06/01/26", chargeDate: "08/01/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 129, note: "6934" },
  { txnDate: "06/01/26", chargeDate: "08/01/26", merchant: "וירונה/מאנו", sector: "מסעדות/קפה", amount: 258, note: "6934" },
  { txnDate: "08/01/26", chargeDate: "11/01/26", merchant: "רשת בית התינוק", sector: "צעצועים", amount: 370, note: "6934" },
  { txnDate: "11/01/26", chargeDate: "13/01/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 45, note: "6934" },
  { txnDate: "11/01/26", chargeDate: "13/01/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 46, note: "6934" },
  { txnDate: "13/01/26", chargeDate: "15/01/26", merchant: "כנאפה דמשק", sector: "מסעדות/קפה", amount: 60, note: "6934" },
  { txnDate: "13/01/26", chargeDate: "15/01/26", merchant: "פז YELLOW", sector: "דלק", amount: 329.52, note: "6934" },
  { txnDate: "15/01/26", chargeDate: "18/01/26", merchant: "הועדה לתכנון עירון", sector: "תש' רשויות", amount: 228, note: "6934" },
  { txnDate: "16/01/26", chargeDate: "19/01/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 88, note: "6934" },
  { txnDate: "16/01/26", chargeDate: "19/01/26", merchant: "אלמדינה מרקט", sector: "מכולת/סופר", amount: 120, note: "6934" },
  { txnDate: "17/01/26", chargeDate: "19/01/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 100, note: "6934" },
  { txnDate: "18/01/26", chargeDate: "20/01/26", merchant: "כנאפה דמשק", sector: "מסעדות/קפה", amount: 30, note: "6934" },
  { txnDate: "18/01/26", chargeDate: "20/01/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 37.15, note: "6934" },
];

/** Unknown-6.pdf — Gold 8841, billing 20/01/26 */
const GOLD_ROWS: Row[] = [
  { txnDate: "30/12/25", chargeDate: "01/01/26", merchant: "ADOBE", amount: 120, note: "8841" },

  {
    txnDate: "20/01/26",
    merchant: "חברת חשמל לישראל",
    sector: "תש' רשויות",
    amount: 511.38,
    note: "8841",
    installmentNote: "קרדיט תשלום 4 מתוך 4",
  },
  {
    txnDate: "20/01/26",
    merchant: "שי מתתיהו — סלפי",
    sector: "שונות",
    amount: 315.85,
    note: "8841",
    installmentNote: "תשלום 3 מתוך 4",
  },
  {
    txnDate: "20/01/26",
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 243.94,
    note: "8841",
    installmentNote: "תשלום 2 מתוך 2",
  },
  {
    txnDate: "20/01/26",
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 301.98,
    note: "8841",
    installmentNote: "תשלום 2 מתוך 2",
  },
  { txnDate: "20/01/26", merchant: "דרך ארץ — הוראת קבע", sector: "תש' רשויות", amount: 152.24, note: "8841" },
  {
    txnDate: "20/01/26",
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 395.29,
    note: "8841",
    installmentNote: "תשלום 1 מתוך 2",
  },
  { txnDate: "20/01/26", merchant: "פועלים — דמי כרטיס", sector: "שונות", amount: 19.25, note: "8841" },
  { txnDate: "20/01/26", merchant: "פז YELLOW", sector: "דלק", amount: 254.42, note: "8841" },
  { txnDate: "20/01/26", merchant: "AIG ביטוח רכב", sector: "ביטוח", amount: 358.73, note: "8841" },
];

function parseDdMmYy(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

function occurredAtForRow(row: Row): Date {
  const txn = parseDdMmYy(row.txnDate);
  if (!row.chargeDate) return txn;
  const charge = parseDdMmYy(row.chargeDate);
  if (charge.getTime() > txn.getTime()) return charge;
  return txn;
}

function categoryFor(row: Row): string {
  if (!row.sector) return "اشتراكات";
  return SECTOR_TO_CATEGORY[row.sector] ?? "أخرى";
}

function isJan2026(d: Date) {
  return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 0;
}

async function importRows(
  prisma: PrismaClient,
  userId: string,
  rows: Row[],
  existing: { amount: { toString(): string }; description: string | null; occurredAt: Date }[],
  catByName: Record<string, { id: string }>,
  paymentMethodId: string | undefined
) {
  let imported = 0;
  let skippedDup = 0;
  let skippedNotJan = 0;

  for (const row of rows) {
    const occurredAt = occurredAtForRow(row);
    if (!isJan2026(occurredAt)) {
      skippedNotJan++;
      continue;
    }

    const catName = categoryFor(row);
    const description = row.merchant.trim();
    const amount = row.amount;
    const notes = [
      `ייבוא ישראכרט ${row.note} — חיוב 01/2026`,
      row.installmentNote,
    ]
      .filter(Boolean)
      .join(" · ");

    const dup = existing.find(
      (t) =>
        Math.abs(Number(t.amount) - amount) < 0.02 &&
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
        data: { userId, name: catName, kind: CategoryKind.EXPENSE },
      });
      categoryId = created.id;
      catByName[catName] = created;
    }

    if (!dryRun) {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          categoryId: categoryId!,
          paymentMethodId,
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

  return { imported, skippedDup, skippedNotJan };
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

  const janStart = new Date(Date.UTC(2026, 0, 1));
  const janEnd = new Date(Date.UTC(2026, 1, 1));

  const existing = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: janStart, lt: janEnd },
    },
  });

  const direct = await importRows(
    prisma,
    user.id,
    DIRECT_ROWS,
    existing,
    catByName,
    pm?.id
  );
  const gold = await importRows(
    prisma,
    user.id,
    GOLD_ROWS,
    existing,
    catByName,
    pm?.id
  );

  const directTotal = DIRECT_ROWS.filter((r) =>
    isJan2026(occurredAtForRow(r))
  ).reduce((s, r) => s + r.amount, 0);
  const goldTotal = GOLD_ROWS.filter((r) => isJan2026(occurredAtForRow(r))).reduce(
    (s, r) => s + r.amount,
    0
  );

  console.log(
    dryRun ? "[dry-run] " : "",
    `Jan 2026 Isracard import for ${userEmail}:`,
    {
      direct: { ...direct, total: directTotal.toFixed(2) },
      gold: { ...gold, total: goldTotal.toFixed(2) },
      combined: (directTotal + goldTotal).toFixed(2),
    }
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
