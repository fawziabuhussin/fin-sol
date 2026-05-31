/**
 * Import 9686F4E.xlsx into the database for a household.
 * Usage: EXCEL_PATH=/path/to/file.xlsx HOUSEHOLD_ID=xxx npx tsx scripts/import-excel.ts
 * Or: npx tsx scripts/import-excel.ts /path/to/file.xlsx user@email.com
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  PrismaClient,
  TransactionType,
  BuildContractorStatus,
  SavingsPlanType,
  SavingsPlanStatus,
  HouseholdRole,
} from "../src/generated/prisma/client";
import { seedHouseholdLookups } from "../src/lib/seed-household";
import { recomputeMonthlySnapshots } from "../src/lib/insights/engine";
import bcrypt from "bcryptjs";

const excelPath =
  process.argv[2] ||
  process.env.EXCEL_PATH ||
  "/Users/fawziabuhussin/Library/Containers/com.microsoft.Excel/Data/tmp/Content.MSO/9686F4E.xlsx";
const userEmail = process.argv[3] || process.env.IMPORT_USER_EMAIL || "demo@fin-sol.local";

function createPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

function parseDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof val === "string" && val.trim()) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

const STATUS_MAP: Record<string, BuildContractorStatus> = {
  "مكتمل": BuildContractorStatus.COMPLETED,
  "قيد التنفيذ": BuildContractorStatus.IN_PROGRESS,
  "لم يبدأ": BuildContractorStatus.NOT_STARTED,
  "غير مفعّل": BuildContractorStatus.INACTIVE,
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const prisma = createPrisma();
  const wb = XLSX.readFile(excelPath);

  let user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: userEmail,
        name: "مستخدم تجريبي",
        passwordHash: await bcrypt.hash("demo1234", 10),
      },
    });
  }

  let household = await prisma.household.findFirst({
    where: { members: { some: { userId: user.id } } },
  });
  if (!household) {
    household = await prisma.household.create({
      data: {
        name: "المنزل",
        members: { create: { userId: user.id, role: HouseholdRole.OWNER } },
      },
    });
  }

  const householdId = household.id;
  await seedHouseholdLookups(prisma, householdId);

  const categories = await prisma.category.findMany({ where: { householdId } });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { householdId },
  });
  const pmByName = Object.fromEntries(paymentMethods.map((p) => [p.name, p]));

  // Master Data → Transactions
  const master = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["Master Data"],
    { defval: null }
  );
  let imported = 0;
  for (const row of master) {
    const date = parseDate(row["التاريخ"]);
    const catName = String(row["الفئة"] ?? "").trim();
    if (!date || !catName) continue;

    const amount = num(row["المبلغ"]);
    if (amount <= 0) continue;

    let type: TransactionType = TransactionType.EXPENSE;
    let isBuild = false;
    if (catName === "بناء") {
      type = TransactionType.BUILD_EXPENSE;
      isBuild = true;
    } else if (catName === "ادخار") {
      type = TransactionType.SAVINGS_CONTRIBUTION;
    } else if (catName === "دخل") {
      type = TransactionType.INCOME;
    }

    const pmRaw = row["طريقة الدفع"];
    let paymentMethodId: string | undefined;
    if (typeof pmRaw === "string" && pmRaw.trim()) {
      const pm = pmByName[pmRaw.trim()];
      if (pm) paymentMethodId = pm.id;
    }

    const categoryId = catByName[catName]?.id;

    await prisma.transaction.create({
      data: {
        householdId,
        date,
        amount,
        type,
        categoryId,
        description: String(row["الوصف"] ?? ""),
        paymentMethodId,
        notes: row["ملاحظات"] ? String(row["ملاحظات"]) : undefined,
        isBuildExpense: isBuild,
      },
    });
    imported++;
  }
  console.log(`Transactions imported: ${imported}`);

  // Build project + contractors from البناء دفع
  const buildRows = XLSX.utils.sheet_to_json(
    wb.Sheets["البناء دفع"],
    { header: 1, defval: null }
  ) as unknown[][];
  const headerIdx = buildRows.findIndex(
    (r) => Array.isArray(r) && r[0] === "الاسم"
  );
  if (headerIdx >= 0) {
    const budgetRow = buildRows.find(
      (r) => Array.isArray(r) && r[0] === "💰  إجمالي الميزانية"
    ) as unknown[] | undefined;
    const totalBudget = budgetRow ? num(budgetRow[1]) : 112833;

    const project = await prisma.buildProject.upsert({
      where: { householdId },
      create: { householdId, totalBudget },
      update: { totalBudget },
    });

    for (let i = headerIdx + 1; i < buildRows.length; i++) {
      const row = buildRows[i] as unknown[];
      const name = row[0];
      if (!name || typeof name !== "string" || !name.trim()) continue;

      const contractTotal = num(row[3]);
      if (contractTotal <= 0) continue;

      const amountPaid = num(row[4]);
      const remaining = num(row[6]) || contractTotal - amountPaid;
      const statusStr = String(row[16] ?? "لم يبدأ");
      const status = STATUS_MAP[statusStr] ?? BuildContractorStatus.NOT_STARTED;

      await prisma.buildContractor.create({
        data: {
          householdId,
          buildProjectId: project.id,
          name: name.trim(),
          profession: row[1] ? String(row[1]) : undefined,
          contractTotal,
          amountPaid,
          remainingBalance: remaining,
          status,
          reason: row[7] ? String(row[7]) : undefined,
          notes: row[8] ? String(row[8]) : undefined,
          downPayment: row[10] != null ? num(row[10]) : undefined,
          totalInstallments: row[11] != null ? num(row[11]) : undefined,
          installmentAmount: row[12] != null ? num(row[12]) : undefined,
          installmentsCompleted: row[13] != null ? num(row[13]) : 0,
          installmentsRemaining: row[14] != null ? num(row[14]) : undefined,
          monthsToCompletion: row[15] != null ? num(row[15]) : undefined,
          isFullyPaid: remaining <= 0,
        },
      });
    }
    console.log("Build contractors imported");
  }

  // Savings from الادخارات
  const savingsSheet = wb.Sheets["الادخارات"];
  if (savingsSheet) {
    const savingsRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      savingsSheet,
      { defval: null }
    );
    for (const row of savingsRows) {
      const typeName = row["النوع"];
      const name = row["الاسم / الوصف"];
      if (!typeName || !name) continue;

      const monthly = num(row["المبلغ الشهري"]);
      if (monthly <= 0) continue;

      const startDate = parseDate(row["تاريخ البدء"]);
      const payoutRaw = row["تاريخ القبض"];
      let payoutDate = parseDate(payoutRaw);
      if (!payoutDate && typeof payoutRaw === "string") {
        payoutDate = new Date(payoutRaw);
      }
      if (!startDate || !payoutDate) continue;

      await prisma.savingsPlan.create({
        data: {
          householdId,
          type:
            String(typeName).includes("جمعية")
              ? SavingsPlanType.JAMIYA
              : SavingsPlanType.PERSONAL,
          name: String(name),
          monthlyContribution: monthly,
          startDate,
          payoutDate,
          monthsCount: num(row["عدد الأشهر"]) || 12,
          totalCommitment: num(row["الإجمالي الملتزم"]),
          paidToDate: num(row["المدفوع حتى الآن"]),
          remaining: num(row["المتبقي"]),
          status: SavingsPlanStatus.ACTIVE,
        },
      });
    }
    console.log("Savings plans imported");
  }

  // Annual summary → MonthlySnapshot
  const annual = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["تلخيص سنوي"],
    { defval: null }
  );
  for (const row of annual) {
    const monthDate = parseDate(row["الشهر"]);
    if (!monthDate || String(row["الشهر"]).includes("المجموع")) continue;

    const y = monthDate.getFullYear();
    const m = monthDate.getMonth() + 1;
    const incomeBySource = {
      أفق: num(row["أفق"]),
      انطلاقة: num(row["انطلاقة"]),
      "جامعة منحة": num(row["جامعة منحة"]),
      "جامعة شغل": num(row["جامعة شغل"]),
    };

    await prisma.monthlySnapshot.upsert({
      where: { householdId_year_month: { householdId, year: y, month: m } },
      create: {
        householdId,
        year: y,
        month: m,
        totalIncome: num(row["إجمالي الدخل"]),
        dailyExpenses: num(row["المصروفات اليومية"]),
        buildExpenses: num(row["مصروفات البناء"]),
        savingsContributions: 0,
        netCashflow: num(row["الصافي"]),
        incomeBySource,
      },
      update: {
        totalIncome: num(row["إجمالي الدخل"]),
        dailyExpenses: num(row["المصروفات اليومية"]),
        buildExpenses: num(row["مصروفات البناء"]),
        netCashflow: num(row["الصافي"]),
        incomeBySource,
      },
    });
  }
  console.log("Monthly snapshots from annual sheet");

  await recomputeMonthlySnapshots(householdId);

  await prisma.kerenHishtalmutProfile.upsert({
    where: { householdId },
    create: { householdId, currentBalance: 0 },
    update: {},
  });

  console.log("\nDone!");
  console.log(`  User: ${userEmail} / demo1234`);
  console.log(`  Household ID: ${householdId}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
