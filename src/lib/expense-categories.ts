/**
 * Arabic expense categories + Isracard (ענף) / merchant classification.
 */

/** User-facing expense category names (excluding income/savings/build). */
export const EXPENSE_CATEGORY_NAMES = [
  "سوبرماركت",
  "مخبوزات",
  "مطاعم",
  "قهوة",
  "اشتراكات",
  "فواتير",
  "تأمين",
  "وقود",
  "مواصلات",
  "موقف سيارات",
  "صيدلية",
  "ملابس",
  "أطفال",
  "رسوم بنكية",
  "أخرى",
] as const;

export type ExpenseCategoryName = (typeof EXPENSE_CATEGORY_NAMES)[number];

/** Isracard sector (ענף) → default category */
export const SECTOR_TO_CATEGORY: Record<string, ExpenseCategoryName> = {
  "מכולת/סופר": "سوبرماركت",
  מעדניות: "مخبوزات",
  "מסעדות/קפה": "مطاعم",
  דלק: "وقود",
  "תש' רשויות": "فواتير",
  ביטוח: "تأمين",
  הלבשה: "ملابس",
  תחבורה: "مواصلات",
  "שירותי רכב": "موقف سيارات",
  פארמה: "صيدلية",
  צעצועים: "أطفال",
  משתלות: "أخرى",
  "עיתון/דפוס": "أخرى",
  שונות: "أخرى",
};

const MERCHANT_RULES: { category: ExpenseCategoryName; patterns: RegExp[] }[] = [
  {
    category: "اشتراكات",
    patterns: [
      /cursor/i,
      /github/i,
      /apple\.com/i,
      /genspark/i,
      /google|youtube/i,
      /vercel/i,
      /adobe/i,
      /overleaf/i,
    ],
  },
  {
    category: "رسوم بنكية",
    patterns: [/דמי כרטיס/i, /פועלים/i],
  },
  {
    category: "تأمين",
    patterns: [/aig/i, /ביטוח/i],
  },
  {
    category: "وقود",
    patterns: [/פז/i, /yellow/i, /דלק/i, /אלון/i],
  },
  {
    category: "موقف سيارات",
    patterns: [/חניון/i, /חוף/i, /פארק צ'ארלס/i],
  },
  {
    category: "مواصلات",
    patterns: [/האאט/i, /wolt/i, /דילברי/i],
  },
  {
    category: "صيدلية",
    patterns: [/פארם/i, /מרקחת/i, /TOP-? ?פארם/i, /לנה פארם/i],
  },
  {
    category: "فواتير",
    patterns: [
      /חשמל/i,
      /דרך ארץ/i,
      /עירית/i,
      /הועדה לתכנון/i,
      /מ\.? התחבורה/i,
      /תש['']?\s*רשויות/i,
    ],
  },
  {
    category: "ملابس",
    patterns: [
      /boutique/i,
      /fashion/i,
      /הלבשה/i,
      /עותמאן/i,
      /קליאופטרה/i,
      /חקן אל חריר/i,
      /maran/i,
    ],
  },
  {
    category: "أطفال",
    patterns: [/תינוק/i, /צעצוע/i],
  },
  {
    category: "سوبرماركت",
    patterns: [
      /סופר/i,
      /מרקט/i,
      /מכולת/i,
      /תאופיק/i,
      /אלמדינה/i,
      /זוהדי/i,
      /אלביאן/i,
      /אלהודא/i,
      /אלערין/i,
      /אלרחמה/i,
      /אלואחה/i,
      /בית הבשר/i,
    ],
  },
  {
    category: "مخبوزات",
    patterns: [/מאפי/i, /מעדני/i, /אלבאבור/i, /אלדואר/i, /אלבאבור/i],
  },
  {
    category: "قهوة",
    patterns: [
      /קינמון/i,
      /ארומה/i,
      /קופי/i,
      /coffee/i,
      /קיוסק אל טארק/i,
    ],
  },
  {
    category: "مطاعم",
    patterns: [
      /מסעד/i,
      /בורגר/i,
      /ברייק/i,
      /crispy/i,
      /דמשק/i,
      /גדודנא/i,
      /בונז/i,
      /roasty/i,
      /krunchy/i,
      /וירונה/i,
      /אמיגוס/i,
      /המקסיקני/i,
      /מש-קר/i,
      /טייק/i,
      /ערוס/i,
      /אלבאחאר/i,
      /אגיאל/i,
      /סאן גת/i,
    ],
  },
];

/**
 * Pick the best expense category from merchant name and optional Isracard sector.
 */
export function categorizeExpense(
  description: string | null | undefined,
  sector?: string | null
): ExpenseCategoryName {
  const text = (description ?? "").trim();

  for (const { category, patterns } of MERCHANT_RULES) {
    if (patterns.some((p) => p.test(text))) {
      return category;
    }
  }

  if (sector?.trim()) {
    const fromSector = SECTOR_TO_CATEGORY[sector.trim()];
    if (fromSector) return fromSector;
  }

  return "أخرى";
}
