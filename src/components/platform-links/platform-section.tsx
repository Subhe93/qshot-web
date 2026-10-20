"use client";

import { useLocale, useTranslations } from "next-intl";
import { Ban, Globe, Link2Off, MousePointerClick, Pencil, Plus, QrCode, Tag, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_DOMAIN } from "@/lib/site-domain";
import type { PlatformCode, PlatformEntry } from "@/lib/platform-redirect/model";
import { CopyButton, PlatformIcon, StatusBadge } from "./bits";
import { displayUrl, formatRelative } from "./copy";

export interface SectionActions {
  onAddLink: (entry: PlatformEntry) => void;
  onEditLink: (entry: PlatformEntry) => void;
  onDeleteLink: (entry: PlatformEntry) => void;
  onLinkCard: (entry: PlatformEntry) => void;
  onRename: (entry: PlatformEntry, code: PlatformCode) => void;
  onUnlink: (entry: PlatformEntry, code: PlatformCode) => void;
}

/**
 * One platform (integration guide §7.1 layout, §7.2 rendering rules): brand
 * tile + admin-editable `label`, status badge, the link block, the cards list.
 * `paused` hides "Edit link" and "Link a card" but keeps Rename, Unlink and
 * Delete link.
 */
export function PlatformSection({ entry, actions }: { entry: PlatformEntry; actions: SectionActions }) {
  const t = useTranslations("platformLinks");
  const locale = useLocale();
  const active = entry.status === "active";
  const link = entry.link;

  return (
    <section
      data-platform={entry.platform}
      data-status={entry.status}
      aria-labelledby={`platform-${entry.platform}-title`}
      className={cn(
        "overflow-hidden rounded-3xl border border-border bg-card shadow-soft",
        !active && "border-dashed",
      )}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
        <PlatformIcon platform={entry.platform} label={entry.label} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h2 id={`platform-${entry.platform}-title`} className="truncate text-lg font-bold text-foreground">
              {entry.label}
            </h2>
            <StatusBadge status={entry.status} />
          </div>
          <p dir="ltr" className="truncate text-xs text-foreground/50 rtl:text-right">
            {`${SITE_DOMAIN}/${entry.path}/•••••`}
          </p>
        </div>
        {active && (
          <button
            type="button"
            onClick={() => actions.onLinkCard(entry)}
            // Full-width on its own row on phones so the platform title never
            // truncates beside it; inline at the end of the row from `sm`.
            className="brand-gradient inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-[0_5px_12px_rgba(68,136,255,0.25)] transition-opacity hover:opacity-90 sm:w-auto"
          >
            <Plus className="size-4" aria-hidden />
            {t("linkCard")}
          </button>
        )}
      </div>

      {!active && (
        <p className="mx-4 mt-3 rounded-xl bg-warning/10 px-3.5 py-2.5 text-xs leading-relaxed text-[#8a5a00] sm:mx-5">
          {t("pausedNote")}
        </p>
      )}

      {/* Link block */}
      <div className="px-4 pt-4 sm:px-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/50">{t("yourLink")}</p>
        {link ? (
          <div data-testid="link-block" className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/60 p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border">
              <Globe className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 basis-40">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                dir="ltr"
                title={link.url}
                className="block truncate text-sm font-semibold text-foreground hover:underline rtl:text-right"
              >
                {displayUrl(link.url)}
              </a>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-foreground/55">
                {link.host && (
                  <span dir="ltr" className="rounded-md bg-card px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-border">
                    {link.host}
                  </span>
                )}
                {link.updatedAt && <span>{t("updated", { when: formatRelative(link.updatedAt, locale) })}</span>}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <CopyButton value={link.url} label={t("copyLink")} />
              {active && (
                <button
                  type="button"
                  onClick={() => actions.onEditLink(entry)}
                  aria-label={t("editLink")}
                  title={t("editLink")}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
              )}
              <button
                type="button"
                onClick={() => actions.onDeleteLink(entry)}
                aria-label={t("deleteLink")}
                title={t("deleteLink")}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-error/10 hover:text-error"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </div>
        ) : active ? (
          <button
            type="button"
            data-testid="link-empty"
            onClick={() => actions.onAddLink(entry)}
            className="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-3 text-start transition-colors hover:border-primary/60 hover:bg-primary/[0.06]"
          >
            <span className="brand-tint flex size-9 shrink-0 items-center justify-center rounded-lg text-primary">
              <Plus className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-primary">{t("addLink", { label: entry.label })}</span>
              <span className="block text-xs text-foreground/55">{t("noLinkDesc", { label: entry.label })}</span>
            </span>
          </button>
        ) : (
          <div data-testid="link-empty" className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground/40">
              <Link2Off className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground/70">{t("noLink")}</span>
              <span className="block text-xs text-foreground/50">{t("noLinkDesc", { label: entry.label })}</span>
            </span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
            {t("cards")}
            {entry.codes.length > 0 && (
              <span className="ms-1.5 rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] tabular-nums normal-case tracking-normal text-foreground/70">
                {entry.codes.length}
              </span>
            )}
          </p>
        </div>
        {entry.codes.length === 0 ? (
          <div data-testid="cards-empty" className="flex flex-col items-center rounded-2xl bg-muted/60 px-4 py-6 text-center">
            <QrCode className="size-8 text-foreground/25" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-foreground/70">{t("noCards")}</p>
            <p className="mt-0.5 max-w-xs text-xs text-foreground/50">{t("noCardsDesc")}</p>
            {active && (
              <button
                type="button"
                onClick={() => actions.onLinkCard(entry)}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground hover:bg-muted"
              >
                <Plus className="size-3.5" aria-hidden />
                {t("linkCard")}
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {entry.codes.map((code) => (
              <CardRow key={code.code} entry={entry} code={code} actions={actions} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CardRow({ entry, code, actions }: { entry: PlatformEntry; code: PlatformCode; actions: SectionActions }) {
  const t = useTranslations("platformLinks");
  const locale = useLocale();
  const disabled = code.status === "disabled";

  return (
    <li
      data-code={code.code}
      data-code-status={code.status}
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 bg-card p-3 sm:px-4", disabled && "bg-muted/40")}
    >
      {/* Big code */}
      <span
        dir="ltr"
        className={cn(
          "rounded-xl bg-foreground px-3 py-1.5 font-mono text-xl font-bold tabular-nums tracking-[0.18em] text-white",
          disabled && "bg-foreground/35",
        )}
      >
        {code.code}
      </span>

      <div className={cn("min-w-0 flex-1 basis-40", disabled && "opacity-60")}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {code.label ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-foreground">
              <Tag className="size-3.5 shrink-0 text-foreground/40" aria-hidden />
              <span className="truncate">{code.label}</span>
            </span>
          ) : (
            <span className="text-sm text-foreground/45">{t("noName")}</span>
          )}
          {disabled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.08] px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
              <Ban className="size-3" aria-hidden />
              {t("disabledCard")}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-foreground/55">
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="size-3.5" aria-hidden />
            {t("scans", { count: code.hits })}
          </span>
          {code.lastHitAt && <span>· {t("lastScan", { when: formatRelative(code.lastHitAt, locale) })}</span>}
        </div>
        {code.url && (
          <div className="mt-1 flex items-center gap-1">
            <span dir="ltr" className="truncate font-mono text-[11px] text-foreground/50 rtl:text-right">
              {displayUrl(code.url, 44)}
            </span>
            <CopyButton value={code.url} label={t("copyCardUrl")} size="sm" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => actions.onRename(entry, code)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-foreground hover:bg-muted"
        >
          <Pencil className="size-3.5" aria-hidden />
          {t("rename")}
        </button>
        <button
          type="button"
          onClick={() => actions.onUnlink(entry, code)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-error hover:bg-error/10"
        >
          <Link2Off className="size-3.5" aria-hidden />
          {t("unlink")}
        </button>
      </div>
    </li>
  );
}
