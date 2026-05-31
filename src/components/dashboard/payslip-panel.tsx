"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";

type Salary = {
  net: number;
  gross: number;
  keren: number;
};

export function PayslipPanel({
  salary,
  monthLabel,
}: {
  salary: Salary | null;
  monthLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>💵 תלוש — {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        {!salary ? (
          <p className="text-sm text-gray-500">لم يُدخل تلوש لهذا الشهر</p>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">ברוטו</p>
              <p className="text-lg font-semibold">{formatILS(salary.gross)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">נטו</p>
              <p className="text-xl font-bold text-emerald-600">
                {formatILS(salary.net)}
              </p>
            </div>
            {salary.keren > 0 && (
              <div className="rounded-lg bg-indigo-50 p-2">
                <p className="text-xs text-indigo-600">קרן השתלמות (חודשי)</p>
                <p className="font-medium text-indigo-900">
                  {formatILS(salary.keren)}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
