import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import {
  applyOfficialBguSlip,
  extractTextFromFile,
  parsePayslipText,
} from "@/lib/payslip-parser";
import { isOwnerEmail } from "@/lib/security/owner";
import { MINUTE, consumeRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const AMOUNT_FIELDS = ["gross", "net", "tax", "pension", "kerenHishtalmut", "fees"] as const;

/** Hebrew/Arabic/Latin names compared loosely (spacing, punctuation, case). */
const normalize = (s: string) => s.toLowerCase().replace(/[\s"'״׳\-–—.,()]/g, "");

/** Employer hints the parser recognises, mapped to words that may appear in a user's employer name. */
const HINT_WORDS: Record<string, string[]> = {
  bgu: ["בןגוריון", "bengurion", "جامعة", "بنغوريون", "בגוריון"],
  menora: ["מנורה", "menora"],
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (await consumeRateLimit(`payslip-parse:${user.id}`, 30, 10 * MINUTE)) {
      return NextResponse.json({ error: "محاولات كثيرة — انتظر قليلاً" }, { status: 429 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "الملف أكبر من 10MB" }, { status: 413 });
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json(
        { error: "ارفع القسيمة كملف PDF (الصور غير مدعومة بعد)", code: "UNSUPPORTED_TYPE" },
        { status: 415 }
      );
    }

    let text: string;
    try {
      text = await extractTextFromFile(file);
    } catch {
      return NextResponse.json(
        { error: "تعذّر فتح ملف الـPDF — تأكد أنه غير محمي بكلمة مرور", code: "UNREADABLE" },
        { status: 422 }
      );
    }
    if (text.replace(/\s/g, "").length < 40) {
      return NextResponse.json(
        {
          error: "هذا الـPDF صورة ممسوحة بلا نص — أدخل الأرقام يدوياً أو حمّل القسيمة الرقمية من بوابة الرواتب",
          code: "NO_TEXT",
        },
        { status: 422 }
      );
    }

    let parsed = parsePayslipText(text, file.name);
    // The official BGU figures are the original owner's payslips.
    if (isOwnerEmail(user.email)) parsed = applyOfficialBguSlip(parsed);

    // Suggest one of the user's employers: name appearing in the text, or the parser's hint.
    const employers = await prisma.employer.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, active: true },
    });
    const haystack = normalize(`${text}\n${file.name}`);
    const hintWords = HINT_WORDS[parsed.employerHint ?? ""] ?? [];
    const match =
      employers.find((e) => normalize(e.name).length >= 3 && haystack.includes(normalize(e.name))) ??
      employers.find((e) => hintWords.some((w) => normalize(e.name).includes(w)));

    return NextResponse.json({
      ...Object.fromEntries(AMOUNT_FIELDS.map((k) => [k, parsed[k] ?? null])),
      periodYear: parsed.periodYear ?? null,
      periodMonth: parsed.periodMonth ?? null,
      breakdown: parsed.breakdown ?? null,
      employerHint: parsed.employerHint ?? "generic",
      suggestedEmployerId: match?.id ?? null,
      suggestedEmployerName:
        match?.name ?? (parsed.employerHint === "bgu" ? "אוניברסיטת בן-גוריון" : parsed.employerHint === "menora" ? "מנורה" : null),
      estimatedFields: AMOUNT_FIELDS.filter((k) => parsed.derivedFields?.includes(k) && parsed[k]! > 0),
      foundFields: [
        ...AMOUNT_FIELDS.filter((k) => parsed[k] != null && parsed[k]! > 0 && !parsed.derivedFields?.includes(k)),
        ...(parsed.periodMonth ? ["period"] : []),
      ],
      confidence: parsed.confidence,
      fileName: file.name,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
