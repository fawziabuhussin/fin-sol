export type SavingsNewsCategory =
  | "gold"
  | "usd"
  | "crypto"
  | "silver"
  | "jamiya"
  | "general";

export type SavingsNewsItem = {
  id: string;
  title: string;
  summary: string;
  category: SavingsNewsCategory;
  tags: string[];
  publishedAt: string;
  url?: string;
  highlight?: boolean;
};

export const SAVINGS_NEWS_CATEGORIES: {
  id: SavingsNewsCategory | "all";
  label: string;
}[] = [
  { id: "all", label: "الكل" },
  { id: "gold", label: "ذهب" },
  { id: "usd", label: "دولار" },
  { id: "silver", label: "فضة" },
  { id: "crypto", label: "عملات رقمية" },
  { id: "jamiya", label: "جمعيات" },
  { id: "general", label: "نصائح عامة" },
];

/** Curated savings opportunities & market context (updated periodically). */
export const SAVINGS_NEWS_ITEMS: SavingsNewsItem[] = [
  {
    id: "usd-boi-rate",
    title: "تابع سعر الدولار الرسمي (שער יציג)",
    summary:
      "قبل شراء دولار للادخار، راجع سعر بنك إسرائيل. الفارق بين المصارف والسوق الحر قد يؤثر على قيمة ادخارك عند التحويل لشيكل.",
    category: "usd",
    tags: ["دولار", "سعر صرف"],
    publishedAt: "2026-06-01",
    url: "https://www.boi.org.il/",
    highlight: true,
  },
  {
    id: "gold-gram-dca",
    title: "شراء الذهب تدريجياً (DCA)",
    summary:
      "بدلاً من شراء كمية كبيرة دفعة واحدة، جرّب شراءً شهرياً بمبلغ ثابت. يقلل مخاطر الشراء عند ذروة السعر ويناسب الادخار طويل الأمد.",
    category: "gold",
    tags: ["ذهب", "استراتيجية"],
    publishedAt: "2026-05-28",
    highlight: true,
  },
  {
    id: "silver-medals",
    title: "ميداليات فضية كأصل ادخاري",
    summary:
      "الفضة والميداليات تُسجّل كأصل منفصل في التطبيق. سجّل سعر الغرام أو القطعة عند كل شراء لمعرفة القيمة الحقيقية لمحفظتك.",
    category: "silver",
    tags: ["فضة", "ميداليات"],
    publishedAt: "2026-05-25",
  },
  {
    id: "crypto-small-allocation",
    title: "تخصيص صغير للعملات الرقمية",
    summary:
      "إن اخترت العملات الرقمية، حدّد نسبة صغيرة من محفظة الادخار (مثلاً 5–10%) وسجّل كل عملية شراء بسعر التحويل لشيكل في تاريخها.",
    category: "crypto",
    tags: ["بيتكوين", "مخاطر"],
    publishedAt: "2026-05-20",
  },
  {
    id: "jamiya-payout-month",
    title: "خطط لشهر القبض في الجمعية",
    summary:
      "قبل شهر القبض، راجع التزاماتك الشهرية. جزء من مبلغ الجمعية يمكن تحويله لدولار أو ذهب إذا كان هدفك حماية القيمة.",
    category: "jamiya",
    tags: ["جمعية", "تخطيط"],
    publishedAt: "2026-05-18",
  },
  {
    id: "emergency-before-invest",
    title: "صندوق طوارئ قبل الادخار في الأصول",
    summary:
      "احتفظ بـ 3–6 أشهر مصروف في حساب سائل قبل زيادة مشتريات الذهب أو الدولار. الادخار الذكي يبدأ بالأمان المالي.",
    category: "general",
    tags: ["طوارئ", "تخطيط"],
    publishedAt: "2026-05-15",
  },
  {
    id: "track-withdrawals",
    title: "سجّل السحوبات وليس المشتريات فقط",
    summary:
      "عند بيع ذهب أو سحب دولار، استخدم زر «سحب» في سجل الحركات. هكذا تبقى المعاملات والرصيد متطابقين في صفحة الادخار والمعاملات.",
    category: "general",
    tags: ["تطبيق", "دقة"],
    publishedAt: "2026-06-08",
    highlight: true,
  },
  {
    id: "kupot-review",
    title: "راجع קופות مع الادخار الشخصي",
    summary:
      "פנסיה וקרן השתלמות جزء من ثروتك طويلة الأمد. قارن نموها مع الذهب والدولار في التقرير السنوي لتوزيع أوضح.",
    category: "general",
    tags: ["קופות", "تنويع"],
    publishedAt: "2026-05-10",
  },
];
