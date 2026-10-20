"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { BarChart3, CreditCard, Layers, LifeBuoy, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const PLATFORM_CARDS_BASE = "/admin/platform-cards";

const TABS: { key: string; href: string; Icon: LucideIcon; exact?: boolean }[] = [
  { key: "overview", href: PLATFORM_CARDS_BASE, Icon: BarChart3, exact: true },
  { key: "platforms", href: `${PLATFORM_CARDS_BASE}/platforms`, Icon: Settings2 },
  { key: "batches", href: `${PLATFORM_CARDS_BASE}/batches`, Icon: Layers },
  { key: "cards", href: `${PLATFORM_CARDS_BASE}/cards`, Icon: CreditCard },
  { key: "support", href: `${PLATFORM_CARDS_BASE}/support`, Icon: LifeBuoy },
];

/**
 * Section navigation: a pill tab bar on desktop, a horizontally scrolling
 * segmented control on phones. Each tab is a real route so every screen is
 * deep-linkable (batch detail lives under /batches/:id and keeps that tab lit).
 */
export function PlatformCardsTabs() {
  const t = useTranslations("adminPlatformCards.tabs");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("aria")}
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <div className="inline-flex min-w-full gap-1 rounded-2xl border border-border bg-card p-1 shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:min-w-0">
        {TABS.map(({ key, href, Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:flex-none sm:px-4 sm:text-sm",
                active
                  ? "brand-gradient text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
