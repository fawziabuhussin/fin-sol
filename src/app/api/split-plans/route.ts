import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { handleApiError } from "@/lib/api-error";
import { expenseInstallmentSchema } from "@/lib/validations/payment-plan";
import {
  createSplitExpense,
  DownPaymentTooLargeError,
} from "@/lib/expense-installments";
import { listSplitPlans } from "@/lib/split-payments";
import { ensureDbSchema } from "@/lib/ensure-schema";

export async function GET() {
  try {
    const user = await requireUser();
    await ensureDbSchema();
    const items = await listSplitPlans(user.id);
    return NextResponse.json({ items });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await ensureDbSchema();
    const parsed = expenseInstallmentSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const item = await createSplitExpense(user.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof DownPaymentTooLargeError) {
      return NextResponse.json(
        { error: "المقدمة أكبر من أو تساوي المبلغ الإجمالي" },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}
