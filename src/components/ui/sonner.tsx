"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      dir="rtl"
      richColors
      closeButton
      toastOptions={{
        className: "font-sans !rounded-2xl !shadow-float",
      }}
    />
  );
}
