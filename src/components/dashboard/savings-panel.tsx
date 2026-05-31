"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

type Plan = {
  id: string;
  name: string;
  monthly: number;
  payoutDate: string;
  remaining: number;
  total: number;
};

export function SavingsPanel({ plans }: { plans: Plan[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>💎 الجمعيات والادخار</CardTitle>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <p className="text-sm text-gray-500">لا توجد خطط ادخار نشطة</p>
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-teal-50 bg-teal-50/50 p-3"
              >
                <p className="font-medium text-gray-900">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {formatILS(p.monthly)} / شهر
                </p>
                <p className="mt-1 text-sm text-teal-700">
                  قبض:{" "}
                  {format(new Date(p.payoutDate), "d MMM yyyy", { locale: ar })}
                </p>
                <p className="text-xs text-gray-600">
                  متبقي: {formatILS(p.remaining)} من {formatILS(p.total)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
