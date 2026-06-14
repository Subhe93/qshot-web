"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // Full-screen workspaces with their own chrome (builder, booking dashboard).
  if (pathname.startsWith("/builder") || pathname.endsWith("/booking")) {
    return <main className="h-dvh bg-background">{children}</main>;
  }

  return (
    <div className="flex w-full overflow-x-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawer(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 shadow-xl">
            <AppSidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar: logo (leading) + burger menu (trailing) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-3 md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.svg" alt="QShot" width={26} height={26} />
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Menu"
            className="flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-muted"
          >
            <Menu className="size-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
