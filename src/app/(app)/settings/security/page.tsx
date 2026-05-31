import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SecuritySettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الأمان</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        تحديث كلمة المرور وتفعيل 2FA ستكون ضمن المرحلة القادمة.
      </CardContent>
    </Card>
  );
}
