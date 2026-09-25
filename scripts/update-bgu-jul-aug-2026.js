/**
 * Apply BGU תלושים to جامعة شغل:
 *   June  ← 6-2026 data that was sitting on July (paid 02/07)
 *   July  ← 7-2026.pdf (paid 02/08, bank ₪6,592.21)
 *   August ← 8-2026.pdf (paid 02/09 — entered in September)
 *
 * Usage: DATABASE_URL=... node scripts/update-bgu-jul-aug-2026.js [--dry-run]
 */
const { Pool } = require("pg");

const userEmail = process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const dryRun = process.argv.includes("--dry-run");

const JUN = {
  month: 6,
  paidAt: "2026-07-02",
  gross: 2638.84,
  net: 2039.25,
  tax: 374,
  pension: 164.73,
  keren: 54.27,
  fees: 17.57,
  notes: "תלוש בן גוריון — יוני 2026 (6-2026.pdf)",
  breakdown: {
    taxes: {
      nationalInsurance: 185,
      healthInsurance: 136,
      incomeTax: 53,
      total: 374,
    },
    pension: {
      employee: 164.73,
      employer: 153.75,
      severanceEmployer: 182.96,
      lines: [
        {
          fund: "347",
          type: "קצבה שכיר-תג.",
          employee: 164.73,
          employer: 153.75,
          base: 2196.4,
        },
        {
          fund: "347",
          type: "פיצויים",
          employee: 0,
          employer: 182.96,
          base: 2196.4,
        },
        {
          fund: "458",
          type: "קרן השתלמות",
          employee: 54.27,
          employer: 162.81,
          base: 2170.84,
        },
      ],
    },
    keren: { employee: 54.27, employer: 162.81 },
    otherDeductions: 17.57,
  },
};

const JUL = {
  month: 7,
  paidAt: "2026-08-02",
  gross: 8606.25,
  net: 6592.21,
  tax: 1200,
  pension: 541.84,
  keren: 191.28,
  fees: 80.92,
  notes: "תלוש בן גוריון — יולי 2026 (7-2026.pdf)",
  breakdown: {
    taxes: {
      nationalInsurance: 593,
      healthInsurance: 439,
      incomeTax: 168,
      total: 1200,
    },
    pension: {
      employee: 541.84,
      employer: 580.54,
      severanceEmployer: 644.79,
      lines: [
        {
          fund: "347",
          type: "קצבה שכיר-תג. 06/26",
          employee: 204.41,
          employer: 219.01,
          base: 2920.14,
        },
        {
          fund: "347",
          type: "קצבה שכיר-תג.",
          employee: 337.43,
          employer: 361.53,
          base: 4820.44,
        },
        {
          fund: "347",
          type: "פיצויים 06/26",
          employee: 0,
          employer: 243.25,
          base: 2920.14,
        },
        {
          fund: "347",
          type: "פיצויים",
          employee: 0,
          employer: 401.54,
          base: 4820.44,
        },
        {
          fund: "458",
          type: "קרן השתלמות 06/26",
          employee: 72.16,
          employer: 216.49,
          base: 2886.48,
        },
        {
          fund: "458",
          type: "קרן השתלמות",
          employee: 119.12,
          employer: 357.36,
          base: 4764.77,
        },
      ],
    },
    keren: { employee: 191.28, employer: 573.85 },
    otherDeductions: 80.92,
  },
};

const AUG = {
  month: 8,
  paidAt: "2026-09-02",
  gross: 4764.77,
  net: 3594.66,
  tax: 675,
  pension: 337.43,
  keren: 119.12,
  fees: 38.56,
  notes: "תלוש בן גוריון — אוגוסט 2026 (8-2026.pdf)",
  breakdown: {
    taxes: {
      nationalInsurance: 334,
      healthInsurance: 246,
      incomeTax: 95,
      total: 675,
    },
    pension: {
      employee: 337.43,
      employer: 361.53,
      severanceEmployer: 401.54,
      lines: [
        {
          fund: "347",
          type: "קצבה שכיר-תג.",
          employee: 337.43,
          employer: 361.53,
          base: 4820.44,
        },
        {
          fund: "347",
          type: "פיצויים",
          employee: 0,
          employer: 401.54,
          base: 4820.44,
        },
        {
          fund: "458",
          type: "קרן השתלמות",
          employee: 119.12,
          employer: 357.36,
          base: 4764.77,
        },
      ],
    },
    keren: { employee: 119.12, employer: 357.36 },
    otherDeductions: 38.56,
  },
};

function effectiveNet(row) {
  return Math.round((row.net - row.fees) * 100) / 100;
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

    const employer = (
      await client.query(
        `SELECT id, name FROM "Employer" WHERE "userId" = $1 AND name = 'جامعة شغل'`,
        [user.id]
      )
    ).rows[0];
    if (!employer) throw new Error("Employer جامعة شغل not found");

    if (!dryRun) await client.query("BEGIN");

    for (const row of [JUN, JUL, AUG]) {
      const slip = (
        await client.query(
          `SELECT id, net::float, paid, "paidAt"::text
           FROM "SalarySlip"
           WHERE "userId" = $1 AND "employerId" = $2
             AND "periodYear" = 2026 AND "periodMonth" = $3`,
          [user.id, employer.id, row.month]
        )
      ).rows[0];
      if (!slip) throw new Error(`Missing slip for month ${row.month}`);

      console.log(
        `~ ${row.month}/2026 net ${slip.net} → ${row.net} paidAt ${row.paidAt} (${row.notes})`
      );

      if (!dryRun) {
        await client.query(
          `UPDATE "SalarySlip" SET
             worked = true,
             paid = true,
             "paidAt" = $1::date,
             gross = $2,
             net = $3,
             tax = $4,
             pension = $5,
             "kerenHishtalmut" = $6,
             fees = $7,
             bonus = 0,
             notes = $8,
             "slipBreakdown" = $9::jsonb,
             "updatedAt" = NOW()
           WHERE id = $10`,
          [
            row.paidAt,
            row.gross,
            row.net,
            row.tax,
            row.pension,
            row.keren,
            row.fees,
            row.notes,
            JSON.stringify(row.breakdown),
            slip.id,
          ]
        );

        const amount = effectiveNet(row);
        await client.query(
          `UPDATE "Transaction" SET amount = $1, "occurredAt" = $2::date, "updatedAt" = NOW()
           WHERE "salarySlipId" = $3`,
          [amount, row.paidAt, slip.id]
        );
      }
    }

    console.log("~ employer defaults ← August תלוש");
    if (!dryRun) {
      await client.query(
        `UPDATE "Employer" SET
           "baseGross" = $1,
           "baseNet" = $2,
           "baseTax" = $3,
           "basePension" = $4,
           "baseKeren" = $5,
           "baseFees" = $6,
           "baseBonus" = 0,
           "baseSlipBreakdown" = $7::jsonb
         WHERE id = $8`,
        [
          AUG.gross,
          AUG.net,
          AUG.tax,
          AUG.pension,
          AUG.keren,
          AUG.fees,
          JSON.stringify(AUG.breakdown),
          employer.id,
        ]
      );
      await client.query("COMMIT");
    }

    console.log({ dryRun, updated: ["6/2026", "7/2026", "8/2026"] });
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
