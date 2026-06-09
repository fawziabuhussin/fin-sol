"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Coins,
  DollarSign,
  Pencil,
  PiggyBank,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { localTodayIso } from "@/lib/dates";
import { GOLD_KARAT_OPTIONS } from "@/lib/market-rates";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { computeAssetValueIls } from "@/lib/savings-asset-value";

export type SavingsSummaryData = {
  summary: {
    monthlyThisMonth: number;
    accumulatedTotal: number;
    committedTotal: number;
    remainingToPay: number;
    activePlans: number;
    jamiyaPaidTotal: number;
    assetsTotal: number;
    goldTotal: number;
    usdTotal: number;
    kupotTotal: number;
  };
  kupot: {
    id: string;
    name: string;
    color: string | null;
    pensionTotal: number;
    kerenTotal: number;
    employeeTotal: number;
    employerTotal: number;
    kupotTotal: number;
    latestPension: number;
    latestKeren: number;
    latestEmployerTotal: number;
  }[];
  planProgress: {
    id: string;
    title: string;
    paid: number;
    target: number;
    remaining: number;
    progress: number;
  }[];
  assets: {
    id: string;
    kind: "GOLD" | "USD";
    title: string;
    quantity: number;
    unitPrice: number;
    goldKarat: number;
    priceCurrency: string;
    valueIls: number;
    updatedAt: string;
    history?: {
      id: string;
      quantity: number;
      unitPrice: number;
      valueIls: number;
      purchasedAt: string;
      notes: string | null;
    }[];
  }[];
  charts: {
    portfolio: { name: string; value: number; fill: string }[];
    commitment: { name: string; value: number; fill: string }[];
    plans: { name: string; paid: number; remaining: number }[];
  };
  liveRates?: {
    usdIls: number;
    usdIlsDate: string;
    fetchedAt: string;
  } | null;
};

const USD_RATE_POLL_MS = 60_000;

function applyLiveUsdToAssets(
  assets: SavingsSummaryData["assets"],
  liveUsdIls: number | null
): SavingsSummaryData["assets"] {
  if (liveUsdIls == null) return assets;
  return assets.map((asset) => {
    if (asset.kind !== "USD") return asset;
    const valueIls = computeAssetValueIls(
      "USD",
      asset.quantity,
      liveUsdIls,
      liveUsdIls
    );
    return {
      ...asset,
      unitPrice: liveUsdIls,
      valueIls,
    };
  });
}

type PurchaseHistoryRow = NonNullable<
  SavingsSummaryData["assets"][number]["history"]
>[number];

function PurchaseRow({
  assetId,
  entry,
  isGold,
  unitLabel,
}: {
  assetId: string;
  entry: PurchaseHistoryRow;
  isGold: boolean;
  unitLabel: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    quantity: entry.quantity,
    purchasedAt: entry.purchasedAt,
    notes: entry.notes ?? "",
  });

  const saveEdit = () => {
    if (form.quantity <= 0) {
      toast.error("الكمية يجب أن تكون أكبر من صفر");
      return;
    }
    startTransition(async () => {
      const res = await fetch(
        `/api/savings/assets/${assetId}/entries/${entry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      if (!res.ok) {
        toast.error("فشل التعديل");
        return;
      }
      toast.success("تم تعديل الشراء");
      setEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm("حذف هذا الشراء من السجل؟")) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/savings/assets/${assetId}/entries/${entry.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("فشل الحذف");
        return;
      }
      toast.success("تم حذف الشراء");
      router.refresh();
    });
  };

  if (editing) {
    return (
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">{isGold ? "الوزن (غرام)" : "المبلغ ($)"}</Label>
            <Input
              type="number"
              step="0.01"
              min={0.01}
              value={form.quantity || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: Number(e.target.value) }))
              }
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">التاريخ</Label>
            <Input
              type="date"
              value={form.purchasedAt}
              onChange={(e) =>
                setForm((f) => ({ ...f, purchasedAt: e.target.value }))
              }
              className="h-8 text-xs"
            />
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          القيمة تُحسب تلقائياً — {formatCurrency(entry.valueIls)} (عند الحفظ
          تُحدَّث)
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={isPending}
            onClick={saveEdit}
          >
            حفظ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => setEditing(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xs hover:bg-white/60">
      <div className="min-w-0 flex-1 text-slate-600">
        <span>
          {entry.purchasedAt} · {entry.quantity}
          {unitLabel}
        </span>
      </div>
      <span className="shrink-0 font-semibold text-slate-800">
        {formatCurrency(entry.valueIls)}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={isPending}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        aria-label="تعديل"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={isPending}
        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
        aria-label="حذف"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AssetCard({
  asset,
  liveUsdIls,
  liveUsdDate,
  onLiveUsd,
}: {
  asset: SavingsSummaryData["assets"][number];
  liveUsdIls: number | null;
  liveUsdDate: string | null;
  onLiveUsd: (rate: number, date: string) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [goldKarat, setGoldKarat] = useState(asset.goldKarat ?? 21);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    quantity: 0,
    purchasedAt: localTodayIso(),
    notes: "",
  });
  const [rateMeta, setRateMeta] = useState<string | null>(null);
  const [liveGoldPrice, setLiveGoldPrice] = useState(asset.unitPrice);
  const [fetchingRate, setFetchingRate] = useState(false);
  const isGold = asset.kind === "GOLD";
  const unitLabel = isGold ? " غ" : " $";

  const totalQuantity =
    asset.history?.reduce((sum, h) => sum + h.quantity, 0) ?? asset.quantity;

  const fetchLiveRate = useCallback(async () => {
    setFetchingRate(true);
    try {
      const url = isGold
        ? `/api/savings/market-rates?karat=${goldKarat}`
        : "/api/savings/market-rates?karat=21";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "تعذّر جلب السعر");
        return;
      }
      if (isGold) {
        setLiveGoldPrice(data.gold.pricePerGramIls);
        setRateMeta(
          `سعر ${data.gold.karat}K: ${data.gold.pricePerGramIls.toLocaleString("ar-IL")} ₪/غرام · أونصة $${Math.round(data.gold.pricePerOzUsd).toLocaleString("en-US")}`
        );
      } else {
        onLiveUsd(data.usdIls, data.usdIlsDate);
        const src =
          data.usdIlsSource === "boi" ? "בנק ישראל" : "Frankfurter";
        setRateMeta(`سعر الصرف (${src}): ${data.usdIls} ₪/$ · ${data.usdIlsDate}`);
      }
    } catch {
      toast.error("تعذّر الاتصال بمصدر الأسعار");
    } finally {
      setFetchingRate(false);
    }
  }, [isGold, goldKarat, onLiveUsd]);

  useEffect(() => {
    fetchLiveRate();
    if (!isGold) {
      const id = setInterval(fetchLiveRate, USD_RATE_POLL_MS);
      return () => clearInterval(id);
    }
  }, [fetchLiveRate, isGold]);

  const usdRate = liveUsdIls ?? asset.unitPrice;
  const portfolioValue = isGold
    ? computeAssetValueIls("GOLD", totalQuantity, liveGoldPrice)
    : computeAssetValueIls("USD", totalQuantity, usdRate, usdRate);

  const addPreviewValue =
    addForm.quantity > 0
      ? isGold
        ? computeAssetValueIls("GOLD", addForm.quantity, liveGoldPrice)
        : computeAssetValueIls("USD", addForm.quantity, usdRate, usdRate)
      : 0;

  const saveGoldKarat = () => {
    startTransition(async () => {
      const res = await fetch(`/api/savings/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goldKarat }),
      });
      if (!res.ok) {
        toast.error("فشل الحفظ");
        return;
      }
      toast.success("تم تحديث العيار");
      router.refresh();
    });
  };

  const addPurchase = () => {
    if (addForm.quantity <= 0) {
      toast.error("أدخل كمية صحيحة");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/savings/assets/${asset.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (!res.ok) {
        toast.error("فشل إضافة الشراء");
        return;
      }
      toast.success("تمت إضافة الشراء");
      setAddForm({ quantity: 0, purchasedAt: localTodayIso(), notes: "" });
      setShowAdd(false);
      router.refresh();
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${
        isGold
          ? "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50"
          : "border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${
            isGold ? "bg-amber-100/80" : "bg-emerald-100/80"
          }`}
        >
          <Image
            src={isGold ? "/savings/gold.svg" : "/savings/dollar.svg"}
            alt={isGold ? "ذهب" : "دولار"}
            width={72}
            height={72}
            className="drop-shadow-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isGold ? (
              <Coins className="h-4 w-4 text-amber-600" />
            ) : (
              <DollarSign className="h-4 w-4 text-emerald-600" />
            )}
            <p className="font-bold text-slate-900">
              {isGold ? "ذهب" : "دولار أمريكي"}
            </p>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-600">{asset.title}</p>
          <p
            className={`mt-2 text-2xl font-extrabold ${
              isGold ? "text-amber-700" : "text-emerald-700"
            }`}
          >
            {formatCurrency(portfolioValue)}
          </p>
          <p className="text-xs text-slate-500">
            {totalQuantity.toLocaleString("ar-IL")}
            {unitLabel}
            {!isGold && liveUsdDate ? ` · سعر حي ${liveUsdDate}` : ""}
          </p>
        </div>
      </div>

      {isGold && (
        <div className="mt-4 flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">العيار (قيراط)</Label>
            <select
              value={goldKarat}
              onChange={(e) => setGoldKarat(Number(e.target.value))}
              className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
            >
              {GOLD_KARAT_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}K
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || goldKarat === (asset.goldKarat ?? 21)}
              onClick={saveGoldKarat}
            >
              حفظ العيار
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 rounded-lg bg-white/50 px-3 py-2 text-xs text-slate-600">
        {isGold ? (
          <span>
            سعر الغرام الحالي:{" "}
            <strong>{liveGoldPrice.toLocaleString("ar-IL")} ₪</strong>
          </span>
        ) : (
          <span>
            سعر الصرف: <strong>{usdRate} ₪/$</strong>
          </span>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 w-full"
        disabled={fetchingRate}
        onClick={fetchLiveRate}
      >
        <RefreshCw
          className={`me-2 h-3.5 w-3.5 ${fetchingRate ? "animate-spin" : ""}`}
        />
        {fetchingRate ? "جاري التحديث…" : "تحديث السعر من الإنترنت"}
      </Button>
      {rateMeta && (
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{rateMeta}</p>
      )}

      <div className="mt-4 border-t border-slate-100 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-600">سجل المشتريات</p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setShowAdd((v) => !v)}
          >
            {showAdd ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAdd ? "إلغاء" : "إضافة شراء"}
          </Button>
        </div>

        {showAdd && (
          <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">
                  {isGold ? "الوزن (غرام)" : "المبلغ ($)"}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={addForm.quantity || ""}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      quantity: Number(e.target.value),
                    }))
                  }
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">تاريخ الشراء</Label>
                <Input
                  type="date"
                  value={addForm.purchasedAt}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, purchasedAt: e.target.value }))
                  }
                  className="h-9"
                />
              </div>
            </div>
            {addForm.quantity > 0 && (
              <p className="text-xs text-slate-600">
                القيمة المحسوبة:{" "}
                <strong className="text-slate-900">
                  {formatCurrency(addPreviewValue)}
                </strong>
              </p>
            )}
            <Button
              size="sm"
              className="w-full"
              disabled={isPending}
              onClick={addPurchase}
            >
              {isPending ? "..." : "حفظ الشراء"}
            </Button>
          </div>
        )}

        {asset.history && asset.history.length > 0 ? (
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {asset.history.map((h) => (
              <PurchaseRow
                key={h.id}
                assetId={asset.id}
                entry={h}
                isGold={isGold}
                unitLabel={unitLabel}
              />
            ))}
          </div>
        ) : (
          <p className="py-2 text-center text-xs text-slate-400">
            لا توجد مشتريات — أضف شراءً جديداً
          </p>
        )}
      </div>
    </motion.div>
  );
}

export function SavingsSummary({ data }: { data: SavingsSummaryData }) {
  const { summary, charts, assets: serverAssets } = data;
  const [liveUsdIls, setLiveUsdIls] = useState<number | null>(
    data.liveRates?.usdIls ?? null
  );
  const [liveUsdDate, setLiveUsdDate] = useState<string | null>(
    data.liveRates?.usdIlsDate ?? null
  );

  const onLiveUsd = useCallback((rate: number, date: string) => {
    setLiveUsdIls(rate);
    setLiveUsdDate(date);
  }, []);

  const assets = applyLiveUsdToAssets(serverAssets, liveUsdIls);
  const goldTotal = assets
    .filter((a) => a.kind === "GOLD")
    .reduce((s, a) => s + a.valueIls, 0);
  const usdTotal = assets
    .filter((a) => a.kind === "USD")
    .reduce((s, a) => s + a.valueIls, 0);
  const assetsTotal = goldTotal + usdTotal;
  const accumulatedTotal = summary.jamiyaPaidTotal + assetsTotal;
  const hasChartData = charts.portfolio.length > 0;

  return (
    <div className="space-y-6">
      {/* KPI row — mirrors Excel summary */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "ادخار هذا الشهر",
            value: summary.monthlyThisMonth,
            icon: Wallet,
            color: "text-indigo-700",
            bg: "bg-indigo-50",
          },
          {
            label: "إجمالي المتراكم",
            value: accumulatedTotal,
            icon: TrendingUp,
            color: "text-emerald-700",
            bg: "bg-emerald-50",
          },
          {
            label: "إجمالي الالتزام",
            value: summary.committedTotal,
            icon: Target,
            color: "text-violet-700",
            bg: "bg-violet-50",
          },
          {
            label: "المتبقي للدفع",
            value: summary.remainingToPay,
            icon: PiggyBank,
            color: "text-amber-700",
            bg: "bg-amber-50",
          },
          {
            label: "جمعيات نشطة",
            value: summary.activePlans,
            icon: PiggyBank,
            color: "text-slate-800",
            bg: "bg-slate-50",
            isCount: true,
          },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className="overflow-hidden shadow-sm transition hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-2 ${kpi.bg}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
                <p className={`mt-2 text-xl font-extrabold sm:text-2xl ${kpi.color}`}>
                  {"isCount" in kpi && kpi.isCount
                    ? kpi.value
                    : formatCurrency(kpi.value as number)}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Accumulated total breakdown */}
      <Card className="border-emerald-100 bg-gradient-to-l from-emerald-50/80 to-white shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-bold text-slate-900">
            تفصيل إجمالي المتراكم — {formatCurrency(accumulatedTotal)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            جمعيات مدفوعة + قيمة الأصول (ذهب ودولار) — بدون קופות
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "جمعيات (مدفوع)",
                value: summary.jamiyaPaidTotal,
                color: "text-indigo-700",
                bg: "bg-indigo-50",
              },
              {
                label: "ذهب",
                value: summary.goldTotal,
                color: "text-amber-700",
                bg: "bg-amber-50",
              },
              {
                label: "دولار ($ → ₪)",
                value: usdTotal,
                color: "text-emerald-700",
                bg: "bg-emerald-50",
              },
            ].map((row) => (
              <div
                key={row.label}
                className={`rounded-xl border border-slate-100 ${row.bg} p-3`}
              >
                <p className="text-xs text-slate-600">{row.label}</p>
                <p className={`mt-1 text-lg font-extrabold ${row.color}`}>
                  {formatCurrency(row.value)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gold & Dollar assets */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-900">
          <Coins className="h-5 w-5 text-amber-600" />
          الأصول — ذهب وعملات
        </h2>
        {assets.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-slate-500">
              لا توجد أصول مسجّلة بعد
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                liveUsdIls={liveUsdIls}
                liveUsdDate={liveUsdDate}
                onLiveUsd={onLiveUsd}
              />
            ))}
          </div>
        )}
        {assets.length > 0 && (
          <p className="mt-3 text-center text-sm text-slate-600">
            إجمالي قيمة الأصول:{" "}
            <span className="font-bold text-emerald-700">
              {formatCurrency(assetsTotal)}
            </span>
            {" · "}
            <span className="text-amber-700">ذهب {formatCurrency(goldTotal)}</span>
            {" · "}
            <span className="text-emerald-700">دولار {formatCurrency(usdTotal)}</span>
          </p>
        )}
      </div>

      {/* Charts */}
      {hasChartData && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزيع المتراكم</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.portfolio}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {charts.portfolio.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">الالتزام — مدفوع vs متبقي</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.commitment}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {charts.commitment.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {charts.plans.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">تقدّم الجمعيات</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={charts.plans}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                    <Bar dataKey="paid" name="مدفوع" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                    <Bar
                      dataKey="remaining"
                      name="متبقي"
                      stackId="a"
                      fill="#fca5a5"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
