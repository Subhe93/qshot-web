"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CloudOff, IdCard, Link as LinkIcon, QrCode, RefreshCw, ScanLine, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useUpgradeDialog } from "@/components/plan/upgrade-dialog";
import { accountEntry } from "@/lib/local-store";
import { SITE_DOMAIN } from "@/lib/site-domain";
import { cardDomainsOf, type CardUrlPlatform, type PlatformCode, type PlatformEntry } from "@/lib/platform-redirect/model";
import { PlatformRedirectError, PLATFORM_REDIRECT_ERROR_CODES } from "@/lib/platform-redirect/errors";
import { usePlatformRedirect, usePlatformRedirectActions, usePlatformRegistry } from "@/lib/platform-redirect/queries";
import { PlatformSection } from "./platform-section";
import { LinkSheet } from "./link-sheet";
import { ClaimSheet } from "./claim-sheet";
import { RenameSheet } from "./rename-sheet";
import { platformRedirectErrorMessage } from "./copy";

/** "How it works" intro, dismissed per account (never raw localStorage). */
const introDismissed = accountEntry<boolean>({
  name: "platform-links-intro-dismissed",
  fallback: false,
  validate: (v): v is boolean => typeof v === "boolean",
});

type Sheet =
  | { kind: "link"; platform: string }
  | { kind: "claim"; platform: string; code: string | null }
  | { kind: "rename"; platform: string; code: PlatformCode }
  | null;

type Confirm =
  | { kind: "unlink"; platform: string; code: PlatformCode }
  | { kind: "deleteLink"; platform: string }
  | null;

export interface DeepLinkClaim {
  platform: string;
  code: string | null;
}

/**
 * The Platform links section (integration guide §7). An ACCOUNT screen: works
 * with zero profiles and never reads profile data. Loads on mount, after every
 * write (local update + invalidate), on the refresh button, on window focus,
 * and on the plan-change signal (the live plan channel invalidates our key).
 */
export function PlatformLinksScreen({ deepLink }: { deepLink?: DeepLinkClaim | null }) {
  const t = useTranslations("platformLinks");
  const tc = useTranslations("common");
  const showUpgrade = useUpgradeDialog((s) => s.show);
  const query = usePlatformRedirect();
  const registry = usePlatformRegistry();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The (app) layout renders us only once the auth store has hydrated, so the
  // account scope is already resolvable here. The intro itself only renders
  // after the overview has loaded (client side), so SSR never sees it.
  const [introHidden, setIntroHidden] = useState(() => introDismissed.get());

  const overview = query.data;
  const platformOf = useCallback(
    (code: string) => overview?.platforms.find((p) => p.platform === code) ?? null,
    [overview],
  );

  // Global reactions to a refusal: a stale platform list reloads itself (the
  // actions hook invalidates); the message is shown as a page notice when no
  // sheet is open to carry it.
  const onActionError = useCallback(
    (error: PlatformRedirectError) => {
      if (error.isPlanError) showUpgrade();
      if (error.needsReload) {
        const label = error.extra.label ?? platformOf(error.extra.platform ?? "")?.label ?? "";
        setNotice(platformRedirectErrorMessage(error, t, label, tc("genericError")));
        setSheet(null);
      }
    },
    [showUpgrade, platformOf, t, tc],
  );
  const actions = usePlatformRedirectActions({ onError: onActionError });

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  // Deep link `?platform=…&code=…` (§7.6): open "Link a card" pre-filled once
  // the platform list is known. A paused or unknown platform gets a notice.
  // Deferred a tick so no set-state runs synchronously in the effect body
  // (react-hooks/set-state-in-effect); the ref makes it fire exactly once.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    if (!deepLink || deepLinkHandled.current || !overview) return;
    const id = setTimeout(() => {
      if (deepLinkHandled.current) return;
      deepLinkHandled.current = true;
      const entry = platformOf(deepLink.platform);
      if (!entry) {
        setNotice(t("errPlatformGone"));
        return;
      }
      if (entry.status !== "active") {
        setNotice(t("errPlatformPaused", { label: entry.label }));
        return;
      }
      setSheet({ kind: "claim", platform: entry.platform, code: deepLink.code });
    }, 0);
    return () => clearTimeout(id);
  }, [deepLink, overview, platformOf, t]);

  const sheetEntry = sheet ? platformOf(sheet.platform) : null;
  // A platform that turned `paused` under an open write sheet (a reload landed
  // mid-edit, §4): the sheet is withheld from render at once and closed with a
  // notice on the next tick.
  const sheetBlocked =
    sheet != null && sheet.kind !== "rename" && sheetEntry != null && sheetEntry.status !== "active";
  const blockedLabel = sheetBlocked ? sheetEntry.label : null;
  useEffect(() => {
    if (blockedLabel == null) return;
    const id = setTimeout(() => {
      setSheet(null);
      setNotice(t("errPlatformPaused", { label: blockedLabel }));
    }, 0);
    return () => clearTimeout(id);
  }, [blockedLabel, t]);

  const knownPlatforms: CardUrlPlatform[] = (() => {
    const map = new Map<string, CardUrlPlatform>();
    for (const p of registry.data ?? []) map.set(p.platform, { platform: p.platform, path: p.path, label: p.label });
    for (const p of overview?.platforms ?? []) map.set(p.platform, { platform: p.platform, path: p.path, label: p.label });
    return [...map.values()];
  })();

  const sectionActions = {
    onAddLink: (entry: PlatformEntry) => setSheet({ kind: "link", platform: entry.platform }),
    onEditLink: (entry: PlatformEntry) => setSheet({ kind: "link", platform: entry.platform }),
    onDeleteLink: (entry: PlatformEntry) => setConfirm({ kind: "deleteLink", platform: entry.platform }),
    onLinkCard: (entry: PlatformEntry) => setSheet({ kind: "claim", platform: entry.platform, code: null }),
    onRename: (entry: PlatformEntry, code: PlatformCode) => setSheet({ kind: "rename", platform: entry.platform, code }),
    onUnlink: (entry: PlatformEntry, code: PlatformCode) => setConfirm({ kind: "unlink", platform: entry.platform, code }),
  };

  async function runConfirm() {
    if (!confirm) return;
    const current = confirm;
    setConfirm(null);
    const outcome =
      current.kind === "unlink"
        ? await actions.unlink(current.platform, current.code.code)
        : await actions.removeLink(current.platform);
    if (!outcome.ok && !outcome.error.needsReload && !outcome.error.isPlanError) {
      const label = platformOf(current.platform)?.label ?? "";
      setNotice(platformRedirectErrorMessage(outcome.error, t, label, tc("genericError")));
    }
  }

  const loadError = query.error instanceof PlatformRedirectError ? query.error : null;
  const unavailable = loadError?.code === PLATFORM_REDIRECT_ERROR_CODES.featureDisabled;
  const quota = overview?.quota;
  const showIntro =
    !introHidden &&
    overview != null &&
    overview.platforms.every((p) => p.link == null && p.codes.length === 0);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        Icon={IdCard}
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            {quota && quota.limit != null && (
              <span
                data-testid="quota-pill"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground/80"
              >
                <QrCode className="size-3.5 text-primary" aria-hidden />
                {t("quota", { used: quota.used, limit: quota.limit })}
              </span>
            )}
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              aria-label={t("refresh")}
              title={t("refresh")}
              className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={cn("size-4", query.isFetching && "animate-spin motion-reduce:animate-none")} aria-hidden />
            </button>
          </>
        }
      />

      {notice && (
        <div
          role="status"
          className="animate-fade-in mt-4 flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-sm text-foreground"
        >
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={tc("ok")} className="rounded-md p-0.5 hover:bg-foreground/10">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      {showIntro && (
        <div className="brand-tint-soft relative mt-6 rounded-3xl border border-border p-4 sm:p-5" data-testid="intro">
          <button
            type="button"
            aria-label={tc("ok")}
            onClick={() => {
              introDismissed.set(true);
              setIntroHidden(true);
            }}
            className="absolute end-3 top-3 rounded-full p-1.5 text-foreground/50 hover:bg-foreground/10"
          >
            <X className="size-4" aria-hidden />
          </button>
          <p className="text-sm font-bold text-foreground">{t("howTitle")}</p>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            <IntroStep n={1} Icon={LinkIcon} text={t("howStep1")} />
            <IntroStep n={2} Icon={ScanLine} text={t("howStep2")} />
            <IntroStep n={3} Icon={IdCard} text={t("howStep3")} />
          </ol>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {query.isLoading && (
          <>
            <Skeleton />
            <Skeleton />
          </>
        )}

        {!query.isLoading && loadError && !overview && (
          <div
            data-testid={unavailable ? "unavailable" : "load-error"}
            className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-10 text-center"
          >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-foreground/40">
              <CloudOff className="size-7" aria-hidden />
            </span>
            <p className="mt-4 font-semibold text-foreground">
              {unavailable ? t("unavailableTitle") : t("loadFailed")}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {unavailable ? t("unavailableDesc") : platformRedirectErrorMessage(loadError, t, "", tc("genericError"))}
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold hover:bg-muted"
            >
              <RefreshCw className="size-4" aria-hidden />
              {tc("retry")}
            </button>
          </div>
        )}

        {overview && overview.platforms.length === 0 && (
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <IdCard className="size-10 text-foreground/25" aria-hidden />
            <p className="mt-3 font-semibold text-foreground">{t("empty")}</p>
          </div>
        )}

        {overview?.platforms.map((entry) => (
          <PlatformSection key={entry.platform} entry={entry} actions={sectionActions} />
        ))}
      </div>

      {sheet?.kind === "link" && sheetEntry && !sheetBlocked && (
        <LinkSheet
          entry={sheetEntry}
          busy={actions.busy}
          onSave={(url) => actions.saveLink(sheetEntry.platform, url)}
          onClose={() => setSheet(null)}
          onPlanRefused={showUpgrade}
        />
      )}
      {sheet?.kind === "claim" && sheetEntry && !sheetBlocked && (
        <ClaimSheet
          entry={sheetEntry}
          knownPlatforms={knownPlatforms}
          cardDomains={cardDomainsOf(overview?.platforms ?? [], SITE_DOMAIN)}
          initialCode={sheet.code}
          busy={actions.busy}
          onClaim={(code, label) => actions.claim(sheetEntry.platform, code, label)}
          onClose={() => setSheet(null)}
          onAddLink={() => setSheet({ kind: "link", platform: sheetEntry.platform })}
          onPlanRefused={showUpgrade}
        />
      )}
      {sheet?.kind === "rename" && sheetEntry && (
        <RenameSheet
          entry={sheetEntry}
          code={sheet.code}
          busy={actions.busy}
          onRename={(label) => actions.rename(sheetEntry.platform, sheet.code.code, label)}
          onClose={() => setSheet(null)}
        />
      )}

      <ConfirmDialog
        open={confirm?.kind === "unlink"}
        type="danger"
        title={confirm?.kind === "unlink" ? t("unlinkTitle", { code: confirm.code.code }) : ""}
        message={t("unlinkMessage")}
        confirmText={t("unlink")}
        cancelText={tc("cancel")}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "deleteLink"}
        type="warning"
        title={
          confirm?.kind === "deleteLink"
            ? t("deleteLinkTitle", { label: platformOf(confirm.platform)?.label ?? "" })
            : ""
        }
        message={t("deleteLinkMessage")}
        confirmText={t("deleteLink")}
        cancelText={tc("cancel")}
        onConfirm={() => void runConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function IntroStep({ n, Icon, text }: { n: number; Icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <li className="flex items-start gap-2.5 rounded-2xl bg-card/80 p-3">
      <span className="brand-gradient relative flex size-8 shrink-0 items-center justify-center rounded-lg text-white">
        <Icon className="size-4" />
        <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-white">
          {n}
        </span>
      </span>
      <p className="text-xs leading-relaxed text-foreground/75">{text}</p>
    </li>
  );
}

function Skeleton() {
  return (
    <div aria-hidden className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="size-11 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="h-3 w-28 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      </div>
      <div className="mt-5 h-14 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="mt-4 h-20 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}
