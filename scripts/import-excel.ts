/**
 * Import 9686F4E.xlsx into a user's account (multi-tenant schema).
 * Usage: npx tsx scripts/import-excel.ts [excelPath] [userEmail]
 */
import "dotenv/config";
import * as XLSX from "xlsx";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import {
  PrismaClient,
  TransactionType,
  CategoryKind,
  ProjectStatus,
  ProjectKind,
  SavingsPlanType,
  SavingsPlanStatus,
  SavingsAssetKind,
} from "../src/generated/prisma/client";
import { INCOME_SOURCES } from "../src/lib/finance-labels";
import {
  buildInstallmentSchedule,
  installmentLabel,
} from "../src/lib/payment-plan";
import { syncSalarySlipIncome } from "../src/lib/salary-income-sync";
import {
  InstallmentStatus,
  PaymentPlanMode,
} from "../src/generated/prisma/client";

const excelPath =
  process.argv[2] ||
  process.env.EXCEL_PATH ||
  "/Users/fawziabuhussin/Library/Containers/com.microsoft.Excel/Data/tmp/Content.MSO/9686F4E.xlsx";
const userEmail =
  process.argv[3] || process.env.IMPORT_USER_EMAIL || "foze820@gmail.com";
const userPassword = process.env.IMPORT_USER_PASSWORD;

function createPrisma() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  return { prisma: new PrismaClient({ adapter: new PrismaPg(pool) }), pool };
}

function parseDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
  }
  if (typeof val === "string" && val.trim()) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parsePaymentDates(val: unknown): Date[] {
  if (val instanceof Date) return [val];
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return [new Date(Date.UTC(d.y, d.m - 1, d.d))];
  }
  if (typeof val === "string" && val.trim()) {
    const parts = val
      .split(/[-–,|/]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const dates: Date[] = [];
    for (const part of parts) {
      const parsed = parseDate(part);
      if (parsed) dates.push(parsed);
    }
    if (dates.length > 0) return dates;
    const single = parseDate(val);
    return single ? [single] : [];
  }
  return [];
}

async function resolvePaymentMethodId(
  prisma: PrismaClient,
  userId: string,
  pmByName: Record<string, { id: string }>,
  raw: unknown
): Promise<string | undefined> {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const name = raw.trim();
  let pm = pmByName[name];
  if (!pm) {
    pm = await prisma.paymentMethod.create({ data: { userId, name } });
    pmByName[name] = pm;
  }
  return pm.id;
}

async function importContractorPaymentPlan(
  prisma: PrismaClient,
  userId: string,
  contractorProject: { id: string; title: string },
  row: unknown[],
  buildCategoryId: string,
  pmByName: Record<string, { id: string }>
) {
  const contractTotal = num(row[3]);
  const amountPaid = num(row[4]);
  const installmentCount = Math.round(num(row[11]));
  const firstPayment = num(row[10]);
  const recurringAmount = num(row[12]);
  const paymentDates = parsePaymentDates(row[2]);
  const startDate = paymentDates[0] ?? new Date();
  const paymentMethodId = await resolvePaymentMethodId(
    prisma,
    userId,
    pmByName,
    row[5]
  );
  const notes = [row[7], row[8], row[9]].filter(Boolean).join(" — ");

  const hasInstallmentPlan =
    installmentCount >= 1 && (firstPayment > 0 || recurringAmount > 0);

  if (!hasInstallmentPlan) {
    if (amountPaid > 0) {
      const paidAt = paymentDates[0] ?? new Date();
      await prisma.transaction.create({
        data: {
          userId,
          projectId: contractorProject.id,
          categoryId: buildCategoryId,
          paymentMethodId,
          type: TransactionType.EXPENSE,
          amount: amountPaid,
          occurredAt: paidAt,
          description: `${installmentLabel(1)} — ${contractorProject.title}`,
          notes: row[5] ? String(row[5]) : notes || undefined,
        },
      });
    }
    return;
  }

  const count = Math.max(1, installmentCount);
  const first = firstPayment > 0 ? firstPayment : recurringAmount;
  const recurring = recurringAmount > 0 ? recurringAmount : first;

  const dueDates: Date[] = [];
  for (let i = 0; i < count; i++) {
    if (paymentDates[i]) {
      dueDates.push(paymentDates[i]);
    } else {
      const d = new Date(startDate);
      d.setUTCMonth(d.getUTCMonth() + i);
      dueDates.push(d);
    }
  }

  const schedule = buildInstallmentSchedule({
    mode: count === 1 ? PaymentPlanMode.FULL : PaymentPlanMode.INSTALLMENTS,
    totalAmount: contractTotal,
    installmentCount: count,
    firstPaymentAmount: first,
    recurringAmount: recurring,
    startDate,
    dueDates,
  });

  const plan = await prisma.projectPaymentPlan.create({
    data: {
      userId,
      projectId: contractorProject.id,
      mode: count === 1 ? PaymentPlanMode.FULL : PaymentPlanMode.INSTALLMENTS,
      totalAmount: contractTotal,
      installmentCount: count > 1 ? count : null,
      firstPaymentAmount: count > 1 ? first : null,
      recurringAmount: count > 1 ? recurring : null,
      paymentMethodId: paymentMethodId ?? null,
      installments: {
        create: schedule.map((s) => ({
          sequence: s.sequence,
          label: s.label,
          dueDate: s.dueDate,
          amount: s.amount,
          status: InstallmentStatus.PENDING,
          notes: s.sequence === 1 && notes ? notes : undefined,
        })),
      },
    },
    include: { installments: { orderBy: { sequence: "asc" } } },
  });

  if (amountPaid <= 0) return;

  let remainingPaid = amountPaid;
  for (const inst of plan.installments) {
    if (remainingPaid <= 0) break;
    const instAmount = num(inst.amount);
    if (remainingPaid < instAmount) break;

    const paidAt =
      paymentDates[inst.sequence - 1] ??
      paymentDates[0] ??
      inst.dueDate;

    const tx = await prisma.transaction.create({
      data: {
        userId,
        projectId: contractorProject.id,
        categoryId: buildCategoryId,
        paymentMethodId,
        type: TransactionType.EXPENSE,
        amount: instAmount,
        occurredAt: paidAt,
        description: `${inst.label ?? installmentLabel(inst.sequence)} — ${contractorProject.title}`,
        notes: inst.sequence === 1 ? notes || undefined : undefined,
      },
    });

    await prisma.projectInstallment.update({
      where: { id: inst.id },
      data: { status: InstallmentStatus.PAID, transactionId: tx.id },
    });

    remainingPaid -= instAmount;
  }
}

function num(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

function categoryKind(name: string): CategoryKind {
  if (name === "دخل") return CategoryKind.INCOME;
  if (name === "ادخار") return CategoryKind.SAVINGS;
  return CategoryKind.EXPENSE;
}

const PROJECT_STATUS_MAP: Record<string, ProjectStatus> = {
  مكتمل: ProjectStatus.COMPLETED,
  "قيد التنفيذ": ProjectStatus.ACTIVE,
  "لم يبدأ": ProjectStatus.PLANNED,
  "غير مفعّل": ProjectStatus.ON_HOLD,
};

const MONTH_NAMES: Record<string, number> = {
  يناير: 1,
  فبراير: 2,
  مارس: 3,
  أبريل: 4,
  مايو: 5,
  يونيو: 6,
  يوليو: 7,
  أغسطس: 8,
  سبتمبر: 9,
  أكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12,
};

async function ensureUser(prisma: PrismaClient) {
  let user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) {
    const passwordHash = await bcrypt.hash(userPassword ?? "changeme123", 10);
    user = await prisma.user.create({
      data: { email: userEmail, name: "Fawzi", passwordHash },
    });
    console.log("Created user:", userEmail);
  } else if (userPassword) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(userPassword, 10) },
    });
    console.log("Updated password for:", userEmail);
  }
  return user;
}

async function clearUserData(prisma: PrismaClient, userId: string) {
  await prisma.projectInstallment.deleteMany({
    where: { plan: { userId } },
  });
  await prisma.projectPaymentPlan.deleteMany({ where: { userId } });
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.salarySlip.deleteMany({ where: { userId } });
  await prisma.savingsAsset.deleteMany({ where: { userId } });
  await prisma.savingsPlan.deleteMany({ where: { userId } });
  await prisma.project.deleteMany({ where: { userId } });
  await prisma.payee.deleteMany({ where: { userId } });
  await prisma.employer.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
  await prisma.paymentMethod.deleteMany({ where: { userId } });
}

async function seedEmployers(prisma: PrismaClient, userId: string) {
  const colors = ["#059669", "#10b981", "#14b8a6", "#6366f1"];
  const employers: Record<string, { id: string }> = {};
  for (const [i, src] of INCOME_SOURCES.entries()) {
    const emp = await prisma.employer.create({
      data: { userId, name: src.name, color: src.color ?? colors[i] },
    });
    employers[src.name] = emp;
  }
  return employers;
}

async function seedLookups(
  prisma: PrismaClient,
  userId: string,
  wb: XLSX.WorkBook
) {
  const lists = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["Lists"],
    { defval: null }
  );

  const categoryNames = new Set<string>();
  const paymentNames = new Set<string>();
  const incomeSources = new Set<string>();

  for (const row of lists) {
    const cat = row["الفئات"];
    const pm = row["طرق الدفع"];
    const src = row["مصادر الدخل"];
    if (typeof cat === "string" && cat.trim()) categoryNames.add(cat.trim());
    if (typeof pm === "string" && pm.trim()) paymentNames.add(pm.trim());
    if (typeof src === "string" && src.trim() && src !== "Other")
      incomeSources.add(src.trim());
  }

  let sortOrder = 0;
  for (const name of categoryNames) {
    await prisma.category.create({
      data: {
        userId,
        name,
        kind: categoryKind(name),
        sortOrder: sortOrder++,
      },
    });
  }

  for (const name of paymentNames) {
    await prisma.paymentMethod.create({ data: { userId, name } });
  }

  for (const name of incomeSources) {
    await prisma.payee.create({ data: { userId, name } });
  }

  console.log(
    `Lookups: ${categoryNames.size} categories, ${paymentNames.size} payment methods, ${incomeSources.size} payees`
  );
}

async function importTransactions(
  prisma: PrismaClient,
  userId: string,
  wb: XLSX.WorkBook,
  buildProjectId: string | null
) {
  const categories = await prisma.category.findMany({ where: { userId } });
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { userId },
  });
  const pmByName = Object.fromEntries(paymentMethods.map((p) => [p.name, p]));

  const master = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets["Master Data"],
    { defval: null }
  );

  let imported = 0;
  for (const row of master) {
    const occurredAt = parseDate(row["التاريخ"]);
    const catName = String(row["الفئة"] ?? "").trim();
    if (!occurredAt || !catName) continue;

    const amount = num(row["المبلغ"]);
    if (amount <= 0) continue;

    let type = TransactionType.EXPENSE;
    if (catName === "ادخار") type = TransactionType.SAVINGS_CONTRIBUTION;
    else if (catName === "دخل") type = TransactionType.INCOME;

    let categoryId = catByName[catName]?.id;
    if (!categoryId) {
      const created = await prisma.category.create({
        data: { userId, name: catName, kind: categoryKind(catName) },
      });
      categoryId = created.id;
      catByName[catName] = created;
    }

    const pmRaw = row["طريقة الدفع"];
    let paymentMethodId: string | undefined;
    if (typeof pmRaw === "string" && pmRaw.trim()) {
      let pm = pmByName[pmRaw.trim()];
      if (!pm) {
        pm = await prisma.paymentMethod.create({
          data: { userId, name: pmRaw.trim() },
        });
        pmByName[pmRaw.trim()] = pm;
      }
      paymentMethodId = pm.id;
    }

    const projectId = catName === "بناء" ? buildProjectId : undefined;

    await prisma.transaction.create({
      data: {
        userId,
        projectId: projectId ?? undefined,
        categoryId,
        paymentMethodId,
        type,
        amount,
        occurredAt,
        description: String(row["الوصف"] ?? "").trim() || undefined,
        notes: row["ملاحظات"] ? String(row["ملاحظات"]) : undefined,
      },
    });
    imported++;
  }
  console.log(`Transactions imported: ${imported}`);
}

async function importBuild(
  prisma: PrismaClient,
  userId: string,
  wb: XLSX.WorkBook
): Promise<string | null> {
  const sheet = wb.Sheets["البناء دفع"];
  if (!sheet) return null;

  const buildRows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];

  const budgetValueRow = buildRows[5] as unknown[] | undefined;
  const totalBudget = budgetValueRow ? num(budgetValueRow[0]) : 112833;

  const headerIdx = buildRows.findIndex(
    (r) => Array.isArray(r) && r[0] === "الاسم"
  );
  if (headerIdx < 0) return null;

  const mainProject = await prisma.project.create({
    data: {
      userId,
      kind: ProjectKind.MASTER_BUILD,
      title: "Building",
      description: "بناء البيت — المشروع الرئيسي",
      totalBudget,
      status: ProjectStatus.ACTIVE,
      imageUrl: "/placeholders/project.svg",
    },
  });

  const buildCategory = await prisma.category.findFirst({
    where: { userId, name: "بناء" },
  });
  const paymentMethods = await prisma.paymentMethod.findMany({ where: { userId } });
  const pmByName = Object.fromEntries(paymentMethods.map((p) => [p.name, p]));

  let contractors = 0;
  for (let i = headerIdx + 1; i < buildRows.length; i++) {
    const row = buildRows[i] as unknown[];
    const name = row[0];
    if (!name || typeof name !== "string" || !name.trim()) continue;
    if (name.trim() === "المجموع") continue;

    const contractTotal = num(row[3]);
    if (contractTotal <= 0) continue;

    const amountPaid = num(row[4]);
    const remaining = num(row[6]) || contractTotal - amountPaid;
    const statusStr = String(row[16] ?? "لم يبدأ");
    const status = PROJECT_STATUS_MAP[statusStr] ?? ProjectStatus.PLANNED;
    const profession = row[1] ? String(row[1]).trim() : null;
    const notes = [row[7], row[8], row[9]].filter(Boolean).join(" — ");

    const contractorProject = await prisma.project.create({
      data: {
        userId,
        parentProjectId: mainProject.id,
        kind: ProjectKind.BUILD_CONTRACTOR,
        title: name.trim(),
        profession,
        description: [
          notes && `ملاحظات: ${notes}`,
          `المتبقي: ${remaining}`,
        ]
          .filter(Boolean)
          .join("\n"),
        totalBudget: contractTotal,
        status,
      },
    });
    contractors++;

    if (buildCategory) {
      await importContractorPaymentPlan(
        prisma,
        userId,
        contractorProject,
        row,
        buildCategory.id,
        pmByName
      );
    }
  }

  console.log(`Build: main project + ${contractors} contractor projects`);
  return mainProject.id;
}

async function importSavings(prisma: PrismaClient, userId: string, wb: XLSX.WorkBook) {
  const sheet = wb.Sheets["الادخارات"];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r.includes("النوع")
  );
  if (headerIdx < 0) return;

  let count = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const typeName = row[1];
    const title = row[2];
    if (!typeName || !title) continue;

    const monthly = num(row[3]);
    if (monthly <= 0) continue;

    const startDate = parseDate(row[4]);
    let payoutDate = parseDate(row[5]);
    if (!payoutDate && typeof row[5] === "string") {
      payoutDate = new Date(row[5] as string);
    }
    if (!startDate || !payoutDate || isNaN(payoutDate.getTime())) continue;

    const targetAmount = num(row[7]) || undefined;

    await prisma.savingsPlan.create({
      data: {
        userId,
        title: String(title),
        type: String(typeName).includes("جمعية")
          ? SavingsPlanType.JAMIYA
          : SavingsPlanType.PERSONAL,
        monthlyContribution: monthly,
        targetAmount,
        startDate,
        payoutDate,
        status: SavingsPlanStatus.ACTIVE,
      },
    });
    count++;
  }
  console.log(`Savings plans imported: ${count}`);
}

async function importSavingsAssets(
  prisma: PrismaClient,
  userId: string,
  wb: XLSX.WorkBook
) {
  const sheet = wb.Sheets["الادخارات"];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r[1] === "النوع" && r[2] === "التفاصيل"
  );
  if (headerIdx < 0) return;

  await prisma.savingsAsset.deleteMany({ where: { userId } });

  let count = 0;
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const typeLabel = row[1];
    const title = row[2];
    if (typeof typeLabel !== "string" || typeof title !== "string") continue;
    if (typeLabel.includes("إجمالي")) break;

    const quantity = num(row[3]);
    const unitPrice = num(row[4]);
    const valueIls = num(row[6]);
    if (quantity <= 0 || valueIls <= 0) continue;

    const kind = typeLabel.includes("ذهب")
      ? SavingsAssetKind.GOLD
      : SavingsAssetKind.USD;
    const priceCurrency =
      typeof row[5] === "string" && row[5].includes("$") ? "USD" : "ILS";

    await prisma.savingsAsset.create({
      data: {
        userId,
        kind,
        title: title.trim(),
        quantity,
        unitPrice,
        priceCurrency,
        valueIls,
      },
    });
    count++;
  }
  console.log(`Savings assets imported: ${count}`);
}

const ANNUAL_INCOME_SOURCES = [
  { name: "أفق", index: 2 },
  { name: "انطلاقة", index: 3 },
  { name: "جامعة منحة", index: 4 },
  { name: "جامعة شغل", index: 5, isSalary: true },
];

async function importAnnualIncome(
  prisma: PrismaClient,
  userId: string,
  wb: XLSX.WorkBook,
  employers: Record<string, { id: string }>
) {
  const sheet = wb.Sheets["تلخيص سنوي"];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r[1] === "الشهر"
  );
  if (headerIdx < 0) return;

  let incomeCount = 0;
  let salaryCount = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const monthLabel = row[1];
    if (typeof monthLabel !== "string" || monthLabel.includes("المجموع")) continue;

    const periodMonth = MONTH_NAMES[monthLabel.trim()];
    if (!periodMonth) continue;

    const periodYear = 2026;

    for (const src of ANNUAL_INCOME_SOURCES) {
      const amount = num(row[src.index]);
      if (amount <= 0) continue;

      const employer = employers[src.name];
      if (!employer) continue;

      const slip = await prisma.salarySlip.upsert({
        where: {
          userId_employerId_periodYear_periodMonth: {
            userId,
            employerId: employer.id,
            periodYear,
            periodMonth,
          },
        },
        create: {
          userId,
          employerId: employer.id,
          periodYear,
          periodMonth,
          gross: amount,
          net: amount,
          paid: false,
        },
        update: { gross: amount, net: amount },
      });
      await syncSalarySlipIncome(slip.id, prisma);
      salaryCount++;
      incomeCount++;
    }
  }

  console.log(
    `Annual income: ${incomeCount} transactions, ${salaryCount} salary slips`
  );
}

async function importSalary(
  prisma: PrismaClient,
  userId: string,
  wb: XLSX.WorkBook,
  employers: Record<string, { id: string }>
) {
  const sheet = wb.Sheets["تلوش الراتب"];
  if (!sheet) return;

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  }) as unknown[][];
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r[1] === "البند"
  );
  if (headerIdx < 0) return;

  const year = 2026;
  const rowByLabel = new Map<string, unknown[]>();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const label = row[1];
    if (typeof label === "string" && label.trim()) {
      rowByLabel.set(label.trim(), row);
    }
  }

  const grossRow = rowByLabel.get("إجمالي الراتب الإجمالي (ברוטו)");
  const netRow = rowByLabel.get("✅  الراتب الصافي (נטו)");
  const taxRow = rowByLabel.get("ضريبة الدخل (מס הכנסה)");
  const pensionRow = rowByLabel.get("تقاعد (פנסיה)");
  const kerenRow = rowByLabel.get("كرن השתלמות");

  if (!grossRow && !netRow) {
    console.log("Salary sheet: no numeric data, skipped");
    return;
  }

  let count = 0;
  for (let col = 2; col <= 13; col++) {
    const monthLabel = rows[headerIdx][col];
    if (typeof monthLabel !== "string") continue;
    const periodMonth = MONTH_NAMES[monthLabel.trim()];
    if (!periodMonth) continue;

    const gross = grossRow ? num(grossRow[col]) : 0;
    const net = netRow ? num(netRow[col]) : 0;
    const tax = taxRow ? num(taxRow[col]) : 0;
    const pension = pensionRow ? num(pensionRow[col]) : 0;
    const kerenHishtalmut = kerenRow ? num(kerenRow[col]) : 0;

    if (gross <= 0 && net <= 0) continue;

    const employer = employers["جامعة شغل"];
    if (!employer) continue;

    await prisma.salarySlip.upsert({
      where: {
        userId_employerId_periodYear_periodMonth: {
          userId,
          employerId: employer.id,
          periodYear: year,
          periodMonth,
        },
      },
      create: {
        userId,
        employerId: employer.id,
        periodYear: year,
        periodMonth,
        gross,
        net,
        tax,
        pension,
        kerenHishtalmut,
      },
      update: { gross, net, tax, pension, kerenHishtalmut },
    });
    count++;
  }
  console.log(`Salary slips imported: ${count}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
  }

  const { prisma, pool } = createPrisma();
  const wb = XLSX.readFile(excelPath);

  const user = await ensureUser(prisma);
  console.log("Importing for:", user.email);

  await clearUserData(prisma, user.id);
  await seedLookups(prisma, user.id, wb);
  const employers = await seedEmployers(prisma, user.id);

  const buildProjectId = await importBuild(prisma, user.id, wb);
  await importTransactions(prisma, user.id, wb, buildProjectId);
  await importAnnualIncome(prisma, user.id, wb, employers);
  await importSavings(prisma, user.id, wb);
  await importSavingsAssets(prisma, user.id, wb);
  await importSalary(prisma, user.id, wb, employers);

  console.log("\nDone!");
  console.log(`  Login: ${userEmail}`);
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
