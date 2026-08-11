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
  deleteTiktokConnection,
  displayName,
  getTiktokConnectUrl,
  listTiktokConnections,
  openId as openIdOf,
  type TiktokConnection,
} from "@/lib/api/tiktok";
import { isTiktokReturn } from "@/lib/api/social-connect";
import type { TiktokFeedInfo } from "@/lib/types/blocks";

/** Bundled colored TikTok mark (same asset the social-links editor uses). */
function TtMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={brandIconUrl("colored", "tiktok.svg")} alt="" className={className} />;
}

/** What the sheet is currently doing / showing. */
type Phase =
  | "loading" // listing connections
  | "connect" // no connection yet → offer the OAuth flow
  | "waiting" // consent URL opened → the user is finishing in the popup
  | "accounts" // at least one connection exists → pick one
  | "unavailable" // tiktok-integration/* isn't deployed on this API host
  | "error"; // network / server failure — retryable

/**
 * "Connect TikTok" sheet backing `SocialFeedModule` with
 * `configuration: "tiktok"`.
 *
 * Mirrors `FacebookPageSheet` (and mobile's `TiktokConnectLayout`), minus the
 * picker: a TikTok connection maps to exactly ONE account, so choosing an
 * account IS choosing the feed. Flow:
 *
 *   tiktok-integration/connections → (none) → tiktok-integration/connect
 *   → popup → return → pick the account
 *   → write { connection_id, open_id, username } into `info`.
 *
 * Every call resolves with an `unavailable` flag rather than throwing, so on a
 * host where the routes are missing the sheet renders a plain "not available
 * right now" panel with Retry: it never hangs, never spins forever and never
 * crashes the editor. A blocked pop-up is reported inline and leaves the button
 * usable.
 *
 * ⚠️ The popup return is filtered through `isTiktokReturn` — Meta and TikTok
 * share the return path and are told apart by the `platform` parameter; see
 * `lib/api/social-connect.ts`.
 */
export function TiktokConnectSheet({
  value,
  onSelect,
  onClose,
}: {
  value: Partial<TiktokFeedInfo> | null;
  onSelect: (info: TiktokFeedInfo) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");

  const [phase, setPhase] = useState<Phase>("loading");
  const [connections, setConnections] = useState<TiktokConnection[]>([]);
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
    const res = await listTiktokConnections();
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
    (c: TiktokConnection) => {
      onSelect({
        connection_id: connIdOf(c),
        open_id: openIdOf(c),
        username: displayName(c),
      });
      onClose();
    },
    [onSelect, onClose],
  );

  async function connect() {
    setConnecting(true);
    setNotice(null);
    const res = await getTiktokConnectUrl();
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
    const popup = window.open(res.data, "tiktok-connect", "width=560,height=700");
    if (!popup) {
      // Pop-up blocked — never leave the button spinning forever.
      setConnecting(false);
      setNotice(t("socialFeed.tiktok.popupBlocked"));
      return;
    }
    attempted.current = true;
    setPhase("waiting");

    // The popup finishes on tiktok-integration/callback (server-side); we
    // cannot read its result cross-origin, so we either take a posted payload
    // or re-list connections when this window regains focus.
    const finish = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!alive.current) return;
      setConnecting(false);
      void loadConnections();
    };
    const onMessage = (e: MessageEvent) => {
      const data = e.data as Record<string, unknown> | null;
      // Same-origin only, and only OUR platform: Meta shares this channel.
      if (e.origin !== window.location.origin) return;
      if (data?.type !== "tiktok" && !isTiktokReturn(data)) return;
      // A payload that already carries the connection lets us skip the
      // (undocumented) list endpoint entirely — this is the web equivalent of
      // mobile reading `connection_id` straight off the deep link.
      const id = typeof data?.connection_id === "string" ? data.connection_id : "";
      if (id) {
        cleanupRef.current?.();
        cleanupRef.current = null;
        if (!alive.current) return;
        setConnecting(false);
        choose({
          id,
          open_id: typeof data?.open_id === "string" ? data.open_id : "",
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
    await deleteTiktokConnection(id);
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
      title={t("socialFeed.tiktok.title")}
      subtitle={t("socialFeed.tiktok.subtitle")}
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
          problemPanel(t("socialFeed.tiktok.unavailable"), true)}

        {phase === "error" && problemPanel(tc("genericError"), true)}

        {phase === "connect" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
            <TtMark className="size-12" />
            <p className="text-sm text-muted-foreground">
              {t("socialFeed.tiktok.connectHint")}
            </p>
            <Button variant="gradient" disabled={connecting} onClick={() => void connect()}>
              {connecting && <Loader2 className="size-4 animate-spin" />}
              {connecting
                ? t("socialFeed.tiktok.connecting")
                : t("socialFeed.tiktok.connect")}
            </Button>
          </div>
        )}

        {/* Mobile TiktokConnectAwaitingBrowser — the popup is open and this
            window can only wait. Offer a way to reopen it. */}
        {phase === "waiting" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {t("socialFeed.finishSignIn", { platform: "TikTok" })}
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
              {t("socialFeed.tiktok.chooseAccount")}
            </p>

            {connections.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
                {t("socialFeed.tiktok.noAccounts")}
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
                          <TtMark className="size-8 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {displayName(c) || id}
                          </span>
                          {c.status && c.status !== "active" && (
                            <span className="block truncate text-xs text-error">
                              {t("socialFeed.tiktok.reconnectNeeded")}
                            </span>
                          )}
                        </span>
                        {active && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                      <button
                        type="button"
                        aria-label={t("socialFeed.tiktok.disconnect")}
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
                ? t("socialFeed.tiktok.connecting")
                : t("socialFeed.tiktok.addAccount")}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDisconnect != null}
        type="danger"
        title={t("socialFeed.tiktok.disconnect")}
        message={t("socialFeed.tiktok.disconnectConfirm")}
        confirmText={t("socialFeed.tiktok.disconnect")}
        cancelText={tc("cancel")}
        onConfirm={() => confirmDisconnect && void disconnect(confirmDisconnect)}
        onCancel={() => setConfirmDisconnect(null)}
      />
    </BottomSheet>
  );
}
