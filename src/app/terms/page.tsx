import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "شروط الاستخدام",
  description: "شروط استخدام تطبيق Fin$ol",
};

export default function TermsPage() {
  return (
    <LegalLayout title="شروط الاستخدام">
      <p>
        باستخدامك <strong>Fin$ol</strong> («التطبيق») فإنك توافق على هذه الشروط.
      </p>

      <h2 className="text-lg font-bold text-slate-900">1. الخدمة</h2>
      <p>
        Fin$ol أداة شخصية لإدارة الدخل والمصروفات والادخار والراتب. لا يُقدّم
        استشارات مالية أو ضريبية أو استثمارية.
      </p>

      <h2 className="text-lg font-bold text-slate-900">2. حسابك</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>أنت مسؤول عن دقة البيانات التي تُدخلها.</li>
        <li>حافظ على سرّية كلمة المرور.</li>
        <li>لا تُشارك حسابك مع الآخرين.</li>
      </ul>

      <h2 className="text-lg font-bold text-slate-900">3. الاستخدام المقبول</h2>
      <p>
        يُمنع إساءة استخدام التطبيق، محاولة اختراقه، أو استخدامه لأغراض غير
        قانونية.
      </p>

      <h2 className="text-lg font-bold text-slate-900">4. إخلاء مسؤولية</h2>
      <p>
        التطبيق يُقدَّم «كما هو». لا نضمن دقة الحسابات التلقائية أو استخراج
        التلושات. راجع الأرقام قبل اتخاذ قرارات مالية.
      </p>

      <h2 className="text-lg font-bold text-slate-900">5. الإنهاء</h2>
      <p>
        يمكنك التوقف عن استخدام التطبيق في أي وقت. يمكننا تعليق الحسابات التي
        تُخالف هذه الشروط.
      </p>

      <h2 className="text-lg font-bold text-slate-900">6. التواصل</h2>
      <p>
        للأسئلة:{" "}
        <a href="mailto:foze820@gmail.com" className="text-indigo-600">
          foze820@gmail.com
        </a>
      </p>
    </LegalLayout>
  );
}
