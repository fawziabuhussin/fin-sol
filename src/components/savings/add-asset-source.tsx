"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Coins, DollarSign, Gem, Bitcoin, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADDABLE_ASSET_KINDS,
  ASSET_KIND_CONFIG,
  type SavingsAssetKindKey,
} from "@/lib/savings-asset-kinds";

const KIND_ICONS: Record<SavingsAssetKindKey, typeof Coins> = {
  GOLD: Coins,
  USD: DollarSign,
  SILVER: Gem,
  CRYPTO: Bitcoin,
  CUSTOM: Sparkles,
};

export function AddAssetSource({
  existingKinds,
}: {
  existingKinds: SavingsAssetKindKey[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<SavingsAssetKindKey>("SILVER");
  const [form, setForm] = useState({
    title: "",
    unitLabel: "",
  });

  const config = ASSET_KIND_CONFIG[kind];
  const singletonTaken =
    ASSET_KIND_CONFIG[kind].singleton && existingKinds.includes(kind);

  const submit = () => {
    startTransition(async () => {
      const res = await fetch("/api/savings/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: form.title.trim() || config.defaultTitle,
          quantity: 0,
          unitPrice: 0,
          unitLabel: form.unitLabel.trim() || config.defaultUnitLabel,
          goldKarat: kind === "GOLD" ? 21 : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "فشل إضافة الأصل");
        return;
      }
      toast.success("تمت إضافة مصدر الادخار — أضف أول شراء من البطاقة");
      setOpen(false);
      setForm({ title: "", unitLabel: "" });
      router.refresh();
    });
  };

  return (
    <Card className="border-dashed border-violet-200 bg-violet-50/30 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">إضافة مصدر ادخار جديد</CardTitle>
          <Button
            type="button"
            size="sm"
            variant={open ? "outline" : "default"}
            className="gap-1"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "إلغاء" : (
              <>
                <Plus className="h-4 w-4" />
                أصل جديد
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          فضة، ميداليات، عملات رقمية، أو أي أصل آخر تريد تتبعه
        </p>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {ADDABLE_ASSET_KINDS.map((k) => {
              const meta = ASSET_KIND_CONFIG[k];
              const Icon = KIND_ICONS[k];
              const disabled =
                meta.singleton && existingKinds.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  disabled={disabled}
                  onClick={() => setKind(k)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center text-xs font-semibold transition-all ${
                    kind === k
                      ? "border-violet-500 bg-white text-violet-800 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                  {meta.label}
                  {disabled && (
                    <span className="text-[9px] font-normal text-slate-400">
                      مُسجّل
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">اسم الأصل</Label>
              <Input
                placeholder={config.defaultTitle}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="h-10"
              />
            </div>
            {(kind === "CUSTOM" || kind === "CRYPTO" || kind === "SILVER") && (
              <div>
                <Label className="text-xs">وحدة القياس</Label>
                <Input
                  placeholder={config.defaultUnitLabel}
                  value={form.unitLabel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, unitLabel: e.target.value }))
                  }
                  className="h-10"
                />
              </div>
            )}
          </div>

          {singletonTaken ? (
            <p className="text-sm text-amber-700">
              {config.label} مُسجّل مسبقاً — أضف حركات شراء من بطاقته أعلاه.
            </p>
          ) : (
            <Button
              className="w-full sm:w-auto"
              disabled={isPending}
              onClick={submit}
            >
              {isPending ? "..." : `إنشاء ${config.label}`}
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
