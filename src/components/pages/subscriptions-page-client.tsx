"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import { monthLabel } from "@/lib/finance-labels";

type SubscriptionItem = {
  id: string;
  title: string;
  amount: number;
  billingDay: number | null;
  categoryName: string;
  paymentMethodName: string | null;
  notes: string | null;
  paid: boolean;
  paidAt: string | null;
};

type SubscriptionsData = {
  year: number;
  month: number;
  monthLabel: string;
  items: SubscriptionItem[];
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
  paidCount: number;
  totalCount: number;
};

function PaidCheckbox({
  subscriptionId,
  item,
  year,
  month,
}: {
  subscriptionId: string;
  item: SubscriptionItem;
  year: number;
  month: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(async () => {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/payments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodYear: year,
          periodMonth: month,
          amount: item.amount,
          paid: !item.paid,
        }),
      });
      if (!res.ok) {
        toast.error("تعذّر التحديث");
        return;
      }
      toast.success(
        item.paid
          ? `تم إلغاء دفع ${item.title}`
          : `تم تسجيل ${item.title} — ${formatCurrency(item.amount)}`
      );
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={item.paid ? "إلغاء" : "تأكيد الدفع"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
        item.paid
          ? "border-violet-600 bg-violet-600 text-white"
          : "border-slate-300 bg-white text-transparent hover:border-violet-400 hover:text-violet-300",
        isPending && "opacity-50"
      )}
    >
      <Check className="h-5 w-5" strokeWidth={3} />
    </button>
  );
}

export function SubscriptionsPageClient({
  data,
  paymentMethods,
}: {
  data: SubscriptionsData;
  paymentMethods: { id: string; name: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    title: "",
    amount: 0,
    billingDay: 1,
    paymentMethodId: "",
    notes: "",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    amount: 0,
    billingDay: 1,
    paymentMethodId: "",
    notes: "",
  });

  const navigateMonth = (delta: number) => {
    let y = data.year;
    let m = data.month + delta;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(y));
    params.set("month", String(m));
    router.push(`/subscriptions?${params.toString()}`);
  };

  const seedDefaults = () => {
    startTransition(async () => {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed-defaults" }),
      });
      if (!res.ok) {
        toast.error("تعذّر الاستيراد");
        return;
      }
      toast.success("تم استيراد الاشتراكات الافتراضية");
      router.refresh();
    });
  };

  const addSubscription = () => {
    if (!addForm.title || addForm.amount <= 0) {
      toast.error("أدخل الاسم والمبلغ");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addForm.title,
          amount: addForm.amount,
          billingDay: addForm.billingDay,
          paymentMethodId: addForm.paymentMethodId || undefined,
          notes: addForm.notes || undefined,
        }),
      });
      if (!res.ok) {
        toast.error("فشل الإضافة");
        return;
      }
      toast.success("تمت إضافة الاشتراك");
      setShowAdd(false);
      setAddForm({ title: "", amount: 0, billingDay: 1, paymentMethodId: "", notes: "" });
      router.refresh();
    });
  };

  const startEdit = (item: SubscriptionItem) => {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      amount: item.amount,
      billingDay: item.billingDay ?? 1,
      paymentMethodId:
        paymentMethods.find((m) => m.name === item.paymentMethodName)?.id ?? "",
      notes: item.notes ?? "",
    });
  };

  const saveEdit = (id: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/subscriptions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        toast.error("فشل الحفظ");
        return;
      }
      toast.success("تم التحديث");
      setEditingId(null);
      router.refresh();
    });
  };

  const deleteSub = (id: string, title: string) => {
    if (!confirm(`حذف «${title}»؟`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل الحذف");
        return;
      }
      toast.success("تم الحذف");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Month nav + summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="min-w-[120px] text-center font-bold">
                {monthLabel(data.month)} {data.year}
              </span>
              <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
                <Plus className="h-4 w-4" /> إضافة
              </Button>
              {data.totalCount === 0 && (
                <Button size="sm" variant="outline" onClick={seedDefaults} disabled={isPending}>
                  <RefreshCw className="h-4 w-4" /> استيراد القائمة
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "المطلوب", value: formatCurrency(data.totalDue) },
              { label: "المدفوع", value: formatCurrency(data.totalPaid) },
              { label: "المتبقي", value: formatCurrency(data.totalRemaining) },
              {
                label: "الحالة",
                value: `${data.paidCount}/${data.totalCount}`,
                isText: true,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{kpi.label}</p>
                <p className="text-lg font-extrabold text-slate-900">
                  {"isText" in kpi ? kpi.value : kpi.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">اشتراك جديد</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>الخدمة</Label>
              <Input
                value={addForm.title}
                onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>المبلغ (₪)</Label>
              <Input
                type="number"
                step="0.01"
                value={addForm.amount || ""}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, amount: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <Label>يوم الفوترة</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={addForm.billingDay}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, billingDay: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <Label>طريقة الدفع</Label>
              <Select
                value={addForm.paymentMethodId}
                onChange={(e) =>
                  setAddForm((f) => ({ ...f, paymentMethodId: e.target.value }))
                }
              >
                <option value="">—</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>ملاحظات</Label>
              <Input
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={addSubscription} disabled={isPending}>
                حفظ
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            اشتراكات {data.monthLabel} {data.year}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              لا توجد اشتراكات. أضف اشتراكاً أو استورد القائمة الافتراضية.
            </p>
          ) : (
            data.items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "rounded-xl border p-3",
                  item.paid
                    ? "border-violet-100 bg-violet-50/40"
                    : "border-slate-100 bg-white"
                )}
              >
                {editingId === item.id ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, title: e.target.value }))
                      }
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, amount: Number(e.target.value) }))
                      }
                    />
                    <div className="flex gap-2 sm:col-span-2">
                      <Button size="sm" onClick={() => saveEdit(item.id)}>
                        <Save className="h-4 w-4" /> حفظ
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <PaidCheckbox
                      subscriptionId={item.id}
                      item={item}
                      year={data.year}
                      month={data.month}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900">{item.title}</p>
                        <Badge variant="default">{item.categoryName}</Badge>
                        {item.paid && <Badge variant="success">مدفوع</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.billingDay ? `يوم ${item.billingDay}` : "بدون تاريخ ثابت"}
                        {item.paidAt && ` · دُفع ${item.paidAt}`}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 font-extrabold",
                        item.paid ? "text-violet-700" : "text-slate-900"
                      )}
                    >
                      {formatCurrency(item.amount)}
                    </p>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-600"
                        onClick={() => deleteSub(item.id, item.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
