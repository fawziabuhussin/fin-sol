"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bitcoin,
  Coins,
  DollarSign,
  ExternalLink,
  Gem,
  Lightbulb,
  Newspaper,
  PiggyBank,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SavingsTabs } from "@/components/savings/savings-tabs";
import {
  SAVINGS_NEWS_CATEGORIES,
  SAVINGS_NEWS_ITEMS,
  type SavingsNewsCategory,
} from "@/lib/savings-news";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<SavingsNewsCategory, typeof Coins> = {
  gold: Coins,
  usd: DollarSign,
  silver: Gem,
  crypto: Bitcoin,
  jamiya: PiggyBank,
  general: Lightbulb,
};

export function SavingsNewsPageClient() {
  const [filter, setFilter] = useState<SavingsNewsCategory | "all">("all");

  const items = useMemo(() => {
    const sorted = [...SAVINGS_NEWS_ITEMS].sort(
      (a, b) => b.publishedAt.localeCompare(a.publishedAt)
    );
    if (filter === "all") return sorted;
    return sorted.filter((item) => item.category === filter);
  }, [filter]);

  const highlights = items.filter((item) => item.highlight);

  return (
    <div className="space-y-5 pb-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">الجمعية والادخار</h1>
        <p className="mt-1 text-sm text-slate-500">
          أخبار وفرص ادخار قد تهمك — ذهب، دولار، عملات رقمية، وجمعيات
        </p>
      </div>

      <SavingsTabs />

      {highlights.length > 0 && filter === "all" && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-violet-700">مُختار لك</p>
          <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {highlights.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="w-[min(100%,280px)] shrink-0"
              >
                <NewsCard item={item} compact />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SAVINGS_NEWS_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setFilter(cat.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors sm:text-sm",
              filter === cat.id
                ? "bg-violet-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
          >
            <NewsCard item={item} />
          </motion.div>
        ))}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-slate-500">
            لا توجد مقالات في هذا التصنيف.
          </CardContent>
        </Card>
      )}

      <Card className="border-violet-100 bg-violet-50/50">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900">جاهز لتسجيل أصل جديد؟</p>
              <p className="text-xs text-slate-600">
                أضف فضة، عملات رقمية، أو أي مصدر ادخار من صفحة الأصول.
              </p>
            </div>
          </div>
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href="/savings">
              <ArrowUpRight className="me-2 h-4 w-4" />
              الذهاب للأصول
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function NewsCard({
  item,
  compact,
}: {
  item: (typeof SAVINGS_NEWS_ITEMS)[number];
  compact?: boolean;
}) {
  const Icon = CATEGORY_ICONS[item.category];
  return (
    <Card
      className={cn(
        "h-full overflow-hidden shadow-sm transition hover:shadow-md",
        item.highlight && "ring-1 ring-violet-200"
      )}
    >
      <CardContent className={cn("p-4", compact && "p-3.5")}>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "font-bold text-slate-900",
                  compact ? "text-sm" : "text-base"
                )}
              >
                {item.title}
              </p>
              {item.highlight && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  مهم
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.publishedAt}</p>
          </div>
          <Newspaper className="h-4 w-4 shrink-0 text-slate-300" />
        </div>
        <p
          className={cn(
            "mt-3 leading-relaxed text-slate-600",
            compact ? "text-xs line-clamp-3" : "text-sm"
          )}
        >
          {item.summary}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
          >
            المزيد
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
