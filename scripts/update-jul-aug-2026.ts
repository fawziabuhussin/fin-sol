/**
 * Update Jul–Aug 2026: Isracard statements + bank cash/gifts + building plan.
 * Usage: npx tsx scripts/update-jul-aug-2026.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  CategoryKind,
  InstallmentStatus,
  PaymentPlanMode,
  PrismaClient,
  ProjectKind,
  ProjectStatus,
  TransactionType,
  type Transaction,
} from "../src/generated/prisma/client";
import { categorizeExpense } from "../src/lib/expense-categories";
import { buildInstallmentSchedule, installmentLabel } from "../src/lib/payment-plan";
import { paidAtForPeriod } from "../src/lib/savings-schedule";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const CARD_PM = "אשראי";
const CASH_PM = "كاش";
const BANK_PM = "העברה בנקאית";
const CARD_NOTE = "ייבוא דף חיוב ישראכרט 07-08/2026";
const BANK_NOTE = 'ייבוא תנועות עו"ש 07-08/2026';

type SourceRow = {
  card?: "8841" | "6934" | "bank";
  txnDate: string;
  chargeDate?: string;
  merchant: string;
  sector?: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
};

/** Card rows from 20/07 and 20/08 billing PDFs. Credits and subscription-duplicates omitted. */
const CARD_ROWS: SourceRow[] = [
  // ── 8841 Gold — remaining July billing (20/07) ──
  { card: "8841", txnDate: "11/07/26", merchant: "KRUNCHY CHICKEN", sector: "מסעדות/קפה", amount: 245 },
  { card: "8841", txnDate: "12/07/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 62 },

  // ── 6934 Direct — remaining July billing (20/07) ──
  { card: "6934", txnDate: "04/07/26", chargeDate: "06/07/26", merchant: "GITHUB, INC.", amount: 30.83 },
  { card: "6934", txnDate: "08/07/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 85 },
  { card: "6934", txnDate: "08/07/26", merchant: "בית קליה אבו פול", sector: "מכולת/סופר", amount: 30 },
  { card: "6934", txnDate: "10/07/26", merchant: "ספרית אלבאין", sector: "כלי בית", amount: 32 },
  { card: "6934", txnDate: "10/07/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 222 },
  { card: "6934", txnDate: "10/07/26", merchant: "לנה פארם", sector: "פארמה", amount: 450 },
  { card: "6934", txnDate: "10/07/26", merchant: "קינמון", sector: "שונות", amount: 33 },
  { card: "6934", txnDate: "11/07/26", merchant: "מינימרקט אלערין", sector: "מכולת/סופר", amount: 93 },
  { card: "6934", txnDate: "11/07/26", chargeDate: "13/07/26", merchant: "CURSOR USAGE MID", amount: 189.8 },
  { card: "6934", txnDate: "12/07/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 12 },
  { card: "6934", txnDate: "12/07/26", merchant: "APPLE.COM/BILL", amount: 39.9 },
  { card: "6934", txnDate: "13/07/26", merchant: "העברה ב BIT", sector: "שונות", amount: 300 },
  { card: "6934", txnDate: "13/07/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 22 },
  { card: "6934", txnDate: "13/07/26", merchant: "קינמון", sector: "שונות", amount: 65 },
  { card: "6934", txnDate: "14/07/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 387.47 },
  { card: "6934", txnDate: "15/07/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 420.32 },
  { card: "6934", txnDate: "15/07/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 155 },
  { card: "6934", txnDate: "16/07/26", merchant: "זאצי באקה", sector: "מסעדות/קפה", amount: 160 },
  { card: "6934", txnDate: "16/07/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 93 },
  { card: "6934", txnDate: "16/07/26", merchant: "מרכז אלואחה למזון", sector: "מכולת/סופר", amount: 44 },
  { card: "6934", txnDate: "17/07/26", merchant: "קינמון", sector: "שונות", amount: 47 },
  { card: "6934", txnDate: "17/07/26", merchant: "GOOGLE YOUTUBEPREM", amount: 45.9 },
  { card: "6934", txnDate: "19/07/26", merchant: "דפוס אלפאתח", sector: "עיתון/דפוס", amount: 150 },

  // ── 8841 Gold — August billing (20/08) ──
  { card: "8841", txnDate: "23/07/26", chargeDate: "26/07/26", merchant: "OVERLEAF EDITOR", amount: 28.16 },
  { card: "8841", txnDate: "20/07/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 20 },
  { card: "8841", txnDate: "21/07/26", merchant: "דרך ארץ הוראת קבע", sector: "תש' רשויות", amount: 118.42 },
  { card: "8841", txnDate: "21/07/26", merchant: "WOLT", sector: "שונות", amount: 226.9 },
  { card: "8841", txnDate: "22/07/26", merchant: "אמיגוס בורגר בר", sector: "מסעדות/קפה", amount: 186 },
  { card: "8841", txnDate: "22/07/26", merchant: "פועלים- דמי כרטיס", sector: "שונות", amount: 19.25 },
  { card: "8841", txnDate: "23/07/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 451.47 },
  { card: "8841", txnDate: "23/07/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 30 },
  { card: "8841", txnDate: "23/07/26", merchant: "ערב אספרסו ביינז", sector: "שונות", amount: 160 },
  { card: "8841", txnDate: "23/07/26", merchant: "אחמד זוהדי מרקט", sector: "מכולת/סופר", amount: 1918.6 },
  { card: "8841", txnDate: "24/07/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 45 },
  { card: "8841", txnDate: "24/07/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 125 },
  { card: "8841", txnDate: "24/07/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 377.49 },
  { card: "8841", txnDate: "24/07/26", merchant: "אחמד זוהדי מרקט", sector: "מכולת/סופר", amount: 110.5 },
  { card: "8841", txnDate: "25/07/26", merchant: "דפוס אלפאתח", sector: "עיתון/דפוס", amount: 700 },
  { card: "8841", txnDate: "29/07/26", merchant: "AIG ביטוח רכב", sector: "ביטוח", amount: 353.4 },

  // ── 6934 Direct — August billing (20/08) foreign ──
  { card: "6934", txnDate: "27/07/26", merchant: "APPLE.COM/BILL", amount: 50.9 },
  { card: "6934", txnDate: "28/07/26", chargeDate: "30/07/26", merchant: "CURSOR, AI POWERED", amount: 62.93 },
  { card: "6934", txnDate: "01/08/26", chargeDate: "03/08/26", merchant: "GOOGLE CLOUD", amount: 3.09 },
  { card: "6934", txnDate: "04/08/26", chargeDate: "06/08/26", merchant: "GITHUB, INC.", amount: 30.88 },
  { card: "6934", txnDate: "07/08/26", merchant: "APPLE.COM/BILL", amount: 31.9 },
  { card: "6934", txnDate: "12/08/26", merchant: "APPLE.COM/BILL", amount: 39.9 },
  { card: "6934", txnDate: "12/08/26", chargeDate: "14/08/26", merchant: "CURSOR USAGE JUL", amount: 55.83 },
  { card: "6934", txnDate: "17/08/26", merchant: "GOOGLE YOUTUBEPREM", amount: 45.9 },

  // ── 6934 Direct — August billing (20/08) domestic ──
  { card: "6934", txnDate: "19/07/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 59 },
  { card: "6934", txnDate: "20/07/26", merchant: "אמיגוס באקה", sector: "שונות", amount: 153 },
  { card: "6934", txnDate: "21/07/26", merchant: "אחוזות החוף- חניון", sector: "שירותי רכב", amount: 44 },
  { card: "6934", txnDate: "21/07/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 16 },
  { card: "6934", txnDate: "21/07/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 128 },
  { card: "6934", txnDate: "25/07/26", merchant: "אחמד זוהדי מרקט", sector: "מכולת/סופר", amount: 156.22 },
  { card: "6934", txnDate: "25/07/26", merchant: "קינמון", sector: "שונות", amount: 24 },
  { card: "6934", txnDate: "22/07/26", merchant: "פועלים- דמי כרטיס", sector: "שונות", amount: 7.8 },
  { card: "6934", txnDate: "27/07/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 16 },
  { card: "6934", txnDate: "27/07/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 49 },
  { card: "6934", txnDate: "28/07/26", merchant: "WOLT", sector: "מסעדות/קפה", amount: 43 },
  { card: "6934", txnDate: "30/07/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 232.87 },
  { card: "6934", txnDate: "30/07/26", merchant: "לנה פארם", sector: "פארמה", amount: 90.79 },
  { card: "6934", txnDate: "30/07/26", merchant: "לנה פארם", sector: "פארמה", amount: 50.3 },
  { card: "6934", txnDate: "30/07/26", merchant: "חלקי חילוף מואסי", sector: "שירותי רכב", amount: 120 },
  { card: "6934", txnDate: "02/08/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 62 },
  { card: "6934", txnDate: "02/08/26", merchant: "אחוזות החוף- חניון", sector: "שירותי רכב", amount: 44 },
  { card: "6934", txnDate: "02/08/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 25 },
  { card: "6934", txnDate: "06/08/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 420.04 },
  { card: "6934", txnDate: "07/08/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 90 },
  { card: "6934", txnDate: "08/08/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 400.61 },
  { card: "6934", txnDate: "08/08/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 157.5 },
  { card: "6934", txnDate: "08/08/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 361.8 },
  { card: "6934", txnDate: "08/08/26", merchant: "אמיגוס באקה", sector: "שונות", amount: 217 },
  { card: "6934", txnDate: "08/08/26", merchant: "סאן גת", sector: "שונות", amount: 100 },
  { card: "6934", txnDate: "09/08/26", merchant: "אחוזות החוף- חניון", sector: "שירותי רכב", amount: 44 },
  { card: "6934", txnDate: "10/08/26", merchant: "עיר המותגים", sector: "הלבשה", amount: 1180 },
  { card: "6934", txnDate: "11/08/26", merchant: "סופרמרקט תאופיק חלף", sector: "מכולת/סופר", amount: 24 },
  { card: "6934", txnDate: "13/08/26", merchant: "בלוביריי", sector: "מעדניות", amount: 70 },
  { card: "6934", txnDate: "13/08/26", merchant: "MILAGROS", sector: "מסעדות/קפה", amount: 107 },
  { card: "6934", txnDate: "13/08/26", merchant: "מינימרקט אלערין", sector: "מכולת/סופר", amount: 107 },
  { card: "6934", txnDate: "16/08/26", merchant: "אמיגוס באקה", sector: "שונות", amount: 91 },
  { card: "6934", txnDate: "18/08/26", merchant: "סטאר קפה", sector: "מסעדות/קפה", amount: 32 },
  { card: "6934", txnDate: "18/08/26", merchant: "טן באקה-צמרת", sector: "דלק", amount: 416.71 },
  { card: "6934", txnDate: "19/08/26", merchant: 'בונז"ור בקה', sector: "מסעדות/קפה", amount: 127 },
  { card: "6934", txnDate: "19/08/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 85 },
];

const BANK_ROWS: SourceRow[] = [
  { card: "bank", txnDate: "01/07/26", merchant: "ONTIME-עמ' עוש", amount: 9, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "03/07/26", merchant: "ע.מפעולות-ישיר", amount: 19.25, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "03/07/26", merchant: "עמ'הקצאת אשראי", amount: 3.69, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "05/07/26", merchant: "מכבי", amount: 92.85, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "12/07/26", merchant: "העברה לותד אבראהים", amount: 50, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "26/07/26", merchant: "העברה לותד אבראהים", amount: 50, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "02/08/26", merchant: "ONTIME-עמ' עוש", amount: 9, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "03/08/26", merchant: "ע.מפעולות-ישיר", amount: 24.5, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "07/08/26", merchant: "מכבי", amount: 92.85, paymentMethod: BANK_PM },
  { card: "bank", txnDate: "17/08/26", merchant: "העברה לותד אבראהים", amount: 50, paymentMethod: BANK_PM },
];

const GIFT_ROWS: SourceRow[] = [
  {
    txnDate: "28/08/26",
    merchant: "هدية ريحان",
    amount: 600,
    paymentMethod: CASH_PM,
    notes: "سحب بنكي 28/08",
  },
  {
    txnDate: "25/08/26",
    merchant: "هدية امي",
    amount: 3500,
    paymentMethod: CASH_PM,
    notes: "سحب بنكي 25/08",
  },
  {
    txnDate: "18/08/26",
    merchant: "تحويل لأخي",
    amount: 1000,
    paymentMethod: CASH_PM,
    notes: "أرسلت مرة 1000 ثم 3000",
  },
  {
    txnDate: "20/08/26",
    merchant: "تحويل لأخي",
    amount: 3000,
    paymentMethod: CASH_PM,
    notes: "أرسلت مرة 1000 ثم 3000",
  },
];

const MERCHANT_ALIASES: [RegExp, RegExp][] = [
  [/אלהודא/i, /הד[ىي]|הודא|alhuda|سوبر.*هدى|llhoda/i],
  [/אלביאן/i, /ביאן|albiyan/i],
  [/אלבאבור|אלדואר/i, /babur|الدوار|elbabu|elababur/i],
  [/פז|yellow|טן/i, /בנזין|דלק|paz|بنزين/i],
  [/קינמון/i, /kinamon|سينامون|cinnamon/i],
  [/לנה פארם/i, /lana|فارم|عطر|رهام/i],
  [/אלערין/i, /أحمد سيدو|سيدو|arin/i],
  [/אלואחה/i, /الواحة|ואחה|alwaha/i],
  [/תאופיק/i, /tawfek|توفيق/i],
  [/זאצי/i, /zachi|زachi/i],
  [/אמיגוס/i, /amigos/i],
  [/בונז/i, /bonjour|بنجور/i],
  [/בלוביריי/i, /blue\s*berr|بلوبري/i],
  [/עיר המותגים/i, /המותגים/i],
  [/GITHUB/i, /github/i],
  [/APPLE\.COM/i, /apple|icloud|chatgpt/i],
  [/CURSOR/i, /cursor/i],
  [/GOOGLE|YOUTUBE/i, /google|youtube/i],
  [/OVERLEAF/i, /overleaf/i],
  [/WOLT/i, /wolt/i],
  [/AIG/i, /aig|ביטוח/i],
  [/דרך ארץ/i, /דרך ארץ/i],
  [/דפוס אלפאתח/i, /לפטה|מطبعة|دפוס/i],
  [/KRUNCHY/i, /krunchy|كرانتش/i],
  [/BIT/i, /bit|שי לינצקי/i],
  [/מכבי/i, /مכבי|مكابي|תأمين صحي/i],
  [/هدية ريحان|ريحان/i, /ريحان|rehan/i],
  [/هدية امي/i, /امي|أمي|امي/i],
  [/تحويل لأخي/i, /أخي|اخي|أخ/i],
  [/ותד אבראהים/i, /אבראהים|إبراهيم/i],
  [/عبدالرحيم|عبد الرحيم/i, /عبدالرحيم|عبدالرحيم/i],
];

function parseDdMmYy(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

function occurredAtForRow(row: SourceRow): Date {
  const txn = parseDdMmYy(row.txnDate);
  if (!row.chargeDate) return txn;
  const charge = parseDdMmYy(row.chargeDate);
  return charge.getTime() > txn.getTime() ? charge : txn;
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[.,()+\-–—'"״]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function amountsMatch(a: number, b: number, tolerance = 2.5) {
  return Math.abs(a - b) <= tolerance;
}

function datesClose(a: Date, b: Date, days = 4) {
  return Math.abs(a.getTime() - b.getTime()) <= days * 24 * 60 * 60 * 1000;
}

function descriptionsMatch(sourceMerchant: string, txDescription: string | null) {
  const src = normalizeText(sourceMerchant);
  const imp = normalizeText(txDescription);
  if (!src || !imp) return false;
  if (src === imp || imp.includes(src) || src.includes(imp)) return true;

  const srcTokens = src.split(" ").filter((t) => t.length >= 3);
  const impTokens = new Set(imp.split(" ").filter((t) => t.length >= 3));
  if (srcTokens.some((t) => impTokens.has(t))) return true;

  for (const [a, b] of MERCHANT_ALIASES) {
    if (a.test(sourceMerchant) && b.test(txDescription ?? "")) return true;
    if (b.test(sourceMerchant) && a.test(txDescription ?? "")) return true;
  }
  return false;
}

function matchTxToSource(tx: Transaction, row: SourceRow): boolean {
  if (!amountsMatch(Number(tx.amount), row.amount)) return false;
  if (!datesClose(tx.occurredAt, occurredAtForRow(row))) return false;
  return descriptionsMatch(row.merchant, tx.description);
}

function sourceKey(row: SourceRow) {
  const d = occurredAtForRow(row);
  return `${row.card ?? "x"}|${d.toISOString().slice(0, 10)}|${row.amount.toFixed(2)}|${normalizeText(row.merchant)}`;
}

async function ensurePm(
  prisma: PrismaClient,
  userId: string,
  name: string,
  cache: Map<string, string>
) {
  const hit = cache.get(name);
  if (hit) return hit;
  let pm = await prisma.paymentMethod.findFirst({ where: { userId, name } });
  if (!pm && !dryRun) {
    pm = await prisma.paymentMethod.create({ data: { userId, name } });
  }
  if (pm) cache.set(name, pm.id);
  return pm?.id;
}

async function ensureCategory(
  prisma: PrismaClient,
  userId: string,
  name: string,
  kind: CategoryKind,
  catByName: Record<string, { id: string }>
) {
  if (catByName[name]) return catByName[name].id;
  if (dryRun) return undefined;
  const created = await prisma.category.create({
    data: { userId, name, kind },
  });
  catByName[name] = created;
  return created.id;
}

async function importRows(
  prisma: PrismaClient,
  userId: string,
  rows: SourceRow[],
  existing: Transaction[],
  catByName: Record<string, { id: string }>,
  pmCache: Map<string, string>,
  defaultPmName: string,
  note: string
) {
  const matched = new Set<string>();
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const key = sourceKey(row);
    const dup = existing.find((tx) => !matched.has(tx.id) && matchTxToSource(tx, row));
    if (dup) {
      matched.add(dup.id);
      skipped++;
      continue;
    }

    const occurredAt = occurredAtForRow(row);
    const catName = categorizeExpense(row.merchant, row.sector);
    const pmName = row.paymentMethod ?? defaultPmName;
    const paymentMethodId = await ensurePm(prisma, userId, pmName, pmCache);
    const categoryId = await ensureCategory(
      prisma,
      userId,
      catName,
      CategoryKind.EXPENSE,
      catByName
    );

    console.log(
      `+ ${occurredAt.toISOString().slice(0, 10)} | ${row.amount.toFixed(2)} | ${row.merchant} → ${catName}`
    );

    if (!dryRun) {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          categoryId: categoryId!,
          paymentMethodId,
          type: TransactionType.EXPENSE,
          amount: row.amount,
          occurredAt,
          description: row.merchant.trim(),
          notes: row.notes ?? `${note}${row.card && row.card !== "bank" ? ` (${row.card})` : ""}`,
        },
      });
      existing.push(tx);
    }
    imported++;
    matched.add(key);
  }

  return { imported, skipped };
}

async function markAugustJamiya1000(prisma: PrismaClient, userId: string) {
  const plan = await prisma.savingsPlan.findFirst({
    where: { userId, title: "جمعية العائلة", monthlyContribution: 1000 },
  });
  if (!plan) {
    console.log("! جمعية 1000 plan not found");
    return;
  }
  const existing = await prisma.savingsEntry.findUnique({
    where: {
      planId_periodYear_periodMonth: {
        planId: plan.id,
        periodYear: 2026,
        periodMonth: 8,
      },
    },
  });
  if (existing?.paid) {
    console.log("= جمعية 1000 August already paid");
    return;
  }
  const paidAt = paidAtForPeriod(2026, 8);
  console.log("+ جمعية العائلة 1000 for August 2026");
  if (dryRun) return;

  const savingsCat = await prisma.category.findFirst({
    where: { userId, name: "ادخار", kind: CategoryKind.SAVINGS },
  });
  const tx = await prisma.transaction.create({
    data: {
      userId,
      type: TransactionType.SAVINGS_CONTRIBUTION,
      amount: 1000,
      occurredAt: paidAt,
      categoryId: savingsCat?.id,
      description: `ادخار — ${plan.title}`,
      currency: "ILS",
    },
  });
  await prisma.savingsEntry.upsert({
    where: {
      planId_periodYear_periodMonth: {
        planId: plan.id,
        periodYear: 2026,
        periodMonth: 8,
      },
    },
    create: {
      planId: plan.id,
      periodYear: 2026,
      periodMonth: 8,
      amount: 1000,
      paid: true,
      paidAt,
      transactionId: tx.id,
    },
    update: {
      amount: 1000,
      paid: true,
      paidAt,
      transactionId: tx.id,
    },
  });
}

async function addMajadlaPayment(prisma: PrismaClient, userId: string) {
  const building = await prisma.project.findFirst({
    where: { userId, kind: ProjectKind.MASTER_BUILD },
  });
  if (!building) throw new Error("Building project not found");

  const existing = await prisma.project.findFirst({
    where: { userId, parentProjectId: building.id, title: "محمد مجادلة" },
  });
  if (existing) {
    const paid = await prisma.transaction.findFirst({
      where: { userId, projectId: existing.id, amount: 4000 },
    });
    if (paid) {
      console.log("= محمد مجادلة 4000 already recorded");
      return;
    }
  }

  console.log("+ محمد مجادلة 4000 on 2026-09-01");
  if (dryRun) return;

  const buildCat = await prisma.category.findFirst({
    where: { userId, name: "بناء" },
  });
  const cashId = await prisma.paymentMethod.findFirst({
    where: { userId, name: CASH_PM },
  });
  const occurredAt = new Date(Date.UTC(2026, 8, 1));

  const project =
    existing ??
    (await prisma.project.create({
      data: {
        userId,
        parentProjectId: building.id,
        kind: ProjectKind.BUILD_CONTRACTOR,
        title: "محمد مجادلة",
        totalBudget: 4000,
        status: ProjectStatus.COMPLETED,
      },
    }));

  const schedule = buildInstallmentSchedule({
    mode: PaymentPlanMode.FULL,
    totalAmount: 4000,
    startDate: occurredAt,
  });

  const plan = await prisma.projectPaymentPlan.create({
    data: {
      userId,
      projectId: project.id,
      title: "دفعة نقدية",
      mode: PaymentPlanMode.FULL,
      totalAmount: 4000,
      payeeName: "محمد مجادلة",
      startDate: occurredAt,
      paymentMethodId: cashId?.id,
      installments: {
        create: schedule.map((s) => ({
          sequence: s.sequence,
          label: s.label,
          dueDate: s.dueDate,
          amount: s.amount,
          status: InstallmentStatus.PENDING,
        })),
      },
    },
    include: { installments: true },
  });

  const inst = plan.installments[0]!;
  const tx = await prisma.transaction.create({
    data: {
      userId,
      projectId: project.id,
      categoryId: buildCat?.id,
      paymentMethodId: cashId?.id,
      type: TransactionType.EXPENSE,
      amount: 4000,
      occurredAt,
      description: `${inst.label ?? installmentLabel(1)} — محمد مجادلة`,
    },
  });
  await prisma.projectInstallment.update({
    where: { id: inst.id },
    data: { status: InstallmentStatus.PAID, transactionId: tx.id },
  });
  if (project.status !== ProjectStatus.COMPLETED) {
    await prisma.project.update({
      where: { id: project.id },
      data: { status: ProjectStatus.COMPLETED, totalBudget: 4000 },
    });
  }
}

async function replaceSilulaPlan(prisma: PrismaClient, userId: string) {
  const project = await prisma.project.findFirst({
    where: { userId, title: { in: ["סלילה", "הטלת סלילה"] } },
    include: {
      paymentPlans: { include: { installments: true } },
    },
  });
  if (!project) throw new Error("סלילה project not found");

  const already = project.paymentPlans.find(
    (p) => Number(p.totalAmount) === 45000 && Number(p.recurringAmount) === 1500
  );
  if (already) {
    console.log("= הטלת סלילה 45000 plan already exists");
    return;
  }

  const startDate = new Date(Date.UTC(2026, 8, 15));
  console.log("+ Replace סלילה placeholder with 45,000 / 1,500 from 15.09.2026 (30 months)");

  if (dryRun) return;

  for (const plan of project.paymentPlans) {
    const anyPaid = plan.installments.some((i) => i.status === InstallmentStatus.PAID);
    if (anyPaid) {
      console.log(`! Skipping delete of plan ${plan.id} — has paid installments`);
      continue;
    }
    await prisma.projectInstallment.deleteMany({ where: { planId: plan.id } });
    await prisma.projectPaymentPlan.delete({ where: { id: plan.id } });
  }

  const schedule = buildInstallmentSchedule({
    mode: PaymentPlanMode.INSTALLMENTS,
    totalAmount: 45000,
    installmentCount: 30,
    firstPaymentAmount: 1500,
    recurringAmount: 1500,
    startDate,
  });

  await prisma.projectPaymentPlan.create({
    data: {
      userId,
      projectId: project.id,
      title: "הטלת סלילה",
      mode: PaymentPlanMode.INSTALLMENTS,
      totalAmount: 45000,
      installmentCount: 30,
      firstPaymentAmount: 1500,
      recurringAmount: 1500,
      payeeName: "הטלת סלילה",
      startDate,
      installments: {
        create: schedule.map((s) => ({
          sequence: s.sequence,
          label: s.label,
          dueDate: s.dueDate,
          amount: s.amount,
          status: InstallmentStatus.PENDING,
        })),
      },
    },
  });

  await prisma.project.update({
    where: { id: project.id },
    data: {
      title: "הטלת סלילה",
      totalBudget: 45000,
      status: ProjectStatus.ACTIVE,
    },
  });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const categories = await prisma.category.findMany({ where: { userId: user.id } });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const pmCache = new Map<string, string>();
  const pms = await prisma.paymentMethod.findMany({ where: { userId: user.id } });
  for (const pm of pms) pmCache.set(pm.name, pm.id);

  const rangeStart = new Date(Date.UTC(2026, 5, 1));
  const rangeEnd = new Date(Date.UTC(2026, 9, 2));
  const existing = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: { in: [TransactionType.EXPENSE, TransactionType.SAVINGS_CONTRIBUTION] },
      occurredAt: { gte: rangeStart, lt: rangeEnd },
    },
  });

  console.log(dryRun ? "[dry-run] " : "", `Update Jul–Aug 2026 for ${userEmail}`);
  console.log(`Existing expenses in window: ${existing.length}`);

  console.log("\n--- CARD ---");
  const card = await importRows(
    prisma,
    user.id,
    CARD_ROWS,
    existing,
    catByName,
    pmCache,
    CARD_PM,
    CARD_NOTE
  );
  console.log(`Card imported ${card.imported}, skipped dups ${card.skipped}`);

  console.log("\n--- BANK ---");
  const bank = await importRows(
    prisma,
    user.id,
    BANK_ROWS,
    existing,
    catByName,
    pmCache,
    BANK_PM,
    BANK_NOTE
  );
  console.log(`Bank imported ${bank.imported}, skipped dups ${bank.skipped}`);

  console.log("\n--- GIFTS ---");
  const gifts = await importRows(
    prisma,
    user.id,
    GIFT_ROWS,
    existing,
    catByName,
    pmCache,
    CASH_PM,
    "هدية"
  );
  console.log(`Gifts imported ${gifts.imported}, skipped dups ${gifts.skipped}`);

  console.log("\n--- JAMIYA ---");
  await markAugustJamiya1000(prisma, user.id);

  console.log("\n--- BUILDING ---");
  await addMajadlaPayment(prisma, user.id);
  await replaceSilulaPlan(prisma, user.id);

  console.log("\nDone.");
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
