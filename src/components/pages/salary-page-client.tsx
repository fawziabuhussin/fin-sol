"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  Briefcase,
  ChevronLeft,
  FileText,
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  SlipReviewDialog,
  parsePayslipFile,
  type ParseResponse,
  type SlipValues,
} from "@/components/salary/slip-review-dialog";
import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import { cn, formatCurrency, formatCurrencyPrecise } from "@/lib/utils";
import { monthLabel } from "@/lib/finance-labels";

type EmployerCard = {
  id: string;
  name: string;
  role: string | null;
  color: string | null;
  active: boolean;
  ytdNet: number;
  months: number[];
  slipCount: number;
  last: { year: number; month: number; net: number; paid: boolean } | null;
};

type RecentSlip = {
  id: string;
  employerId: string;
  employerName: string;
  year: number;
  month: number;
  net: number;
  gross: number;
  worked: boolean;
  paid: boolean;
  fromPayslip: boolean;
  values: SlipValues;
  breakdown: SalarySlipBreakdown | null;
};

type Summary = {
  year: number;
  net: number;
  gross: number;
  tax: number;
  pension: number;
  monthsWithPay: number;
  thisMonth: { employerId: string; net: number; paid: boolean }[];
};

const PALETTE = ["#4F46E5", "#059669", "#0891B2", "#D97706", "#DB2777", "#7C3AED"];
const colorFor = (e: { color: string | null }, i: number) => e.color || PALETTE[i % PALETTE.length]!;

function EmployerAvatar({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold", className)}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

function MonthBars({ months, color, currentMonth }: { months: number[]; color: string; currentMonth: number }) {
  const max = Math.max(1, ...months);
  return (
    <div className="flex h-10 items-end gap-[3px]" aria-hidden>
      {months.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: v > 0 ? `${Math.max(12, (v / max) * 100)}%` : "6%",
            backgroundColor: v > 0 ? color : "#e2e8f0",
            opacity: v > 0 ? (i + 1 === currentMonth ? 1 : 0.55) : 1,
          }}
        />
      ))}
    </div>
  );
}

export function SalaryPageClient({
  currentPeriod,
  employers,
  summary,
  recent,
  existing,
}: {
  currentPeriod: { year: number; month: number };
  employers: EmployerCard[];
  summary: Summary;
  recent: RecentSlip[];
  existing: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [review, setReview] = useState<{
    key: number;
    parsed: ParseResponse | null;
    employerId?: string;
    year?: number;
    month?: number;
    slip?: RecentSlip;
  } | null>(null);
  const [employerForm, setEmployerForm] = useState<{ key: number; employer: EmployerCard | null } | null>(null);
  const [deleting, setDeleting] = useState<EmployerCard | null>(null);
  const [deleteText, setDeleteText] = useState("");

  const employerOptions = employers.map((e) => ({ id: e.id, name: e.name, active: e.active }));
  const activeCount = employers.filter((e) => e.active).length;
  const avgMonthly = summary.monthsWithPay > 0 ? summary.net / summary.monthsWithPay : 0;
  const thisMonthNet = summary.thisMonth.reduce((s, x) => s + x.net, 0);

  const openReview = (
    parsed: ParseResponse | null,
    extra: { employerId?: string; year?: number; month?: number; slip?: RecentSlip } = {}
  ) =>
    setReview({ key: ++seq.current, parsed, ...extra });

  const handleFile = async (file: File) => {
    setParsing(true);
    const { data, error } = await parsePayslipFile(file);
    setParsing(false);
    if (error || !data) {
      toast.error(error ?? "تعذّرت قراءة القسيمة", {
        action: { label: "إدخال يدوي", onClick: () => openReview(null) },
      });
      return;
    }
    openReview(data);
  };

  const patchEmployer = (id: string, body: object, msg: string) =>
    startTransition(async () => {
      const res = await fetch(`/api/employers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return void toast.error("تعذّر التحديث");
      toast.success(msg);
      setEmployerForm(null);
      router.refresh();
    });

  const deleteEmployer = () =>
    startTransition(async () => {
      if (!deleting) return;
      const res = await fetch(`/api/employers/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) return void toast.error("تعذّر الحذف");
      toast.success(`حُذفت «${deleting.name}»`);
      setDeleting(null);
      setDeleteText("");
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="الراتب"
        description="ارفع قسيمة الراتب (תלוש) فنقرأ الأرقام ونقترحها عليك — بعد المراجعة يُضاف الصافي إلى دخل الشهر تلقائياً."
        actions={
          <>
            <Button variant="outline" onClick={() => openReview(null)}>
              <Pencil className="h-4 w-4" /> إدخال يدوي
            </Button>
            <Button variant="brand" onClick={() => fileInput.current?.click()} disabled={parsing}>
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              رفع قسيمة
            </Button>
          </>
        }
      />
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Year summary */}
        <div className="relative overflow-hidden rounded-3xl bg-[#0B1220] p-5 text-white shadow-float sm:p-7 lg:col-span-3">
          <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 right-10 h-64 w-64 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="relative">
            <p className="text-sm text-white/60">صافي الرواتب في {summary.year}</p>
            <p className="num mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{formatCurrency(summary.net)}</p>
            <p className="mt-2 text-xs text-white/60">
              {summary.thisMonth.length > 0 ? (
                <>
                  {monthLabel(currentPeriod.month)}: <span className="num font-semibold text-white">{formatCurrency(thisMonthNet)}</span> من{" "}
                  <span className="num">{summary.thisMonth.length}</span> {summary.thisMonth.length === 1 ? "جهة" : "جهات"}
                  {activeCount > summary.thisMonth.length && (
                    <span className="text-amber-300"> · بانتظار {activeCount - summary.thisMonth.length}</span>
                  )}
                </>
              ) : activeCount > 0 ? (
                <span className="text-amber-300">لم يُسجّل راتب {monthLabel(currentPeriod.month)} بعد</span>
              ) : (
                "أضف جهة عمل لتبدأ"
              )}
            </p>
          </div>
          <dl className="relative mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] py-3 ring-1 ring-inset ring-white/10">
            {[
              { label: "متوسط شهري", value: formatCurrency(avgMonthly) },
              { label: "ضرائب دُفعت", value: formatCurrency(summary.tax) },
              { label: "تقاعد واستكمال", value: formatCurrency(summary.pension) },
            ].map((s) => (
              <div key={s.label} className="px-2 text-center">
                <dt className="text-[11px] text-white/55">{s.label}</dt>
                <dd className="num mt-0.5 text-sm font-semibold sm:text-base">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-4 rounded-3xl border-2 border-dashed p-4 text-start transition-colors sm:flex-col sm:justify-center sm:p-6 sm:text-center lg:col-span-2",
            dragOver ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40"
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 sm:h-14 sm:w-14">
            {parsing ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileText className="h-7 w-7" />}
          </span>
          <span className="min-w-0">
          <p className="text-base font-bold text-slate-900 sm:mt-4">{parsing ? "نقرأ القسيمة…" : "ارفع قسيمة الراتب"}</p>
          <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
            اسحب ملف PDF هنا أو اضغط للاختيار. نقرأ الإجمالي والصافي والضرائب والتقاعد والشهر — وأنت تراجع قبل الحفظ.
          </p>
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={parsing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Employers */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">جهات العمل</h2>
          <Button variant="ghost" size="sm" onClick={() => setEmployerForm({ key: ++seq.current, employer: null })}>
            <Plus className="h-4 w-4" /> جهة عمل
          </Button>
        </div>
        {employers.length === 0 ? (
          <Card className="px-6 py-12 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">لا جهات عمل بعد</p>
            <p className="mt-1 text-xs text-slate-500">ارفع أول قسيمة وسننشئ جهة العمل منها، أو أضفها يدوياً.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {employers.map((emp, i) => {
              const color = colorFor(emp, i);
              return (
                <Card key={emp.id} className={cn("flex flex-col p-4", !emp.active && "opacity-75")}>
                  <div className="flex items-start gap-3">
                    <EmployerAvatar name={emp.name} color={color} />
                    <Link href={`/salary/${emp.id}`} className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate font-semibold text-slate-900" dir="auto">
                        {emp.name}
                        {!emp.active && <Badge variant="outline">متوقفة</Badge>}
                      </p>
                      <p className="truncate text-xs text-slate-500">{emp.role || `${emp.slipCount} قسائم`}</p>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="text-slate-400" aria-label={`خيارات ${emp.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onSelect={() => openReview(null, { employerId: emp.id })}>
                          <Plus /> راتب جديد
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setEmployerForm({ key: ++seq.current, employer: emp })}>
                          <Pencil /> تعديل الاسم
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            patchEmployer(emp.id, { active: !emp.active }, emp.active ? "أُوقفت جهة العمل" : "فُعّلت جهة العمل")
                          }
                        >
                          {emp.active ? <Pause /> : <Play />} {emp.active ? "إيقاف (انتهى العمل)" : "إعادة تفعيل"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-rose-600 [&_svg]:text-rose-500" onSelect={() => setDeleting(emp)}>
                          <Trash2 /> حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Link href={`/salary/${emp.id}`} className="mt-4 block">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] text-slate-500">صافي {summary.year}</p>
                        <p className="num text-lg font-bold text-slate-900">{formatCurrency(emp.ytdNet)}</p>
                      </div>
                      <div className="w-28">
                        <MonthBars months={emp.months} color={color} currentMonth={currentPeriod.month} />
                      </div>
                    </div>
                    <p className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                      {emp.last ? (
                        <span>
                          آخر راتب: {monthLabel(emp.last.month)} · <span className="num font-semibold text-slate-700">{formatCurrency(emp.last.net)}</span>
                        </span>
                      ) : (
                        <span>لا رواتب بعد</span>
                      )}
                      <span className="flex items-center gap-0.5 font-semibold text-indigo-600">
                        الأشهر <ChevronLeft className="h-3.5 w-3.5" />
                      </span>
                    </p>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent payslips */}
      {recent.length > 0 && (
        <Card className="p-2 sm:p-3">
          <h2 className="px-3 pb-1 pt-3 text-sm font-semibold text-slate-900">آخر الرواتب</h2>
          <ul className="divide-y divide-slate-100/80">
            {recent.map((s) => {
              const i = employers.findIndex((e) => e.id === s.employerId);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openReview(null, { employerId: s.employerId, year: s.year, month: s.month, slip: s })}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-start hover:bg-slate-50 sm:px-3"
                  >
                    <EmployerAvatar name={s.employerName} color={colorFor(employers[i] ?? { color: null }, Math.max(0, i))} className="h-9 w-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900" dir="auto">{s.employerName}</span>
                      <span className="flex items-center gap-1.5 text-xs text-slate-500">
                        {monthLabel(s.month)} {s.year}
                        {s.fromPayslip && (
                          <span className="inline-flex items-center gap-0.5 text-indigo-600"><FileText className="h-3 w-3" /> قسيمة</span>
                        )}
                      </span>
                    </span>
                    <span className="text-left">
                      <span className="num block text-sm font-bold text-emerald-600">{s.worked ? formatCurrencyPrecise(s.net) : "—"}</span>
                      <span className={cn("block text-[11px]", !s.worked ? "text-slate-400" : s.paid ? "text-slate-400" : "text-amber-600")}>
                        {!s.worked ? "لم يعمل" : s.paid ? "مقبوض" : "بانتظار القبض"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {review && (
        <SlipReviewDialog
          key={review.key}
          open
          onOpenChange={(o) => !o && setReview(null)}
          employers={employerOptions}
          existing={existing}
          parsed={review.parsed}
          currentPeriod={currentPeriod}
          initial={{
            employerId: review.employerId ?? null,
            year: review.year ?? currentPeriod.year,
            month: review.month ?? currentPeriod.month,
            values: review.slip?.values,
            breakdown: review.slip?.breakdown,
            paid: review.slip?.paid,
          }}
        />
      )}

      {employerForm && (
        <EmployerDialog
          key={employerForm.key}
          employer={employerForm.employer}
          pending={isPending}
          onClose={() => setEmployerForm(null)}
          onSave={(name, role) => {
            if (employerForm.employer) return patchEmployer(employerForm.employer.id, { name, role }, "تم حفظ التعديلات");
            startTransition(async () => {
              const res = await fetch("/api/employers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, role }),
              });
              if (!res.ok) return void toast.error("تعذّرت الإضافة — ربما الاسم مستخدم");
              toast.success(`أُضيفت «${name}»`);
              setEmployerForm(null);
              router.refresh();
            });
          }}
        />
      )}

      <Dialog open={deleting != null} onOpenChange={(o) => !o && (setDeleting(null), setDeleteText(""))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>حذف «{deleting?.name}»؟</DialogTitle>
            <DialogDescription>
              تُحذف كل قسائم هذه الجهة والدخل المرتبط بها من المعاملات والتقارير. إن انتهى العمل فقط، استخدم «إيقاف» بدلاً من ذلك.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Label htmlFor="del-employer">اكتب الاسم للتأكيد</Label>
            <Input id="del-employer" value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder={deleting?.name} />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>إلغاء</Button>
            <Button
              variant="destructive"
              disabled={isPending || deleteText.trim() !== deleting?.name.trim()}
              onClick={deleteEmployer}
            >
              <Trash2 className="h-4 w-4" /> حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmployerDialog({
  employer,
  pending,
  onClose,
  onSave,
}: {
  employer: EmployerCard | null;
  pending: boolean;
  onClose: () => void;
  onSave: (name: string, role: string) => void;
}) {
  const [name, setName] = useState(employer?.name ?? "");
  const [role, setRole] = useState(employer?.role ?? "");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSave(name.trim(), role.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{employer ? "تعديل جهة العمل" : "جهة عمل جديدة"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <Label htmlFor="emp-name">الاسم</Label>
              <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
            </div>
            <div>
              <Label htmlFor="emp-role">المسمّى الوظيفي (اختياري)</Label>
              <Input id="emp-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
            <Button type="submit" variant="brand" disabled={pending || !name.trim()}>حفظ</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
