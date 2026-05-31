import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PreferencesSettingsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>التفضيلات</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-slate-600">
        اللغة الافتراضية RTL والعملة ILS يمكن تخصيصهما لاحقاً.
      </CardContent>
    </Card>
  );
}
