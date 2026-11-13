"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-shell/sidebar";
import { TopHeader } from "@/components/app-shell/top-header";
import { MobileBottomNav } from "@/components/app-shell/mobile-bottom-nav";
import { QuickAddSheet, type QuickAddLookups } from "@/components/app-shell/quick-add-sheet";
import { SIDEBAR_COOKIE } from "@/components/app-shell/nav-config";

export function ShellClient({
  children,
  userName,
  userEmail,
  quickAddLookups,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  quickAddLookups: QuickAddLookups;
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const toggleSidebar = () => {
    setCollapsed((v) => {
      const next = !v;
      document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-float"
      >
        تخطَّ إلى المحتوى
      </a>
      <div className="hidden lg:block">
        <AppSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </div>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <TopHeader
          onOpenQuickAdd={() => setQuickAddOpen(true)}
          userName={userName}
          userEmail={userEmail}
        />
        <main
          id="main"
          className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-hidden px-4 pb-32 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8"
        >
          {children}
        </main>
      </div>
      <MobileBottomNav onOpenQuickAdd={() => setQuickAddOpen(true)} />
      <QuickAddSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        lookups={quickAddLookups}
      />
    </div>
  );
}
