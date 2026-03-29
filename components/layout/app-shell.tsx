"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BrandMark } from "@/components/site-logo";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLiveCameraScreen = pathname.startsWith("/record/") && pathname !== "/record/new";

  return (
    <div className={cn("min-h-dvh", isLiveCameraScreen ? "h-dvh overflow-hidden pb-0" : "pb-24")}>
      {!isLiveCameraScreen ? (
        <header className="sticky top-0 z-40 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
          <div className="surface-panel mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-4 py-3">
            <BrandMark />
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-[0.24em] text-slate-300 uppercase">
              PWA Prototype
            </div>
          </div>
        </header>
      ) : null}
      <main
        className={cn(
          "mx-auto max-w-6xl px-4 pb-8",
          isLiveCameraScreen
            ? "h-dvh max-w-none px-0 pb-0 pt-0 overflow-hidden"
            : "pt-2"
        )}
      >
        {children}
      </main>
      {!isLiveCameraScreen ? <MobileNav /> : null}
    </div>
  );
}
