"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { brandIconUrl } from "@/lib/builder/brand-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteMetaConnection,
  getMetaConnectUrl,
  listMetaConnections,
  listMetaPages,
  pagePicture,
  type MetaConnection,
  type MetaPage,
} from "@/lib/api/meta";
import { isMetaReturn } from "@/lib/api/social-connect";
import type { FacebookFeedInfo } from "@/lib/types/blocks";

/** Bundled colored Facebook mark (same asset the social-links editor uses). */
function FbMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={brandIconUrl("colored", "facebook.svg")} alt="" className={className} />;
}

/** What the sheet is currently doing / showing. */
type Phase =
  | "loading" // listing connections
  | "connect" // no connection yet → offer the OAuth flow
  | "waiting" // consent URL opened → the user is finishing in the popup
  | "pages" // a connection exists → pick a Page
  | "unavailable" // meta/* isn't deployed on this API host
  | "error"; // network / server failure — retryable

/**
 * "Connect a Facebook Page" sheet backing `SocialFeedModule` with
 * `configuration: "facebook"`.
 *
 * Flow (mirrors the ProviderGoogleCalendar OAuth pattern):
 *   meta/connections → (none) → meta/connect → popup → re-list → meta/pages
 *   → pick a Page → write { connection_id, page_id, username } into `info`.
 *
 * Every meta call returns an `unavailable` flag rather than throwing, so when
 * the routes are missing on the configured API host the sheet renders a plain
 * "not available right now" panel with a Retry button — it never hangs, never
 * shows an endless spinner and never crashes the editor.
 */
export function FacebookPageSheet({
  value,
  onSelect,
  onClose,
}: {
  value: Partial<FacebookFeedInfo> | null;
  onSelect: (info: FacebookFeedInfo) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");

  const [phase, setPhase] = useState<Phase>("loading");
  const [connections, setConnections] = useState<MetaConnection[]>([]);
  const [connectionId, setConnectionId] = useState<string>(value?.connection_id ?? "");
  const [pages, setPages] = useState<MetaPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [pagesProblem, setPagesProblem] = useState<"none" | "unavailable" | "error">("none");
  const [connecting, setConnecting] = useState(false);
  /** Inline, non-blocking message (e.g. the browser blocked the OAuth pop-up). */
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);

  // Guards against state updates from a superseded request / after unmount.
  const alive = useRef(true);
  const reqId = useRef(0);
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
    const res = await listMetaConnections();
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
      setConnectionId("");
      // Mobile's `connection_not_returned` — the flow finished but produced
      // nothing, which is a real (cancelled / denied) outcome, not an error.
      if (attempted.current) setNotice(t("socialFeed.noConnectionReturned"));
      setPhase("connect");
      return;
    }
    // Keep the block's stored connection when it still exists, else take the first.
    const keep = res.data.find((c) => c._id === connectionId)?._id ?? res.data[0]._id;
    setConnectionId(keep);
    setNotice(null);
    setPhase("pages");
  }, [connectionId, t]);

  // Initial load — run once; refreshes go through loadConnections() directly.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void loadConnections();
  }, [loadConnections]);

  // Load Pages whenever the active connection changes. All state updates happen
  // inside the deferred callback (never synchronously in the effect body) —
  // same shape as GoogleReviewsImportSheet's debounced search.
  useEffect(() => {
    if (phase !== "pages" || !connectionId) return;
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      if (!alive.current || id !== reqId.current) return;
      setLoadingPages(true);
      setPagesProblem("none");
      const res = await listMetaPages(connectionId);
      if (!alive.current || id !== reqId.current) return;
      setLoadingPages(false);
      setPages(res.data);
      setPagesProblem(res.unavailable ? "unavailable" : res.failed ? "error" : "none");
    }, 0);
    return () => clearTimeout(handle);
  }, [phase, connectionId]);

  // ── OAuth popup ───────────────────────────────────────────────────────────
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);

  async function connect() {
    setConnecting(true);
    setNotice(null);
    const res = await getMetaConnectUrl();
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
    const popup = window.open(res.data, "meta-connect", "width=560,height=700");
    if (!popup) {
      // Pop-up blocked — never leave the button spinning forever.
      setConnecting(false);
      setNotice(t("socialFeed.facebook.popupBlocked"));
      return;
    }
    attempted.current = true;
    setPhase("waiting");

    // The popup finishes on meta/callback (server-side); we can't read its
    // result cross-origin, so re-list connections when it posts back or when
    // this window regains focus.
    const finish = () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (!alive.current) return;
      setConnecting(false);
      void loadConnections();
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string } | null;
      // ⚠️ Meta and TikTok share this return channel and are told apart by the
      // `platform` field — mirrors the guard mobile added to
      // `meta_connect_cubit.dart`. Tolerant: a missing `platform` is Meta,
      // because Meta callbacks predate the parameter.
      if (!isMetaReturn(data)) return;
      if (data?.type === "meta") finish();
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
    await deleteMetaConnection(id);
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
      title={t("socialFeed.facebook.title")}
      subtitle={t("socialFeed.facebook.subtitle")}
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
          problemPanel(t("socialFeed.facebook.unavailable"), true)}

        {phase === "error" && problemPanel(tc("genericError"), true)}

        {phase === "connect" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
            <FbMark className="size-12" />
            <p className="text-sm text-muted-foreground">
              {t("socialFeed.facebook.connectHint")}
            </p>
            <Button variant="gradient" disabled={connecting} onClick={() => void connect()}>
              {connecting && <Loader2 className="size-4 animate-spin" />}
              {connecting
                ? t("socialFeed.facebook.connecting")
                : t("socialFeed.facebook.connect")}
            </Button>
          </div>
        )}

        {/* Mobile MetaConnectAwaitingBrowser — the popup is open and this
            window can only wait. Offer a way to reopen it. */}
        {phase === "waiting" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              {t("socialFeed.finishSignIn", { platform: "Facebook" })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("socialFeed.finishSignInDesc")}
            </p>
            <Button variant="outline" size="sm" onClick={() => void connect()}>
              {t("socialFeed.reopenSignIn")}
            </Button>
          </div>
        )}

        {phase === "pages" && (
          <>
            {/* Connected Meta accounts — switch between them or drop one. */}
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("socialFeed.facebook.account")}
              </p>
              <div className="overflow-hidden rounded-xl border border-border">
                {connections.map((c) => (
                  <div
                    key={c._id}
                    className="flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
                  >
                    <button
                      type="button"
                      onClick={() => setConnectionId(c._id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    >
                      <FbMark className="size-4 shrink-0" />
                      <span className="truncate text-sm text-foreground">
                        {c.name || c.username || c.email || c._id}
                      </span>
                      {c._id === connectionId && (
                        <Check className="ms-auto size-4 shrink-0 text-primary" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={t("socialFeed.facebook.disconnect")}
                      onClick={() => setConfirmDisconnect(c._id)}
                      className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-error"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={connecting}
                onClick={() => void connect()}
                className="px-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {connecting
                  ? t("socialFeed.facebook.connecting")
                  : t("socialFeed.facebook.addAccount")}
              </button>
            </div>

            {/* Pages of the active connection */}
            <div className="space-y-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("socialFeed.facebook.choosePage")}
              </p>

              {loadingPages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : pagesProblem === "unavailable" ? (
                problemPanel(t("socialFeed.facebook.unavailable"), true)
              ) : pagesProblem === "error" ? (
                problemPanel(tc("genericError"), true)
              ) : pages.length === 0 ? (
                // Mobile `no_facebook_pages` + `no_facebook_pages_desc` +
                // `reconnect`: the account manages no Page, which reconnecting
                // with a different account (or after creating one) can fix.
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-foreground">
                    {t("socialFeed.facebook.noPages")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("socialFeed.facebook.noPagesDesc")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={connecting}
                    onClick={() => void connect()}
                  >
                    {t("socialFeed.facebook.reconnect")}
                  </Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  {pages.map((p) => {
                    const picture = pagePicture(p);
                    const active = value?.page_id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onSelect({
                            connection_id: connectionId,
                            page_id: String(p.id),
                            username: p.name ?? "",
                          });
                          onClose();
                        }}
                        className="flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-start last:border-b-0 hover:bg-muted"
                      >
                        {picture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={picture}
                            alt=""
                            className="size-8 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <FbMark className="size-8 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {p.name}
                          </span>
                          {p.category && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {p.category}
                            </span>
                          )}
                          {/* Mobile `instagram_linked` badge (MetaPage.hasInstagram). */}
                          {p.has_instagram && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {t("socialFeed.facebook.instagramLinked")}
                              {p.ig_username ? ` · @${p.ig_username}` : ""}
                            </span>
                          )}
                        </span>
                        {active && <Check className="size-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDisconnect != null}
        type="danger"
        title={t("socialFeed.facebook.disconnect")}
        message={t("socialFeed.facebook.disconnectConfirm")}
        confirmText={t("socialFeed.facebook.disconnect")}
        cancelText={tc("cancel")}
        onConfirm={() => confirmDisconnect && void disconnect(confirmDisconnect)}
        onCancel={() => setConfirmDisconnect(null)}
      />
    </BottomSheet>
  );
}
