"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";

const COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

export function CategoryDonut({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>🍩 المصروفات حسب الفئة</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">لا توجد مصروفات هذا الشهر</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>🍩 المصروفات حسب الفئة</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatILS(Number(value))}
                contentStyle={{ borderRadius: 12, direction: "rtl" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.slice(0, 6).map((d, i) => (
            <li
              key={d.name}
              className="flex items-center gap-1 text-xs text-gray-600"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {d.name}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
