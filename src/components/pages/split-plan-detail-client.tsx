"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, cn } from "@/lib/utils";
import { SplitPlanEditSheet } from "@/components/forms/split-plan-edit-sheet";
import type { SplitPlanView } from "@/lib/split-payments";

type SplitPlan = SplitPlanView;
type Installment = SplitPlan["installments"][number];

function PayCheckbox({
  installmentId,
  paid,
  label,
  amount,
}: {
  installmentId: string;
  paid: boolean;
  label: string;
  amount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const res = await fetch(`/api/split-installments/${installmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paid: !paid,
          occurredAt: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) {
        toast.error("تعذّر تحديث الدفعة");
        return;
      }
      toast.success(
        paid
          ? `تم إلغاء ${label}`
          : `تم تسجيل دفع ${label} (${formatCurrency(amount)})`
      );
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={paid ? "إلغاء الدفع" : "تأكيد الدفع"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
        paid
          ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
          : "border-slate-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-300",
        isPending && "opacity-50"
      )}
    >
      <Check className="h-5 w-5" strokeWidth={3} />
    </button>
  );
}

export function SplitPlanDetailClient({
  plan,
  paymentMethods,
}: {
  plan: SplitPlan;
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pending = plan.installments.filter((i) => i.status === "PENDING");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    label: "",
    amount: 0,
    dueDate: "",
    paidAt: "",
    notes: "",
  });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    label: "",
    amount: plan.recurringAmount ?? 0,
    dueDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const startEdit = (inst: Installment) => {
    setEditingId(inst.id);
    setEditForm({
      label: inst.label,
      amount: inst.amount,
      dueDate: inst.dueDate,
      paidAt: inst.paidAt ?? inst.dueDate,
      notes: inst.notes ?? "",
    });
  };

  const saveInstallment = (id: string, isPaid: boolean) => {
    startTransition(async () => {
      const body: Record<string, unknown> = {
        label: editForm.label,
        amount: editForm.amount,
        dueDate: editForm.dueDate,
        notes: editForm.notes,
      };
      if (isPaid && editForm.paidAt) body.occurredAt = editForm.paidAt;
      const res = await fetch(`/api/split-installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("فشل تعديل الدفعة");
        return;
      }
      toast.success("تم تعديل هذه الدفعة فقط");
      setEditingId(null);
      router.refresh();
    });
  };

  const deleteInstallment = (id: string, label: string) => {
    if (!confirm(`حذف «${label}»؟`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/split-installments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("فشل حذف الدفعة");
        return;
      }
      toast.success("تم حذف الدفعة");
      router.refresh();
    });
  };

  const addInstallment = () => {
    startTransition(async () => {
      const res = await fetch(`/api/split-plans/${plan.id}/installments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        toast.error("فشل إضافة الدفعة");
        return;
      }
      toast.success("تمت إضافة الدفعة");
      setAdding(false);
      router.refresh();
    });
  };

  const deletePlan = () => {
    if (!confirm("حذف هذا التقسيط وكل دفعاته؟ سيتم حذف المصروفات المسجّلة أيضاً.")) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/split-plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل الحذف");
        return;
      }
      toast.success("تم حذف التقسيط");
      router.push("/splits");
    });
  };

  return (
    <div className="space-y-4 pb-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/splits"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowRight className="h-4 w-4" />
          كل الأقساط
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CreditCard className="h-4 w-4" />
              مصروف مقسّط
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {plan.title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {plan.paymentMethodName ?? "—"}
              {plan.categoryName ? ` · ${plan.categoryName}` : ""}
              {plan.startDate ? ` · يبدأ ${plan.startDate}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            <SplitPlanEditSheet
              key={`${plan.id}-${plan.totalAmount}-${plan.installmentCount}-${plan.startDate}`}
              plan={plan}
              paymentMethods={paymentMethods}
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              disabled={isPending}
              onClick={deletePlan}
            >
              <Trash2 className="h-4 w-4" /> حذف
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "الإجمالي", value: plan.totalAmount, color: "text-slate-900" },
            { label: "المدفوع", value: plan.paid, color: "text-emerald-700" },
            { label: "المتبقي", value: plan.remaining, color: "text-amber-700" },
            {
              label: "الدفعات",
              value: `${plan.paidCount}/${plan.installments.length}`,
              color: "text-indigo-700",
              isText: true,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className={`text-lg font-extrabold ${kpi.color}`}>
                {"isText" in kpi && kpi.isText
                  ? (kpi.value as string)
                  : formatCurrency(kpi.value as number)}
              </p>
            </div>
          ))}
        </div>
        <Progress value={plan.percentComplete} className="mt-4 h-2" />
      </motion.div>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-5 w-5" />
            جدول الدفعات ({plan.installments.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            {pending.length > 0 && (
              <p className="text-sm text-amber-700">
                {pending.length} معلّقة ·{" "}
                {formatCurrency(pending.reduce((s, i) => s + i.amount, 0))}
              </p>
            )}
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              <Plus className="h-4 w-4" /> دفعة
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-slate-500">
            قلم التعديل يغيّر هذه الدفعة فقط. «تعديل كل الدفعات» يحدّث الأقساط
            المعلّقة معاً.
          </p>
          {adding && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="mb-2 text-sm font-semibold text-indigo-900">دفعة جديدة</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">الوصف</Label>
                  <Input
                    value={addForm.label}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, label: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">المبلغ</Label>
                  <Input
                    type="number"
                    value={addForm.amount || ""}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, amount: Number(e.target.value) }))
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">الاستحقاق</Label>
                  <Input
                    type="date"
                    value={addForm.dueDate}
                    onChange={(e) =>
                      setAddForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button size="sm" onClick={addInstallment} disabled={isPending}>
                    حفظ
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                    إلغاء
                  </Button>
                </div>
              </div>
            </div>
          )}

          {plan.installments.map((inst) => {
            const paid = inst.status === "PAID";
            const editing = editingId === inst.id;
            return (
              <div
                key={inst.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center",
                  paid
                    ? "border-emerald-100 bg-emerald-50/40"
                    : "border-slate-100 bg-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <PayCheckbox
                    installmentId={inst.id}
                    paid={paid}
                    label={inst.label}
                    amount={inst.amount}
                  />
                  {editing ? (
                    <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                      <Input
                        value={editForm.label}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, label: e.target.value }))
                        }
                      />
                      <Input
                        type="number"
                        value={editForm.amount || ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            amount: Number(e.target.value),
                          }))
                        }
                      />
                      <Input
                        type="date"
                        value={editForm.dueDate}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, dueDate: e.target.value }))
                        }
                      />
                      {paid && (
                        <Input
                          type="date"
                          value={editForm.paidAt}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, paidAt: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-900">{inst.label}</p>
                      <p className="text-xs text-slate-500">
                        {inst.dueDate}
                        {paid && inst.paidAt ? ` · دُفع ${inst.paidAt}` : ""}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 sm:ms-auto">
                  {editing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => saveInstallment(inst.id, paid)}
                        disabled={isPending}
                      >
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-extrabold text-slate-900">
                        {formatCurrency(inst.amount)}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(inst)}
                        aria-label="تعديل هذه الدفعة"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-rose-600"
                        onClick={() => deleteInstallment(inst.id, inst.label)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
