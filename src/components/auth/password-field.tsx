"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PasswordInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        dir="ltr"
        className={cn("pl-10 text-right", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-700"
        aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

/** Mirrors the server policy (8+ chars, letters and digits) and grades extra strength. */
export function passwordScore(pw: string) {
  const meetsPolicy = pw.length >= 8 && /\p{L}/u.test(pw) && /\d/.test(pw);
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /\p{L}/u.test(pw)) score++;
  if (/[^\p{L}\d]/u.test(pw)) score++;
  return { meetsPolicy, level: meetsPolicy ? Math.min(4, Math.max(1, score - 1)) : pw ? 0 : -1 };
}

const LEVELS = [
  { label: "ضعيفة — 8 أحرف على الأقل مع حروف وأرقام", color: "bg-rose-500", text: "text-rose-600" },
  { label: "مقبولة", color: "bg-amber-500", text: "text-amber-600" },
  { label: "جيدة", color: "bg-lime-500", text: "text-lime-700" },
  { label: "قوية", color: "bg-emerald-500", text: "text-emerald-600" },
  { label: "قوية جداً", color: "bg-emerald-600", text: "text-emerald-700" },
];

export function PasswordStrength({ password }: { password: string }) {
  const { level } = passwordScore(password);
  if (level < 0) {
    return (
      <p className="mt-1.5 text-xs text-slate-500">8 أحرف على الأقل، تتضمن حروفاً وأرقاماً.</p>
    );
  }
  const meta = LEVELS[level]!;
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= Math.max(1, level) ? meta.color : "bg-slate-200"
            )}
          />
        ))}
      </div>
      <p className={cn("mt-1 text-xs font-medium", meta.text)}>{meta.label}</p>
    </div>
  );
}
