"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/app-shell/sidebar";
import { TopHeader } from "@/components/app-shell/top-header";
import { AppFooter } from "@/components/app-shell/footer";
import { MobileBottomNav } from "@/components/app-shell/mobile-bottom-nav";
import { QuickAddSheet, type QuickAddLookups } from "@/components/app-shell/quick-add-sheet";

export function ShellClient({
  children,
  userName,
  quickAddLookups,
}: {
  children: React.ReactNode;
  userName?: string | null;
  quickAddLookups: QuickAddLookups;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <main className="flex min-h-screen min-w-0 flex-1 flex-col">
        <TopHeader onOpenQuickAdd={() => setQuickAddOpen(true)} userName={userName} />
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-36 sm:px-6 sm:py-6 lg:pb-28">
          {children}
        </div>
        <AppFooter />
      </main>
      <div className="hidden lg:block">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      </div>
      <MobileBottomNav />
      <QuickAddSheet
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        lookups={quickAddLookups}
      />
    </div>
  );
}
