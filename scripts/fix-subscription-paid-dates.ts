/**
 * Set subscription paidAt and linked transaction occurredAt to the first day
 * of each payment's schedule month (not the last).
 * Run: npx tsx scripts/fix-subscription-paid-dates.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { subscriptionPaidAtForPeriod } from "../src/lib/savings-schedule";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const payments = await prisma.subscriptionPayment.findMany({
    where: { paid: true },
    include: { transaction: true },
  });

  let fixed = 0;
  for (const payment of payments) {
    const expected = subscriptionPaidAtForPeriod(
      payment.periodYear,
      payment.periodMonth
    );
    const current = payment.paidAt;
    const needsPaidAtFix =
      !current ||
      current.getUTCFullYear() !== payment.periodYear ||
      current.getUTCMonth() + 1 !== payment.periodMonth ||
      current.getUTCDate() !== 1;

    if (!needsPaidAtFix) continue;

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { paidAt: expected },
    });

    if (payment.transactionId) {
      await prisma.transaction.update({
        where: { id: payment.transactionId },
        data: { occurredAt: expected },
      });
    }

    fixed++;
    console.log(
      `  ${payment.periodYear}-${String(payment.periodMonth).padStart(2, "0")}: ${current?.toISOString().slice(0, 10) ?? "null"} → ${expected.toISOString().slice(0, 10)}`
    );
  }

  console.log(`Fixed ${fixed} of ${payments.length} paid subscription payments.`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
