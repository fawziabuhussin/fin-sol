"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, FolderKanban, Layers, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProjectSheet } from "@/components/forms/project-sheet";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { PROJECT_STATUS_LABELS, monthLabel } from "@/lib/finance-labels";

type Status = "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  totalBudget: number | null;
  targetDate: string | null;
  status: Status;
  spent: number;
  itemCount: number;
};

type Filter = "open" | "done" | "all";

const STATUS_BADGE: Record<Status, "brand" | "default" | "attention" | "success" | "outline"> = {
  ACTIVE: "brand",
  PLANNED: "default",
  ON_HOLD: "attention",
  COMPLETED: "success",
  CANCELLED: "outline",
};

const isClosed = (p: ProjectRow) => p.status === "COMPLETED" || p.status === "CANCELLED";

const formatTarget = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${monthLabel(m!)} ${y}`;
};

function ProjectCard({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const budget = project.totalBudget ?? 0;
  const pct = budget > 0 ? Math.round((project.spent / budget) * 100) : null;
  const over = pct != null && pct > 100;
  const closed = isClosed(project);

  return (
    <Card
      className={cn(
        "relative flex flex-col p-5 transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-float",
        closed && "opacity-80"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <FolderKanban className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {/* The whole card is the link target; the menu button sits above it (z-10). */}
          <Link href={`/projects/${project.id}`} className="after:absolute after:inset-0 after:rounded-2xl">
            <h3 className="truncate font-semibold text-slate-900" dir="auto">{project.title}</h3>
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_BADGE[project.status]}>{PROJECT_STATUS_LABELS[project.status] ?? project.status}</Badge>
            {project.itemCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Layers className="h-3 w-3" /> {project.itemCount} بنود
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative z-10 text-slate-400" aria-label={`خيارات ${project.title}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> تعديل
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-rose-600 [&_svg]:text-rose-500" onSelect={onDelete}>
              <Trash2 /> حذف
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {project.description && (
        <p className="mt-3 line-clamp-2 text-sm text-slate-500" dir="auto">{project.description}</p>
      )}

      <div className="mt-auto pt-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] text-slate-500">صُرف</p>
            <p className="num text-lg font-bold text-slate-900">{formatCurrency(project.spent)}</p>
          </div>
          <div className="text-left">
            <p className="text-[11px] text-slate-500">الميزانية</p>
            <p className="num text-sm font-semibold text-slate-700">{budget > 0 ? formatCurrency(budget) : "—"}</p>
          </div>
        </div>
        {pct != null && (
          <>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", over ? "bg-rose-500" : closed ? "bg-emerald-500" : "bg-indigo-500")}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
            <p className={cn("mt-1.5 text-xs", over ? "font-semibold text-rose-600" : "text-slate-500")}>
              {over
                ? `تجاوز الميزانية بـ ${formatCurrency(project.spent - budget)}`
                : `${pct}% · متبقٍ ${formatCurrency(Math.max(0, budget - project.spent))}`}
            </p>
          </>
        )}
        {project.targetDate && (
          <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" /> الموعد المستهدف: {formatTarget(project.targetDate)}
          </p>
        )}
      </div>
    </Card>
  );
}

export function ProjectsPageClient({ data, search }: { data: ProjectRow[]; search: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ask, confirmDialog] = useConfirm();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState(search);

  // Debounced server search.
  useEffect(() => {
    if (q.trim() === search) return;
    const t = setTimeout(
      () => router.push(`/projects${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`),
      400
    );
    return () => clearTimeout(t);
  }, [q, search, router]);

  const open = useMemo(() => data.filter((p) => !isClosed(p)), [data]);
  const closed = useMemo(() => data.filter(isClosed), [data]);
  const listed = filter === "open" ? open : filter === "done" ? closed : data;
  const totals = useMemo(
    () => ({
      budget: open.reduce((s, p) => s + (p.totalBudget ?? 0), 0),
      spent: open.reduce((s, p) => s + p.spent, 0),
    }),
    [open]
  );

  const remove = async (project: ProjectRow) => {
    const ok = await ask({
      title: `حذف «${project.title}»؟`,
      description: "تُحذف خطط الدفع والأقساط والبنود المرتبطة. لا يمكن التراجع.",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) return void toast.error("تعذّر حذف المشروع");
      toast.success(`حُذف «${project.title}»`);
      router.refresh();
    });
  };

  const openSheet = (project: ProjectRow | null) => {
    setEditing(project);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="المشاريع"
        description="ميزانية لكل مشروع، بنود داخله، وجداول دفعات — وكل دفعة تُسجَّل في مصروفاتك."
        actions={
          <Button variant="brand" onClick={() => openSheet(null)}>
            <Plus className="h-4 w-4" /> مشروع جديد
          </Button>
        }
      />

      {data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500">مشاريع مفتوحة</p>
            <p className="num mt-1 text-2xl font-bold text-slate-900">{open.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500">صُرف عليها</p>
            <p className="num mt-1 truncate text-2xl font-bold text-slate-900">{formatCurrency(totals.spent)}</p>
          </Card>
          <Card className="col-span-2 p-4 sm:col-span-1">
            <p className="text-xs text-slate-500">من ميزانية</p>
            <p className="num mt-1 text-2xl font-bold text-slate-900">{formatCurrency(totals.budget)}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث في المشاريع…"
            aria-label="بحث في المشاريع"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-9 text-base shadow-card placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none sm:text-sm"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {(
            [
              ["open", `مفتوحة (${open.length})`],
              ["done", `مكتملة (${closed.length})`],
              ["all", `الكل (${data.length})`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                filter === value ? "bg-white text-slate-900 shadow-card" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {listed.length === 0 ? (
        <Card className="px-6 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
            <FolderKanban className="h-7 w-7" />
          </span>
          <p className="mt-4 font-semibold text-slate-800">
            {data.length === 0 ? (search ? "لا نتائج مطابقة" : "لا مشاريع بعد") : "لا مشاريع في هذا التصنيف"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {data.length === 0 && !search
              ? "بناء بيت، تجديد، زفاف… أنشئ مشروعاً وتابع ميزانيته ودفعاته."
              : "جرّب تصنيفاً آخر أو كلمة بحث مختلفة."}
          </p>
          {data.length === 0 && !search && (
            <Button variant="brand" className="mt-5" onClick={() => openSheet(null)}>
              <Plus className="h-4 w-4" /> أول مشروع
            </Button>
          )}
        </Card>
      ) : (
        <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3", isPending && "opacity-60")}>
          {listed.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => openSheet(project)}
              onDelete={() => remove(project)}
            />
          ))}
        </div>
      )}

      <ProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        projectId={editing?.id}
        parentOptions={data.map((p) => ({ id: p.id, title: p.title }))}
        initial={
          editing
            ? {
                title: editing.title,
                description: editing.description ?? "",
                totalBudget: editing.totalBudget ?? undefined,
                targetDate: editing.targetDate ?? "",
                status: editing.status,
              }
            : undefined
        }
      />
      {confirmDialog}
    </div>
  );
}
