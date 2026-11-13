import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app-shell/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      <PageHeader
        title={q ? `نتائج البحث عن «${q}»` : "البحث"}
        description="ابحث في المشاريع ووصف المعاملات وملاحظاتها."
      />
      <form action="/search" role="search" className="flex gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="مثال: سوبرماركت، إيجار، Netflix…"
          aria-label="كلمة البحث"
          className="h-11 flex-1"
        />
        <Button type="submit" className="h-11">بحث</Button>
      </form>
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
