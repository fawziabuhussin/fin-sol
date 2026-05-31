"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [householdName, setHouseholdName] = useState("المنزل");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, householdName }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "فشل التسجيل");
      setLoading(false);
      return;
    }

    await signIn("credentials", { email, password, redirect: false });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-xl">إنشاء حساب</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-600">الاسم</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                اسم المنزل / العائلة
              </label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">البريد</label>
              <input
                type="email"
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                كلمة المرور
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "جاري الإنشاء..." : "تسجيل"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            لديك حساب؟{" "}
            <Link href="/login" className="text-indigo-600 hover:underline">
              دخول
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
