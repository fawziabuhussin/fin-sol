import Link from "next/link";
import { BellRing, PieChart, ShieldCheck } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";

const POINTS = [
  { icon: PieChart, title: "صورة كاملة لأموالك", text: "الدخل، المصروفات، الادخار والراتب — في لوحة واحدة واضحة." },
  { icon: BellRing, title: "لا اشتراك يفوتك", text: "مواعيد الدفع والتكلفة السنوية الحقيقية لكل خدمة." },
  { icon: ShieldCheck, title: "خصوصيتك أولاً", text: "بياناتك لك وحدك — نزّلها أو احذفها متى شئت." },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link href="/" className="w-fit lg:hidden" aria-label="الصفحة الرئيسية">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-8 text-center text-sm text-slate-500">{footer}</div>
        </div>
        <p className="text-center text-xs text-slate-400">
          بالمتابعة أنت توافق على{" "}
          <Link href="/terms" className="underline-offset-2 hover:underline">الشروط</Link> و
          <Link href="/privacy" className="underline-offset-2 hover:underline">سياسة الخصوصية</Link>
        </p>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#0B1220] p-12 text-white lg:flex lg:flex-col">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/30 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]"
        />

        <Link href="/" className="relative flex items-center gap-3" aria-label="الصفحة الرئيسية">
          <LogoMark className="h-11 w-11" />
          <span className="text-xl font-bold">
            Fin<span className="text-indigo-300">$</span>ol
          </span>
        </Link>

        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            أموالك، <span className="text-indigo-300">بوضوح تام.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            اعرف كم يدخل وكم يخرج كل شهر، وأين يذهب كل شيكل — بدون جداول معقّدة.
          </p>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-inset ring-white/10">
                  <Icon className="h-5 w-5 text-indigo-300" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-sm text-white/55">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Fin$ol — المالية الذكية</p>
      </aside>
    </div>
  );
}
