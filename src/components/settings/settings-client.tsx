"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn, signOut } from "next-auth/react";
import { toast } from "sonner";
import {
  ChevronLeft,
  Download,
  FileText,
  KeyRound,
  LifeBuoy,
  LogOut,
  MonitorSmartphone,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PasswordInput, PasswordStrength, passwordScore } from "@/components/auth/password-field";

function Section({
  id,
  icon: Icon,
  title,
  description,
  children,
  tone = "default",
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <Card id={id} className="scroll-mt-24 overflow-hidden">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <div>
          <span
            className={
              tone === "danger"
                ? "flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600"
                : "flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
            }
          >
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </Card>
  );
}

async function jsonRequest(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: typeof data.error === "string" ? data.error : null };
}

function ProfileForm({ name: initialName, email, memberSince }: { name: string; email: string; memberSince: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();
  const dirty = name.trim() !== initialName && name.trim().length > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const { ok, error } = await jsonRequest("/api/account", "PATCH", { name: name.trim() });
          if (!ok) return void toast.error(error ?? "تعذّر الحفظ");
          toast.success("تم تحديث الاسم");
          router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">الاسم</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input id="email" value={email} disabled dir="ltr" className="text-right" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">عضو منذ {memberSince}</p>
        <Button type="submit" disabled={!dirty || isPending}>
          {isPending ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { meetsPolicy } = passwordScore(next);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!meetsPolicy) return setError("كلمة المرور الجديدة لا تستوفي الشروط");
        if (next !== confirm) return setError("تأكيد كلمة المرور غير مطابق");
        setError(null);
        startTransition(async () => {
          const { ok, error } = await jsonRequest("/api/account/password", "POST", {
            currentPassword: current,
            newPassword: next,
          });
          if (!ok) return setError(error ?? "تعذّر تغيير كلمة المرور");
          // All sessions were revoked server-side; sign this device back in.
          await signIn("credentials", { email, password: next, redirect: false });
          setCurrent("");
          setNext("");
          setConfirm("");
          toast.success("تم تغيير كلمة المرور", {
            description: "سُجّل خروج جميع الأجهزة الأخرى.",
          });
        });
      }}
    >
      <div>
        <Label htmlFor="current-password">كلمة المرور الحالية</Label>
        <PasswordInput
          id="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
          <PasswordInput
            id="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
          />
          <PasswordStrength password={next} />
        </div>
        <div>
          <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
          <PasswordInput
            id="confirm-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={confirm.length > 0 && confirm !== next}
            required
          />
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !current || !next}>
          <KeyRound className="h-4 w-4" />
          {isPending ? "جارٍ التحديث…" : "تغيير كلمة المرور"}
        </Button>
      </div>
    </form>
  );
}

function SessionsCard() {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MonitorSmartphone className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <div>
          <p className="text-sm font-semibold text-slate-800">تسجيل الخروج من كل الأجهزة</p>
          <p className="mt-0.5 text-xs text-slate-500">
            إن فقدت هاتفاً أو سجّلت الدخول من جهاز عام، أنهِ كل الجلسات فوراً.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const { ok } = await jsonRequest("/api/account/sessions", "DELETE");
            if (!ok) return void toast.error("تعذّر إنهاء الجلسات");
            await signOut({ callbackUrl: "/login" });
          })
        }
      >
        <LogOut className="h-4 w-4" /> إنهاء كل الجلسات
      </Button>
    </div>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-rose-900">حذف الحساب نهائياً</p>
          <p className="mt-0.5 text-xs text-rose-800/70">
            يحذف كل معاملاتك واشتراكاتك ومشاريعك وادخارك. لا يمكن التراجع.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" /> حذف الحساب
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const { ok, error } = await jsonRequest("/api/account", "DELETE", { password, confirm });
                if (!ok) return setError(error ?? "تعذّر حذف الحساب");
                await signOut({ callbackUrl: "/" });
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>حذف الحساب؟</DialogTitle>
              <DialogDescription>
                ننصحك بتنزيل نسخة من بياناتك أولاً. بعد الحذف لا يمكن استعادة أي شيء.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div>
                <Label htmlFor="delete-password">كلمة المرور</Label>
                <PasswordInput
                  id="delete-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="delete-confirm">
                  اكتب <span dir="ltr" className="font-mono font-bold text-rose-600">DELETE</span> للتأكيد
                </Label>
                <Input
                  id="delete-confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  dir="ltr"
                  autoComplete="off"
                />
              </div>
              {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending || confirm !== "DELETE" || !password}
              >
                {isPending ? "جارٍ الحذف…" : "حذف نهائي"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SettingsClient({
  name,
  email,
  memberSince,
}: {
  name: string;
  email: string;
  memberSince: string;
}) {
  return (
    <div className="space-y-5">
      <Section
        id="profile"
        icon={UserRound}
        title="الملف الشخصي"
        description="الاسم الذي يظهر في التطبيق والتقارير."
      >
        <ProfileForm name={name} email={email} memberSince={memberSince} />
      </Section>

      <Section
        id="security"
        icon={Shield}
        title="الأمان"
        description="غيّر كلمة المرور بانتظام. تغييرها يُنهي الجلسات على الأجهزة الأخرى تلقائياً."
      >
        <div className="space-y-6">
          <PasswordForm email={email} />
          <SessionsCard />
        </div>
      </Section>

      <Section
        id="data"
        icon={Download}
        title="بياناتك وخصوصيتك"
        description="بياناتك ملكك. نزّلها في أي وقت، أو احذف حسابك بالكامل."
        tone="default"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">تنزيل نسخة من بياناتك</p>
              <p className="mt-0.5 text-xs text-slate-500">ملف JSON يحتوي على كل ما سجّلته في Fin$ol.</p>
            </div>
            <Button asChild variant="outline">
              <a href="/api/account/export" download>
                <Download className="h-4 w-4" /> تنزيل
              </a>
            </Button>
          </div>
          <DeleteAccount />
        </div>
      </Section>

      <Card className="divide-y divide-slate-100">
        {[
          { href: "/support", label: "الدعم والتواصل", icon: LifeBuoy },
          { href: "/privacy", label: "سياسة الخصوصية", icon: Shield },
          { href: "/terms", label: "شروط الاستخدام", icon: FileText },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 px-5 py-4 text-sm font-medium text-slate-700 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-slate-50"
          >
            <Icon className="h-4 w-4 text-slate-400" />
            <span className="flex-1">{label}</span>
            <ChevronLeft className="h-4 w-4 text-slate-300" />
          </Link>
        ))}
      </Card>
      <p className="text-center text-xs text-slate-400">Fin$ol · الإصدار 1.1 · iOS والويب</p>
    </div>
  );
}
