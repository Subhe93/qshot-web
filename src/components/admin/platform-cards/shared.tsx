"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Inbox,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  parseAdminError,
  parseAdminErrorSync,
  type AdminApiError,
  type BatchStatus,
  type CodeStatus,
  type Pagination,
  type PlatformCode,
  type PlatformStatus,
} from "@/lib/api/admin-platform-redirect";

/* -------------------------------------------------------------------------- */
/* Brand marks                                                                 */
/* -------------------------------------------------------------------------- */

const BRAND_FILES: Record<PlatformCode, string> = {
  google_reviews: "google.svg",
  instagram: "instagram.svg",
  tiktok: "tiktok.svg",
  whatsapp: "whatsapp.svg",
  facebook: "facebook.svg",
  snapchat: "snapchat.svg",
};

/** Original full-colour brand mark on a soft tile. Same SVG set the social-links block uses. */
export function PlatformMark({
  platform,
  size = 36,
  className,
}: {
  platform: PlatformCode | string;
  size?: number;
  className?: string;
}) {
  const file = BRAND_FILES[platform as PlatformCode];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border border-border bg-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {file ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/brand-icons/colored/${file}`}
          alt=""
          width={Math.round(size * 0.55)}
          height={Math.round(size * 0.55)}
          draggable={false}
        />
      ) : (
        <span className="text-xs font-bold text-muted-foreground">?</span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Pills                                                                       */
/* -------------------------------------------------------------------------- */

export type Tone = "success" | "warning" | "error" | "info" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-[#b57600]",
  error: "bg-error/12 text-error",
  info: "bg-primary/10 text-primary",
  muted: "bg-foreground/[0.06] text-muted-foreground",
};

export function Pill({
  tone = "muted",
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const platformStatusTone: Record<PlatformStatus, Tone> = {
  active: "success",
  paused: "warning",
  hidden: "muted",
};
export const codeStatusTone: Record<CodeStatus, Tone> = {
  unassigned: "muted",
  assigned: "success",
  disabled: "error",
};
export const batchStatusTone: Record<BatchStatus, Tone> = {
  generated: "warning",
  printed: "success",
  void: "error",
};

export function PlatformStatusPill({ status }: { status: PlatformStatus }) {
  const t = useTranslations("adminPlatformCards");
  return <Pill tone={platformStatusTone[status] ?? "muted"}>{t(`platformStatus.${status}`)}</Pill>;
}
export function CodeStatusPill({ status }: { status: CodeStatus }) {
  const t = useTranslations("adminPlatformCards");
  return <Pill tone={codeStatusTone[status] ?? "muted"}>{t(`codeStatus.${status}`)}</Pill>;
}
export function BatchStatusPill({ status }: { status: BatchStatus }) {
  const t = useTranslations("adminPlatformCards");
  return <Pill tone={batchStatusTone[status] ?? "muted"}>{t(`batchStatus.${status}`)}</Pill>;
}

/* -------------------------------------------------------------------------- */
/* Layout bits                                                                 */
/* -------------------------------------------------------------------------- */

export function Panel({
  children,
  className,
  title,
  description,
  actions,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-[0_2px_16px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/** Label + value row (detail drawers). */
export function KV({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "min-w-0 text-end font-medium text-foreground [overflow-wrap:anywhere]",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function EmptyState({
  Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  Icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-4 py-12 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2 p-4", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="size-9 shrink-0 animate-pulse rounded-xl bg-muted" />
          <span className="h-3 flex-1 animate-pulse rounded bg-muted" />
          <span className="h-3 w-16 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

/** Inline status line under a form or at the top of a panel. */
export function Notice({
  tone,
  children,
  className,
}: {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? AlertTriangle : tone === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
        tone === "error" && "bg-error/10 text-error",
        tone === "success" && "bg-success/10 text-success",
        tone === "info" && "bg-warning/15 text-[#8a5a00]",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                    */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Native select styled like `Input` — RTL-safe and keyboard-friendly. */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn("relative block", className)}>
      <select
        className="h-11 w-full appearance-none rounded-lg border border-input bg-card pe-9 ps-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => setCopied(true));
      }}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}

/** A code or URL with a copy affordance. */
export function CopyValue({
  value,
  display,
  mono = true,
  className,
}: {
  value: string;
  display?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  const tc = useTranslations("common");
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className={cn("min-w-0 truncate", mono && "font-mono text-xs")}>{display ?? value}</span>
      <CopyButton value={value} label={tc("copy")} />
    </span>
  );
}

export function Pager({
  pagination,
  onPage,
  className,
}: {
  pagination: Pagination | undefined;
  onPage: (page: number) => void;
  className?: string;
}) {
  const t = useTranslations("adminPlatformCards");
  if (!pagination || pagination.totalItems === 0) return null;
  const { currentPage, totalPages, totalItems, itemsPerPage } = pagination;
  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>{t("pager.range", { from, to, total: totalItems })}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          aria-label={t("pager.prev")}
          disabled={!pagination.hasPreviousPage}
          onClick={() => onPage(currentPage - 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </button>
        <span className="px-2 font-medium text-foreground">
          {t("pager.page", { page: currentPage, pages: totalPages })}
        </span>
        <button
          type="button"
          aria-label={t("pager.next")}
          disabled={!pagination.hasNextPage}
          onClick={() => onPage(currentPage + 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground disabled:opacity-40"
        >
          <ChevronRight className="size-4 rtl:rotate-180" />
        </button>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                       */
/* -------------------------------------------------------------------------- */

/** Locale-aware date/time formatter; `—` for null. */
export function useFormatDate() {
  const locale = useLocale();
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  return useCallback(
    (iso: string | null | undefined): string => {
      if (!iso) return "—";
      const ts = Date.parse(iso);
      return Number.isNaN(ts) ? iso : fmt.format(ts);
    },
    [fmt],
  );
}

export function useFormatNumber() {
  const locale = useLocale();
  const fmt = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  return useCallback((n: number | null | undefined) => (n == null ? "—" : fmt.format(n)), [fmt]);
}

/**
 * Maps every refusal from `admin-platform-redirect.ts` to a localized message
 * (api-design.md §6 by `error.code`; integration-guide.md §6 by `error.name`).
 * Extra fields (`max`, `issued`, `space`, `assignedCount`, …) are interpolated.
 */
export function useAdminErrorMessage() {
  const t = useTranslations("adminPlatformCards.errors");
  return useCallback(
    (err: AdminApiError): string => {
      if (err.kind === "code") {
        const x = err.extra as Record<string, string | number | undefined>;
        switch (err.code) {
          case "PENDING_BATCH":
            return t("PENDING_BATCH");
          case "SPACE_EXHAUSTED":
            return t("SPACE_EXHAUSTED", { issued: x.issued ?? "?", space: x.space ?? "?" });
          case "BATCH_HAS_ASSIGNED":
            return t("BATCH_HAS_ASSIGNED", { count: x.assignedCount ?? "?" });
          case "EXPORT_TOO_LARGE":
            return t("EXPORT_TOO_LARGE", { max: x.max ?? "?" });
          case "INVALID_LABEL":
            return t("INVALID_LABEL", { max: x.maxLength ?? "60" });
          case "HOST_NOT_ALLOWED":
            return t("HOST_NOT_ALLOWED", { host: x.host ?? "" });
          case "PLATFORM_UNKNOWN":
          case "PLATFORM_NOT_AVAILABLE":
          case "PLATFORM_PAUSED":
          case "INVALID_CODE":
          case "CODE_NOT_FOUND":
          case "CODE_DISABLED":
          case "CODE_ALREADY_ASSIGNED":
          case "BATCH_NOT_FOUND":
          case "BATCH_VOID":
          case "BATCH_PRINTED":
          case "INVALID_ID":
          case "USER_NOT_FOUND":
          case "FEATURE_DISABLED":
          case "INVALID_URL":
            return t(err.code);
          default:
            return t("unknownCode", { code: err.code });
        }
      }
      if (err.kind === "framework") {
        switch (err.name) {
          case "ThrottlerException":
            return t("throttled");
          case "UnauthorizedException":
            return t("unauthorized");
          case "BadRequestException":
            return t("badRequest", { detail: err.messages.join("; ") });
          default:
            return t("framework", { name: err.name });
        }
      }
      if (err.kind === "network") return t("network");
      return t("unknown", { status: err.status || "?" });
    },
    [t],
  );
}

/** Localized message for a query error (or null) — safe at render time. */
export function useLoadError(error: unknown): string | null {
  const msg = useAdminErrorMessage();
  return useMemo(() => (error ? msg(parseAdminErrorSync(error)) : null), [error, msg]);
}

/** `useMutation`-friendly: parse + translate in one step. */
export function useAdminErrorHandler(setError: (msg: string | null) => void) {
  const msg = useAdminErrorMessage();
  return useCallback(
    async (e: unknown) => {
      const parsed = await parseAdminError(e);
      setError(msg(parsed));
      return parsed;
    },
    [msg, setError],
  );
}
