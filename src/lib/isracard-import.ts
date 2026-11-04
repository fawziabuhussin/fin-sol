import {
  CategoryKind,
  PrismaClient,
  TransactionType,
  type Transaction,
} from "@/generated/prisma/client";
import { categorizeExpense } from "@/lib/expense-categories";

export const ISRACARD_PAYMENT_METHOD = "אשראי";

export type IsracardStatementRow = {
  txnDate: string;
  merchant: string;
  sector?: string;
  amount: number;
  installmentNote?: string;
  standingOrder?: boolean;
};

export type IsracardStatementPack = {
  id: string;
  label: string;
  cardNote: string;
  importNote: string;
  rows: IsracardStatementRow[];
};

/** Built-in statement packs (same data as scripts/import-isracard-*.ts). */
export const ISRACARD_STATEMENT_PACKS: IsracardStatementPack[] = [
  {
    id: "2026-11",
    label: "חיוב 11/2026 — Gold 8841",
    cardNote: "8841",
    importNote: "ייבוא ישראכרט 8841 — חיוב 11/2026",
    rows: [
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
    ],
  },
];

export function listIsracardStatementPacks() {
  return ISRACARD_STATEMENT_PACKS.map(({ id, label, cardNote, rows }) => ({
    id,
    label,
    cardNote,
    rowCount: rows.length,
    statementTotal: rows.reduce((s, r) => s + r.amount, 0),
  }));
}

export function getIsracardStatementPack(packId: string): IsracardStatementPack | undefined {
  return ISRACARD_STATEMENT_PACKS.find((p) => p.id === packId);
}

export function parseIsracardDdMmYy(s: string): Date {
  const [d, m, y] = s.split("/").map(Number);
  return new Date(Date.UTC(2000 + y, m - 1, d));
}

function normalizeDescription(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function isracardDescriptionsMatch(
  a: string,
  b: string | null | undefined
): boolean {
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

function dedupeWindowForPack(pack: IsracardStatementPack) {
  const dates = pack.rows.map((r) => parseIsracardDdMmYy(r.txnDate).getTime());
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  min.setUTCDate(min.getUTCDate() - 1);
  max.setUTCDate(max.getUTCDate() + 2);
  return { gte: min, lt: max };
}

export type IsracardImportResult = {
  packId: string;
  imported: number;
  skippedDup: number;
  statementTotal: number;
  rows: number;
  dryRun: boolean;
};

export async function importIsracardStatementPack(
  prisma: PrismaClient,
  userId: string,
  packId: string,
  options?: { dryRun?: boolean }
): Promise<IsracardImportResult> {
  const dryRun = options?.dryRun ?? false;
  const pack = getIsracardStatementPack(packId);
  if (!pack) {
    throw new Error(`Unknown Isracard statement pack: ${packId}`);
  }

  const categories = await prisma.category.findMany({ where: { userId } });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  let pm = await prisma.paymentMethod.findFirst({
    where: { userId, name: ISRACARD_PAYMENT_METHOD },
  });
  if (!pm && !dryRun) {
    pm = await prisma.paymentMethod.create({
      data: { userId, name: ISRACARD_PAYMENT_METHOD },
    });
  }

  const window = dedupeWindowForPack(pack);
  const existing = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: window,
    },
  });

  let imported = 0;
  let skippedDup = 0;
  const workingExisting: Transaction[] = [...existing];

  for (const row of pack.rows) {
    const occurredAt = parseIsracardDdMmYy(row.txnDate);
    const description = row.merchant.trim();
    const amount = row.amount;
    const notes = [
      pack.importNote,
      row.installmentNote,
      row.standingOrder ? "הוראת קבע" : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const dup = workingExisting.find(
      (t) =>
        amountsMatch(Number(t.amount), amount) &&
        isracardDescriptionsMatch(description, t.description) &&
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
          paymentMethodId: pm?.id,
          type: TransactionType.EXPENSE,
          amount,
          occurredAt,
          description,
          notes,
        },
      });
      workingExisting.push(tx);
    }
    imported++;
  }

  return {
    packId,
    imported,
    skippedDup,
    statementTotal: pack.rows.reduce((s, r) => s + r.amount, 0),
    rows: pack.rows.length,
    dryRun,
  };
}
