"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, Plus } from "lucide-react";
import { DataTable } from "@/components/tables/data-table";
import { RowActions } from "@/components/tables/row-actions";
import { ProjectSheet } from "@/components/forms/project-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  totalBudget: number | null;
  targetDate: string | null;
  status: "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
};

export function ProjectsPageClient({
  data,
  search,
}: {
  data: ProjectRow[];
  search: string;
}) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const columns = useMemo<ColumnDef<ProjectRow>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <button className="flex items-center gap-1" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            العنوان <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/projects/${row.original.id}`}
            className="font-semibold text-indigo-700 hover:underline"
          >
            {row.original.title}
          </Link>
        ),
      },
      { accessorKey: "description", header: "الوصف" },
      {
        accessorKey: "totalBudget",
        header: "الميزانية",
        cell: ({ row }) =>
          row.original.totalBudget ? formatCurrency(row.original.totalBudget) : "—",
      },
      {
        accessorKey: "targetDate",
        header: "الهدف",
        cell: ({ row }) => row.original.targetDate ?? "—",
      },
      {
        accessorKey: "status",
        header: "الحالة",
        cell: ({ row }) => {
          const status = row.original.status;
          const label: Record<string, string> = {
            PLANNED: "مخطط",
            ACTIVE: "نشط",
            ON_HOLD: "متوقف",
            COMPLETED: "مكتمل",
            CANCELLED: "ملغى",
          };
          return <Badge variant={status === "ACTIVE" ? "success" : "default"}>{label[status]}</Badge>;
        },
      },
      {
        id: "open",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/projects/${row.original.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
          >
            فتح <ChevronLeft className="h-3 w-3" />
          </Link>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <RowActions
            onEdit={() => {
              setEditing(row.original);
              setSheetOpen(true);
            }}
            onDelete={() => {
              startTransition(async () => {
                await fetch(`/api/projects/${row.original.id}`, { method: "DELETE" });
                router.refresh();
              });
            }}
          />
        ),
      },
    ],
    [router]
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>المشاريع</CardTitle>
          <div className="flex gap-2">
            <form
              action={(fd) => {
                const value = String(fd.get("q") || "");
                router.push(`/projects?q=${encodeURIComponent(value)}`);
              }}
            >
              <Input name="q" defaultValue={search} placeholder="بحث في المشاريع..." />
            </form>
            <Button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              مشروع جديد
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data} />
        </CardContent>
      </Card>

      <ProjectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        projectId={editing?.id}
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
      {isPending && <p className="mt-2 text-xs text-slate-500">جاري التحديث...</p>}
    </>
  );
}
