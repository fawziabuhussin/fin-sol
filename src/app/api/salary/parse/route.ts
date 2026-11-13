import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { extractTextFromFile, parsePayslipText } from "@/lib/payslip-parser";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
    }

    const text = await extractTextFromFile(file);
    const parsed = parsePayslipText(text, file.name);

    return NextResponse.json({
      gross: parsed.gross,
      net: parsed.net,
      tax: parsed.tax,
      pension: parsed.pension,
      kerenHishtalmut: parsed.kerenHishtalmut,
      fees: parsed.fees,
      periodYear: parsed.periodYear,
      periodMonth: parsed.periodMonth,
      breakdown: parsed.breakdown,
      employerHint: parsed.employerHint,
      confidence: parsed.confidence,
      fileName: file.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
