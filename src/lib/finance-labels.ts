export const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;

export const INCOME_SOURCES = [
  { id: "afaq", name: "أفق", color: "#059669" },
  { id: "intilaqa", name: "انطلاقة", color: "#10b981" },
  { id: "scholarship", name: "جامعة منحة", color: "#14b8a6" },
  { id: "salary", name: "جامعة شغل", color: "#6366f1", isSalary: true },
] as const;

export function monthLabel(month: number) {
  return AR_MONTHS[month - 1] ?? "";
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطط للمستقبل",
  ACTIVE: "قيد التنفيذ",
  ON_HOLD: "متوقف",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

export function projectStatusLabel(status: string) {
  return PROJECT_STATUS_LABELS[status] ?? status;
}
