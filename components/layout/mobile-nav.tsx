"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Camera, FolderOpen, Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/" as Route,
    label: "Home",
    icon: Home
  },
  {
    href: "/record/new" as Route,
    label: "Record",
    icon: Camera
  },
  {
    href: "/projects" as Route,
    label: "Library",
    icon: FolderOpen
  },
  {
    href: "/settings" as Route,
    label: "Settings",
    icon: Settings
  }
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="surface-panel mx-auto flex max-w-lg items-center justify-between rounded-full px-2 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[4.5rem] flex-1 items-center justify-center gap-2 rounded-full px-3 py-3 text-xs font-medium transition",
                active ? "bg-cyan-300/15 text-cyan-200" : "text-slate-300 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
