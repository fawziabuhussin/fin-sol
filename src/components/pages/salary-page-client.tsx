"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import type { PayslipParseResult } from "@/lib/payslip-parser";

type Employer = {
  id: string;
  name: string;
  role: string | null;
  color: string | null;
  active: boolean;
  ytdNet: number;
  slipCount: number;
};

type SalaryRow = {
  id: string;
  employerId: string;
  employerName: string;
  periodYear: number;
  periodMonth: number;
  gross: number;
  net: number;
};

export function SalaryPageClient({
  employers,
  recentSlips,
}: {
  employers: Employer[];
  recentSlips: SalaryRow[];
}) {
  const router = useRouter();
  const [selectedEmployer, setSelectedEmployer] = useState<string | null>(
    employers[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    periodYear: 2026,
    periodMonth: new Date().getMonth() + 1,
    gross: 0,
    net: 0,
    tax: 0,
    pension: 0,
    kerenHishtalmut: 0,
  });

  const applyParsed = (parsed: PayslipParseResult) => {
    setForm((f) => ({
      ...f,
      gross: parsed.gross ?? f.gross,
      net: parsed.net ?? f.net,
      tax: parsed.tax ?? f.tax,
      pension: parsed.pension ?? f.pension,
      kerenHishtalmut: parsed.kerenHishtalmut ?? f.kerenHishtalmut,
      periodYear: parsed.periodYear ?? f.periodYear,
      periodMonth: parsed.periodMonth ?? f.periodMonth,
    }));
    toast.success(
      parsed.confidence === "high"
        ? "تم استخراج بيانات التלוש — راجع قبل الحفظ"
        : "تعذّر الاستخراج الكامل — أكمل الحقول يدوياً"
    );
  };

  const onUpload = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await fetch("/api/salary/parse", { method: "POST", body: fd });
      if (!res.ok) {
        toast.error("فشل رفع الملف");
        return;
      }
      applyParsed(await res.json());
    });
  };

  const save = () => {
    if (!selectedEmployer) return;
    startTransition(async () => {
      const res = await fetch("/api/salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employerId: selectedEmployer, ...form }),
      });
      if (!res.ok) {
        toast.error("فشل الحفظ");
        return;
      }
      toast.success("تم حفظ التלוש");
      router.refresh();
    });
  };

  const [editingEmployer, setEditingEmployer] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({ name: "", role: "" });
  const [addingEmployer, setAddingEmployer] = useState(false);
  const [newEmployer, setNewEmployer] = useState({ name: "", role: "" });

  const patchEmployer = (id: string, body: Record<string, unknown>, msg: string) => {
    startTransition(async () => {
      const res = await fetch(`/api/employers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error("فشل التحديث");
        return;
      }
      toast.success(msg);
      setEditingEmployer(null);
      router.refresh();
    });
  };

  const deleteEmployer = (emp: Employer) => {
    if (!confirm(`حذف "${emp.name}"؟`)) return;
    startTransition(async () => {
      const res = await fetch(`/api/employers/${emp.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("فشل الحذف");
        return;
      }
      toast.success("تم الحذف");
      router.refresh();
    });
  };

  const addEmployer = () => {
    if (!newEmployer.name.trim()) {
      toast.error("أدخل اسم جهة العمل");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/employers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEmployer),
      });
      if (!res.ok) {
        toast.error("فشل الإضافة");
        return;
      }
      toast.success("تمت الإضافة");
      setAddingEmployer(false);
      setNewEmployer({ name: "", role: "" });
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {employers.map((emp) => {
          const selected = selectedEmployer === emp.id;
          const isEditing = editingEmployer === emp.id;
          return (
            <div
              key={emp.id}
              className={cn(
                "rounded-2xl border p-4 text-right transition",
                selected
                  ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                  : "border-slate-100 bg-white hover:shadow-md",
                !emp.active && "opacity-70"
              )}
            >
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={empForm.name}
                    placeholder="الاسم"
                    className="text-slate-900"
                    onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  <Input
                    value={empForm.role}
                    placeholder="المسمّى الوظيفي"
                    className="text-slate-900"
                    onChange={(e) => setEmpForm((f) => ({ ...f, role: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => patchEmployer(emp.id, empForm, "تم التحديث")}
                    >
                      <Save className="h-4 w-4" /> حفظ
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingEmployer(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
              <>
              <button
                type="button"
                onClick={() => setSelectedEmployer(emp.id)}
                className="block w-full text-right"
              >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{emp.name}</p>
              {!emp.active && <Badge variant="warning">متوقف</Badge>}
            </div>
            {emp.role && (
              <p className={cn("text-xs", selected ? "text-slate-300" : "text-slate-500")}>
                {emp.role}
              </p>
            )}
            <p className={`mt-1 text-sm ${selectedEmployer === emp.id ? "text-slate-200" : "text-slate-500"}`}>
              {emp.slipCount} تلוש · YTD {formatCurrency(emp.ytdNet)}
            </p>
            </button>
            <Link
              href={`/salary/${emp.id}`}
              className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${
                selectedEmployer === emp.id ? "text-indigo-200" : "text-indigo-600"
              } hover:underline`}
            >
              فتح الصفحة الشهرية <ChevronLeft className="h-3 w-3" />
            </Link>
              <div className="mt-3 flex items-center gap-0.5">
                <button
                  type="button"
                  title={emp.active ? "إيقاف" : "تفعيل"}
                  onClick={() =>
                    patchEmployer(
                      emp.id,
                      { active: !emp.active },
                      emp.active ? "تم الإيقاف" : "تم التفعيل"
                    )
                  }
                  className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    selected ? "hover:bg-white/10" : "hover:bg-slate-100",
                    emp.active ? "text-amber-500" : "text-emerald-500"
                  )}
                >
                  {emp.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  title="تعديل"
                  onClick={() => {
                    setEditingEmployer(emp.id);
                    setEmpForm({ name: emp.name, role: emp.role ?? "" });
                  }}
                  className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    selected ? "text-slate-200 hover:bg-white/10" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="حذف"
                  onClick={() => deleteEmployer(emp)}
                  className={cn(
                    "rounded-lg p-1.5 transition-colors",
                    selected
                      ? "text-rose-300 hover:bg-white/10"
                      : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              </>
              )}
          </div>
          );
        })}

        {addingEmployer ? (
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
            <p className="mb-2 text-sm font-bold text-indigo-900">جهة عمل جديدة</p>
            <div className="space-y-2">
              <Input
                value={newEmployer.name}
                placeholder="الاسم"
                onChange={(e) => setNewEmployer((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                value={newEmployer.role}
                placeholder="المسمّى الوظيفي (اختياري)"
                onChange={(e) => setNewEmployer((f) => ({ ...f, role: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={isPending} onClick={addEmployer}>
                  <Save className="h-4 w-4" /> إضافة
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAddingEmployer(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingEmployer(true)}
            className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white text-slate-500 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:text-indigo-600"
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-semibold">إضافة جهة عمل</span>
          </button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>رفع תלוש שכר</CardTitle>
          </CardHeader>
          <CardContent>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 transition hover:border-indigo-300 hover:bg-indigo-50/50"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) onUpload(file);
              }}
            >
              <Upload className="mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">
                اسحب التلוש هنا أو انقر للرفع
              </p>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إدخال / مراجعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>السنة</Label>
                <Input
                  type="number"
                  value={form.periodYear}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, periodYear: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <Label>الشهر</Label>
                <Input
                  type="number"
                  value={form.periodMonth}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, periodMonth: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            {(["gross", "net", "tax", "pension", "kerenHishtalmut"] as const).map(
              (key) => (
                <div key={key}>
                  <Label>{key}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form[key] || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
                    }
                  />
                </div>
              )
            )}
            <Button className="w-full" disabled={isPending || !selectedEmployer} onClick={save}>
              {isPending ? "جاري الحفظ..." : "حفظ التلוש"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>آخر الرواتب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentSlips.map((s) => (
            <div key={s.id} className="flex justify-between rounded-xl border border-slate-100 p-3">
              <div>
                <p className="font-bold">{s.employerName}</p>
                <p className="text-xs text-slate-500">
                  {s.periodMonth}/{s.periodYear}
                </p>
              </div>
              <p className="font-bold text-emerald-700">{formatCurrency(s.net)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
