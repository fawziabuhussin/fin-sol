/**
 * Reconcile Isracard transactions (cards 8841 + 6934) for May–Jul 2026
 * against PDF/Excel statements. Adds missing rows, removes orphaned card imports.
 *
 * Usage: npx tsx scripts/reconcile-isracard-may-jul-2026.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  CategoryKind,
  PrismaClient,
  TransactionType,
  type Transaction,
} from "../src/generated/prisma/client";
import { categorizeExpense } from "../src/lib/expense-categories";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const PAYMENT_METHOD = "אשראי";
const IMPORT_NOTE = "ייבוא דף חיוב ישראכרט 05-07/2026";

type SourceRow = {
  card: "8841" | "6934";
  txnDate: string;
  chargeDate?: string;
  merchant: string;
  sector?: string;
  amount: number;
};

/** Parsed from Unknown-2.pdf (8841), Unknown.pdf (6934), 8841_07_2026.xlsx, 6934_07_2026.xlsx */
const SOURCE_ROWS: SourceRow[] = [
  // ── 8841 Gold — May (June billing PDF) ──
  { card: "8841", txnDate: "23/05/26", chargeDate: "25/05/26", merchant: "OVERLEAF EDITOR", amount: 26.73 },
  { card: "8841", txnDate: "03/05/26", merchant: "ליאמי ע.ל", sector: "שונות", amount: 399.67 },
  { card: "8841", txnDate: "19/05/26", merchant: "ארומה אפליקציה", sector: "מסעדות/קפה", amount: 100 },
  { card: "8841", txnDate: "20/05/26", merchant: "דרך ארץ הוראת קבע", sector: "תש' רשויות", amount: 226.84 },
  { card: "8841", txnDate: "20/05/26", merchant: "אחמד זוהדי מרקט", sector: "מכולת/סופר", amount: 1463.2 },
  { card: "8841", txnDate: "21/05/26", merchant: "פועלים- דמי כרטיס", sector: "שונות", amount: 19.25 },
  { card: "8841", txnDate: "26/05/26", merchant: "העברה ב BIT", sector: "שונות", amount: 200 },
  { card: "8841", txnDate: "27/05/26", merchant: "AIG ביטוח רכב", sector: "ביטוח", amount: 354.41 },
  { card: "8841", txnDate: "27/05/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 203 },
  { card: "8841", txnDate: "28/05/26", merchant: "פז YELLOW", sector: "דלק", amount: 195.7 },
  { card: "8841", txnDate: "28/05/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 339.46 },
  { card: "8841", txnDate: "30/05/26", merchant: 'ב.א. באסל בורגר בע"מ', sector: "שונות", amount: 394 },
  { card: "8841", txnDate: "31/05/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 190.33 },

  // ── 8841 Gold — Jun–Jul (July billing Excel) ──
  { card: "8841", txnDate: "21/06/26", merchant: "דרך ארץ הוראת קבע", sector: "תש' רשויות", amount: 106.15 },
  { card: "8841", txnDate: "21/06/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 141 },
  { card: "8841", txnDate: "22/06/26", merchant: "חלקי חילוף מואסי גוד", sector: "שונות", amount: 20 },
  { card: "8841", txnDate: "23/06/26", merchant: "בלוביריי", sector: "מעדניות", amount: 22 },
  { card: "8841", txnDate: "23/06/26", merchant: "אמיגוס בורגר בר", sector: "מסעדות/קפה", amount: 36.48 },
  { card: "8841", txnDate: "23/06/26", merchant: "קינמון", sector: "שונות", amount: 60 },
  { card: "8841", txnDate: "23/06/26", merchant: "פועלים- דמי כרטיס", sector: "שונות", amount: 19.25 },
  { card: "8841", txnDate: "23/06/26", chargeDate: "25/06/26", merchant: "OVERLEAF EDITOR", amount: 27.51 },
  { card: "8841", txnDate: "24/06/26", merchant: "סנאבל אל עלם ע\"ר", sector: "שונות", amount: 50 },
  { card: "8841", txnDate: "25/06/26", merchant: "מ.תחבורה רב-פס", sector: "תש' רשויות", amount: 210 },
  { card: "8841", txnDate: "26/06/26", merchant: "אקאסיה בוטיק", sector: "משתלות", amount: 200 },
  { card: "8841", txnDate: "26/06/26", merchant: "אחמד זוהדי מרקט", sector: "מכולת/סופר", amount: 1331.95 },
  { card: "8841", txnDate: "26/06/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 84 },
  { card: "8841", txnDate: "26/06/26", chargeDate: "28/06/26", merchant: "VERCEL DOMAINS", amount: 41.39 },
  { card: "8841", txnDate: "29/06/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 99.9 },
  { card: "8841", txnDate: "29/06/26", merchant: "AIG ביטוח רכב", sector: "ביטוח", amount: 353.4 },
  { card: "8841", txnDate: "30/06/26", merchant: 'אונ.ב"ג--דמי רישום', sector: "שונות", amount: 250 },
  { card: "8841", txnDate: "30/06/26", merchant: "ראיד אמבלייזרים", sector: "שונות", amount: 300 },
  { card: "8841", txnDate: "30/06/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 10 },
  { card: "8841", txnDate: "01/07/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 377.8 },
  { card: "8841", txnDate: "02/07/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 35 },
  { card: "8841", txnDate: "02/07/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 39 },
  { card: "8841", txnDate: "03/07/26", chargeDate: "05/07/26", merchant: "ALIEXPRESS", amount: 53.81 },
  { card: "8841", txnDate: "04/07/26", merchant: "פייס אוף קייק באקה", sector: "מסעדות/קפה", amount: 39.22 },

  // ── 6934 Direct — foreign (June billing PDF) ──
  { card: "6934", txnDate: "25/05/26", chargeDate: "28/05/26", merchant: "APPLE.COM/BILL", amount: 69.9 },
  { card: "6934", txnDate: "28/05/26", chargeDate: "31/05/26", merchant: "CURSOR, AI POWERED", amount: 57.85 },
  { card: "6934", txnDate: "07/06/26", chargeDate: "08/06/26", merchant: "APPLE.COM/BILL", amount: 31.9 },
  { card: "6934", txnDate: "08/06/26", chargeDate: "12/06/26", merchant: "PAYPAL *AISGECOMME", amount: 281.54 },
  { card: "6934", txnDate: "12/06/26", chargeDate: "12/06/26", merchant: "APPLE.COM/BILL", amount: 39.9 },
  { card: "6934", txnDate: "11/06/26", chargeDate: "14/06/26", merchant: "GITHUB, INC.", amount: 30.2 },
  { card: "6934", txnDate: "15/06/26", merchant: "APPLE.COM/BILL", amount: 529.9 },
  { card: "6934", txnDate: "16/06/26", merchant: "APPLE.COM/BILL", amount: 699.9 },
  { card: "6934", txnDate: "17/06/26", chargeDate: "19/06/26", merchant: "GOOGLE YOUTUBEPREM", amount: 45.9 },

  // ── 6934 Direct — domestic May (June billing PDF) ──
  { card: "6934", txnDate: "20/05/26", merchant: 'בונז"ור בקה', sector: "מסעדות/קפה", amount: 117 },
  { card: "6934", txnDate: "20/05/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 91 },
  { card: "6934", txnDate: "22/05/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 179.14 },
  { card: "6934", txnDate: "23/05/26", merchant: "בלוביריי", sector: "מעדניות", amount: 50 },
  { card: "6934", txnDate: "23/05/26", merchant: "LAVIA", sector: "הלבשה", amount: 595 },
  { card: "6934", txnDate: "23/05/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 385.55 },
  { card: "6934", txnDate: "23/05/26", merchant: 'סטאר בוקס קפה בע"מ', sector: "מסעדות/קפה", amount: 99 },
  { card: "6934", txnDate: "23/05/26", merchant: 'סטאר בוקס קפה בע"מ', sector: "מסעדות/קפה", amount: 26 },
  { card: "6934", txnDate: "23/05/26", merchant: "עיר המותגים", sector: "הלבשה", amount: 470 },
  { card: "6934", txnDate: "24/05/26", merchant: "טכנו ג'ת", sector: "שונות", amount: 260 },
  { card: "6934", txnDate: "24/05/26", merchant: "טכנו ג'ת", sector: "שונות", amount: 18 },
  { card: "6934", txnDate: "21/05/26", merchant: "פועלים- דמי כרטיס", sector: "שונות", amount: 7.8 },
  { card: "6934", txnDate: "25/05/26", merchant: "חשמל וצבע הכפר", sector: "שונות", amount: 170 },
  { card: "6934", txnDate: "25/05/26", merchant: "חשמל וצבע הכפר", sector: "שונות", amount: 160 },
  { card: "6934", txnDate: "25/05/26", merchant: "חשמל וצבע הכפר", sector: "שונות", amount: 65 },
  { card: "6934", txnDate: "25/05/26", merchant: "פרחי אליאסמין", sector: "שונות", amount: 236 },
  { card: "6934", txnDate: "28/05/26", merchant: "בלוביריי", sector: "מעדניות", amount: 25 },

  // ── 6934 Direct — domestic Jun (PDF + Excel) ──
  { card: "6934", txnDate: "01/06/26", merchant: "אטלנטק פוד", sector: "מכולת/סופר", amount: 18 },
  { card: "6934", txnDate: "01/06/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 30 },
  { card: "6934", txnDate: "02/06/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 56.9 },
  { card: "6934", txnDate: "02/06/26", merchant: "אילנס רכבת באר שבע צ", sector: "מסעדות/קפה", amount: 62 },
  { card: "6934", txnDate: "03/06/26", merchant: "דפוס אלפאתח", sector: "עיתון/דפוס", amount: 200 },
  { card: "6934", txnDate: "04/06/26", merchant: "אקאסיה בוטיק", sector: "משתלות", amount: 150 },
  { card: "6934", txnDate: "04/06/26", merchant: "האאט דילברי", sector: "תחבורה", amount: 125 },
  { card: "6934", txnDate: "07/06/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 400.15 },
  { card: "6934", txnDate: "07/06/26", merchant: "חברת החשמל לישראל בע", sector: "תש' רשויות", amount: 1544.72 },
  { card: "6934", txnDate: "07/06/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 97.8 },
  { card: "6934", txnDate: "09/06/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 95 },
  { card: "6934", txnDate: "10/06/26", merchant: "בית הבשר והמזון באקה", sector: "שונות", amount: 18 },
  { card: "6934", txnDate: "10/06/26", merchant: "בית הבשר והמזון באקה", sector: "שונות", amount: 500 },
  { card: "6934", txnDate: "10/06/26", merchant: "מאפיית אלדואר", sector: "מעדניות", amount: 20 },
  { card: "6934", txnDate: "10/06/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 99.8 },
  { card: "6934", txnDate: "10/06/26", merchant: "מרכז אלואחה למזון ו", sector: "מכולת/סופר", amount: 103 },
  { card: "6934", txnDate: "11/06/26", merchant: "אגיאל פאסט פוד וקפה", sector: "שונות", amount: 7 },
  { card: "6934", txnDate: "12/06/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 113 },
  { card: "6934", txnDate: "13/06/26", merchant: "חנות אלברכה", sector: "מכולת/סופר", amount: 25 },
  { card: "6934", txnDate: "13/06/26", merchant: "לנה פארם", sector: "פארמה", amount: 47.65 },
  { card: "6934", txnDate: "14/06/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 42 },
  { card: "6934", txnDate: "15/06/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 271.81 },
  { card: "6934", txnDate: "15/06/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 17 },
  { card: "6934", txnDate: "15/06/26", merchant: "זול סטוק סניף באקה א", sector: "כלי בית", amount: 199.9 },
  { card: "6934", txnDate: "15/06/26", merchant: "מנגו סטין", sector: "שונות", amount: 160 },
  { card: "6934", txnDate: "16/06/26", merchant: "המקסיקני אוניברסיטת", sector: "מסעדות/קפה", amount: 83 },
  { card: "6934", txnDate: "18/06/26", merchant: "רוזמרין מרקט", sector: "מכולת/סופר", amount: 119.7 },
  { card: "6934", txnDate: "20/06/26", merchant: 'סופר-פארם באקה סנטר', sector: "פארמה", amount: 274 },
  { card: "6934", txnDate: "20/06/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 411.44 },
  { card: "6934", txnDate: "20/06/26", merchant: "פז אפליקצית-YELLOW", sector: "דלק", amount: 4 },
  { card: "6934", txnDate: "20/06/26", merchant: "מאפיית אלבאבור", sector: "מעדניות", amount: 120 },
  { card: "6934", txnDate: "21/06/26", merchant: "רוזמרין מרקט", sector: "מכולת/סופר", amount: 51.9 },
  { card: "6934", txnDate: "23/06/26", merchant: "פועלים- דמי כרטיס", sector: "שונות", amount: 7.8 },
  { card: "6934", txnDate: "24/06/26", merchant: "LA CHILLOUT", sector: "מסעדות/קפה", amount: 32 },
  { card: "6934", txnDate: "28/06/26", merchant: "APPLE.COM/BILL", amount: 50.9 },
  { card: "6934", txnDate: "28/06/26", merchant: "בית קליה אבו פול", sector: "שונות", amount: 30 },
  { card: "6934", txnDate: "28/06/26", chargeDate: "30/06/26", merchant: "CURSOR, AI POWERED IDE", amount: 60.94 },
  { card: "6934", txnDate: "28/06/26", merchant: 'ביג סטור המרכז בע"מ', sector: "שונות", amount: 113.7 },
  { card: "6934", txnDate: "29/06/26", merchant: "מוביטי", sector: "תחבורה", amount: 50 },
  { card: "6934", txnDate: "29/06/26", merchant: "קינמון", sector: "שונות", amount: 55 },
  { card: "6934", txnDate: "01/07/26", merchant: "GOOGLE CLOUD QZCN6L", amount: 3.06 },
  { card: "6934", txnDate: "04/07/26", merchant: "יור קפה בע''מ", sector: "מסעדות/קפה", amount: 5 },
  { card: "6934", txnDate: "04/07/26", chargeDate: "06/07/26", merchant: "GITHUB, INC.", amount: 30.83 },
  { card: "6934", txnDate: "04/07/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 66 },
  { card: "6934", txnDate: "05/07/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 36.5 },
  { card: "6934", txnDate: "05/07/26", merchant: 'סופר אלביאן בע"מ', sector: "מכולת/סופר", amount: 24 },
  { card: "6934", txnDate: "06/07/26", merchant: "סופר מרקט אלהודא", sector: "שונות", amount: 130.4 },
  { card: "6934", txnDate: "06/07/26", merchant: "השוק הסיני", sector: "שונות", amount: 100 },
  { card: "6934", txnDate: "07/07/26", chargeDate: "08/07/26", merchant: "CURSOR USAGE MID JUN", amount: 126.07 },
  { card: "6934", txnDate: "07/07/26", merchant: "APPLE.COM/BILL", amount: 31.9 },
];

const MERCHANT_ALIASES: [RegExp, RegExp][] = [
  [/אלהודא|אלהודא/i, /הד[ىي]|הודא|alhuda|סופר אלהודא/i],
  [/אלביאן/i, /ביאן|albiyan/i],
  [/אלבאבור|אלדואר/i, /בابور|babur|الدوار|rozmaren|rozmari/i],
  [/פז|yellow/i, /בנזין|דלק|paz/i],
  [/האאט|דילברי/i, /afandena|star box|אכל מ/i],
  [/בלוביריי/i, /blue\s*berr|بلوبري|blueberry/i],
  [/אקאסיה/i, /akaysia|akasia/i],
  [/המקסיקני/i, /maxicani|mexicani/i],
  [/אמיגוס/i, /amigos/i],
  [/ארומה/i, /اروما|aroma/i],
  [/סטאר בוקס|starbucks/i, /star box/i],
  [/בונז/i, /بنجور|bonjour/i],
  [/עיר המותגים/i, /המותגים/i],
  [/LAVIA/i, /lavia/i],
  [/GITHUB/i, /github/i],
  [/APPLE\.COM/i, /apple|icloud|chatgpt/i],
  [/CURSOR/i, /cursor/i],
  [/GOOGLE/i, /google|youtube/i],
  [/OVERLEAF/i, /overleaf/i],
  [/VERCEL/i, /vercel/i],
  [/PAYPAL|AISGECOMME/i, /car parts|חלקי|aliexpress/i],
  [/חברת החשמל/i, /كهرباء|חשמל/i],
  [/דפוס אלפאתח/i, /לפטה|לافتة|מطبعة/i],
  [/לנה פארם/i, /lana phar|فارم/i],
  [/מרכז אלואחה/i, /الواحة|ואחה/i],
  [/בית הבשר/i, /לحمة|meathouse/i],
  [/מנגו סטין/i, /מנגוסטין|mangosteen/i],
  [/זול סטוק/i, /זול הסטוק|zol stock/i],
  [/LA CHILLOUT/i, /chillout/i],
  [/בית קליה אבו פול/i, /abo fol|אבו פול/i],
  [/רוזמרין/i, /rozmaren/i],
  [/סופר-פארם/i, /هدية سعيد|super.?pharm/i],
  [/AIG/i, /aig|ביטוח/i],
  [/דרך ארץ/i, /דרך ארץ/i],
  [/מ\.תחבורה|רב-פס/i, /תחבורה|רב.?פס/i],
  [/חלקי חילוף/i, /חלקי חילוף|חלקי/i],
  [/קינמון/i, /kinamon|سينامون|cinnamon/i],
  [/אילנס/i, /אילנס/i],
  [/אטלנטק/i, /el medina|medina market/i],
  [/חשמל וצבע/i, /كهرباء|חשמל.*הבלה|حسام/i],
  [/פרחי אליאסמין/i, /ازهار|יاسمين|jasmine/i],
  [/טכנו/i, /techno/i],
  [/ALIEXPRESS/i, /aliexpress|השוק הסיני/i],
];

function parseDdMmYy(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

function occurredAtForRow(row: SourceRow): Date {
  const txn = parseDdMmYy(row.txnDate);
  if (!row.chargeDate) return txn;
  const charge = parseDdMmYy(row.chargeDate);
  if (charge.getTime() > txn.getTime()) return charge;
  return txn;
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

function datesClose(a: Date, b: Date, days = 5) {
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

function sourceKey(row: SourceRow) {
  const d = occurredAtForRow(row);
  return `${row.card}|${d.toISOString().slice(0, 10)}|${row.amount.toFixed(2)}|${normalizeText(row.merchant)}`;
}

function dedupeSourceRows(rows: SourceRow[]): SourceRow[] {
  const seen = new Set<string>();
  const out: SourceRow[] = [];
  for (const row of rows) {
    const key = sourceKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function matchTxToSource(tx: Transaction, row: SourceRow): boolean {
  const txAmount = Number(tx.amount);
  const rowDate = occurredAtForRow(row);
  if (!amountsMatch(txAmount, row.amount)) return false;
  if (!datesClose(tx.occurredAt, rowDate)) return false;
  return descriptionsMatch(row.merchant, tx.description);
}

function isCardRelatedTx(
  tx: Transaction & { paymentMethod?: { name: string } | null }
): boolean {
  const pm = tx.paymentMethod?.name ?? "";
  if (pm === PAYMENT_METHOD || pm === "اشراي" || pm === "אשראי") return true;
  if (tx.notes?.includes("ייבוא דף חיוב ישראכרט")) return true;
  return false;
}

function isProtectedTx(tx: Transaction): boolean {
  if (tx.salarySlipId) return true;
  if (tx.notes?.startsWith("اشتراك شهري —")) return true;
  return false;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const user = await prisma.user.findFirst({ where: { email: userEmail } });
  if (!user) throw new Error(`User not found: ${userEmail}`);

  const sources = dedupeSourceRows(SOURCE_ROWS);
  const rangeStart = new Date(Date.UTC(2026, 4, 1));
  const rangeEnd = new Date(Date.UTC(2026, 7, 9));

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

  const existing = await prisma.transaction.findMany({
    where: {
      userId: user.id,
      type: TransactionType.EXPENSE,
      occurredAt: { gte: rangeStart, lt: rangeEnd },
    },
    include: {
      paymentMethod: true,
      subscriptionPayment: true,
      installment: true,
    },
  });

  const matchedTxIds = new Set<string>();
  const matchedSourceKeys = new Set<string>();

  for (const row of sources) {
    const match = existing.find(
      (tx) => !matchedTxIds.has(tx.id) && matchTxToSource(tx, row)
    );
    if (match) {
      matchedTxIds.add(match.id);
      matchedSourceKeys.add(sourceKey(row));
    }
  }

  const toAdd = sources.filter((row) => !matchedSourceKeys.has(sourceKey(row)));

  const unmatchedSources = sources.filter((row) => !matchedSourceKeys.has(sourceKey(row)));

  const toRemove = existing.filter((tx) => {
    if (matchedTxIds.has(tx.id)) return false;
    if (isProtectedTx(tx)) return false;
    if (tx.installment) return false;
    if (tx.subscriptionPayment) return false;

    // Remove card-import orphans (אשראי / isracard notes) not backed by a statement row
    if (isCardRelatedTx(tx)) {
      const backed = sources.some((row) => matchTxToSource(tx, row));
      if (!backed) return true;
    }

    // Remove manual Arabic/duplicate entries when a statement row will replace them
    const replacingSource = unmatchedSources.find((row) => matchTxToSource(tx, row));
    if (replacingSource) return true;

    // Remove obvious amount typos when the correct statement row is being imported
    const typoSource = unmatchedSources.find((row) => {
      if (!datesClose(tx.occurredAt, occurredAtForRow(row))) return false;
      if (!descriptionsMatch(row.merchant, tx.description)) return false;
      const txAmt = Number(tx.amount);
      if (amountsMatch(txAmt, row.amount)) return false;
      return txAmt > row.amount * 3;
    });
    if (typoSource) return true;

    return false;
  });

  console.log(dryRun ? "[dry-run] " : "", `Reconcile Isracard May–Jul 2026 for ${userEmail}`);
  console.log(`Source rows: ${sources.length}, matched: ${matchedSourceKeys.size}`);
  console.log(`To add: ${toAdd.length}, to remove: ${toRemove.length}`);

  if (toAdd.length) {
    console.log("\n--- ADD ---");
    for (const row of toAdd) {
      const occurredAt = occurredAtForRow(row);
      const catName = categorizeExpense(row.merchant, row.sector);
      console.log(
        `+ ${occurredAt.toISOString().slice(0, 10)} | ${row.amount.toFixed(2)} | [${row.card}] ${row.merchant} → ${catName}`
      );

      if (!dryRun) {
        let categoryId = catByName[catName]?.id;
        if (!categoryId) {
          const created = await prisma.category.create({
            data: { userId: user.id, name: catName, kind: CategoryKind.EXPENSE },
          });
          categoryId = created.id;
          catByName[catName] = created;
        }

        const tx = await prisma.transaction.create({
          data: {
            userId: user.id,
            categoryId: categoryId!,
            paymentMethodId: pm?.id,
            type: TransactionType.EXPENSE,
            amount: row.amount,
            occurredAt,
            description: row.merchant.trim(),
            notes: `${IMPORT_NOTE} (${row.card})`,
          },
        });
        existing.push({ ...tx, paymentMethod: pm, subscriptionPayment: null, installment: null });
        matchedSourceKeys.add(sourceKey(row));
      }
    }
  }

  if (toRemove.length) {
    console.log("\n--- REMOVE ---");
    for (const tx of toRemove) {
      console.log(
        `- ${tx.occurredAt.toISOString().slice(0, 10)} | ${Number(tx.amount).toFixed(2)} | ${tx.description ?? ""} | ${tx.paymentMethod?.name ?? "-"}`
      );
      if (!dryRun) {
        await prisma.transaction.delete({ where: { id: tx.id } });
      }
    }
  }

  const addTotal = toAdd.reduce((s, r) => s + r.amount, 0);
  const removeTotal = toRemove.reduce((s, t) => s + Number(t.amount), 0);
  console.log(`\nAdd total: ${addTotal.toFixed(2)} ILS, Remove total: ${removeTotal.toFixed(2)} ILS`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
