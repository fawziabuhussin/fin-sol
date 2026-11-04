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
  /** Already recorded via الأقساط — reconcile only, do not create on import. */
  fromSplit?: boolean;
};

export type IsracardStatementPack = {
  id: string;
  label: string;
  cardNote: string;
  importNote: string;
  /** When the card is charged (דף חיוב) — used as `occurredAt`. */
  billingDate: string;
  rows: IsracardStatementRow[];
};

/** Built-in statement packs (same data as scripts/import-isracard-*.ts). */
export const ISRACARD_STATEMENT_PACKS: IsracardStatementPack[] = [
  {
    id: "2026-11",
    label: "חיוב 11/2026 — Gold 8841",
    cardNote: "8841",
    importNote: "ייבוא ישראכרט 8841 — חיוב 11/2026",
    billingDate: "20/11/26",
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
        fromSplit: true,
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
      // — תשלומים (الأقساط) on same Isracard billing —
      {
        txnDate: "25/10/26",
        merchant: "מקדימה ביטוח רכב",
        sector: "ביטוח",
        amount: 251,
        installmentNote: "מקדימה · תשלום 1 מתוך 12",
        fromSplit: true,
      },
      {
        txnDate: "19/10/26",
        merchant: "אחמד זוהדי מרקט - חר",
        sector: "מכולת/סופר",
        amount: 699.35,
        installmentNote: "תשלום 1 מתוך 2",
        fromSplit: true,
      },
      {
        txnDate: "24/08/26",
        merchant: "מחסני חשמל - אלקטרה",
        sector: "שונות",
        amount: 433.33,
        installmentNote: "תשלום 3 מתוך 3 · תשלום אחרון",
        fromSplit: true,
      },
      {
        txnDate: "04/09/26",
        merchant: "ויטוריו דיוואני-צמרת",
        sector: "שונות",
        amount: 298.75,
        installmentNote: "תשלום 3 מתוך 8",
        fromSplit: true,
      },
      {
        txnDate: "04/09/26",
        merchant: "דורי הום ריהוט ועיצו",
        sector: "שונות",
        amount: 288,
        installmentNote: "תשלום 3 מתוך 8",
        fromSplit: true,
      },
      {
        txnDate: "04/11/26",
        merchant: "YM EMOH - מיי הום",
        sector: "שונות",
        amount: 840.5,
        installmentNote: "תשלום 1 מתוך 6",
        fromSplit: true,
      },
      {
        txnDate: "04/11/26",
        merchant: "مصروف مقسّط (12)",
        sector: "ביטוח",
        amount: 243,
        installmentNote: "תשלום 2 מתוך 12",
        fromSplit: true,
      },
      {
        txnDate: "04/11/26",
        merchant: "مصروف مقسّط (4)",
        sector: "תש' רשויות",
        amount: 240,
        installmentNote: "תשלום 2 מתוך 4",
        fromSplit: true,
      },
      {
        txnDate: "04/11/26",
        merchant: "עיר המותגים",
        sector: "הלבשה",
        amount: 185,
        installmentNote: "תשלום 2 מתוך 2",
        fromSplit: true,
      },
      {
        txnDate: "04/11/26",
        merchant: 'עותמאן עתאמנה בע"מ',
        sector: "הלבשה",
        amount: 300,
        installmentNote: "תשלום 2 מתוך 3",
        fromSplit: true,
      },
    ],
  },
];

export function listIsracardStatementPacks() {
  return ISRACARD_STATEMENT_PACKS.map(({ id, label, cardNote, billingDate, rows }) => ({
    id,
    label,
    cardNote,
    billingDate,
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

export function billingDateForPack(pack: IsracardStatementPack): Date {
  return parseIsracardDdMmYy(pack.billingDate);
}

function rowNotes(pack: IsracardStatementPack, row: IsracardStatementRow): string {
  return [
    pack.importNote,
    `רכישה ${row.txnDate}`,
    row.installmentNote,
    row.standingOrder ? "הוראת קבע" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function isImportNoteTransaction(notes: string | null | undefined, pack: IsracardStatementPack) {
  return Boolean(notes?.includes(pack.importNote));
}

function merchantMatchesRow(row: IsracardStatementRow, description: string | null, amount: number) {
  if (amountsMatch(amount, row.amount)) {
    if (isracardDescriptionsMatch(row.merchant, description)) return true;
    const tail = description?.includes("—")
      ? description.split("—").pop()?.trim()
      : description;
    if (tail && isracardDescriptionsMatch(row.merchant, tail)) return true;
  } else if (isracardDescriptionsMatch(row.merchant, description)) {
    if (Math.abs(amount - row.amount) >= 1) return false;
  } else {
    const tail = description?.includes("—")
      ? description.split("—").pop()?.trim()
      : description;
    if (!tail || !isracardDescriptionsMatch(row.merchant, tail)) {
      if (row.amount === 2692.36 && /חשמל/i.test(description ?? "")) return amountsMatch(amount, row.amount);
      if (row.amount === 2253 && (/עירון|מיי/i.test(description ?? "") || /مقسّط \(2\)|מים|מיא/i.test(description ?? "")))
        return amountsMatch(amount, row.amount);
      if (row.amount === 150.08 && /כלל/i.test(description ?? "")) return amountsMatch(amount, row.amount);
      if (row.amount === 243 && /مقسّط \(12\)/.test(description ?? "")) return amountsMatch(amount, row.amount);
      if (row.amount === 240 && /مقسّط \(4\)/.test(description ?? "")) return amountsMatch(amount, row.amount);
      if (row.amount === 699.35 && /זוהדי|zuhadi/i.test(description ?? "")) return amountsMatch(amount, row.amount);
      if (row.amount === 251 && /מקדימה|مقدّمة|مقسّط \(12\)/.test(description ?? ""))
        return amountsMatch(amount, row.amount);
      return false;
    }
    if (Math.abs(amount - row.amount) >= 1) return false;
  }
  return true;
}

async function linkedInstallmentTransactionIds(prisma: PrismaClient, userId: string) {
  const [split, project] = await Promise.all([
    prisma.splitPaymentInstallment.findMany({
      where: { plan: { userId }, transactionId: { not: null } },
      select: { transactionId: true },
    }),
    prisma.projectInstallment.findMany({
      where: { plan: { userId }, transactionId: { not: null } },
      select: { transactionId: true },
    }),
  ]);
  return new Set(
    [...split, ...project].map((i) => i.transactionId).filter(Boolean) as string[]
  );
}

export type IsracardBillingReconcileResult = {
  packId: string;
  billingDate: string;
  updated: number;
  deleted: number;
  billingDayTotal: number;
  dryRun: boolean;
};

/** Move statement rows to billing date and collapse duplicates (imports vs splits/manual). */
export async function reconcileIsracardStatementBilling(
  prisma: PrismaClient,
  userId: string,
  packId: string,
  options?: { dryRun?: boolean }
): Promise<IsracardBillingReconcileResult> {
  const dryRun = options?.dryRun ?? false;
  const pack = getIsracardStatementPack(packId);
  if (!pack) throw new Error(`Unknown Isracard statement pack: ${packId}`);

  const billingAt = billingDateForPack(pack);
  const billingIso = billingAt.toISOString().slice(0, 10);
  const linkedIds = await linkedInstallmentTransactionIds(prisma, userId);

  const candidates = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: {
        gte: new Date(Date.UTC(2026, 7, 1)),
        lt: new Date(Date.UTC(2026, 11, 30)),
      },
    },
  });

  let updated = 0;
  let deleted = 0;
  const deletedIds = new Set<string>();

  for (const row of pack.rows) {
    const matches = candidates.filter(
      (t) =>
        !deletedIds.has(t.id) &&
        merchantMatchesRow(row, t.description, Number(t.amount))
    );

    if (matches.length === 0) continue;

    const ranked = [...matches].sort((a, b) => {
      const score = (t: Transaction) => {
        let s = 0;
        if (linkedIds.has(t.id)) s += 100;
        if (t.occurredAt.toISOString().slice(0, 10) === billingIso) s += 40;
        if (!isImportNoteTransaction(t.notes, pack)) s += 25;
        if (isImportNoteTransaction(t.notes, pack)) s -= 10;
        return s;
      };
      return score(b) - score(a);
    });

    const keeper = ranked[0];
    for (const dup of ranked.slice(1)) {
      if (!dryRun) {
        await prisma.transaction.delete({ where: { id: dup.id } }).catch(() => null);
      }
      deletedIds.add(dup.id);
      deleted++;
    }

    const notes = rowNotes(pack, row);
    const isLinked = linkedIds.has(keeper.id);
    const needsDate = keeper.occurredAt.toISOString().slice(0, 10) !== billingIso;
    const needsNotes = !isLinked && !keeper.notes?.includes(pack.importNote);
    if (needsDate || needsNotes) {
      if (!dryRun) {
        await prisma.transaction.update({
          where: { id: keeper.id },
          data: {
            occurredAt: billingAt,
            ...(needsNotes ? { notes } : {}),
            ...(needsDate && row.amount === 370.29 && amountsMatch(Number(keeper.amount), 370)
              ? { amount: row.amount }
              : {}),
          },
        });
      }
      updated++;
    }
  }

  // Remove stray import rows for this pack that did not match any row (safety)
  for (const t of candidates) {
    if (deletedIds.has(t.id)) continue;
    if (!isImportNoteTransaction(t.notes, pack)) continue;
    const matchedRow = pack.rows.some((row) =>
      merchantMatchesRow(row, t.description, Number(t.amount))
    );
    if (matchedRow) continue;
    if (!dryRun) await prisma.transaction.delete({ where: { id: t.id } }).catch(() => null);
    deletedIds.add(t.id);
    deleted++;
  }

  const billingDay = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.EXPENSE,
      occurredAt: {
        gte: billingAt,
        lt: new Date(billingAt.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
  const billingDayTotal = billingDay
    .filter((t) => !deletedIds.has(t.id))
    .reduce((s, t) => s + Number(t.amount), 0);

  return {
    packId,
    billingDate: pack.billingDate,
    updated,
    deleted,
    billingDayTotal,
    dryRun,
  };
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

  const billingAt = billingDateForPack(pack);
  const billingIso = billingAt.toISOString().slice(0, 10);

  const window = {
    gte: new Date(Date.UTC(2026, 9, 1)),
    lt: new Date(Date.UTC(2026, 11, 30)),
  };
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
    const occurredAt = billingAt;
    const description = row.merchant.trim();
    const amount = row.amount;
    const notes = rowNotes(pack, row);

    const dup = workingExisting.find(
      (t) =>
        merchantMatchesRow(row, t.description, Number(t.amount)) &&
        (t.occurredAt.toISOString().slice(0, 10) === billingIso ||
          isracardDescriptionsMatch(description, t.description))
    );
    if (dup) {
      skippedDup++;
      continue;
    }

    if (row.fromSplit) {
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
