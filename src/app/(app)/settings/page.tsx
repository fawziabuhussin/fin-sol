import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/app-shell/page-header";
import { SettingsClient } from "@/components/settings/settings-client";
import { monthLabel } from "@/lib/finance-labels";

export const metadata: Metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const user = await requireUser();
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="الإعدادات" description="إدارة حسابك، الأمان، وبياناتك." />
      <SettingsClient
        name={profile.name ?? ""}
        email={profile.email}
        memberSince={`${monthLabel(profile.createdAt.getMonth() + 1)} ${profile.createdAt.getFullYear()}`}
      />
    </div>
  );
}
