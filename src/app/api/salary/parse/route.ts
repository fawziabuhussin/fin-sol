import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { extractTextFromFile, parsePayslipText } from "@/lib/payslip-parser";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    const parsed = parsePayslipText(text, file.name);

    return NextResponse.json({
      gross: parsed.gross,
      net: parsed.net,
      tax: parsed.tax,
      pension: parsed.pension,
      kerenHishtalmut: parsed.kerenHishtalmut,
      periodYear: parsed.periodYear,
      periodMonth: parsed.periodMonth,
      breakdown: parsed.breakdown,
      employerHint: parsed.employerHint,
      confidence: parsed.confidence,
      fileName: file.name,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
