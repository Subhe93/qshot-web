"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowRightLeft, ChevronRight, Eye, Loader2, Lock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { tempRedirectDisplayLabel } from "@/lib/temp-redirect/model";
import type { TempRedirectController, TempRedirectGate } from "./use-temp-redirect";
import { activeHitsLabel, formatMoment, tempRedirectErrorMessage } from "./copy";

/** The public site with the PUBLIC SITE's bypass (`qshot_no_redirect`, not the
 *  API's `no_redirect`), so the owner can see their page while it redirects.
 *  `null` when the host (a stored custom domain) is not a valid URL host. */
export function tempRedirectPreviewUrl(profileHost: string): string | null {
  try {
    const url = new URL(`https://${profileHost}`);
    url.searchParams.set("qshot_no_redirect", "1");
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * The redirect's slot under the QR (mobile `TempRedirectBanner`). The
 * collapsed state is the ONLY one that renders nothing: a redirect the owner
 * cannot see is the failure mode of the whole feature, so a failed read shows
 * "Couldn't check" + Retry, never a silent gap that reads as "nothing running".
 */
export function TempRedirectBanner({
  controller,
  gate,
  profileHost,
}: {
  controller: TempRedirectController;
  gate: TempRedirectGate;
  profileHost: string;
}) {
  const t = useTranslations("tempRedirect");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { active } = controller;
  const previewUrl = tempRedirectPreviewUrl(profileHost);

  // An active redirect outranks every gate: a lapsed plan still sees — and
  // can stop — its own.
  if (active) {
    return (
      <Shell tone="primary">
        <div className="flex items-start gap-2.5">
          <ArrowRightLeft className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-bold text-foreground">
              {t("activeGoingTo", { label: tempRedirectDisplayLabel(active) })}
            </p>
            {active.endsAt && (
              <p className="mt-0.5 text-xs font-medium text-foreground/60">
                {t("activeUntil", { when: formatMoment(active.endsAt, locale) })}
              </p>
            )}
            <p className="mt-0.5 text-xs font-medium text-foreground/60">
              {activeHitsLabel(t, active.hits)}
            </p>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-w-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <Eye className="size-3.5 shrink-0" />
              <span className="truncate">{t("preview")}</span>
            </a>
          ) : (
            <span />
          )}
          {controller.busy ? (
            <Loader2 className="mx-4 size-4 animate-spin text-foreground/50" />
          ) : (
            <button
              type="button"
              onClick={() => void controller.stop()}
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-error hover:bg-error/10"
            >
              {t("stop")}
            </button>
          )}
        </div>
        {controller.actionError && (
          <p className="mt-1 px-1 text-xs font-medium text-error">
            {tempRedirectErrorMessage(controller.actionError, t, tc("genericError"))}
          </p>
        )}
      </Shell>
    );
  }

  // Plan-locked with nothing running: the action row below carries the
  // locked copy — one row, not the same title twice.
  if (gate.loaded && gate.planLocked) return null;

  if (controller.waiting) {
    return <div className="h-16 w-full animate-pulse rounded-[14px] bg-foreground/[0.06]" />;
  }

  if (controller.failed) {
    return (
      <Shell tone="neutral">
        <div className="flex items-center gap-2.5">
          <TriangleAlert className="size-3.5 shrink-0 text-foreground/45" />
          <p className="line-clamp-2 min-w-0 flex-1 text-xs font-medium text-foreground/60">
            {t("checkFailed")}
          </p>
          <button
            type="button"
            onClick={controller.refetch}
            className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            {t("retry")}
          </button>
        </div>
      </Shell>
    );
  }

  return null;
}

/**
 * The "Temporary link" action (mobile `_buildTempRedirectAction`): locked, not
 * hidden — a plan lock shows a padlock and the locked line, and opens the
 * upgrade dialog. A failed account read retries it rather than going dead.
 */
export function TempRedirectAction({
  gate,
  onOpen,
  onUpgrade,
}: {
  gate: TempRedirectGate;
  onOpen: () => void;
  onUpgrade: () => void;
}) {
  const t = useTranslations("tempRedirect");
  const locked = gate.loaded && gate.planLocked;
  const loading = !gate.loaded && !gate.failed;
  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading}
      onClick={() => {
        if (gate.failed) gate.retry();
        else if (gate.planLocked) onUpgrade();
        else onOpen();
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-start transition-colors hover:bg-muted disabled:cursor-wait",
        locked && "opacity-55",
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/12 text-primary">
        <ArrowRightLeft className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{t("title")}</span>
        {locked && (
          <span className="line-clamp-2 block text-xs font-medium text-foreground/60">
            {t("locked")}
          </span>
        )}
      </span>
      {loading ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-foreground/35" />
      ) : locked ? (
        <Lock className="size-3.5 shrink-0 text-foreground/35" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
      )}
    </button>
  );
}

function Shell({ tone, children }: { tone: "primary" | "neutral"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "w-full rounded-[14px] border px-3.5 pb-2 pt-3",
        tone === "primary"
          ? "border-primary/15 bg-primary/[0.06]"
          : "border-foreground/15 bg-foreground/[0.04]",
      )}
    >
      {children}
    </div>
  );
}
