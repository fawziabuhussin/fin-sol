import type { PrismaClient } from "@/generated/prisma/client";
import { CategoryKind } from "@/generated/prisma/client";

const CATEGORIES: { name: string; kind: CategoryKind }[] = [
  { name: "أخرى", kind: CategoryKind.EXPENSE },
  { name: "قهوة", kind: CategoryKind.EXPENSE },
  { name: "طعام خارج", kind: CategoryKind.EXPENSE },
  { name: "اشتراكات", kind: CategoryKind.EXPENSE },
  { name: "فواتير", kind: CategoryKind.EXPENSE },
  { name: "ملابس", kind: CategoryKind.EXPENSE },
  { name: "بناء", kind: CategoryKind.BUILD },
  { name: "ادخار", kind: CategoryKind.SAVINGS },
  { name: "دخل", kind: CategoryKind.INCOME },
];

const PAYMENT_METHODS = [
  "مزومان",
  "شيكات",
  "אשראי",
  "كاش",
  "העברה בנקאית",
  "اشراي",
];

const INCOME_SOURCES = ["أفق", "انطلاقة", "جامعة منحة", "جامعة شغل"];

export async function seedHouseholdLookups(
  prisma: PrismaClient,
  householdId: string
) {
  await Promise.all(
    CATEGORIES.map((c, i) =>
      prisma.category.upsert({
        where: { householdId_name: { householdId, name: c.name } },
        create: { householdId, name: c.name, kind: c.kind, sortOrder: i },
        update: {},
      })
    )
  );

  await Promise.all(
    PAYMENT_METHODS.map((name) =>
      prisma.paymentMethod.upsert({
        where: { householdId_name: { householdId, name } },
        create: { householdId, name },
        update: {},
      })
    )
  );

  await Promise.all(
    INCOME_SOURCES.map((name) =>
      prisma.incomeSource.upsert({
        where: { householdId_name: { householdId, name } },
        create: { householdId, name },
        update: {},
      })
    )
  );
}
