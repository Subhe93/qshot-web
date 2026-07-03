"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";

/**
 * Shared admin UI kit. A small set of responsive, presentational building
 * blocks so every admin screen shares one design language: a wide centered
 * shell, a header with a back arrow + icon badge, responsive card grids, and
 * professional icon + description cards that work in a 1-col mobile stack and a
 * multi-col desktop grid alike.
 *
 * Reuses the app's real Tailwind tokens (border, bg-card, text-muted-foreground,
 * brand-gradient, rounded-2xl) and lucide-react icons — no new design system.
 */

/* -------------------------------------------------------------------------- */
/* Shell                                                                       */
/* -------------------------------------------------------------------------- */

/** Responsive page container: comfortable padding, wide centered max width. */
export function AdminShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Admin page header — delegates to the shared `PageHeader` so admin screens use
 * the exact same header shape as My Website / Generate QR / Bookings / Settings.
 */
export function AdminHeader({
  title,
  description,
  backHref,
  Icon,
  actions,
}: {
  title: string;
  description?: string;
  backHref?: string;
  Icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      subtitle={description}
      backHref={backHref}
      Icon={Icon}
      actions={actions}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Grid                                                                        */
/* -------------------------------------------------------------------------- */

/** Responsive card grid. Default 3-up on xl; pass cols={2} to cap at 2-up. */
export function AdminGrid({
  children,
  cols = 3,
  className,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2",
        cols === 3 && "xl:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export interface AdminCardProps {
  Icon: LucideIcon;
  title: string;
  description?: string;
  /** Navigate via next-intl Link. Takes precedence over onClick. */
  href?: string;
  onClick?: () => void;
  /** Icon-badge tint (any CSS color). Ignored when danger. Defaults to brand gradient. */
  accent?: string;
  danger?: boolean;
  /** Custom trailing node. Defaults to a chevron when interactive. */
  trailing?: React.ReactNode;
  /** Small pill shown top-end (e.g. a count or status). */
  badge?: React.ReactNode;
  className?: string;
}

/**
 * A professional action/navigation card: tinted icon badge, bold title, muted
 * multi-line description, trailing chevron. Renders as a Link when href is set,
 * a button when onClick is set, else a static div. Looks great 1-col or in a grid.
 */
export function AdminCard({
  Icon,
  title,
  description,
  href,
  onClick,
  accent,
  danger,
  trailing,
  badge,
  className,
}: AdminCardProps) {
  const interactive = Boolean(href || onClick);

  const badgeStyle = danger
    ? { background: "color-mix(in srgb, var(--error) 14%, transparent)", color: "var(--error)" }
    : accent
      ? { background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }
      : undefined;

  const content = (
    <>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            !danger && !accent && "brand-gradient text-white",
          )}
          style={badgeStyle}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                "truncate text-sm font-semibold",
                danger ? "text-error" : "text-foreground",
              )}
            >
              {title}
            </h3>
            {badge}
          </div>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {interactive &&
          (trailing ?? (
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          ))}
        {!interactive && trailing}
      </div>
    </>
  );

  const base = cn(
    "block rounded-2xl border border-border bg-card p-4 text-start shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:p-5",
    interactive && "transition-colors hover:bg-muted/50",
    danger && "border-error/30",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={base}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(base, "w-full")}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}

/* -------------------------------------------------------------------------- */
/* Extras                                                                      */
/* -------------------------------------------------------------------------- */

/** Small uppercase section label above a group of cards. */
export function AdminSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

/** A compact stat card: big value + muted label + optional icon. */
export function AdminStatCard({
  Icon,
  value,
  label,
  accent,
}: {
  Icon?: LucideIcon;
  value: React.ReactNode;
  label: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
      {Icon && (
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-2xl",
            !accent && "brand-gradient text-white",
          )}
          style={
            accent
              ? {
                  background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                  color: accent,
                }
              : undefined
          }
        >
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
