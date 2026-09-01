/**
 * Reconcile Poalim עו"ש (01/06/2026–01/09/2026) against app transactions.
 *
 * Does NOT import:
 * - דירקט-מצטבר / ישראכרט lumps that already have itemized Isracard merchants
 * - Salary credits (אוניברסיטת בן, מרכז מעשה) — already salary slips
 * - FX קניה/מכירה — already savings-asset entries (approx. amounts)
 * - ATM 8000 on 10/08 — already جمعية 5000 + engineer 3000
 * - ATM gifts already listed (600 ريحان, 3500 امي, 2000 مجد, 1000 أخي)
 * - Pelephone July (subscription 110 already exists)
 *
 * Usage:
 *   DATABASE_URL=... node scripts/reconcile-poalim-jun-aug-2026.js [--dry-run]
 */
const { Pool } = require("pg");
const crypto = require("crypto");

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");
const NOTE = 'ייבוא תנועות עו"ש 06-09/2026';
const CARD_PENDING_NOTE =
  'ייבוא עו"ש — חיוב אחרי דף ישראכרט 20/08, בלי פירוט בית עסק';

function createId() {
  return "c" + crypto.randomBytes(12).toString("hex");
}

function utcDate(iso) {
  return `${iso}T00:00:00.000Z`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();

  try {
    const user = (
      await client.query(`SELECT id FROM "User" WHERE email = $1`, [userEmail])
    ).rows[0];
    if (!user) throw new Error(`User not found: ${userEmail}`);

    const cats = Object.fromEntries(
      (
        await client.query(
          `SELECT id, name FROM "Category" WHERE "userId" = $1`,
          [user.id]
        )
      ).rows.map((r) => [r.name, r.id])
    );
    const pms = Object.fromEntries(
      (
        await client.query(
          `SELECT id, name FROM "PaymentMethod" WHERE "userId" = $1`,
          [user.id]
        )
      ).rows.map((r) => [r.name, r.id])
    );
    const subs = Object.fromEntries(
      (
        await client.query(
          `SELECT id, title FROM "Subscription" WHERE "userId" = $1`,
          [user.id]
        )
      ).rows.map((r) => [r.title, r.id])
    );

    const existing = (
      await client.query(
        `SELECT id, type, description, notes, amount::float AS amount,
                "occurredAt"::text AS occurred
         FROM "Transaction"
         WHERE "userId" = $1
           AND "occurredAt" >= '2026-06-01'
           AND "occurredAt" < '2026-09-02'`,
        [user.id]
      )
    ).rows;

    function findExact({ date, amount, description }) {
      return existing.find(
        (t) =>
          t.occurred.slice(0, 10) === date &&
          Math.abs(t.amount - amount) < 0.02 &&
          (t.description || "") === description
      );
    }

    function findByDescAmount(description, amount) {
      return existing.filter(
        (t) =>
          (t.description || "") === description &&
          Math.abs(t.amount - amount) < 0.02
      );
    }

    const dateFixes = [
      {
        description: "هدية ريحان",
        amount: 600,
        date: "2026-08-27",
        notes: "سحب بنكي 27/08 — משיכה מבנקט",
      },
      {
        description: "هدية امي",
        amount: 3500,
        date: "2026-08-24",
        notes: "سحب بنكي 24/08 — משיכה מבנקט",
      },
      {
        description: "تحويل لأخي",
        amount: 1000,
        date: "2026-08-17",
        notes: "سحب بنكي 17/08 — משיכה מבנקט",
      },
      {
        description: "העברה לותד אבראהים",
        amount: 50,
        fromDate: "2026-08-17",
        date: "2026-08-19",
        notes: NOTE,
      },
      {
        description: "מכבי",
        amount: 92.85,
        fromDate: "2026-08-07",
        date: "2026-08-05",
        notes: NOTE,
      },
    ];

    const inserts = [
      {
        date: "2026-08-10",
        amount: 500,
        type: "EXPENSE",
        description: "سحب من الصراف",
        category: "أخرى",
        method: "كاش",
        notes: "משיכה מבנקט 10/08 — غير مصنّف بعد",
      },
      {
        date: "2026-07-26",
        amount: 500,
        type: "EXPENSE",
        description: "سحب من الصراف",
        category: "أخرى",
        method: "كاش",
        notes: "משיכה מבנקט 26/07 — غير مصنّف بعد",
      },
      {
        date: "2026-07-14",
        amount: 600,
        type: "EXPENSE",
        description: "سحب من الصراف",
        category: "أخرى",
        method: "كاش",
        notes: "משיכה מבנקט 14/07 — غير مصنّف بعد",
      },

      {
        date: "2026-08-21",
        amount: 210,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-24",
        amount: 300,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-25",
        amount: 27.53,
        type: "EXPENSE",
        description: "OVERLEAF EDITOR",
        category: "اشتراكات",
        method: "אשראי",
        notes: `${NOTE} — ישראכרט 27.53 (نفس نمط Overleaf الشهري)`,
      },
      {
        date: "2026-08-26",
        amount: 527,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-27",
        amount: 51.8,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-28",
        amount: 120.8,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-30",
        amount: 380.17,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-31",
        amount: 60,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-31",
        amount: 61.49,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },
      {
        date: "2026-08-31",
        amount: 270.83,
        type: "EXPENSE",
        description: "דירקט",
        category: "أخرى",
        method: "אשראי",
        notes: CARD_PENDING_NOTE,
      },

      {
        date: "2026-06-01",
        amount: 9,
        type: "EXPENSE",
        description: "ONTIME-עמ' עוש",
        category: "رسوم بنكية",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-06-03",
        amount: 26.25,
        type: "EXPENSE",
        description: "ע.מפעולות-ישיר",
        category: "رسوم بنكية",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-06-05",
        amount: 93.11,
        type: "EXPENSE",
        description: "מכבי",
        category: "تأمين",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-06-10",
        amount: 113.11,
        type: "EXPENSE",
        description: "פלאפון",
        category: "اشتراكات",
        method: "העברה בנקאית",
        notes: NOTE,
        subscription: { title: "פלאפון", year: 2026, month: 6 },
      },
      {
        date: "2026-08-10",
        amount: 106.01,
        type: "EXPENSE",
        description: "פלאפון",
        category: "اشتراكات",
        method: "העברה בנקאית",
        notes: NOTE,
        subscription: { title: "פלאפון", year: 2026, month: 8 },
      },
      {
        date: "2026-06-21",
        amount: 50,
        type: "EXPENSE",
        description: "העברה לותד אבראהים",
        category: "أخرى",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-06-16",
        amount: 100,
        type: "EXPENSE",
        description: "העברה לאחר-נייד",
        category: "أخرى",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-06-15",
        amount: 400,
        type: "EXPENSE",
        description: "העברה לאחר-נייד",
        category: "أخرى",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-07-19",
        amount: 400,
        type: "INCOME",
        description: "העברה-נייד",
        category: "دخل",
        method: "העברה בנקאית",
        notes: NOTE,
      },
      {
        date: "2026-06-18",
        amount: 446.9,
        type: "INCOME",
        description: "استرداد ديراكت",
        category: "دخل",
        method: "אשראי",
        notes: `${NOTE} — זיכוי דירקט-מצטבר`,
      },
    ];

    let updated = 0;
    let inserted = 0;
    let skipped = 0;
    let subLinked = 0;

    if (!dryRun) await client.query("BEGIN");

    for (const fix of dateFixes) {
      const hits = findByDescAmount(fix.description, fix.amount);
      const row = fix.fromDate
        ? hits.find((t) => t.occurred.slice(0, 10) === fix.fromDate) ||
          hits.find((t) => t.occurred.slice(0, 10) === fix.date)
        : hits[0];
      if (!row) {
        console.log(`! date-fix missing: ${fix.description} ${fix.amount}`);
        continue;
      }
      if (row.occurred.slice(0, 10) === fix.date && row.notes === fix.notes) {
        skipped++;
        continue;
      }
      console.log(
        `~ ${fix.description} ${fix.amount}: ${row.occurred.slice(0, 10)} → ${fix.date}`
      );
      if (!dryRun) {
        await client.query(
          `UPDATE "Transaction" SET "occurredAt" = $1::date, notes = $2, "updatedAt" = NOW()
           WHERE id = $3`,
          [fix.date, fix.notes, row.id]
        );
      }
      row.occurred = utcDate(fix.date);
      row.notes = fix.notes;
      updated++;
    }

    for (const row of inserts) {
      if (findExact(row)) {
        console.log(`= skip exists ${row.date} ${row.amount} ${row.description}`);
        skipped++;
        continue;
      }
      const categoryId = cats[row.category];
      const paymentMethodId = pms[row.method];
      if (!categoryId) throw new Error(`Missing category ${row.category}`);
      if (!paymentMethodId) throw new Error(`Missing payment method ${row.method}`);

      const id = createId();
      console.log(`+ ${row.date} ${row.type} ${row.amount} ${row.description}`);
      if (!dryRun) {
        await client.query(
          `INSERT INTO "Transaction"
            (id, "userId", "categoryId", "paymentMethodId", type, amount, currency,
             "occurredAt", description, notes, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5::"TransactionType",$6,'ILS',$7::date,$8,$9,NOW(),NOW())`,
          [
            id,
            user.id,
            categoryId,
            paymentMethodId,
            row.type,
            row.amount,
            row.date,
            row.description,
            row.notes,
          ]
        );
      }
      existing.push({
        id,
        type: row.type,
        description: row.description,
        notes: row.notes,
        amount: row.amount,
        occurred: utcDate(row.date),
      });
      inserted++;

      if (row.subscription) {
        const subId = subs[row.subscription.title];
        if (!subId) throw new Error(`Missing subscription ${row.subscription.title}`);
        const already = (
          await client.query(
            `SELECT id FROM "SubscriptionPayment"
             WHERE "subscriptionId" = $1 AND "periodYear" = $2 AND "periodMonth" = $3`,
            [subId, row.subscription.year, row.subscription.month]
          )
        ).rows[0];
        if (already) {
          console.log(
            `  = subscription ${row.subscription.title} ${row.subscription.month} already exists`
          );
        } else {
          console.log(
            `  + subscription payment ${row.subscription.title} ${row.subscription.year}/${row.subscription.month}`
          );
          if (!dryRun) {
            await client.query(
              `INSERT INTO "SubscriptionPayment"
                (id, "subscriptionId", "periodYear", "periodMonth", amount, paid, "paidAt",
                 "transactionId", "createdAt", "updatedAt")
               VALUES ($1,$2,$3,$4,$5,true,$6::date,$7,NOW(),NOW())`,
              [
                createId(),
                subId,
                row.subscription.year,
                row.subscription.month,
                row.amount,
                row.date,
                id,
              ]
            );
          }
          subLinked++;
        }
      }
    }

    if (!dryRun) await client.query("COMMIT");

    console.log({
      dryRun,
      updated,
      inserted,
      skipped,
      subLinked,
    });
  } catch (err) {
    if (!dryRun) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
    }
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
