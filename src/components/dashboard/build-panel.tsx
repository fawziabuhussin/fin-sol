"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatILS } from "@/lib/utils";

type BuildData = {
  totalBudget: number;
  totalPaid: number;
  remaining: number;
  progress: number;
  nextDue: { name: string; amount: number } | null;
  contractors: {
    name: string;
    paid: number;
    total: number;
    remaining: number;
    status: string;
  }[];
};

export function BuildPanel({ build }: { build: BuildData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🏗️ لوحة البناء</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-500">نسبة الإنجاز</span>
            <span className="font-medium text-violet-600">
              {Math.round(build.progress)}%
            </span>
          </div>
          <Progress value={build.progress} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500">المدفوع</p>
            <p className="font-semibold">{formatILS(build.totalPaid)}</p>
          </div>
          <div>
            <p className="text-gray-500">المتبقي</p>
            <p className="font-semibold text-violet-700">
              {formatILS(build.remaining)}
            </p>
          </div>
        </div>
        {build.nextDue && (
          <div className="rounded-lg bg-violet-50 p-3 text-sm">
            <p className="font-medium text-violet-900">الدفعة القادمة</p>
            <p className="text-violet-700">
              {build.nextDue.name} — {formatILS(build.nextDue.amount)}
            </p>
          </div>
        )}
        <ul className="max-h-40 space-y-2 overflow-y-auto text-xs">
          {build.contractors.map((c) => (
            <li
              key={c.name}
              className="flex justify-between border-b border-gray-50 pb-1"
            >
              <span className="truncate pe-2">{c.name}</span>
              <span className="shrink-0 text-gray-500">
                {formatILS(c.remaining)} متبقي
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
