"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/utils";

type PackMeta = {
  id: string;
  label: string;
  cardNote: string;
  rowCount: number;
  statementTotal: number;
};

export function IsracardImportSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [packs, setPacks] = useState<PackMeta[]>([]);
  const [packId, setPackId] = useState("");
  const [preview, setPreview] = useState<{
    imported: number;
    skippedDup: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    fetch("/api/isracard-import")
      .then((r) => r.json())
      .then((data: { packs?: PackMeta[] }) => {
        const list = data.packs ?? [];
        setPacks(list);
        setPackId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => toast.error("تعذّر تحميل دفاتر ישראכרט"));
  }, [open]);

  const selected = packs.find((p) => p.id === packId);

  const runImport = (dryRun: boolean) => {
    if (!packId) return;
    startTransition(async () => {
      const res = await fetch("/api/isracard-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, dryRun }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "فشل الاستيراد");
        return;
      }
      if (dryRun) {
        setPreview({ imported: data.imported, skippedDup: data.skippedDup });
        toast.message(
          `معاينة: ${data.imported} جديد · ${data.skippedDup} موجود مسبقاً`
        );
        return;
      }
      toast.success(
        `تم استيراد ${data.imported} معاملة · ${data.skippedDup} بدون تكرار`
      );
      onOpenChange(false);
      setPreview(null);
      router.refresh();
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            استيراد ישראכרט
          </SheetTitle>
          <SheetDescription>
            يضيف مصروفات כרטיס אשראי من دفتر חיוב محفوظ في التطبيق. المعاملات
            المطابقة (تاريخ + مبلغ + تاجر) لا تُكرَّر.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          <div>
            <Label>دفتر החיוב</Label>
            <Select
              value={packId}
              onChange={(e) => {
                setPackId(e.target.value);
                setPreview(null);
              }}
            >
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>

          {selected ? (
            <p className="text-sm text-slate-600">
              {selected.rowCount} שורות · סה״כ דף{" "}
              {formatCurrency(selected.statementTotal)} · כרטיס {selected.cardNote}
            </p>
          ) : null}

          {preview ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              معاينة: <strong>{preview.imported}</strong> جديد ·{" "}
              <strong>{preview.skippedDup}</strong> موجود
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={isPending || !packId}
              onClick={() => runImport(true)}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              معاينة
            </Button>
            <Button
              type="button"
              disabled={isPending || !packId}
              onClick={() => runImport(false)}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              استيراد
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function IsracardImportTrigger({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick} className="gap-2">
      <CreditCard className="h-4 w-4" />
      استيراد ישראכרט
    </Button>
  );
}
