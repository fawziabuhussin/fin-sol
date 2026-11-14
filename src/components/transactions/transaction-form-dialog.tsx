"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, PiggyBank, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { localTodayIso } from "@/lib/dates";
import type { TxCategory, TxRow, TxType } from "./types";

type Option = { id: string; name: string };

const TYPES: { value: TxType; label: string; icon: typeof ArrowDownLeft; active: string }[] = [
  { value: "EXPENSE", label: "مصروف", icon: ArrowUpRight, active: "text-rose-600" },
  { value: "INCOME", label: "دخل", icon: ArrowDownLeft, active: "text-emerald-600" },
  { value: "SAVINGS_CONTRIBUTION", label: "ادخار", icon: PiggyBank, active: "text-indigo-600" },
  { value: "TRANSFER", label: "تحويل", icon: ArrowLeftRight, active: "text-slate-700" },
];

const KIND_FOR_TYPE: Record<TxType, TxCategory["kind"]> = {
  EXPENSE: "EXPENSE",
  TRANSFER: "EXPENSE",
  INCOME: "INCOME",
  SAVINGS_CONTRIBUTION: "SAVINGS",
};

export async function deleteTransaction(id: string): Promise<string | null> {
  const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
  if (res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message : "تعذّر الحذف";
}

/** Add or edit a transaction. Remount with a `key` per target so state initialises from props. */
export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "EXPENSE",
  lookups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TxRow | null;
  defaultType?: TxType;
  lookups: { categories: TxCategory[]; projects: Option[]; paymentMethods: Option[] };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEdit = transaction != null;
  const [form, setForm] = useState(() => ({
    type: (transaction?.type ?? defaultType) as TxType,
    amount: transaction ? String(transaction.amount) : "",
    occurredAt: transaction?.occurredAt ?? localTodayIso(),
    description: transaction?.description ?? "",
    notes: transaction?.notes ?? "",
    categoryId: transaction?.categoryId ?? "",
    projectId: transaction?.projectId ?? "",
    paymentMethodId: transaction?.paymentMethodId ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const categories = useMemo(() => {
    const kind = KIND_FOR_TYPE[form.type];
    const list = lookups.categories.filter((c) => c.kind === kind);
    // Keep the current category visible even if it belongs to another kind.
    const current = lookups.categories.find((c) => c.id === form.categoryId);
    return current && !list.includes(current) ? [current, ...list] : list;
  }, [lookups.categories, form.type, form.categoryId]);

  const submit = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return setError("أدخل مبلغاً أكبر من صفر");
    if (!form.occurredAt) return setError("اختر التاريخ");
    setError(null);
    startTransition(async () => {
      const res = await fetch(isEdit ? `/api/transactions/${transaction.id}` : "/api/transactions", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          amount,
          occurredAt: form.occurredAt,
          description: form.description.trim(),
          notes: form.notes.trim(),
          categoryId: form.categoryId || null,
          projectId: form.projectId || null,
          paymentMethodId: form.paymentMethodId || null,
          payeeId: transaction?.payeeId ?? null,
          currency: "ILS",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          typeof body.message === "string"
            ? body.message
            : body.error === "INVALID_REFERENCE"
              ? "أحد الاختيارات لم يعد موجوداً — حدّث الصفحة"
              : "تعذّر الحفظ، حاول مرة أخرى"
        );
        return;
      }
      toast.success(isEdit ? "تم حفظ التعديلات" : form.type === "INCOME" ? "أُضيف الدخل" : "أُضيفت المعاملة");
      onOpenChange(false);
      router.refresh();
    });
  };

  const remove = () =>
    startTransition(async () => {
      const err = await deleteTransaction(transaction!.id);
      if (err) {
        setConfirmDelete(false);
        setError(err);
        return;
      }
      toast.success("حُذفت المعاملة");
      onOpenChange(false);
      router.refresh();
    });

  const tone = TYPES.find((t) => t.value === form.type)!;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>{isEdit ? "تعديل المعاملة" : "معاملة جديدة"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "التعديل يُحدَّث فوراً في كل التقارير." : "سجّل مصروفاً أو دخلاً — يظهر فوراً في تقارير الشهر."}
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-5">
              <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1">
                {TYPES.map(({ value, label, icon: Icon, active }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("type", value)}
                    aria-pressed={form.type === value}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg py-2 text-xs font-semibold transition-all sm:flex-row sm:justify-center sm:gap-1.5 sm:text-sm",
                      form.type === value ? cn("bg-white shadow-card", active) : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-center">
                <Label htmlFor="tx-amount" className="mb-0 text-xs text-slate-500">المبلغ</Label>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <input
                    id="tx-amount"
                    autoFocus={!isEdit}
                    inputMode="decimal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)}
                    placeholder="0"
                    className={cn(
                      "num w-44 bg-transparent text-center text-4xl font-bold outline-none placeholder:text-slate-300",
                      tone.active
                    )}
                  />
                  <span className="text-lg font-bold text-slate-400">₪</span>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <Label htmlFor="tx-desc">الوصف</Label>
                  <Input
                    id="tx-desc"
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder={form.type === "INCOME" ? "راتب، عمل حر…" : "سوبرماركت، وقود…"}
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="tx-date">التاريخ</Label>
                  <Input
                    id="tx-date"
                    type="date"
                    value={form.occurredAt}
                    onChange={(e) => set("occurredAt", e.target.value)}
                    className="w-[9.5rem]"
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <Label>الفئة</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => set("categoryId", form.categoryId === c.id ? "" : c.id)}
                        aria-pressed={form.categoryId === c.id}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          form.categoryId === c.id
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#94a3b8" }} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="tx-method">طريقة الدفع</Label>
                  <Select id="tx-method" value={form.paymentMethodId} onChange={(e) => set("paymentMethodId", e.target.value)}>
                    <option value="">غير محددة</option>
                    {lookups.paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="tx-project">المشروع</Label>
                  <Select id="tx-project" value={form.projectId} onChange={(e) => set("projectId", e.target.value)}>
                    <option value="">بدون مشروع</option>
                    {lookups.projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="tx-notes">ملاحظات</Label>
                <Input id="tx-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} maxLength={500} />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
              )}
            </DialogBody>

            <DialogFooter className="sm:justify-between">
              {isEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> حذف
                </Button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button type="submit" variant="brand" disabled={isPending} className="min-w-28">
                  {isPending ? "جارٍ الحفظ…" : isEdit ? "حفظ" : "إضافة"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        destructive
        pending={isPending}
        confirmLabel="حذف"
        title="حذف هذه المعاملة؟"
        description="تُحذف من كل التقارير. إن كانت دفعة اشتراك أو قسط، تعود الدفعة غير مدفوعة."
        onConfirm={remove}
      />
    </>
  );
}
