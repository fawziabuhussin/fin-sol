export type PayslipParseResult = {
  gross?: number;
  net?: number;
  tax?: number;
  pension?: number;
  kerenHishtalmut?: number;
  periodYear?: number;
  periodMonth?: number;
  confidence: "high" | "low";
  rawText: string;
};

const PATTERNS: { key: keyof PayslipParseResult; regex: RegExp }[] = [
  { key: "gross", regex: /(?:ברוטו|Bruto|إجمالي)[:\s]*([\d,]+\.?\d*)/i },
  { key: "net", regex: /(?:נטו|Neto|صافي)[:\s]*([\d,]+\.?\d*)/i },
  { key: "tax", regex: /(?:מס הכנסה|ضريبة)[:\s]*([\d,]+\.?\d*)/i },
  { key: "pension", regex: /(?:פנסיה|تقاعد)[:\s]*([\d,]+\.?\d*)/i },
  {
    key: "kerenHishtalmut",
    regex: /(?:קרן השתלמות|השתלמות)[:\s]*([\d,]+\.?\d*)/i,
  },
];

function parseAmount(raw: string) {
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parsePayslipText(text: string): PayslipParseResult {
  const result: PayslipParseResult = {
    confidence: "low",
    rawText: text.slice(0, 5000),
  };

  for (const { key, regex } of PATTERNS) {
    const match = text.match(regex);
    if (match?.[1]) {
      const val = parseAmount(match[1]);
      if (val != null) (result as Record<string, unknown>)[key] = val;
    }
  }

  const dateMatch = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (dateMatch) {
    result.periodMonth = Number.parseInt(dateMatch[2], 10);
    result.periodYear = Number.parseInt(dateMatch[3], 10);
    if (result.periodYear < 100) result.periodYear += 2000;
  }

  const filled = [result.gross, result.net, result.tax].filter(Boolean).length;
  result.confidence = filled >= 2 ? "high" : "low";
  return result;
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type.startsWith("text/")) return file.text();
  if (file.type === "application/pdf") {
    return `[PDF: ${file.name}] — أدخل المبالغ يدوياً أو الصق نص التלוש`;
  }
  return `[Image: ${file.name}] — أدخل المبالغ يدوياً`;
}
