import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ShellClient } from "@/components/app-shell/shell-client";
import { SIDEBAR_COOKIE } from "@/components/app-shell/nav-config";
import { AppToaster } from "@/components/ui/sonner";
import { getQuickAddLookups } from "@/lib/tenant-data";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const [quickAddLookups, cookieStore] = await Promise.all([
    getQuickAddLookups(session.user.id),
    cookies(),
  ]);

  return (
    <>
      <ShellClient
        userName={session.user.name}
        userEmail={session.user.email}
        quickAddLookups={quickAddLookups}
        initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "1"}
      >
        {children}
      </ShellClient>
      <AppToaster />
    </>
  );
}
