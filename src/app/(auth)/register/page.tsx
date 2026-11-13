"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput, PasswordStrength, passwordScore } from "@/components/auth/password-field";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { meetsPolicy } = passwordScore(password);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!meetsPolicy) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل وتتضمن حروفاً وأرقاماً.");
      return;
    }
    setLoading(true);
    setError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "تعذّر إنشاء الحساب");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email: email.trim(), password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="أنشئ حسابك"
      subtitle="دقيقة واحدة وتبدأ بمتابعة أموالك."
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-800">
            سجّل الدخول
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div>
          <Label htmlFor="name">الاسم</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="h-11"
            maxLength={80}
            required
          />
        </div>
        <div>
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <Input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            className="h-11 text-right"
            placeholder="name@example.com"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">كلمة المرور</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="h-11"
            required
          />
          <PasswordStrength password={password} />
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}
        <Button
          disabled={loading || !name.trim() || !email || !password}
          className="h-11 w-full"
          variant="brand"
          type="submit"
        >
          {loading ? "جارٍ إنشاء الحساب…" : (
            <>
              إنشاء الحساب <ArrowLeft className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
