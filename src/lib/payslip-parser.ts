import type { PayslipParseResult, SalarySlipBreakdown } from "@/lib/payslip-types";

export type { PayslipParseResult, SalarySlipBreakdown } from "@/lib/payslip-types";

const AMOUNT = String.raw`(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)`;

function parseAmount(raw: string | undefined) {
  if (!raw) return undefined;
  const n = Number.parseFloat(raw.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : undefined;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** PDFs often emit Hebrew labels reversed or Latin-1 mojibake — search both directions. */
function labelPatterns(hebrew: string) {
  const rev = hebrew.split("").reverse().join("");
  return [hebrew, rev].map(escapeRegex);
}

function findAmountNearLabel(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    for (const lab of labelPatterns(label)) {
      const re = new RegExp(
        `${lab}\\s*[:\\-]?\\s*${AMOUNT}|${AMOUNT}\\s*${lab}`,
        "i"
      );
      const m = text.match(re);
      if (m) {
        const val = parseAmount(m[1] ?? m[2]);
        if (val != null) return val;
      }
    }
  }
  return undefined;
}

function detectEmployer(text: string, fileName?: string): PayslipParseResult["employerHint"] {
  const blob = `${text}\n${fileName ?? ""}`;
  if (/בן\s*גוריון|Ben[- ]?Gurion|8410501|áâðá|תלוש/i.test(blob)) return "bgu";
  if (/מנורה|Menora|116/i.test(blob)) return "menora";
  return "generic";
}

function periodFromFileName(fileName?: string) {
  const m = fileName?.match(/(\d{1,2})[-_](\d{4})/);
  if (!m) return {};
  const month = Number.parseInt(m[1], 10);
  const year = Number.parseInt(m[2], 10);
  if (month >= 1 && month <= 12) return { periodMonth: month, periodYear: year };
  return {};
}

function periodFromText(text: string) {
  const m = text.match(/(\d{1,2})[\/\-.](\d{4})/g);
  if (!m?.length) return {};
  const last = m[m.length - 1].match(/(\d{1,2})[\/\-.](\d{4})/);
  if (!last) return {};
  const month = Number.parseInt(last[1], 10);
  const year = Number.parseInt(last[2], 10);
  if (month >= 1 && month <= 12 && year >= 2020) return { periodMonth: month, periodYear: year };
  return {};
}

/** BGU university payslip (common PDF text layout). */
function parseBguPayslip(text: string, fileName?: string): PayslipParseResult {
  const fromFile = periodFromFileName(fileName);
  const fromText = periodFromText(text);
  const result: PayslipParseResult = {
    confidence: "low",
    employerHint: "bgu",
    rawText: text.slice(0, 12000),
    periodYear: fromFile.periodYear ?? fromText.periodYear,
    periodMonth: fromFile.periodMonth ?? fromText.periodMonth,
  };

  const net =
    findAmountNearLabel(text, ["שכר נטו", "נטו"]) ??
    parseAmount(text.match(new RegExp(`${AMOUNT}\\s*(?:נטו|åèð\\s*øëù)`, "i"))?.[1]) ??
    parseAmount(text.match(new RegExp(`(?:נטו|åèð\\s*øëù)\\s*${AMOUNT}`, "i"))?.[1]);

  const gross =
    findAmountNearLabel(text, ["סך-כל התשלומים", "שכר מולשם", "סך כל"]) ??
    parseAmount(text.match(new RegExp(`${AMOUNT}\\s*(?:משכורת|שכר מולשם|íéîåìùúä)`, "i"))?.[1]) ??
    parseAmount(text.match(new RegExp(`(?:סך|íéîåìùúä)\\s*${AMOUNT}`, "i"))?.[1]);

  const nationalInsurance =
    findAmountNearLabel(text, ["ביטוח לאומי"]) ??
    parseAmount(text.match(new RegExp(`${AMOUNT}\\s*(?:ביטוח לאומי|íéñî-äáåç)`, "i"))?.[1]);

  const healthInsurance =
    findAmountNearLabel(text, ["מס בריאות", "ביטוח בריאות"]) ??
    parseAmount(text.match(new RegExp(`${AMOUNT}\\s*(?:בריאות|íéôñåð-äáåç)`, "i"))?.[1]);

  let incomeTax = findAmountNearLabel(text, ["מס הכנסה"]);

  const kerenPair = text.match(
    /([\d,]+\.\d{2})([\d,]+\.\d{2})(?:íëñäá|קרן השתלמות|השתלמות)/i
  );
  let kerenEmployee = parseAmount(kerenPair?.[1]);
  let kerenEmployer = parseAmount(kerenPair?.[2]);

  if (net != null) {
    const escapedNet = net.toFixed(2).replace(".", "\\.");
    const beforeNet = text.match(
      new RegExp(`${AMOUNT}\\s*(?:åèð\\s*øëù|נטו|שכר נטו)?\\s*${escapedNet}`, "i")
    );
    const lineBefore = text.match(
      new RegExp(`(${AMOUNT})\\s*${escapedNet}`, "i")
    );
    const candidate = parseAmount(lineBefore?.[1]);
    if (
      candidate != null &&
      candidate > 50 &&
      candidate < (gross ?? 99999) &&
      Math.abs(candidate - net) > 1
    ) {
      if (kerenEmployee == null || kerenEmployee < candidate) {
        kerenEmployee = candidate;
      }
    }
  }

  const pensionLines: SalarySlipBreakdown["pension"]["lines"] = [];
  const gemelLineRe =
    /(\d{1,3}(?:\.\d{2})?)(\d{1,3}(?:\.\d{2})?)(\d{1,3}(?:,\d{3})*\.\d{2})\d{6,}/g;
  let gm: RegExpExecArray | null;
  while ((gm = gemelLineRe.exec(text)) !== null) {
    const employee = parseAmount(gm[1]);
    const employer = parseAmount(gm[2]);
    const base = parseAmount(gm[3]);
    if (!base || base < 1500) continue;
    if (employee == null && employer == null) continue;
    pensionLines.push({
      employee: employee ?? 0,
      employer: employer ?? 0,
      base,
    });
  }

  let pensionEmployee = pensionLines.reduce((s, l) => s + l.employee, 0);
  let pensionEmployer = pensionLines.reduce((s, l) => s + l.employer, 0);
  const severanceEmployer = pensionLines
    .filter((l) => l.employer > 0 && l.employee < 50)
    .reduce((s, l) => s + l.employer, 0);

  if (gross != null && net != null) {
    const withholdings = Math.round((gross - net) * 100) / 100;
    const ni = nationalInsurance ?? 0;
    const health = healthInsurance ?? 0;
    const keren = kerenEmployee ?? 0;
    if (incomeTax == null) {
      incomeTax = Math.round((withholdings - ni - health - keren - pensionEmployee) * 100) / 100;
      if (incomeTax < 0) incomeTax = 0;
    }
    if (pensionEmployee === 0 && withholdings > ni + health + keren) {
      pensionEmployee = Math.round((withholdings - ni - health - keren - (incomeTax ?? 0)) * 100) / 100;
      if (pensionEmployee < 0) pensionEmployee = 0;
    }
  }

  const taxTotal =
    Math.round(
      ((nationalInsurance ?? 0) +
        (healthInsurance ?? 0) +
        (incomeTax ?? 0)) *
        100
    ) / 100;

  const breakdown: SalarySlipBreakdown = {
    taxes: {
      nationalInsurance: nationalInsurance ?? 0,
      healthInsurance: healthInsurance ?? 0,
      incomeTax: incomeTax ?? 0,
      total: taxTotal,
    },
    pension: {
      employee: pensionEmployee,
      employer: pensionEmployer,
      severanceEmployer: severanceEmployer > 0 ? severanceEmployer : undefined,
      lines: pensionLines.length ? pensionLines : undefined,
    },
    keren: {
      employee: kerenEmployee ?? 0,
      employer: kerenEmployer ?? 0,
    },
  };

  result.gross = gross;
  result.net = net;
  result.tax = taxTotal;
  result.pension = pensionEmployee;
  result.kerenHishtalmut = kerenEmployee ?? 0;
  result.breakdown = breakdown;

  const filled = [gross, net, nationalInsurance].filter((v) => v != null && v > 0).length;
  result.confidence = filled >= 3 ? "high" : filled >= 2 ? "medium" : "low";
  return result;
}

/** Menora / private employer format (תגמולים + פיצויים + קרן השתלמות). */
function parseMenoraPayslip(text: string, fileName?: string): PayslipParseResult {
  const result: PayslipParseResult = {
    confidence: "low",
    employerHint: "menora",
    rawText: text.slice(0, 12000),
    ...periodFromFileName(fileName),
    ...periodFromText(text),
  };

  const gross =
    findAmountNearLabel(text, ["סה\"כ תשלומים", "סך-כל תשלומים"]) ??
    parseAmount(text.match(new RegExp(`${AMOUNT}\\s*(?:תשלומים|סה"כ)`, "i"))?.[1]);

  const net =
    findAmountNearLabel(text, ["שכר נטו", "נטו", "לתשלום"]) ??
    parseAmount(text.match(new RegExp(`${AMOUNT}\\s*נטו`, "i"))?.[1]);

  const nationalInsurance = findAmountNearLabel(text, ["ביטוח לאומי"]);
  const healthInsurance = findAmountNearLabel(text, ["ביטוח בריאות", "מס בריאות"]);
  const incomeTax = findAmountNearLabel(text, ["מס הכנסה"]) ?? 0;

  const pensionEmployee =
    findAmountNearLabel(text, ["ניכוי מהעובד", "תגמולים"]) ??
    parseAmount(text.match(/(\d+\.\d{2})\s*(\d+\.\d{2})\s*(?:תגמולים|קצבה)/i)?.[1]) ??
    0;

  const pensionEmployer =
    parseAmount(text.match(/הפרשת מעסיק\s*${AMOUNT}/i)?.[1]) ?? 0;

  const kerenEmployee = findAmountNearLabel(text, ["קרן השתלמות", "השתלמות"]) ?? 0;
  const kerenEmployer =
    parseAmount(text.match(/השתלמות[\s\S]{0,80}?הפרשת מעסיק\s*${AMOUNT}/i)?.[1]) ?? 0;

  const taxTotal =
    Math.round(
      ((nationalInsurance ?? 0) + (healthInsurance ?? 0) + incomeTax) * 100
    ) / 100;

  const breakdown: SalarySlipBreakdown = {
    taxes: {
      nationalInsurance: nationalInsurance ?? 0,
      healthInsurance: healthInsurance ?? 0,
      incomeTax,
      total: taxTotal,
    },
    pension: { employee: pensionEmployee, employer: pensionEmployer },
    keren: { employee: kerenEmployee, employer: kerenEmployer },
  };

  result.gross = gross;
  result.net = net;
  result.tax = taxTotal;
  result.pension = pensionEmployee;
  result.kerenHishtalmut = kerenEmployee;
  result.breakdown = breakdown;

  const filled = [gross, net].filter(Boolean).length;
  result.confidence = filled >= 2 && taxTotal > 0 ? "high" : filled >= 1 ? "medium" : "low";
  return result;
}

export function parsePayslipText(text: string, fileName?: string): PayslipParseResult {
  const hint = detectEmployer(text, fileName);
  if (hint === "bgu") return parseBguPayslip(text, fileName);
  if (hint === "menora") return parseMenoraPayslip(text, fileName);
  const bgu = parseBguPayslip(text, fileName);
  if (bgu.confidence !== "low") return bgu;
  return parseMenoraPayslip(text, fileName);
}

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type.startsWith("text/")) return file.text();

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default as (
      buf: Buffer
    ) => Promise<{ text: string }>;
    const { text } = await pdfParse(buffer);
    return text;
  }

  return `[${file.name}] — الصق نص التלוש أو استخدم PDF`;
}
