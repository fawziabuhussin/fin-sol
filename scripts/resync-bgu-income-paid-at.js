/**
 * Date جامعة شغل income on the bank-credit day (paidAt) and drop unpaid
 * placeholders from the dashboard.
 *
 * Usage: DATABASE_URL=... node scripts/resync-bgu-income-paid-at.js [--dry-run]
 */
const { Pool } = require("pg");

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const { rows } = await pool.query(
    `SELECT s.id, s."periodMonth", s.paid, s."paidAt"::text AS paid_at,
            s.net::float AS net, s.fees::float AS fees, t.id AS txid,
            t.amount::float AS txamt, t."occurredAt"::text AS txdate
     FROM "SalarySlip" s
     JOIN "Employer" e ON e.id = s."employerId"
     JOIN "User" u ON u.id = s."userId"
     LEFT JOIN "Transaction" t ON t."salarySlipId" = s.id
     WHERE u.email = $1 AND e.name = 'جامعة شغل' AND s."periodYear" = 2026
     ORDER BY s."periodMonth"`,
    [userEmail]
  );

  let updated = 0;
  let removed = 0;

  for (const row of rows) {
    const amount = Math.round((row.net - row.fees) * 100) / 100;
    if (!row.paid) {
      if (row.txid) {
        console.log(
          `- unpaid ${row.periodMonth}/2026 remove income ${row.txamt} on ${row.txdate?.slice(0, 10)}`
        );
        if (!dryRun) {
          await pool.query(`DELETE FROM "Transaction" WHERE id = $1`, [row.txid]);
        }
        removed++;
      } else {
        console.log(`= unpaid ${row.periodMonth}/2026 already has no income`);
      }
      continue;
    }

    const paidAt = row.paid_at?.slice(0, 10);
    if (!paidAt || !row.txid) {
      console.log(`! paid ${row.periodMonth}/2026 missing paidAt or tx`);
      continue;
    }
    const txdate = row.txdate?.slice(0, 10);
    if (txdate === paidAt && Math.abs((row.txamt ?? 0) - amount) < 0.02) {
      console.log(`= ${row.periodMonth}/2026 already ${amount} on ${paidAt}`);
      continue;
    }
    console.log(
      `~ ${row.periodMonth}/2026 income ${row.txamt} ${txdate} → ${amount} ${paidAt}`
    );
    if (!dryRun) {
      await pool.query(
        `UPDATE "Transaction"
         SET amount = $1, "occurredAt" = $2::date, "updatedAt" = NOW()
         WHERE id = $3`,
        [amount, paidAt, row.txid]
      );
    }
    updated++;
  }

  console.log({ dryRun, updated, removed });
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
