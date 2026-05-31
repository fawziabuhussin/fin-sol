"use client";

import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type Tx = {
  id: string;
  date: string;
  category: string;
  amount: number;
  description: string;
  paymentMethod: string;
};

export function TransactionsTable({
  transactions,
  categories,
  avgTransaction,
}: {
  transactions: Tx[];
  categories: string[];
  avgTransaction: number;
}) {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filter && t.category !== filter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [transactions, filter, search]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>
          📋 معاملات الشهر · {transactions.length} · متوسط{" "}
          {formatILS(avgTransaction)}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">كل الفئات</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="بحث في الوصف..."
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-2 text-start font-medium">التاريخ</th>
              <th className="pb-2 text-start font-medium">الفئة</th>
              <th className="pb-2 text-start font-medium">المبلغ</th>
              <th className="pb-2 text-start font-medium">الوصف</th>
              <th className="pb-2 text-start font-medium">طريقة الدفع</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-gray-50">
                <td className="py-2.5 whitespace-nowrap">
                  {format(new Date(t.date), "d MMM", { locale: ar })}
                </td>
                <td className="py-2.5">{t.category}</td>
                <td className="py-2.5 font-medium">{formatILS(t.amount)}</td>
                <td className="py-2.5 max-w-[200px] truncate">{t.description}</td>
                <td className="py-2.5 text-gray-500">{t.paymentMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-gray-500">لا توجد معاملات</p>
        )}
      </CardContent>
    </Card>
  );
}
