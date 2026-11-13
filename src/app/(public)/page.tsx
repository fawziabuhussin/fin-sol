import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Coins,
  Download,
  FolderKanban,
  KeyRound,
  Lock,
  Repeat,
  WalletCards,
  Zap,
} from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

const FEATURES = [
  { icon: BarChart3, title: "لوحة شهرية واضحة", text: "كم دخل، كم خرج، وكم تبقّى — مع تصنيف ذكي لكل مصروف." },
  { icon: Repeat, title: "اشتراكات تحت السيطرة", text: "مواعيد الخصم، التكلفة السنوية الحقيقية، وتسجيل الدفع بضغطة." },
  { icon: Zap, title: "إضافة في ثوانٍ", text: "قهوة، بقالة، وقود — سجّل أي مصروف أو دخل من أي شاشة." },
  { icon: Coins, title: "ادخار وأصول", text: "جمعيات، ذهب ودولار بأسعار السوق الحيّة، وأهداف ادخار." },
  { icon: WalletCards, title: "متابعة الراتب", text: "قسائم الراتب، الضرائب والتقاعد — كل شهر في مكانه." },
  { icon: FolderKanban, title: "مشاريع وأقساط", text: "ميزانية لكل مشروع، وجدول أقساط يذكّرك بالموعد القادم." },
];

const PREVIEW_ROWS = [
  { name: "Netflix", color: "#E50914", amount: "₪ 55", status: "مدفوع", paid: true },
  { name: "Spotify", color: "#1DB954", amount: "₪ 24", status: "خلال 3 أيام", paid: false },
  { name: "iCloud+", color: "#111827", amount: "₪ 12", status: "يُجدَّد 18", paid: false },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-hairline/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Logo showSubtitle={false} />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">دخول</Link>
            </Button>
            <Button asChild variant="brand">
              <Link href="/register">ابدأ الآن</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[36rem] max-w-4xl rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-2 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-card">
              <Lock className="h-3.5 w-3.5" /> خاص وآمن · بالعربية
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              اعرف أين يذهب
              <br />
              <span className="bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent">كل شيكل.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              Fin$ol يجمع دخلك ومصروفاتك واشتراكاتك وادخارك في مكان واحد — لتتأكد أن ما يدخل أكثر مما
              يخرج، كل شهر.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="brand" size="lg">
                <Link href="/register">
                  أنشئ حسابك <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">لديّ حساب</Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              {["إعداد في دقيقة", "بياناتك لك وحدك", "على الويب و iPhone"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Product preview (illustrative) */}
          <div className="relative" aria-hidden>
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-indigo-100 to-violet-100 opacity-70 blur-xl" />
            <div className="relative rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-float backdrop-blur">
              <div className="rounded-2xl bg-[#0B1220] p-5 text-white">
                <p className="text-xs text-white/60">المتبقي للدفع هذا الشهر</p>
                <p className="mt-1 text-3xl font-bold">₪ 1,240</p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[62%] rounded-full bg-gradient-to-l from-emerald-300 to-emerald-500" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["الدخل", "₪ 12,400"],
                    ["المصروفات", "₪ 8,960"],
                    ["الادخار", "₪ 2,200"],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl bg-white/[0.06] py-2">
                      <p className="text-[10px] text-white/50">{l}</p>
                      <p className="text-sm font-semibold">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {PREVIEW_ROWS.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 px-1 py-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${r.paid ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}
                    >
                      {r.paid && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white" style={{ backgroundColor: r.color }}>
                      {r.name[0]}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{r.name}</span>
                      <span className={`block text-xs ${r.paid ? "text-emerald-600" : "text-slate-500"}`}>{r.status}</span>
                    </span>
                    <span className="text-sm font-bold text-slate-900">{r.amount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-hairline bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">كل ما تحتاجه، ولا شيء زائد</h2>
            <p className="mt-3 text-slate-600">أدوات بسيطة تُغنيك عن جداول الإكسل والدفاتر المتفرّقة.</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="bg-white p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 rounded-3xl bg-[#0B1220] p-8 text-white sm:p-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">أموالك شأن خاص.</h2>
            <p className="mt-4 leading-relaxed text-white/60">
              صمّمنا Fin$ol ليكون مكاناً آمناً لأكثر بياناتك حساسية — بدون إعلانات، وبدون بيع بيانات.
            </p>
          </div>
          <ul className="space-y-5">
            {[
              { icon: Lock, t: "اتصال مشفّر دائماً", d: "كل الاتصالات عبر HTTPS، وكلمات المرور مخزّنة بتجزئة bcrypt." },
              { icon: KeyRound, t: "حماية الدخول", d: "حظر تلقائي للمحاولات المتكررة، وإنهاء كل الجلسات بضغطة." },
              { icon: Download, t: "تحكّم كامل", d: "نزّل نسخة من بياناتك أو احذف حسابك نهائياً في أي وقت." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] ring-1 ring-inset ring-white/10">
                  <Icon className="h-5 w-5 text-indigo-300" />
                </span>
                <div>
                  <p className="font-semibold">{t}</p>
                  <p className="mt-0.5 text-sm text-white/55">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-5 pb-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">ابدأ الشهر القادم بوضوح.</h2>
        <p className="mt-3 text-slate-600">سجّل أول مصروف خلال أقل من دقيقة.</p>
        <Button asChild variant="brand" size="lg" className="mt-8">
          <Link href="/register">
            أنشئ حسابك <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
      </section>

      <footer className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row">
          <Logo showSubtitle={false} markClassName="h-8 w-8" />
          <nav className="flex gap-6">
            <Link href="/support" className="hover:text-slate-800">الدعم</Link>
            <Link href="/privacy" className="hover:text-slate-800">الخصوصية</Link>
            <Link href="/terms" className="hover:text-slate-800">الشروط</Link>
          </nav>
          <p className="text-xs">© {new Date().getFullYear()} Fin$ol</p>
        </div>
      </footer>
    </div>
  );
}
