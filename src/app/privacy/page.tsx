import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "سياسة خصوصية تطبيق Fin$ol — المالية الذكية",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="سياسة الخصوصية">
      <p>
        <strong>Fin$ol — المالية الذكية</strong> («التطبيق») يحترم خصوصيتك. توضّح
        هذه السياسة ما نجمعه وكيف نستخدمه.
      </p>

      <h2 className="text-lg font-bold text-slate-900">1. البيانات التي نجمعها</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>معلومات الحساب: الاسم، البريد الإلكتروني، كلمة المرور (مشفّرة).</li>
        <li>
          البيانات المالية التي تُدخلها: المعاملات، المشاريع، خطط الادخار،
          رواتب، وتلושات PDF التي ترفعها.
        </li>
        <li>بيانات الاستخدام التقنية: نوع الجهاز، المتصفح، وسجلات الأخطاء.</li>
      </ul>

      <h2 className="text-lg font-bold text-slate-900">2. كيف نستخدم البيانات</h2>
      <ul className="list-disc space-y-1 pr-5">
        <li>تشغيل التطبيق وعرض لوحاتك المالية.</li>
        <li>مزامنة الدخل والراتب والمعاملات داخل حسابك.</li>
        <li>تحسين الأمان والموثوقية.</li>
      </ul>
      <p>لا نبيع بياناتك الشخصية لأطراف ثالثة.</p>

      <h2 className="text-lg font-bold text-slate-900">3. التخزين والأمان</h2>
      <p>
        البيانات تُخزَّن على خوادم سحابية آمنة (PostgreSQL) عبر مزوّدين موثوقين.
        الاتصالات مشفّرة عبر HTTPS. كلمات المرور مُجزّأة (hashed) ولا تُخزَّن
        بنصّ واضح.
      </p>

      <h2 className="text-lg font-bold text-slate-900">4. ملفات PDF (תלוש)</h2>
      <p>
        عند رفع تلוש راتب، يُعالَج الملف لاستخراج الأرقام (מסים، פנסיה، וכו').
        لا نشارك محتوى التلוש مع أطراف خارجية.
      </p>

      <h2 className="text-lg font-bold text-slate-900">5. حقوقك</h2>
      <p>
        يمكنك طلب تصحيح أو حذف بياناتك عبر{" "}
        <a href="mailto:foze820@gmail.com" className="text-indigo-600">
          foze820@gmail.com
        </a>
        .
      </p>

      <h2 className="text-lg font-bold text-slate-900">6. التحديثات</h2>
      <p>آخر تحديث: يونيو 2026. قد نُحدّث هذه السياسة؛ سنُبلّغ عبر التطبيق عند الحاجة.</p>
    </LegalLayout>
  );
}
