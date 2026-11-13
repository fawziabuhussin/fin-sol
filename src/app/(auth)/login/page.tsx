"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/auth/password-field";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setLoading(false);
      setError(
        result?.code === "rate_limited"
          ? "محاولات كثيرة خاطئة. لحماية حسابك، انتظر 15 دقيقة ثم حاول مجدداً."
          : "البريد الإلكتروني أو كلمة المرور غير صحيحة."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell
      title="أهلاً بعودتك"
      subtitle="سجّل الدخول لمتابعة أموالك."
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-800">
            أنشئ حساباً
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={onSubmit} noValidate>
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
            autoComplete="current-password"
            className="h-11"
            required
          />
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}
        <Button disabled={loading || !email || !password} className="h-11 w-full" variant="brand" type="submit">
          {loading ? "جارٍ الدخول…" : (
            <>
              دخول <ArrowLeft className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
