import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfileSettingsPage() {
  const session = await auth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>الملف الشخصي</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-600">
        <p>الاسم: {session?.user?.name ?? "—"}</p>
        <p>البريد: {session?.user?.email ?? "—"}</p>
      </CardContent>
    </Card>
  );
}
