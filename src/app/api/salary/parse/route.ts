import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { extractTextFromFile, parsePayslipText } from "@/lib/payslip-parser";

export async function POST(req: Request) {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const text = await extractTextFromFile(file);
    const parsed = parsePayslipText(text);

    return NextResponse.json({
      ...parsed,
      fileName: file.name,
      slipFileUrl: `/uploads/payslips/${file.name}`,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
