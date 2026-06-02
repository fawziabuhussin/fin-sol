/**
 * Import Isracard Feb 2026 statements (Direct 6934 + Gold 8841).
 * Usage: npx tsx scripts/import-isracard-feb-2026.ts [--dry-run]
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
  "עיתון/דפוס": "أخرى",
  ביטוח: "فواتير",
  משתלות: "أخرى",
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

/** Unknown-4.pdf — MC Direct 6934, billing 20/02/26 */
const DIRECT_ROWS: Row[] = [
  { txnDate: "30/01/26", chargeDate: "01/02/26", merchant: "CURSOR USAGE DEC", amount: 103.22, note: "6934" },
  { txnDate: "03/02/26", chargeDate: "05/02/26", merchant: "CURSOR USAGE MID", amount: 127.14, note: "6934" },
  { txnDate: "04/02/26", chargeDate: "06/02/26", merchant: "GITHUB", amount: 32.07, note: "6934" },
  { txnDate: "07/02/26", chargeDate: "08/02/26", merchant: "APPLE.COM/BILL", amount: 31.9, note: "6934" },
  { txnDate: "10/02/26", chargeDate: "11/02/26", merchant: "GENSPARK.AI", amount: 79.31, note: "6934" },
  { txnDate: "11/02/26", chargeDate: "13/02/26", merchant: "APPLE.COM/BILL", amount: 11.9, note: "6934" },
  { txnDate: "17/02/26", chargeDate: "19/02/26", merchant: "GOOGLE YOUTUBE PREM", amount: 45.9, note: "6934" },
  { txnDate: "23/01/26", chargeDate: "20/02/26", merchant: "פועלים — דמי כרטיס", sector: "שונות", amount: 7.8, note: "6934" },

  { txnDate: "29/01/26", chargeDate: "01/02/26", merchant: "אחוזות החוף חניון", sector: "שירותי רכב", amount: 44, note: "6934" },
  { txnDate: "29/01/26", chargeDate: "01/02/26", merchant: "קופי סטאר", sector: "שונות", amount: 60, note: "6934" },
  { txnDate: "29/01/26", chargeDate: "01/02/26", merchant: "קינמון", sector: "שונות", amount: 38, note: "6934" },
  { txnDate: "30/01/26", chargeDate: "02/02/26", merchant: "אחוזות החוף חניון", sector: "שירותי רכב", amount: 44, note: "6934" },
  { txnDate: "30/01/26", chargeDate: "02/02/26", merchant: "פז YELLOW", sector: "דלק", amount: 203.96, note: "6934" },
  { txnDate: "30/01/26", chargeDate: "02/02/26", merchant: "מסעדת אלבאחאר", sector: "שונות", amount: 358, note: "6934" },
  { txnDate: "31/01/26", chargeDate: "02/02/26", merchant: "אמיגוס בורגר בר", sector: "מסעדות/קפה", amount: 190, note: "6934" },
  { txnDate: "01/02/26", chargeDate: "04/02/26", merchant: "דפוס אלפאתח", sector: "עיתון/דפוס", amount: 170, note: "6934" },
  { txnDate: "02/02/26", chargeDate: "04/02/26", merchant: "אקאסיה בוטיק", sector: "משתלות", amount: 180, note: "6934" },
  { txnDate: "03/02/26", chargeDate: "05/02/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 76, note: "6934" },
  { txnDate: "05/02/26", chargeDate: "08/02/26", merchant: "פז YELLOW", sector: "דלק", amount: 375.83, note: "6934" },
  { txnDate: "06/02/26", chargeDate: "09/02/26", merchant: "מש-קר בע\"מ", sector: "מסעדות/קפה", amount: 5, note: "6934" },
  { txnDate: "06/02/26", chargeDate: "09/02/26", merchant: "אחוזות החוף חניון", sector: "שירותי רכב", amount: 44, note: "6934" },
  { txnDate: "06/02/26", chargeDate: "09/02/26", merchant: "חניון פארק צ'ארלס קל", sector: "שירותי רכב", amount: 16, note: "6934" },
  { txnDate: "06/02/26", chargeDate: "09/02/26", merchant: "WOLT", sector: "שונות", amount: 165.9, note: "6934" },
  { txnDate: "08/02/26", chargeDate: "10/02/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 66, note: "6934" },
  { txnDate: "09/02/26", chargeDate: "11/02/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 78, note: "6934" },
  { txnDate: "10/02/26", chargeDate: "12/02/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 17, note: "6934" },
  { txnDate: "10/02/26", chargeDate: "12/02/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 24, note: "6934" },
  { txnDate: "11/02/26", chargeDate: "13/02/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 95, note: "6934" },
  { txnDate: "11/02/26", chargeDate: "13/02/26", merchant: "פז YELLOW", sector: "דלק", amount: 359.45, note: "6934" },
  { txnDate: "11/02/26", chargeDate: "13/02/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 61, note: "6934" },
  { txnDate: "12/02/26", chargeDate: "15/02/26", merchant: "ערוס דמשק", sector: "מסעדות/קפה", amount: 153, note: "6934" },
  { txnDate: "12/02/26", chargeDate: "16/02/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 35, note: "6934" },
  { txnDate: "13/02/26", chargeDate: "16/02/26", merchant: "אחוזות החוף חניון", sector: "שירותי רכב", amount: 44, note: "6934" },
  { txnDate: "13/02/26", chargeDate: "16/02/26", merchant: "אמיגוס בורגר בר", sector: "מסעדות/קפה", amount: 114, note: "6934" },
  { txnDate: "13/02/26", chargeDate: "16/02/26", merchant: "קינמון", sector: "שונות", amount: 46, note: "6934" },
  { txnDate: "14/02/26", chargeDate: "16/02/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 31, note: "6934" },
  { txnDate: "17/02/26", chargeDate: "19/02/26", merchant: "THE X BY CRISPY", sector: "מסעדות/קפה", amount: 193, note: "6934" },
  { txnDate: "17/02/26", chargeDate: "19/02/26", merchant: "אגיאל פאסט פוד וקפה", sector: "שונות", amount: 27, note: "6934" },
  { txnDate: "17/02/26", chargeDate: "19/02/26", merchant: "קינמון", sector: "שונות", amount: 13, note: "6934" },
  { txnDate: "18/02/26", chargeDate: "20/02/26", merchant: "טייק ברייק", sector: "מסעדות/קפה", amount: 42, note: "6934" },
];

/** Unknown-3.pdf — Gold 8841, billing 20/02/26 */
const GOLD_ROWS: Row[] = [
  {
    txnDate: "20/02/26",
    merchant: "שי מתתיהו — סלפי",
    sector: "שונות",
    amount: 315.85,
    note: "8841",
    installmentNote: "תשלום 4 מתוך 4",
  },
  {
    txnDate: "20/02/26",
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 395.28,
    note: "8841",
    installmentNote: "תשלום 2 מתוך 2",
  },
  {
    txnDate: "20/02/26",
    merchant: "חברת החשמל לישראל",
    sector: "תש' רשויות",
    amount: 490.24,
    note: "8841",
    installmentNote: "קרדיט תשלום 1 מתוך 3",
  },
  {
    txnDate: "20/02/26",
    merchant: "אחמד זוהדי מרקט",
    sector: "מכולת/סופר",
    amount: 444.33,
    note: "8841",
    installmentNote: "תשלום 1 מתוך 3",
  },
  { txnDate: "20/02/26", merchant: "דרך ארץ — הוראת קבע", sector: "תש' רשויות", amount: 118.09, note: "8841" },
  { txnDate: "20/02/26", merchant: "המקסיקני אוניברסיטת", sector: "מסעדות/קפה", amount: 53, note: "8841" },
  { txnDate: "20/02/26", merchant: "פז YELLOW", sector: "דלק", amount: 85.5, note: "8841" },
  { txnDate: "20/02/26", merchant: "ארומה אפליקציה", sector: "מסעדות/קפה", amount: 100, note: "8841" },
  { txnDate: "20/02/26", merchant: "ארומה הנשיאים", sector: "מסעדות/קפה", amount: 13, note: "8841" },
  { txnDate: "20/02/26", merchant: "קינמון", sector: "שונות", amount: 32, note: "8841" },
  { txnDate: "20/02/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 86, note: "8841" },
  { txnDate: "20/02/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 22, note: "8841" },
  { txnDate: "20/02/26", merchant: "פועלים — דמי כרטיס", sector: "שונות", amount: 19.25, note: "8841" },
  { txnDate: "20/02/26", merchant: "ttaJxoBehT", sector: "שונות", amount: 290, note: "8841" },
  { txnDate: "20/02/26", merchant: "AIG ביטוח רכב", sector: "ביטוח", amount: 358.73, note: "8841" },
  { txnDate: "20/02/26", merchant: "פז YELLOW הנשיאים", sector: "דלק", amount: 66.6, note: "8841" },
  { txnDate: "20/02/26", merchant: "קינמון", sector: "שונות", amount: 13, note: "8841" },
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

function isFeb2026(d: Date) {
  return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 1;
}

async function importRows(
  prisma: PrismaClient,
  userId: string,
  rows: Row[],
  existing: { id: string; amount: { toString(): string }; description: string | null; occurredAt: Date }[],
  catByName: Record<string, { id: string }>,
  paymentMethodId: string | undefined
) {
  let imported = 0;
  let skippedDup = 0;
  let skippedNotFeb = 0;

  for (const row of rows) {
    const occurredAt = occurredAtForRow(row);
    if (!isFeb2026(occurredAt)) {
      skippedNotFeb++;
      continue;
    }

    const catName = categoryFor(row);
    const description = row.merchant.trim();
    const amount = row.amount;
    const notes = [
      `ייבוא ישראכרט ${row.note} — חיוב 02/2026`,
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

  return { imported, skippedDup, skippedNotFeb };
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

  const febStart = new Date(Date.UTC(2026, 1, 1));
  const febEnd = new Date(Date.UTC(2026, 2, 1));

  const existing = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: febStart, lt: febEnd },
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
    isFeb2026(occurredAtForRow(r))
  ).reduce((s, r) => s + r.amount, 0);
  const goldTotal = GOLD_ROWS.filter((r) => isFeb2026(occurredAtForRow(r))).reduce(
    (s, r) => s + r.amount,
    0
  );

  console.log(
    dryRun ? "[dry-run] " : "",
    `Feb 2026 Isracard import for ${userEmail}:`,
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
