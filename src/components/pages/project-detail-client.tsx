"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  FolderKanban,
  Hammer,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BuildingPaymentSheet } from "@/components/forms/building-payment-sheet";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Installment = {
  id: string;
  sequence: number;
  label: string;
  dueDate: string;
  amount: number;
  status: string;
  notes: string | null;
  payeeName: string | null;
  paymentMethod: string | null;
  paidAt: string | null;
};

type ProjectDetail = {
  id: string;
  kind: string;
  title: string;
  profession: string | null;
  description: string | null;
  status: string;
  targetDate: string | null;
  totalBudget: number;
  paid: number;
  remaining: number;
  percentComplete: number;
  parent: { id: string; title: string } | null;
  installments: Installment[];
  transactions: {
    id: string;
    amount: number;
    occurredAt: string;
    description: string | null;
    notes: string | null;
    paymentMethod: string | null;
    installmentId: string | null;
  }[];
  paymentPlans: {
    id: string;
    mode: string;
    totalAmount: number;
    installmentCount: number | null;
    firstPaymentAmount: number | null;
    recurringAmount: number | null;
    payeeName: string | null;
    startDate: string | null;
    paymentMethod: string | null;
    paymentMethodId: string | null;
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطط للمستقبل",
  ACTIVE: "قيد التنفيذ",
  ON_HOLD: "متوقف",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

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
      const res = await fetch(`/api/installments/${installmentId}`, {
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
        paid ? `تم إلغاء ${label}` : `تم تسجيل دفع ${label} (${formatCurrency(amount)})`
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

export function ProjectDetailClient({
  detail,
  paymentMethods,
}: {
  detail: ProjectDetail;
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isContractor = detail.kind === "BUILD_CONTRACTOR";
  const pending = detail.installments.filter((i) => i.status === "PENDING");
  const paidCount = detail.installments.filter((i) => i.status === "PAID").length;
  const plan = detail.paymentPlans[0] ?? null;
  const KindIcon = isContractor ? Hammer : FolderKanban;
  const [showHistory, setShowHistory] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    label: "",
    amount: 0,
    dueDate: "",
    paidAt: "",
    notes: "",
  });
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [txEditForm, setTxEditForm] = useState({
    amount: 0,
    occurredAt: "",
    notes: "",
  });
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    label: "",
    amount: plan?.recurringAmount ?? 0,
    dueDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const startEditInstallment = (inst: Installment) => {
    setEditingTxId(null);
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
      if (isPaid && editForm.paidAt) {
        body.occurredAt = editForm.paidAt;
      }
      const res = await fetch(`/api/installments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("فشل تعديل الدفعة");
        return;
      }
      toast.success("تم تعديل الدفعة");
      setEditingId(null);
      router.refresh();
    });
  };

  const deleteInstallment = (id: string, label: string) => {
    if (
      !confirm(
        `حذف «${label}»؟ سيتم حذف الدفعة من الجدول وإزالة المدفوع المرتبط بها من السجل.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/installments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل حذف الدفعة");
        return;
      }
      toast.success("تم حذف الدفعة");
      router.refresh();
    });
  };

  const startEditTransaction = (tx: ProjectDetail["transactions"][0]) => {
    setEditingId(null);
    setEditingTxId(tx.id);
    setTxEditForm({
      amount: tx.amount,
      occurredAt: tx.occurredAt,
      notes: tx.notes ?? "",
    });
  };

  const saveTransaction = (tx: ProjectDetail["transactions"][0]) => {
    startTransition(async () => {
      const url = tx.installmentId
        ? `/api/installments/${tx.installmentId}`
        : `/api/transactions/${tx.id}`;
      const body = tx.installmentId
        ? {
            amount: txEditForm.amount,
            occurredAt: txEditForm.occurredAt,
            dueDate: txEditForm.occurredAt,
            notes: txEditForm.notes,
          }
        : {
            type: "EXPENSE",
            amount: txEditForm.amount,
            occurredAt: txEditForm.occurredAt,
            description: tx.description ?? "دفعة",
            notes: txEditForm.notes,
            projectId: detail.id,
          };
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("فشل تعديل المدفوع");
        return;
      }
      toast.success("تم تعديل المدفوع");
      setEditingTxId(null);
      router.refresh();
    });
  };

  const deleteTransaction = (tx: ProjectDetail["transactions"][0]) => {
    const msg = tx.installmentId
      ? "حذف هذا المدفوع من السجل؟ ستُعاد الدفعة في الجدول إلى «معلّقة»."
      : "حذف هذا المدفوع من السجل؟";
    if (!confirm(msg)) return;
    startTransition(async () => {
      const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل الحذف");
        return;
      }
      toast.success("تم الحذف");
      router.refresh();
    });
  };

  const addInstallment = () => {
    if (!plan) return;
    startTransition(async () => {
      const res = await fetch(`/api/payment-plans/${plan.id}/installments`, {
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
      setAddForm({
        label: "",
        amount: plan?.recurringAmount ?? 0,
        dueDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      router.refresh();
    });
  };

  const deletePlan = () => {
    if (!plan) return;
    if (!confirm("حذف خطة الدفع وكل دفعاتها؟ سيتم أيضاً حذف المدفوعات المسجّلة.")) {
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/payment-plans/${plan.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل حذف الخطة");
        return;
      }
      toast.success("تم حذف الخطة");
      router.refresh();
    });
  };

  const patchProject = (body: Record<string, unknown>, msg: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/projects/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("فشل التحديث");
        return;
      }
      toast.success(msg);
      router.refresh();
    });
  };

  const isPlanned = detail.status === "PLANNED";

  return (
    <div className="space-y-4 pb-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        {detail.parent ? (
          <Link
            href={`/projects/${detail.parent.id}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowRight className="h-4 w-4" />
            {detail.parent.title}
          </Link>
        ) : (
          <Link
            href="/projects"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowRight className="h-4 w-4" />
            كل المشاريع
          </Link>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <KindIcon className="h-4 w-4" />
              {isContractor ? "مقاول / مورد" : "مشروع"}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {detail.title}
            </h1>
            {detail.profession && (
              <p className="mt-1 text-sm text-slate-600">{detail.profession}</p>
            )}
            <Badge
              className="mt-2"
              variant={isPlanned ? "warning" : detail.status === "ACTIVE" ? "success" : "default"}
            >
              {STATUS_LABELS[detail.status] ?? detail.status}
            </Badge>
            {isPlanned && (
              <p className="mt-2 text-sm text-indigo-700">
                مخطط للمستقبل
                {detail.targetDate ? ` — يبدأ ${detail.targetDate}` : " — حدّد تاريخ البداية أدناه"}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="grid grid-cols-2 gap-2 sm:w-64">
              <div>
                <Label className="text-xs">الحالة</Label>
                <Select
                  value={detail.status}
                  disabled={isPending}
                  onChange={(e) =>
                    patchProject(
                      { status: e.target.value },
                      e.target.value === "PLANNED"
                        ? "تم نقله للمستقبل"
                        : "تم تحديث الحالة"
                    )
                  }
                >
                  <option value="PLANNED">مخطط للمستقبل</option>
                  <option value="ACTIVE">قيد التنفيذ</option>
                  <option value="ON_HOLD">متوقف</option>
                  <option value="COMPLETED">مكتمل</option>
                  <option value="CANCELLED">ملغى</option>
                </Select>
              </div>
              <div>
                <Label className="text-xs">تاريخ البداية المخطط</Label>
                <Input
                  type="date"
                  defaultValue={detail.targetDate ?? ""}
                  disabled={isPending}
                  onBlur={(e) => {
                    if (e.target.value !== (detail.targetDate ?? "")) {
                      patchProject({ targetDate: e.target.value || null }, "تم حفظ التاريخ");
                    }
                  }}
                />
              </div>
            </div>
            <BuildingPaymentSheet
              projectId={detail.id}
              projectTitle={detail.title}
              paymentMethods={paymentMethods}
              defaultTotal={detail.remaining > 0 ? detail.remaining : detail.totalBudget}
              defaultPayee={plan?.payeeName ?? detail.title}
              existingPlan={plan}
              triggerLabel={plan ? "تعديل خطة الدفع" : "إنشاء خطة دفع"}
            />
          </div>
        </div>

        {detail.description && (
          <p className="mt-4 whitespace-pre-line text-sm text-slate-600">
            {detail.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "الإجمالي", value: detail.totalBudget, color: "text-slate-900" },
            { label: "المدفوع", value: detail.paid, color: "text-emerald-700" },
            { label: "المتبقي", value: detail.remaining, color: "text-amber-700" },
            {
              label: "الدفعات",
              value: `${paidCount}/${detail.installments.length || "—"}`,
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
        <Progress value={detail.percentComplete} className="mt-4 h-2" />
      </motion.div>

      {/* Plan summary: who, way of payment, start point */}
      {plan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wallet className="h-5 w-5" />
              تفاصيل خطة الدفع
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              disabled={isPending}
              onClick={deletePlan}
            >
              <Trash2 className="h-4 w-4" /> حذف الخطة
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">المستفيد:</span>
              <span className="font-semibold text-slate-900">
                {plan.payeeName ?? detail.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">طريقة الدفع:</span>
              <span className="font-semibold text-slate-900">
                {plan.paymentMethod ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">نقطة البداية:</span>
              <span className="font-semibold text-slate-900">
                {plan.startDate ?? "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">النوع: </span>
              {plan.mode === "INSTALLMENTS" ? "أقساط" : "دفعة واحدة"}
            </div>
            {plan.firstPaymentAmount != null && (
              <div>
                <span className="text-slate-500">الدفعة الأولى: </span>
                {formatCurrency(plan.firstPaymentAmount)}
              </div>
            )}
            {plan.recurringAmount != null && (
              <div>
                <span className="text-slate-500">القسط الشهري: </span>
                {formatCurrency(plan.recurringAmount)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Monthly payment schedule with V checkmarks + CRUD */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-5 w-5" />
            جدول الدفعات الشهرية ({detail.installments.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            {pending.length > 0 && (
              <p className="text-sm text-amber-700">
                {pending.length} معلّقة · {formatCurrency(pending.reduce((s, i) => s + i.amount, 0))}
              </p>
            )}
            {plan && (
              <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
                <Plus className="h-4 w-4" /> دفعة
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {adding && plan && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="mb-2 text-sm font-semibold text-indigo-900">دفعة جديدة</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">الوصف</Label>
                  <Input
                    value={addForm.label}
                    placeholder="الدفعة"
                    onChange={(e) => setAddForm((f) => ({ ...f, label: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">المبلغ</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addForm.amount || ""}
                    onChange={(e) => setAddForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">تاريخ الاستحقاق</Label>
                  <Input
                    type="date"
                    value={addForm.dueDate}
                    onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">ملاحظات</Label>
                  <Input
                    value={addForm.notes}
                    onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" disabled={isPending} onClick={addInstallment}>
                  <Save className="h-4 w-4" /> إضافة
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {detail.installments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">
                لا توجد خطة دفع بعد — اضغط «إنشاء خطة دفع» لإضافة الدفعة الأولى
                والأقساط الشهرية.
              </p>
            </div>
          ) : (
            detail.installments.map((inst) => {
              const isPaid = inst.status === "PAID";
              const isEditing = editingId === inst.id;
              return (
                <div
                  key={inst.id}
                  className={cn(
                    "rounded-xl border p-3",
                    isPaid
                      ? "border-emerald-100 bg-emerald-50/40"
                      : "border-slate-100 bg-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <PayCheckbox
                      installmentId={inst.id}
                      paid={isPaid}
                      label={inst.label}
                      amount={inst.amount}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{inst.label}</p>
                        <Badge variant={isPaid ? "success" : "warning"}>
                          {isPaid ? "مدفوع" : "معلّق"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {isPaid && inst.paidAt
                          ? `دُفع في ${inst.paidAt}`
                          : `مستحق ${inst.dueDate}`}
                        {inst.paymentMethod && ` · ${inst.paymentMethod}`}
                      </p>
                      {inst.notes && (
                        <p className="mt-0.5 text-xs text-slate-600">{inst.notes}</p>
                      )}
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-extrabold",
                        isPaid ? "text-emerald-700" : "text-slate-900"
                      )}
                    >
                      {formatCurrency(inst.amount)}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingId(null) : startEditInstallment(inst))}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="تعديل"
                      >
                        {isEditing ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteInstallment(inst.id, inst.label)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <Label className="text-xs">الوصف</Label>
                          <Input
                            value={editForm.label}
                            onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">المبلغ</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.amount || ""}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">
                            {isPaid ? "تاريخ الدفع" : "تاريخ الاستحقاق"}
                          </Label>
                          <Input
                            type="date"
                            value={isPaid ? editForm.paidAt : editForm.dueDate}
                            onChange={(e) =>
                              setEditForm((f) =>
                                isPaid
                                  ? { ...f, paidAt: e.target.value }
                                  : { ...f, dueDate: e.target.value }
                              )
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">ملاحظات</Label>
                          <Input
                            value={editForm.notes}
                            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                          />
                        </div>
                      </div>
                      {isPaid && (
                        <p className="mt-2 text-xs text-emerald-700">
                          تعديل المبلغ أو التاريخ يحدّث السجل المرتبط في «سجل المدفوعات».
                        </p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveInstallment(inst.id, isPaid)}
                        >
                          <Save className="h-4 w-4" /> حفظ
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base sm:text-lg">
            سجل المدفوعات ({detail.transactions.length})
          </CardTitle>
          {detail.transactions.length > 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHistory((v) => !v)}
            >
              {showHistory ? "إخفاء" : "عرض الكل"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {detail.transactions.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد مدفوعات مسجّلة</p>
          ) : (
            (showHistory
              ? detail.transactions
              : detail.transactions.slice(0, 5)
            ).map((tx) => {
              const isEditingTx = editingTxId === tx.id;
              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-slate-100 p-3"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-slate-900">
                          {tx.description || "دفعة"}
                        </p>
                        {tx.installmentId && (
                          <Badge variant="default" className="text-[10px]">
                            مرتبط بجدول الدفعات
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {tx.occurredAt}
                        {tx.paymentMethod && ` · ${tx.paymentMethod}`}
                      </p>
                      {tx.notes && (
                        <p className="text-xs text-slate-600">{tx.notes}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <p className="font-bold text-emerald-700">
                        {formatCurrency(tx.amount)}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          isEditingTx ? setEditingTxId(null) : startEditTransaction(tx)
                        }
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="تعديل"
                      >
                        {isEditingTx ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTransaction(tx)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {isEditingTx && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">المبلغ</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={txEditForm.amount || ""}
                            onChange={(e) =>
                              setTxEditForm((f) => ({
                                ...f,
                                amount: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">تاريخ الدفع</Label>
                          <Input
                            type="date"
                            value={txEditForm.occurredAt}
                            onChange={(e) =>
                              setTxEditForm((f) => ({
                                ...f,
                                occurredAt: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-xs">ملاحظات</Label>
                          <Input
                            value={txEditForm.notes}
                            onChange={(e) =>
                              setTxEditForm((f) => ({ ...f, notes: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => saveTransaction(tx)}
                        >
                          <Save className="h-4 w-4" /> حفظ
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
