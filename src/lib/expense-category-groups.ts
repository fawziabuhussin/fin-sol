/**
 * Visual expense groups (Isracard-style taxonomy) for dashboards and smart sorting.
 * Maps fine-grained Arabic categories + merchant rules → grouped display buckets.
 */
import type { LucideIcon } from "lucide-react";
import {
  Car,
  Coins,
  CreditCard,
  HeartPulse,
  Home,
  Landmark,
  Palmtree,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Umbrella,
  UtensilsCrossed,
  Wifi,
} from "lucide-react";
import {
  categorizeExpense,
  type ExpenseCategoryName,
} from "@/lib/expense-categories";

export type ExpenseGroupId =
  | "vacation"
  | "entertainment"
  | "culture"
  | "food"
  | "clothing"
  | "health"
  | "home"
  | "insurance"
  | "transport"
  | "taxes"
  | "banking"
  | "subscriptions"
  | "misc"
  | "cash";

export type ExpenseGroupDef = {
  id: ExpenseGroupId;
  label: string;
  color: string;
  icon: LucideIcon;
  sortOrder: number;
};

export const EXPENSE_GROUPS: ExpenseGroupDef[] = [
  { id: "vacation", label: "عطلات", color: "#7C3AED", icon: Palmtree, sortOrder: 1 },
  {
    id: "entertainment",
    label: "ترفيه ومطاعم",
    color: "#EC4899",
    icon: UtensilsCrossed,
    sortOrder: 2,
  },
  { id: "culture", label: "ثقافة وترفيه", color: "#EAB308", icon: Sparkles, sortOrder: 3 },
  { id: "food", label: "طعام ومشروبات", color: "#EF4444", icon: ShoppingBasket, sortOrder: 4 },
  { id: "clothing", label: "ملابس وأحذية", color: "#14B8A6", icon: Shirt, sortOrder: 5 },
  { id: "health", label: "صحة", color: "#22C55E", icon: HeartPulse, sortOrder: 6 },
  { id: "home", label: "منزل وحديقة", color: "#84CC16", icon: Home, sortOrder: 7 },
  { id: "insurance", label: "تأمين", color: "#3B82F6", icon: Umbrella, sortOrder: 8 },
  {
    id: "transport",
    label: "سيارة ومواصلات",
    color: "#F97316",
    icon: Car,
    sortOrder: 9,
  },
  { id: "taxes", label: "ضرائب ومدفوعات", color: "#1E40AF", icon: Landmark, sortOrder: 10 },
  { id: "banking", label: "خدمات بنكية", color: "#0D9488", icon: CreditCard, sortOrder: 11 },
  { id: "subscriptions", label: "اشتراكات", color: "#6366F1", icon: Wifi, sortOrder: 12 },
  { id: "misc", label: "متنوعات", color: "#64748B", icon: ShoppingBasket, sortOrder: 13 },
  { id: "cash", label: "نقدي", color: "#78716C", icon: Coins, sortOrder: 14 },
];

const GROUP_BY_ID = Object.fromEntries(
  EXPENSE_GROUPS.map((g) => [g.id, g])
) as Record<ExpenseGroupId, ExpenseGroupDef>;

/** Fine category name → display group */
const CATEGORY_TO_GROUP: Record<string, ExpenseGroupId> = {
  سوبرماركت: "food",
  مخبوزات: "food",
  مطاعم: "entertainment",
  قهوة: "entertainment",
  اشتراكات: "subscriptions",
  فواتير: "taxes",
  تأمين: "insurance",
  وقود: "transport",
  مواصلات: "transport",
  "موقف سيارات": "transport",
  صيدلية: "health",
  ملابس: "clothing",
  أطفال: "culture",
  "رسوم بنكية": "banking",
  أخرى: "misc",
  مصروفات: "misc",
  بناء: "misc",
  "طعام خارج": "entertainment",
};

/** Merchant keywords → group (for smart suggestions) */
const MERCHANT_TO_GROUP: { group: ExpenseGroupId; patterns: RegExp[] }[] = [
  { group: "subscriptions", patterns: [/cursor|github|apple|google|youtube|vercel|overleaf|icloud|chatgpt|adobe/i] },
  { group: "banking", patterns: [/דמי כרטיס|פועלים|رسوم بنك/i] },
  { group: "insurance", patterns: [/aig|ביטוח|تأمين/i] },
  { group: "transport", patterns: [/פז|yellow|דלק|האאט|דילברי|wolt|מוביטי|חניון|דרך ארץ/i] },
  { group: "taxes", patterns: [/חשמל|עירית|תש.?רשויות|מ\.?תחבורה|רב-פס|كهرباء/i] },
  { group: "health", patterns: [/פארם|מרקחת|pharm|صيدل|דוקטור|רופא/i] },
  { group: "clothing", patterns: [/הלבשה|boutique|lavia|מותגים|ملابس/i] },
  { group: "food", patterns: [/סופר|מרקט|מכולת|מאפי|מעדני|سوبر|مخبز/i] },
  { group: "entertainment", patterns: [/מסעד|בורגר|קפה|ארומה|קינמון|مطعم|قهوة/i] },
  { group: "home", patterns: [/אקאסיה|משתלות|חשמל וצבע|ביג סטור|IKEA/i] },
  { group: "vacation", patterns: [/hotel|מלון|טיסה|flight|נופש/i] },
  { group: "culture", patterns: [/דפוס|מוזיאון|תיאטרון|ספר|كتب/i] },
  { group: "cash", patterns: [/מזומן|نقد|كاش/i] },
];

export const UNCATEGORIZED_CATEGORY_NAMES = new Set([
  "أخرى",
  "مصروفات",
  "—",
  "",
]);

export function getExpenseGroup(id: ExpenseGroupId): ExpenseGroupDef {
  return GROUP_BY_ID[id];
}

export function groupIdFromCategoryName(
  categoryName: string | null | undefined
): ExpenseGroupId {
  const name = (categoryName ?? "").trim();
  if (!name || UNCATEGORIZED_CATEGORY_NAMES.has(name)) return "misc";
  return CATEGORY_TO_GROUP[name] ?? "misc";
}

export function suggestGroupFromDescription(
  description: string | null | undefined,
  sector?: string | null
): ExpenseGroupId {
  const text = (description ?? "").trim();
  for (const { group, patterns } of MERCHANT_TO_GROUP) {
    if (patterns.some((p) => p.test(text))) return group;
  }
  const fine = categorizeExpense(description, sector);
  return groupIdFromCategoryName(fine);
}

export function suggestCategoryNameFromDescription(
  description: string | null | undefined,
  sector?: string | null
): ExpenseCategoryName {
  return categorizeExpense(description, sector);
}

export function isUncategorizedCategoryName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return !n || UNCATEGORIZED_CATEGORY_NAMES.has(n);
}

export type ExpenseGroupRow = {
  id: ExpenseGroupId;
  label: string;
  color: string;
  amount: number;
  percent: number;
  transactions: {
    id: string;
    amount: number;
    occurredAt: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string;
    paymentMethodName: string | null;
  }[];
};

export function aggregateExpensesByGroup(
  items: {
    id: string;
    amount: number;
    occurredAt: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string;
    paymentMethodName?: string | null;
    excludeBuild?: boolean;
  }[],
  totalExpenses: number
): ExpenseGroupRow[] {
  const buckets = new Map<ExpenseGroupId, ExpenseGroupRow>();

  for (const item of items) {
    if (item.excludeBuild && item.categoryName === "بناء") continue;

    const groupId = groupIdFromCategoryName(item.categoryName);
    const def = getExpenseGroup(groupId);
    let row = buckets.get(groupId);
    if (!row) {
      row = {
        id: groupId,
        label: def.label,
        color: def.color,
        amount: 0,
        percent: 0,
        transactions: [],
      };
      buckets.set(groupId, row);
    }
    row.amount += item.amount;
    row.transactions.push({
      id: item.id,
      amount: item.amount,
      occurredAt: item.occurredAt,
      description: item.description,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      paymentMethodName: item.paymentMethodName ?? null,
    });
  }

  const rows = [...buckets.values()]
    .map((row) => ({
      ...row,
      percent: totalExpenses > 0 ? (row.amount / totalExpenses) * 100 : 0,
      transactions: row.transactions.sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt)
      ),
    }))
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        getExpenseGroup(a.id).sortOrder - getExpenseGroup(b.id).sortOrder
    );

  return rows;
}

export type UncategorizedExpense = {
  id: string;
  amount: number;
  occurredAt: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string;
  suggestedGroupId: ExpenseGroupId;
  suggestedGroupLabel: string;
  suggestedCategoryName: ExpenseCategoryName;
};

export function findUncategorizedExpenses(
  items: {
    id: string;
    amount: number;
    occurredAt: string;
    description: string | null;
    categoryId: string | null;
    categoryName: string;
  }[]
): UncategorizedExpense[] {
  return items
    .filter((item) => {
      if (item.categoryName === "بناء") return false;
      if (!isUncategorizedCategoryName(item.categoryName)) return false;
      return true;
    })
    .map((item) => {
      const suggestedGroupId = suggestGroupFromDescription(item.description);
      const suggestedCategoryName = suggestCategoryNameFromDescription(
        item.description
      );
      return {
        ...item,
        suggestedGroupId,
        suggestedGroupLabel: getExpenseGroup(suggestedGroupId).label,
        suggestedCategoryName,
      };
    });
}
