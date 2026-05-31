"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatILS } from "@/lib/utils";

type Point = {
  label: string;
  income: number;
  expenses: number;
  build: number;
};

export function CashflowChart({ data }: { data: Point[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📈 التدفق النقدي</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => formatILS(Number(value))}
                contentStyle={{ borderRadius: 12, direction: "rtl" }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="income"
                name="الدخل"
                stroke="#10B981"
                fill="#10B98133"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="مصروفات"
                stroke="#EF4444"
                fill="#EF444433"
                stackId="2"
              />
              <Area
                type="monotone"
                dataKey="build"
                name="بناء"
                stroke="#8B5CF6"
                fill="#8B5CF633"
                stackId="3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
