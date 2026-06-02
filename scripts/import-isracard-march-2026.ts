/**
 * Import Isracard statement expenses for March 2026 (billing 20/03/26).
 * Usage: npx tsx scripts/import-isracard-march-2026.ts [--dry-run]
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

/** Isracard ענף → user category */
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
};

type Row = {
  /** DD/MM/YY transaction date from statement */
  txnDate: string;
  /** Use when Feb purchase billed in March */
  chargeDate?: string;
  merchant: string;
  sector?: string;
  amount: number;
};

/** Parsed from Unknown.pdf — March 2026 cycle */
const ROWS: Row[] = [
  // Foreign / subscriptions (sector → اشتراكات)
  { txnDate: "26/02/26", chargeDate: "02/03/26", merchant: "CURSOR AI", amount: 64.25 },
  { txnDate: "02/03/26", chargeDate: "04/03/26", merchant: "CURSOR USAGE", amount: 47.3 },
  { txnDate: "04/03/26", chargeDate: "06/03/26", merchant: "GITHUB", amount: 31.61 },
  { txnDate: "07/03/26", chargeDate: "08/03/26", merchant: "APPLE.COM/BILL", amount: 31.9 },
  { txnDate: "07/03/26", chargeDate: "08/03/26", merchant: "APPLE.COM/BILL", amount: 7.9 },
  { txnDate: "10/03/26", chargeDate: "11/03/26", merchant: "GENSPARK.AI", amount: 79.48 },
  { txnDate: "11/03/26", chargeDate: "12/03/26", merchant: "APPLE.COM/BILL", amount: 11.9 },
  { txnDate: "11/03/26", chargeDate: "13/03/26", merchant: "APPLE.COM/BILL", amount: 155.9 },
  { txnDate: "17/03/26", chargeDate: "19/03/26", merchant: "GOOGLE YOUTUBE PREM", amount: 45.9 },

  // Feb purchases charged in March (use chargeDate)
  { txnDate: "26/02/26", chargeDate: "01/03/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 16 },
  { txnDate: "26/02/26", chargeDate: "01/03/26", merchant: "אחוזות החוף חניון", sector: "שירותי רכב", amount: 44 },
  { txnDate: "26/02/26", chargeDate: "01/03/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 40 },
  { txnDate: "26/02/26", chargeDate: "01/03/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 10 },
  { txnDate: "27/02/26", chargeDate: "02/03/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 42 },
  { txnDate: "28/02/26", chargeDate: "02/03/26", merchant: "טייק ברייק", sector: "מסעדות/קפה", amount: 21 },
  { txnDate: "28/02/26", chargeDate: "02/03/26", merchant: "ttaJxoBehT", sector: "שונות", amount: 290 },

  // March — Israel
  { txnDate: "01/03/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 110 },
  { txnDate: "02/03/26", merchant: "מסעדת ומאפיית גדודנא", sector: "מסעדות/קפה", amount: 70 },
  { txnDate: "02/03/26", merchant: "סופר אלביאן", sector: "מכולת/סופר", amount: 16 },
  { txnDate: "02/03/26", merchant: "פז YELLOW", sector: "דלק", amount: 368.1 },
  { txnDate: "03/03/26", merchant: "MARAN BOUTIQUE", sector: "הלבשה", amount: 1250 },
  { txnDate: "03/03/26", merchant: "חקן אל חריר", sector: "הלבשה", amount: 100 },
  { txnDate: "03/03/26", merchant: "אקאסיה בוטיק", sector: "שונות", amount: 150 },
  { txnDate: "03/03/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 144 },
  { txnDate: "03/03/26", merchant: "לנה פארם", sector: "פארמה", amount: 200.4 },
  { txnDate: "03/03/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 142 },
  { txnDate: "05/03/26", merchant: "טייק ברייק", sector: "מסעדות/קפה", amount: 32 },
  { txnDate: "05/03/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 44.13 },
  { txnDate: "05/03/26", merchant: "בית הבשר והמזון באקה", sector: "שונות", amount: 135.71 },
  { txnDate: "06/03/26", merchant: "בית מרקחת שרה", sector: "פארמה", amount: 125 },
  { txnDate: "07/03/26", merchant: "קיוסק אל טארק", sector: "מסעדות/קפה", amount: 70 },
  { txnDate: "10/03/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 48 },
  { txnDate: "10/03/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 107 },
  { txnDate: "10/03/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 150 },
  { txnDate: "12/03/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 24 },
  { txnDate: "12/03/26", merchant: "מסעדת בונז'ור", sector: "מסעדות/קפה", amount: 300 },
  { txnDate: "12/03/26", merchant: "טופ פארם", sector: "פארמה", amount: 95.1 },
  { txnDate: "12/03/26", merchant: "ROASTY KFAR KRAA", sector: "מסעדות/קפה", amount: 35 },
  { txnDate: "15/03/26", merchant: "עירית ירושלים", sector: "תש' רשויות", amount: 650 },
  { txnDate: "17/03/26", merchant: "עותמאן עתאמנה", sector: "הלבשה", amount: 900 },
  { txnDate: "17/03/26", merchant: "פז YELLOW", sector: "דלק", amount: 357.75 },
  { txnDate: "17/03/26", merchant: "קינמון", sector: "שונות", amount: 25 },
  { txnDate: "19/03/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 58 },
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

function isMarch2026(d: Date) {
  return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 2;
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
  let skipped = 0;
  let skippedDup = 0;

  for (const row of ROWS) {
    const occurredAt = occurredAtForRow(row);
    if (!isMarch2026(occurredAt)) {
      skipped++;
      continue;
    }

    const catName = categoryFor(row);
    const description = row.merchant.trim();
    const amount = row.amount;

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
          notes: "ייבוא דף חיוב ישראכרט 03/2026",
        },
      });
      existing.push(tx);
    }
    imported++;
  }

  const total = ROWS.filter((r) => isMarch2026(occurredAtForRow(r))).reduce(
    (s, r) => s + r.amount,
    0
  );

  console.log(
    dryRun ? "[dry-run] " : "",
    `March 2026 Isracard import for ${userEmail}:`,
    { imported, skippedDup, skippedNotMarch: skipped, statementTotal: total.toFixed(2) }
  );

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
