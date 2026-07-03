"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AppIcon } from "@/components/qr/app-icon";

/**
 * Unified page header for every top-level screen (My Website, Generate QR,
 * Bookings, Profile control, Settings): an optional back arrow, a brand-gradient
 * icon badge (lucide `Icon` OR an app SVG via `iconSvg`), a bold title, an
 * optional subtitle, and an optional trailing `actions` slot. Pair with the
 * standard `mx-auto max-w-5xl p-4 sm:p-6` container so all pages share one shape.
 */
export function PageHeader({
  Icon,
  iconSvg,
  title,
  subtitle,
  backHref,
  actions,
}: {
  Icon?: LucideIcon;
  /** App SVG path (e.g. "/nav/portfolio.svg") — recolored white on the badge. */
  iconSvg?: string;
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Back"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="size-5 rotate-180 rtl:rotate-0" />
          </Link>
        )}
        {(Icon || iconSvg) && (
          <span className="brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
            {Icon ? (
              <Icon className="size-5" />
            ) : (
              <AppIcon src={iconSvg!} className="size-5 text-white" />
            )}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
