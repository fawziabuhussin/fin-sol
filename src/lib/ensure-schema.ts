import { prisma } from "@/lib/db";

let pending: Promise<void> | null = null;

/**
 * Production was deployed with Prisma fields that `db push` had not applied yet
 * (notably ProjectPaymentPlan.categoryId). Adding the column here unblocks
 * Server Component queries until the next schema push.
 */
export function ensureDbSchema() {
  if (!pending) {
    pending = applySchemaPatch().catch((error) => {
      pending = null;
      console.error("[db] schema patch failed", error);
    });
  }
  return pending;
}

async function applySchemaPatch() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "ProjectPaymentPlan"
    ADD COLUMN IF NOT EXISTS "categoryId" TEXT
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ProjectPaymentPlan_categoryId_idx"
    ON "ProjectPaymentPlan"("categoryId")
  `);
}
