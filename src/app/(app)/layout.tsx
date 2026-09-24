import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ShellClient } from "@/components/app-shell/shell-client";
import { AppToaster } from "@/components/ui/sonner";
import { getQuickAddLookups } from "@/lib/tenant-data";
import { ensureDbSchema } from "@/lib/ensure-schema";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await ensureDbSchema();
  const quickAddLookups = await getQuickAddLookups(session.user.id);

  return (
    <>
      <ShellClient userName={session.user.name} quickAddLookups={quickAddLookups}>
        {children}
      </ShellClient>
      <AppToaster />
    </>
  );
}
