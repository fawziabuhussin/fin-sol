export function isWeddingProjectTitle(title: string) {
  const t = title.trim().toLowerCase();
  return /wedding|عرس|زفاف/.test(t);
}
