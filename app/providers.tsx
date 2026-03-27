"use client";

import { Toaster } from "sonner";
import { InstallPrompt } from "@/components/pwa/install-prompt";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <InstallPrompt />
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            background: "rgba(15, 23, 42, 0.96)",
            color: "#eef2ff",
            border: "1px solid rgba(148, 163, 184, 0.14)"
          }
        }}
      />
    </>
  );
}
