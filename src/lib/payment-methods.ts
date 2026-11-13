/** Israeli/Arabic credit-card methods that support תשלומים (1–24). */
export function isCreditCardMethod(name?: string | null) {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return (
    /אשראי|כרטיס|visa|mastercard|master\s*card|isracard|amex|american\s*express|credit|card|ויזה|מאסטר/.test(
      n
    ) || /بطاقة|ائتمان|فيزا|ماستر|ماستركارد|ايسراكارد|فيزا|كريدت/.test(n)
  );
}
