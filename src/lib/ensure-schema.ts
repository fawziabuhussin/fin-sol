import { prisma } from "@/lib/db";

/**
 * Production builds run `prisma generate && next build` and do not apply
 * schema changes. Create the split-payment tables at runtime so /splits
 * does not 500 on a missing relation.
 */
let schemaPromise: Promise<void> | null = null;

export function ensureDbSchema() {
  if (!schemaPromise) {
    schemaPromise = applySplitPaymentTables().catch((error) => {
      schemaPromise = null;
      console.error("[schema] split payment tables", error);
    });
  }
  return schemaPromise;
}

async function exec(sql: string) {
  await prisma.$executeRawUnsafe(sql);
}

async function addConstraint(name: string, alterSql: string) {
  await exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = '${name}'
      ) THEN
        ${alterSql};
      END IF;
    END $$;
  `);
}

async function applySplitPaymentTables() {
  await exec(`
    CREATE TABLE IF NOT EXISTS "SplitPaymentPlan" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "totalAmount" DECIMAL(14,2) NOT NULL,
      "installmentCount" INTEGER NOT NULL,
      "firstPaymentAmount" DECIMAL(14,2),
      "recurringAmount" DECIMAL(14,2),
      "categoryId" TEXT,
      "paymentMethodId" TEXT,
      "startDate" DATE NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SplitPaymentPlan_pkey" PRIMARY KEY ("id")
    )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS "SplitPaymentInstallment" (
      "id" TEXT NOT NULL,
      "planId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL,
      "label" TEXT,
      "dueDate" DATE NOT NULL,
      "amount" DECIMAL(14,2) NOT NULL,
      "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "transactionId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SplitPaymentInstallment_pkey" PRIMARY KEY ("id")
    )
  `);

  await exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "SplitPaymentInstallment_transactionId_key" ON "SplitPaymentInstallment"("transactionId")`
  );
  await exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS "SplitPaymentInstallment_planId_sequence_key" ON "SplitPaymentInstallment"("planId", "sequence")`
  );
  await exec(
    `CREATE INDEX IF NOT EXISTS "SplitPaymentPlan_userId_idx" ON "SplitPaymentPlan"("userId")`
  );
  await exec(
    `CREATE INDEX IF NOT EXISTS "SplitPaymentPlan_userId_startDate_idx" ON "SplitPaymentPlan"("userId", "startDate")`
  );
  await exec(
    `CREATE INDEX IF NOT EXISTS "SplitPaymentInstallment_planId_status_idx" ON "SplitPaymentInstallment"("planId", "status")`
  );
  await exec(
    `CREATE INDEX IF NOT EXISTS "SplitPaymentInstallment_dueDate_status_idx" ON "SplitPaymentInstallment"("dueDate", "status")`
  );

  await addConstraint(
    "SplitPaymentPlan_userId_fkey",
    `ALTER TABLE "SplitPaymentPlan" ADD CONSTRAINT "SplitPaymentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE`
  );
  await addConstraint(
    "SplitPaymentPlan_categoryId_fkey",
    `ALTER TABLE "SplitPaymentPlan" ADD CONSTRAINT "SplitPaymentPlan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE`
  );
  await addConstraint(
    "SplitPaymentPlan_paymentMethodId_fkey",
    `ALTER TABLE "SplitPaymentPlan" ADD CONSTRAINT "SplitPaymentPlan_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE`
  );
  await addConstraint(
    "SplitPaymentInstallment_planId_fkey",
    `ALTER TABLE "SplitPaymentInstallment" ADD CONSTRAINT "SplitPaymentInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SplitPaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE`
  );
  await addConstraint(
    "SplitPaymentInstallment_transactionId_fkey",
    `ALTER TABLE "SplitPaymentInstallment" ADD CONSTRAINT "SplitPaymentInstallment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE`
  );
}
