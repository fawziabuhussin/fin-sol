import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>الإعدادات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600">
          <p>إدارة الملف الشخصي، اللغة، والإعدادات الأمنية.</p>
          <div className="flex flex-wrap gap-3">
            <Link className="underline" href="/settings/profile">
              الملف الشخصي
            </Link>
            <Link className="underline" href="/settings/security">
              الأمان
            </Link>
            <Link className="underline" href="/settings/preferences">
              التفضيلات
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">قانوني ودعم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["/privacy", "سياسة الخصوصية"],
            ["/terms", "شروط الاستخدام"],
            ["/support", "الدعم والتواصل"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 font-medium text-slate-800 hover:bg-slate-50"
            >
              {label}
              <span className="text-slate-400">←</span>
            </Link>
          ))}
          <p className="pt-2 text-xs text-slate-500">Fin$ol v1.0.0 · iOS & Web</p>
        </CardContent>
      </Card>
    </div>
  );
}
