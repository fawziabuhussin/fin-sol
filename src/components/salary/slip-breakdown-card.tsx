"use client";

import type { SalarySlipBreakdown } from "@/lib/payslip-types";
import { formatCurrency } from "@/lib/utils";

export function SlipBreakdownCard({
  breakdown,
  compact,
}: {
  breakdown: SalarySlipBreakdown;
  compact?: boolean;
}) {
  const { taxes, pension, keren } = breakdown;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/80 text-sm ${compact ? "p-2" : "p-3"}`}
    >
      <p className="mb-2 text-xs font-bold text-slate-600">פירוט מסים וגמל (מתלוש)</p>

      <div className="space-y-2">
        <div>
          <p className="text-xs font-semibold text-rose-700">מסים (ניכויי חובה)</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            <li className="flex justify-between gap-2">
              <span>ביטוח לאומי</span>
              <span>{formatCurrency(taxes.nationalInsurance)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>ביטוח בריאות / מס בריאות</span>
              <span>{formatCurrency(taxes.healthInsurance)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>מס הכנסה</span>
              <span>{formatCurrency(taxes.incomeTax)}</span>
            </li>
            <li className="flex justify-between gap-2 border-t border-slate-200 pt-1 font-semibold">
              <span>סה״כ מסים</span>
              <span>{formatCurrency(taxes.total)}</span>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold text-indigo-700">פנסיה / גמל (עובד)</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            <li className="flex justify-between gap-2">
              <span>ניכוי עובד</span>
              <span>{formatCurrency(pension.employee)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>הפרשת מעסיק</span>
              <span>{formatCurrency(pension.employer)}</span>
            </li>
            {pension.severanceEmployer != null && pension.severanceEmployer > 0 && (
              <li className="flex justify-between gap-2">
                <span>פיצויים (מעסיק)</span>
                <span>{formatCurrency(pension.severanceEmployer)}</span>
              </li>
            )}
          </ul>
          {pension.lines && pension.lines.length > 0 && (
            <div className="mt-2 space-y-1 border-t border-slate-200 pt-2">
              {pension.lines.map((line, i) => (
                <div
                  key={i}
                  className="flex justify-between gap-2 text-[10px] text-slate-500"
                >
                  <span>
                    {line.fund ?? line.type ?? `שורה ${i + 1}`}
                    {line.base ? ` · בסיס ${formatCurrency(line.base)}` : ""}
                  </span>
                  <span>
                    {formatCurrency(line.employee)} / {formatCurrency(line.employer)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-violet-700">קרן השתלמות</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            <li className="flex justify-between gap-2">
              <span>ניכוי עובד</span>
              <span>{formatCurrency(keren.employee)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span>הפרשת מעסיק</span>
              <span>{formatCurrency(keren.employer)}</span>
            </li>
          </ul>
        </div>

        {breakdown.extraDeductions && breakdown.extraDeductions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-700">ניכויי חובה נוספים</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
              {breakdown.extraDeductions.map((line, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {line.description}
                    {line.period ? ` · ${line.period}` : ""}
                  </span>
                  <span>{formatCurrency(line.amount)}</span>
                </li>
              ))}
              {breakdown.otherDeductions != null && (
                <li className="flex justify-between gap-2 border-t border-slate-200 pt-1 font-semibold">
                  <span>סה״כ</span>
                  <span>{formatCurrency(breakdown.otherDeductions)}</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {breakdown.payments && breakdown.payments.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-700">פירוט תשלומים</p>
            <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
              {breakdown.payments.map((line, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {line.code ? `${line.code} ` : ""}
                    {line.description}
                    {line.period ? ` · ${line.period}` : ""}
                  </span>
                  <span>{formatCurrency(line.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
