"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function NativeShell() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initNative() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/status-bar"),
        ]);

        await StatusBar.setStyle({ style: Style.Light });
        if (Capacitor.getPlatform() === "ios") {
          await StatusBar.setOverlaysWebView({ overlay: false });
        } else if (Capacitor.getPlatform() === "android") {
          await StatusBar.setBackgroundColor({ color: "#4F46E5" });
        }
        await SplashScreen.hide({ fadeOutDuration: 300 });

        const { Network } = await import("@capacitor/network");
        const status = await Network.getStatus();
        if (!cancelled) setOffline(!status.connected);

        const handle = await Network.addListener("networkStatusChange", (s) => {
          setOffline(!s.connected);
        });

        return () => {
          handle.remove();
        };
      } catch {
        /* web build — plugins optional */
      }
    }

    const cleanup = initNative();
    return () => {
      cancelled = true;
      cleanup.then((fn) => fn?.());
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-xs font-semibold text-white"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      لا يوجد اتصال بالإنترنت — بعض الميزات قد لا تعمل
    </div>
  );
}
