"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { brandIconUrl } from "@/lib/builder/brand-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  connectionId as connIdOf,
  deleteInstagramConnection,
  displayName,
  getInstagramConnectUrl,
  igUserId as igUserIdOf,
  listInstagramConnections,
  type InstagramConnection,
} from "@/lib/api/instagram";
import { isInstagramReturn } from "@/lib/api/social-connect";
import type { InstagramConnectedFeedInfo } from "@/lib/types/blocks";

/** Bundled colored Instagram mark (same asset the social-links editor uses). */
function IgMark({ className }: { className?: string }) {
  const src = brandIconUrl("colored", "instagram.svg");
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} />;
}

/** What the sheet is currently doing / showing. */
type Phase =
  | "loading" // listing connections
  | "connect" // no connection yet → offer the OAuth flow
  | "waiting" // consent URL opened → the user is finishing in the popup
  | "accounts" // at least one connection exists → pick one
  | "unavailable" // instagram/* isn't deployed on this API host
  | "error"; // network / server failure — retryable

/**
 * "Connect Instagram" sheet — **Business Login for Instagram**, backing the
 * `SocialFeedModule` with `configuration: "instagram_connected"` (mobile
 * `InstagramConnectedFeedConfiguration` on `feature/template-sites`;
 * `info = { connection_id, ig_user_id, username }`). The sheet itself only
 * hands the chosen connection to `onSelect` — the editor's `setInstagramInfo`
 * is what stamps the configuration value, so a pre-split `"instagram"` block
 * flips to the new value exactly when a flow completes here, never on open.
 *
 * Deliberately the TikTok sheet's twin rather than the Facebook one's: an
 * Instagram Login connection resolves to exactly ONE account, so there is no
 * page/account picker step — choosing the connection IS choosing the feed
 * (`docs/plans/social-instagram-feed/plan.md` §4.4, "no picker: callback → save
 * block"). Flow:
 *
 *   instagram/connections → (none) → instagram/connect → popup → return
 *   → write { connection_id, ig_user_id, username } into `info`.
 *
 * ⚠️ DEGRADATION IS THE NORMAL PATH TODAY. None of the `instagram/*` routes are
 * deployed (verified 2026-08-06 on api.qshot.com and api.speaknet.app), and the
 * whole feature sits behind `INSTAGRAM_FEED_ENABLED`, which defaults to off.
 * Every call resolves with `unavailable` / `failed` instead of throwing, so the
 * first thing this sheet does on such a host is show the "not available right
 * now" panel with Retry: it never hangs, never spins forever and never crashes
 * the editor. A blocked pop-up is reported inline and leaves the button usable.
 *
 * ⚠️ The popup return is filtered through `isInstagramReturn` — Meta, TikTok
 * and Instagram all share the return path and are told apart by the `platform`
 * parameter; see `lib/api/social-connect.ts`.
 */
export function InstagramConnectSheet({
  value,
  onSelect,
  onClose,
}: {
  value: Partial<InstagramConnectedFeedInfo> | null;
  onSelect: (info: InstagramConnectedFeedInfo) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");

  const [phase, setPhase] = useState<Phase>("loading");
  const [connections, setConnections] = useState<InstagramConnection[]>([]);
  const [connecting, setConnecting] = useState(false);
  /** Inline, non-blocking message (blocked pop-up, empty return, …). */
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  // Guards against state updates after unmount.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** Did we just come back from a connect round trip? Drives the empty notice. */
  const attempted = useRef(false);

  const loadConnections = useCallback(async () => {
    setPhase("loading");
    const res = await listInstagramConnections();
    if (!alive.current) return;
    if (res.unavailable) {
      setPhase("unavailable");
      return;
    }
    if (res.failed) {
      setPhase("error");
      return;
    }
    setConnections(res.data);
    if (res.data.length === 0) {
      // Mobile's `connection_not_returned` — the flow finished but produced
      // nothing, which is a real (cancelled / denied) outcome, not an error.
      if (attempted.current) setNotice(t("socialFeed.noConnectionReturned"));
      setPhase("connect");
      return;
    }
    setNotice(null);
    setPhase("accounts");
  }, [t]);

  // Initial load — run once; refreshes go through loadConnections() directly.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadConnections();
  }, [loadConnections]);

  // ── OAuth popup ───────────────────────────────────────────────────────────
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  const choose = useCallback(
    (c: InstagramConnection) => {
      onSelect({
        connection_id: connIdOf(c),
        ig_user_id: igUserIdOf(c),
        username: displayName(c),
      });
      onClose();
    },
    [onSelect, onClose],
  );

  async function connect() {
    setConnecting(true);
    setNotice(null);
    const res = await getInstagramConnectUrl();
    if (!alive.current) return;
    if (res.unavailable) {
      setConnecting(false);
      setPhase("unavailable");
      return;
    }
    if (res.failed || !res.data) {
      setConnecting(false);
      setPhase("error");
      return;
    }
    const popup = window.open(res.data, "instagram-connect", "width=560,height=700");
    if (!popup) {
      // Pop-up blocked — never leave the button spinning forever.
      setConnecting(false);
      setNotice(t("socialFeed.instagram.popupBlocked"));
      return;
    }
    attempted.current = true;
    setPhase("waiting");

    // The popup finishes on instagram/callback (server-side); we cannot read
    // its result cross-origin, so we either take a posted payload or re-list
    // connections when this window regains focus.
    const finish = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!alive.current) return;
      setConnecting(false);
      void loadConnections();
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data as Record<string, unknown> | null;
      // Same-origin only, and only OUR platform: Meta and TikTok share this
      // channel. `isInstagramReturn` is a strict allow-list, so a payload with
      // no `platform` is never claimed here — it belongs to Meta.
      if (e.origin !== window.location.origin) return;
      if (data?.type !== "instagram" && !isInstagramReturn(data)) return;
      // A payload that already carries the connection lets us skip the
      // (undocumented) list endpoint entirely — this is the web equivalent of
      // mobile reading `connection_id` straight off the deep link, and the
      // ONLY path that works while `instagram/connections` is undeployed.
      const id = typeof data?.connection_id === "string" ? data.connection_id : "";
      if (id) {
        cleanupRef.current?.();
        cleanupRef.current = null;
        if (!alive.current) return;
        setConnecting(false);
        choose({
          id,
          // The deep link carries `connection_id`, `platform` and `username`;
          // `ig_user_id` is optional in the contract and usually absent here.
          platform_user_id:
            typeof data?.ig_user_id === "string" ? data.ig_user_id : "",
          username: typeof data?.username === "string" ? data.username : "",
        });
        return;
      }
      finish();
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", finish, { once: true });
    cleanupRef.current = () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", finish);
    };
  }

  async function disconnect(id: string) {
    setConfirmDisconnect(null);
    await deleteInstagramConnection(id);
    if (!alive.current) return;
    await loadConnections();
  }

  // ── Panels ────────────────────────────────────────────────────────────────
  const problemPanel = (message: string, retry: boolean) => (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
      <TriangleAlert className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {retry && (
        <Button variant="outline" size="sm" onClick={() => void loadConnections()}>
          <RefreshCw className="size-4" />
          {tc("retry")}
        </Button>
      )}
    </div>
  );

  return (
    <BottomSheet
      title={t("socialFeed.instagram.title")}
      subtitle={t("socialFeed.instagram.subtitle")}
      onClose={onClose}
    >
      <div className="space-y-3">
        {notice && (
          <p className="rounded-xl bg-error/10 px-3 py-2 text-xs text-error">{notice}</p>
        )}

        {phase === "loading" && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {phase === "unavailable" &&
          problemPanel(t("socialFeed.instagram.unavailable"), true)}

        {phase === "error" && problemPanel(tc("genericError"), true)}

        {phase === "connect" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
            <IgMark className="size-12" />
            <p className="text-sm text-muted-foreground">
              {t("socialFeed.instagram.connectHint")}
            </p>
            {/* plan.md §2 — the professional-account requirement is the single
                most common reason the flow fails, so it is stated UP FRONT
                rather than only in the error copy. */}
            <p className="text-xs text-muted-foreground">
              {t("socialFeed.instagram.professionalRequired")}
            </p>
            <Button variant="gradient" disabled={connecting} onClick={() => void connect()}>
              {connecting && <Loader2 className="size-4 animate-spin" />}
              {connecting
                ? t("socialFeed.instagram.connecting")
                : t("socialFeed.instagram.connect")}
            </Button>
          </div>
        )}

        {/* The popup is open and this window can only wait. Offer a way to
            reopen it (mobile's "awaiting browser" state). */}
        {phase === "waiting" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {t("socialFeed.finishSignIn", { platform: "Instagram" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("socialFeed.finishSignInDesc")}
            </p>
            <Button variant="outline" size="sm" onClick={() => void connect()}>
              {t("socialFeed.reopenSignIn")}
            </Button>
          </div>
        )}

        {phase === "accounts" && (
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("socialFeed.instagram.chooseAccount")}
            </p>

            {connections.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
                {t("socialFeed.instagram.noAccounts")}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-border">
                {connections.map((c) => {
                  const id = connIdOf(c);
                  const avatar =
                    typeof c.avatar_url === "string" ? c.avatar_url : null;
                  const active = value?.connection_id === id;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
                    >
                      <button
                        type="button"
                        onClick={() => choose(c)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-start hover:opacity-80"
                      >
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt=""
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <IgMark className="size-8 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {displayName(c) || id}
                          </span>
                          {c.status && c.status !== "active" && (
                            <span className="block truncate text-xs text-error">
                              {t("socialFeed.instagram.reconnectNeeded")}
                            </span>
                          )}
                        </span>
                        {active && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                      <button
                        type="button"
                        aria-label={t("socialFeed.instagram.disconnect")}
                        onClick={() => setConfirmDisconnect(id)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-error"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              disabled={connecting}
              onClick={() => void connect()}
              className="px-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
            >
              {connecting
                ? t("socialFeed.instagram.connecting")
                : t("socialFeed.instagram.addAccount")}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDisconnect != null}
        type="danger"
        title={t("socialFeed.instagram.disconnect")}
        message={t("socialFeed.instagram.disconnectConfirm")}
        confirmText={t("socialFeed.instagram.disconnect")}
        cancelText={tc("cancel")}
        onConfirm={() => confirmDisconnect && void disconnect(confirmDisconnect)}
        onCancel={() => setConfirmDisconnect(null)}
      />
    </BottomSheet>
  );
}
