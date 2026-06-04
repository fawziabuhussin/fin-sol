import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "الدعم",
  description: "دعم تطبيق Fin$ol",
};

export default function SupportPage() {
  return (
    <LegalLayout title="الدعم">
      <p>نحن هنا لمساعدتك في استخدام Fin$ol — المالية الذكية.</p>

      <h2 className="text-lg font-bold text-slate-900">تواصل معنا</h2>
      <ul className="list-none space-y-2">
        <li>
          <strong>البريد:</strong>{" "}
          <a href="mailto:foze820@gmail.com" className="text-indigo-600">
            foze820@gmail.com
          </a>
        </li>
        <li>
          <strong>الموقع:</strong>{" "}
          <a
            href="https://fin-sol-pied.vercel.app"
            className="text-indigo-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            fin-sol-pied.vercel.app
          </a>
        </li>
      </ul>

      <h2 className="text-lg font-bold text-slate-900">أسئلة شائعة</h2>
      <div className="space-y-3">
        <div>
          <p className="font-semibold text-slate-900">كيف أرفع תלוש שכר؟</p>
          <p>
            من صفحة الراتب → جهة العمل → اختر الشهر → «رفع תלוש (PDF)».
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">هل بياناتي آمنة؟</p>
          <p>
            نعم — كل حساب معزول، والاتصال مشفّر. راجع{" "}
            <a href="/privacy" className="text-indigo-600">
              سياسة الخصوصية
            </a>
            .
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900">نسخة التطبيق</p>
          <p>1.0.0 (iOS / Web)</p>
        </div>
      </div>
    </LegalLayout>
  );
}
