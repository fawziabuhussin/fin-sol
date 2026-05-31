import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الإعدادات</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <p>إدارة الملف الشخصي، اللغة، والإعدادات الأمنية.</p>
        <div className="flex gap-3">
          <Link className="underline" href="/settings/profile">الملف الشخصي</Link>
          <Link className="underline" href="/settings/security">الأمان</Link>
        </div>
      </CardContent>
    </Card>
  );
}
