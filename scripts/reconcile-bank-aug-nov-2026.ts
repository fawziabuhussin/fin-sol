/**
 * Reconcile Bank Hapoalim (12-666-494908) statement 14/08–14/11/2026 against the app.
 *
 * Only applies the unambiguous gaps found by matching every statement line:
 *  - bank-only fees (ONTIME, ע.מפעולות-ישיר) that were never imported,
 *  - מכבי for Sep/Oct, recorded as payments of the existing מכבי subscription,
 *  - the 50 ₪ mobile transfer on 06/09,
 *  - recorded subscription payments whose amount differs from what the bank charged
 *    (פלאפון Sep–Nov, מכבי Nov).
 *  - card lines with no itemised match in the app (Direct daily totals "דירקט" and small
 *    "ישראכרט" charges), added as generic rows like the August import (owner's choice),
 *  - November scholarship (جامعة منحة) actually received: 9,477 ₪,
 *  - a note on «امي» 01/11 explaining the 600 ₪ instant transfer (net 200 ₪).
 * Monthly card bills, ATM withdrawals and the 500 ₪ DJ deposit transfer are already
 * represented in the app and are intentionally not added.
 *
 * Idempotent. Usage: npx tsx scripts/reconcile-bank-aug-nov-2026.ts [--dry-run]
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient, TransactionType } from "../src/generated/prisma/client";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const BANK_PM = "העברה בנקאית";
const NOTE = 'ייבוא תנועות עו"ש 08-11/2026';

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** Exact decimal for lookups — JS floats like 561.44 don't compare equal to Decimal(14,2). */
const money = (n: number) => n.toFixed(2);

/** Bank-only debits with no counterpart anywhere in the app. */
const MISSING_EXPENSES = [
  { date: "2026-09-01", description: "ONTIME-עמ' עוש", amount: 9, category: "رسوم بنكية" },
  { date: "2026-09-03", description: "ע.מפעולות-ישיר", amount: 24.5, category: "رسوم بنكية" },
  { date: "2026-09-06", description: "העב' לאחר-נייד", amount: 50, category: "أخرى" },
  { date: "2026-10-01", description: "ONTIME-עמ' עוש", amount: 9, category: "رسوم بنكية" },
  { date: "2026-10-04", description: "ע.מפעולות-ישיר", amount: 40.25, category: "رسوم بنكية" },
  { date: "2026-11-01", description: "ONTIME-עמ' עוש", amount: 9, category: "رسوم بنكية" },
  { date: "2026-11-03", description: "ע.מפעולות-ישיר", amount: 22.75, category: "رسوم بنكية" },
];

const CARD_PM = "אשראי";
const CARD_NOTE = 'ייבוא עו"ש 08-11/2026 — חיוב כרטיס ללא פירוט';

/** Card charges from the statement with no itemised counterpart in the app. */
const CARD_LINES: [string, "דירקט" | "ישראכרט", number][] = [
  ["2026-08-16", "דירקט", 284], ["2026-08-24", "דירקט", 300], ["2026-09-03", "דירקט", 212.82],
  ["2026-09-04", "דירקט", 30], ["2026-09-06", "דירקט", 114.92], ["2026-09-07", "דירקט", 75],
  ["2026-09-08", "דירקט", 593.6], ["2026-09-10", "דירקט", 65], ["2026-09-14", "דירקט", 357.31],
  ["2026-09-15", "דירקט", 2053.07], ["2026-09-17", "דירקט", 57.8], ["2026-09-22", "דירקט", 96.8],
  ["2026-09-25", "ישראכרט", 40.47], ["2026-09-28", "דירקט", 561.44], ["2026-09-30", "דירקט", 63.22],
  ["2026-10-01", "דירקט", 100], ["2026-10-04", "דירקט", 3.19], ["2026-10-06", "דירקט", 805.74],
  ["2026-10-07", "דירקט", 31.38], ["2026-10-08", "דירקט", 117.98], ["2026-10-11", "ישראכרט", 74.9],
  ["2026-10-11", "דירקט", 17.46], ["2026-10-12", "דירקט", 184.87], ["2026-10-13", "דירקט", 217.02],
  ["2026-10-14", "דירקט", 188.9], ["2026-10-19", "דירקט", 54.9], ["2026-10-20", "דירקט", 64.32],
  ["2026-10-22", "ישראכרט", 128.7], ["2026-10-26", "ישראכרט", 41.34], ["2026-10-28", "דירקט", 7],
  ["2026-11-01", "ישראכרט", 442.73], ["2026-11-03", "ישראכרט", 12.4], ["2026-11-03", "דירקט", 3.33],
  ["2026-11-06", "דירקט", 32.59], ["2026-11-08", "דירקט", 84.88], ["2026-11-09", "דירקט", 100],
  ["2026-11-10", "ישראכרט", 74.9], ["2026-11-12", "דירקט", 39.9], ["2026-11-12", "דירקט", 98.51],
  ["2026-11-13", "ישראכרט", 59],
];

const MOM_NOTE = "صافي: حوالة فورية 600 ₪ (01/11) ناقص 400 ₪ نقداً من امي";
const SCHOLARSHIP = { employer: "جامعة منحة", year: 2026, month: 11, net: 9477 };

/** Subscription months the bank charged — [title, month, amount actually charged]. */
const SUBSCRIPTION_CHARGES: [string, number, number][] = [
  ["מכבי", 9, 93.11],
  ["מכבי", 10, 93.73],
  ["מכבי", 11, 93.29],
  ["פלאפון", 9, 111.43],
  ["פלאפון", 10, 134.67],
  ["פלאפון", 11, 134.67],
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const user = await prisma.user.findFirstOrThrow({
    where: { email: userEmail },
    select: { id: true },
  });
  const userId = user.id;
  const bankPm = await prisma.paymentMethod.findFirst({ where: { userId, name: BANK_PM } });

  console.log(dryRun ? "DRY RUN — no writes\n" : "");

  // 1) Missing bank-only expenses
  for (const row of MISSING_EXPENSES) {
    const exists = await prisma.transaction.findFirst({
      where: { userId, occurredAt: utc(row.date), amount: money(row.amount), description: row.description },
    });
    if (exists) {
      console.log(`= ${row.date} ${row.amount} ${row.description} (already there)`);
      continue;
    }
    const category = await prisma.category.findFirst({ where: { userId, name: row.category } });
    console.log(`+ ${row.date} ${row.amount} ${row.description} → ${row.category}`);
    if (dryRun) continue;
    await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.EXPENSE,
        amount: row.amount,
        occurredAt: utc(row.date),
        description: row.description,
        notes: NOTE,
        categoryId: category?.id ?? null,
        paymentMethodId: bankPm?.id ?? null,
        currency: "ILS",
      },
    });
  }

  // 2) Subscription months: record missing payments, correct wrong amounts
  for (const [title, month, amount] of SUBSCRIPTION_CHARGES) {
    // Select legacy columns only, so this runs before or after `prisma db push`.
    const sub = await prisma.subscription.findFirst({
      where: { userId, title },
      select: { id: true, categoryId: true, paymentMethodId: true },
    });
    if (!sub) {
      console.log(`! subscription «${title}» not found — skipped`);
      continue;
    }
    const key = {
      subscriptionId_periodYear_periodMonth: { subscriptionId: sub.id, periodYear: 2026, periodMonth: month },
    };
    const payment = await prisma.subscriptionPayment.findUnique({ where: key });

    if (payment?.paid && payment.transactionId) {
      if (Math.abs(Number(payment.amount) - amount) < 0.005) {
        console.log(`= ${title} 2026/${month} ${amount} (correct)`);
        continue;
      }
      console.log(`~ ${title} 2026/${month}: ${Number(payment.amount)} → ${amount}`);
      if (dryRun) continue;
      await prisma.$transaction([
        prisma.transaction.update({ where: { id: payment.transactionId }, data: { amount } }),
        prisma.subscriptionPayment.update({ where: key, data: { amount } }),
      ]);
      continue;
    }

    console.log(`+ ${title} 2026/${month} paid ${amount}`);
    if (dryRun) continue;
    const paidAt = new Date(Date.UTC(2026, month - 1, 1));
    await prisma.$transaction(async (tx) => {
      const t = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.EXPENSE,
          amount,
          occurredAt: paidAt,
          description: title,
          notes: `اشتراك شهري — 2026/${month}`,
          categoryId: sub.categoryId,
          paymentMethodId: sub.paymentMethodId,
          currency: "ILS",
        },
      });
      await tx.subscriptionPayment.upsert({
        where: key,
        create: { subscriptionId: sub.id, periodYear: 2026, periodMonth: month, amount, paid: true, paidAt, transactionId: t.id },
        update: { amount, paid: true, paidAt, transactionId: t.id },
      });
    });
  }

  // 3) Card lines without itemised matches
  const cardPm = await prisma.paymentMethod.findFirst({ where: { userId, name: CARD_PM } });
  const otherCat = await prisma.category.findFirst({ where: { userId, name: "أخرى", kind: "EXPENSE" } });
  let added = 0;
  for (const [date, description, amount] of CARD_LINES) {
    const exists = await prisma.transaction.findFirst({
      where: { userId, occurredAt: utc(date), amount: money(amount), description, notes: CARD_NOTE },
    });
    if (exists) continue;
    added++;
    console.log(`+ ${date} ${amount} ${description}`);
    if (dryRun) continue;
    await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.EXPENSE,
        amount,
        occurredAt: utc(date),
        description,
        notes: CARD_NOTE,
        categoryId: otherCat?.id ?? null,
        paymentMethodId: cardPm?.id ?? null,
        currency: "ILS",
      },
    });
  }
  console.log(added ? `  (${added} card lines)` : "= card lines already imported");

  // 4) Note on the net 200 ₪ to mom (600 ₪ transfer − 400 ₪ cash received)
  const mom = await prisma.transaction.findFirst({
    where: { userId, occurredAt: utc("2026-11-01"), amount: money(200), description: "امي" },
  });
  if (!mom) console.log("! «امي» 200 on 01/11 not found — note skipped");
  else if (mom.notes === MOM_NOTE) console.log("= «امي» 01/11 note present");
  else {
    console.log("~ «امي» 01/11: add note about the 600 ₪ transfer");
    if (!dryRun) await prisma.transaction.update({ where: { id: mom.id }, data: { notes: MOM_NOTE } });
  }

  // 5) Scholarship actually received in November
  const slip = await prisma.salarySlip.findFirst({
    where: {
      userId,
      periodYear: SCHOLARSHIP.year,
      periodMonth: SCHOLARSHIP.month,
      employer: { name: SCHOLARSHIP.employer },
    },
  });
  if (!slip) console.log(`! ${SCHOLARSHIP.employer} ${SCHOLARSHIP.month}/${SCHOLARSHIP.year} slip not found`);
  else if (Number(slip.net) === SCHOLARSHIP.net) console.log(`= ${SCHOLARSHIP.employer} Nov net ${SCHOLARSHIP.net}`);
  else {
    console.log(`~ ${SCHOLARSHIP.employer} Nov net ${Number(slip.net)} → ${SCHOLARSHIP.net}`);
    if (!dryRun) {
      await prisma.salarySlip.update({
        where: { id: slip.id },
        data: {
          net: SCHOLARSHIP.net,
          // A scholarship has no deductions: keep gross equal to net when it was.
          ...(Number(slip.gross) === Number(slip.net) ? { gross: SCHOLARSHIP.net } : {}),
        },
      });
      await syncSalarySlipIncome(slip.id, prisma);
    }
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
