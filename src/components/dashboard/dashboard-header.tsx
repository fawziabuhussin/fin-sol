"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const MONTHS = [
  { value: 1, label: "يناير" },
  { value: 2, label: "فبراير" },
  { value: 3, label: "مارس" },
  { value: 4, label: "أبريل" },
  { value: 5, label: "مايو" },
  { value: 6, label: "يونيو" },
  { value: 7, label: "يوليو" },
  { value: 8, label: "أغسطس" },
  { value: 9, label: "سبتمبر" },
  { value: 10, label: "أكتوبر" },
  { value: 11, label: "نوفمبر" },
  { value: 12, label: "ديسمبر" },
];

export function DashboardHeader({
  year,
  month,
  userName,
}: {
  year: number;
  month: number;
  userName?: string | null;
}) {
  const years = [2025, 2026, 2027];

  return (
    <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-[#F8F9FA]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-indigo-600">₪</span>
          <span className="font-semibold text-gray-900">المالية الذكية</span>
        </Link>

        <form className="flex items-center gap-2" method="get">
          <select
            name="month"
            defaultValue={month}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            name="year"
            defaultValue={year}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            تطبيق
          </Button>
        </form>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-gray-600 sm:inline">
            {userName ?? "مرحباً"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            خروج
          </Button>
        </div>
      </div>
    </header>
  );
}
