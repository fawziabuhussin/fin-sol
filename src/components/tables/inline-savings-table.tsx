"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, ChevronLeft, Loader2 } from "lucide-react";

type SavingsRow = {
  id: string;
  title: string;
  type: "JAMIYA" | "PERSONAL" | "KUPOT";
  monthlyContribution: number;
  targetAmount: number | null;
  status: string;
};

type SaveState = "idle" | "saving" | "saved";

export function InlineSavingsTable({
  items: initial,
}: {
  items: SavingsRow[];
}) {
  const [items, setItems] = useState(initial);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [, startTransition] = useTransition();

  const patch = (id: string, field: keyof SavingsRow, value: string | number) => {
    setItems((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const commit = (id: string, field: keyof SavingsRow, raw: string) => {
    const row = items.find((r) => r.id === id);
    if (!row) return;

    let value: string | number = raw;
    if (field === "monthlyContribution" || field === "targetAmount") {
      value = parseFloat(raw) || 0;
    }

    setSaveState((s) => ({ ...s, [`${id}-${field}`]: "saving" }));

    startTransition(async () => {
      const res = await fetch(`/api/savings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        toast.error("فشل الحفظ");
        setSaveState((s) => ({ ...s, [`${id}-${field}`]: "idle" }));
        return;
      }
      setSaveState((s) => ({ ...s, [`${id}-${field}`]: "saved" }));
      toast.success("تم الحفظ");
      setTimeout(() => {
        setSaveState((s) => ({ ...s, [`${id}-${field}`]: "idle" }));
      }, 1500);
    });
  };

  const StatusIcon = ({ id, field }: { id: string; field: string }) => {
    const st = saveState[`${id}-${field}`];
    if (st === "saving") return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />;
    if (st === "saved") return <Check className="h-4 w-4 text-emerald-600" />;
    return null;
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <th className="p-3 text-right font-semibold">العنوان</th>
            <th className="p-3 text-right font-semibold">النوع</th>
            <th className="p-3 text-right font-semibold">شهري</th>
            <th className="p-3 text-right font-semibold">الهدف</th>
            <th className="p-3 text-right font-semibold">الحالة</th>
            <th className="p-3 text-right font-semibold"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-medium focus:border-indigo-300 focus:bg-white focus:outline-none"
                    defaultValue={row.title}
                    onBlur={(e) => commit(row.id, "title", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    onChange={(e) => patch(row.id, "title", e.target.value)}
                  />
                  <StatusIcon id={row.id} field="title" />
                </div>
              </td>
              <td className="p-2">
                <select
                  className="rounded-lg border border-slate-100 px-2 py-1"
                  value={row.type}
                  onChange={(e) => {
                    patch(row.id, "type", e.target.value);
                    commit(row.id, "type", e.target.value);
                  }}
                >
                  <option value="JAMIYA">جمعية</option>
                  <option value="PERSONAL">شخصي</option>
                  <option value="KUPOT">קופות</option>
                </select>
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 rounded-lg border border-transparent px-2 py-1 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    defaultValue={row.monthlyContribution}
                    onBlur={(e) => commit(row.id, "monthlyContribution", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <StatusIcon id={row.id} field="monthlyContribution" />
                </div>
              </td>
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-24 rounded-lg border border-transparent px-2 py-1 focus:border-indigo-300 focus:bg-white focus:outline-none"
                    defaultValue={row.targetAmount ?? ""}
                    onBlur={(e) => commit(row.id, "targetAmount", e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                  <StatusIcon id={row.id} field="targetAmount" />
                </div>
              </td>
              <td className="p-2 text-slate-600">{row.status}</td>
              <td className="p-2">
                <Link
                  href={`/savings/${row.id}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                >
                  فتح <ChevronLeft className="h-3 w-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-500">لا توجد خطط ادخار</p>
      )}
    </div>
  );
}
