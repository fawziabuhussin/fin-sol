import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q = "" } = await searchParams;

  const [projects, transactions] = await Promise.all([
    prisma.project.findMany({
      where: {
        userId: user.id,
        title: { contains: q, mode: "insensitive" },
      },
      take: 20,
    }),
    prisma.transaction.findMany({
      where: {
        userId: user.id,
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: { occurredAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">نتائج البحث: {q || "..."}</h1>
      <Card>
        <CardHeader>
          <CardTitle>المشاريع</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block rounded-xl border border-slate-100 p-3 hover:bg-slate-50">
              {p.title}
            </Link>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>المعاملات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-100 p-3">
              <p className="font-medium text-slate-900">{t.description || "بدون وصف"}</p>
              <p className="text-xs text-slate-500">{t.occurredAt.toISOString().slice(0, 10)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
