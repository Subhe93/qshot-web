"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, History, Loader2, Lock, RotateCcw, TriangleAlert, X } from "lucide-react";
import {
  awaitPendingSave,
  clearFlushFailure,
  hasFlushFailure,
  lastFlushAt,
} from "@/lib/builder/pending-save";

/**
 * §3.1: the server records a save in the background, up to ~3 s after the
 * save response. After a flushed save (§7.1) the first list read waits this
 * long past the response, so the session just saved is in the list.
 */
const HISTORY_FLUSH_SETTLE_MS = 2000;
import {
  HISTORY_PAGE_SIZE,
  historyDocumentOf,
  historyQueryKeys,
  listHistory,
  toHistoryError,
  type HistoryBlockRef,
  type HistoryRow,
} from "@/lib/api/history";
import { groupByDay, HISTORY_SUMMARY_SEPARATOR, summaryParts } from "@/lib/history/summary";
import { listPages } from "@/lib/api/pages";
import { listProfiles } from "@/lib/api/profiles";
import { getAccount } from "@/lib/api/account";
import { useAuthStore } from "@/stores/auth-store";
import { parseBlocks, parseSettings } from "@/lib/builder/serialization";
import { PageHeader } from "@/components/page-header";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { SaveToast } from "@/components/builder/BuilderShell";
import { cn } from "@/lib/utils";
import {
  HistoryActionsSheet,
  HistoryBlockPicker,
  PinChip,
  SourceBadge,
  type HistoryAction,
} from "./HistoryActionsSheet";
import { HistoryPreview } from "./HistoryPreview";
import { HistoryCompare, type BlockRestoreTarget } from "./HistoryCompare";
import { PinLabelDialog } from "./PinLabelDialog";
import { pagesQueryKey, useHistoryActions, type HistoryToast } from "./use-history-actions";
import {
  actorLabel,
  dayHeading,
  formatClock,
  formatRange,
  historyErrorMessage,
  useHistoryStrings,
  type HistoryRowView,
} from "./copy";

type Tab = "all" | "pinned";

/** One surface at a time: a sheet replaces the actions sheet, never stacks. */
type Dialog =
  | { kind: "actions"; row: HistoryRow }
  | { kind: "preview"; row: HistoryRow }
  | { kind: "compare"; row: HistoryRow }
  | { kind: "blocks"; row: HistoryRow }
  | { kind: "confirmRestore"; row: HistoryRow }
  | { kind: "confirmBlock"; row: HistoryRow; block: HistoryBlockRef; target: BlockRestoreTarget }
  | { kind: "confirmPage"; row: HistoryRow }
  | { kind: "pin"; row: HistoryRow }
  | { kind: "confirmUnpin"; row: HistoryRow }
  | null;

/**
 * Website Change History (docs/profile-history-api-contract.md §6). Its own
 * route, deliberately outside the builder: the editor is unmounted (and its
 * last edit flushed, §7.1) before any restore can run, and the builder reloads
 * the site from the server when the user goes back.
 *
 * `profileId` is a prop so the admin dashboard can mount the same screen.
 */
export function HistoryScreen({
  profileId,
  backHref,
}: {
  profileId: string;
  /** Where the back arrow goes; the builder of this site by default. */
  backHref?: string;
}) {
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const locale = useLocale();
  const strings = useHistoryStrings();

  const [tab, setTab] = useState<Tab>("all");
  /** `""` = every page; else `main` / `page:<id>` (§5.1 `document`). */
  const [documentFilter, setDocumentFilter] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toastState, setToastState] = useState<HistoryToast | null>(null);
  // The row button that opened the current sheet — focus returns to it on close.
  const triggerRef = useRef<HTMLElement | null>(null);

  const toast = useCallback((next: HistoryToast) => setToastState(next), []);
  useEffect(() => {
    if (!toastState) return;
    const handle = setTimeout(() => setToastState(null), toastState.error ? 8000 : 3500);
    return () => clearTimeout(handle);
  }, [toastState]);

  const close = useCallback(() => {
    setDialog(null);
    const el = triggerRef.current;
    if (el) requestAnimationFrame(() => el.focus());
  }, []);

  // The builder flushes its last edit on the way here (§7.1). The list must
  // not race it: it is read only once the flush has resolved, and — when a
  // flush happened in this very navigation — a further 2 s later, so the
  // server's background recording (§3.1) has landed; the loading state shows
  // meanwhile (never an empty list that then fills). If the flush did not
  // save, the builder is gone and cannot say so — this screen does, as a
  // dismissible notice (restores may still proceed).
  const [mountedAt] = useState(() => Date.now());
  const [listReady, setListReady] = useState(false);
  const [flushFailed, setFlushFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let handle: ReturnType<typeof setTimeout> | undefined;
    const flushedThisNavigation = lastFlushAt() >= mountedAt;
    void awaitPendingSave().then(() => {
      if (!active) return;
      if (hasFlushFailure()) setFlushFailed(true);
      handle = setTimeout(() => {
        if (active) setListReady(true);
      }, flushedThisNavigation ? HISTORY_FLUSH_SETTLE_MS : 0);
    });
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [mountedAt]);

  // ── Who am I (for "You") ──
  const authUser = useAuthStore((s) => s.user);
  const { data: account } = useQuery({ queryKey: ["account"], queryFn: getAccount, staleTime: 60_000 });
  const selfId = String(authUser?.id ?? authUser?._id ?? account?.user?._id ?? "") || null;

  // ── The live site (frame settings for sub-page previews; order-list names) ──
  const { data: profiles } = useQuery({ queryKey: ["profiles"], queryFn: listProfiles });
  const profile = profiles?.find((p) => (p._id ?? p.id) === profileId);
  const liveSettings = useMemo(() => parseSettings(profile?.settings ?? {}), [profile]);
  const liveBlocks = useMemo(() => parseBlocks(profile?.info?.modules ?? []), [profile]);

  // ── Page names (§6.2.3 "which page") and the page filter ──
  const { data: pages } = useQuery({
    queryKey: pagesQueryKey(profileId),
    queryFn: () => listPages(profileId),
  });
  // ── The list: cursor pages, reloaded on every open, never kept around (§3.2) ──
  const pinned = tab === "pinned";
  const list = useInfiniteQuery({
    queryKey: historyQueryKeys.list(profileId, documentFilter || undefined, pinned),
    queryFn: ({ pageParam }) =>
      listHistory({
        profileId,
        document: documentFilter || undefined,
        pinned,
        cursor: pageParam,
        limit: HISTORY_PAGE_SIZE,
      }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: listReady,
    refetchOnMount: "always",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const rows = useMemo(() => list.data?.pages.flatMap((p) => p.history) ?? [], [list.data]);
  const groups = useMemo(() => groupByDay(rows), [rows]);

  // Deleted sub-pages are gone from `multi-page/index`; their name survives on
  // the `page_deleted` row, which names every earlier row of that page too.
  const deletedPages = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of rows) {
      if (row.source === "page_deleted" && row.pageId && row.page?.listName && !names.has(row.pageId)) {
        names.set(row.pageId, row.page.listName);
      }
    }
    return names;
  }, [rows]);
  const pageNameOf = useCallback(
    (row: HistoryRow): string => {
      if (row.pageId === null) return t("home");
      return (
        pages?.find((p) => p._id === row.pageId)?.listName ||
        deletedPages.get(row.pageId) ||
        row.page?.listName ||
        t("page")
      );
    },
    [pages, deletedPages, t],
  );
  const deletedPageOptions = useMemo(
    () => [...deletedPages].filter(([id]) => !pages?.some((p) => p._id === id)),
    [deletedPages, pages],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "240px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const describe = useCallback(
    (row: HistoryRow): HistoryRowView => {
      // §6.3: with nothing listed the source label IS the line — once, no badge.
      const parts = summaryParts(row, strings);
      const hasParts = parts.length > 0 && !(parts.length === 1 && parts[0] === strings.sourceLabel(row.source));
      return {
        row,
        time: formatClock(row.endedAt, locale),
        range: formatRange(row.startedAt, row.endedAt, locale),
        who: actorLabel(row, selfId, t),
        page: pageNameOf(row),
        summary: parts.join(HISTORY_SUMMARY_SEPARATOR),
        sourceLabel: strings.sourceLabel(row.source),
        sourceBadge: row.source !== "editor" && hasParts,
      };
    },
    [locale, selfId, t, pageNameOf, strings],
  );

  // ── Write flows ──
  const onPinLimit = useCallback(() => {
    setTab("pinned");
    setDialog(null);
  }, []);
  const actions = useHistoryActions(profileId, { toast, onPinLimit });

  function openRow(row: HistoryRow, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setDialog({ kind: "actions", row });
  }

  function onAction(action: HistoryAction) {
    if (!dialog) return;
    const { row } = dialog;
    switch (action) {
      case "preview":
        setDialog({ kind: "preview", row });
        break;
      case "compare":
        setDialog({ kind: "compare", row });
        break;
      case "restore":
        setDialog({ kind: "confirmRestore", row });
        break;
      case "restoreBlock":
        setDialog({ kind: "blocks", row });
        break;
      case "restorePage":
        setDialog({ kind: "confirmPage", row });
        break;
      case "pin":
      case "rename":
        setDialog({ kind: "pin", row });
        break;
      case "unpin":
        setDialog({ kind: "confirmUnpin", row });
        break;
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("tabAll") },
    { key: "pinned", label: t("tabPinned") },
  ];

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <PageHeader
        Icon={History}
        title={t("title")}
        subtitle={t("subtitle")}
        backHref={backHref ?? `/builder/${profileId}`}
      />

      {flushFailed && (
        <div
          role="alert"
          data-testid="history-flush-failed"
          className="mt-4 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p className="flex-1">{t("flushFailed")}</p>
          <button
            type="button"
            aria-label={t("flushFailedDismiss")}
            onClick={() => {
              clearFlushFailure();
              setFlushFailed(false);
            }}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Filters: All / Pinned (§6.2.5 `pinned=true`) and the page selector (`document=`). */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label={t("title")} className="flex min-w-[220px] flex-1 rounded-xl border border-input p-0.5 sm:flex-none">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                tab === item.key ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("pageFilter")}</span>
          <select
            value={documentFilter}
            onChange={(e) => setDocumentFilter(e.target.value)}
            className="h-9 max-w-[200px] rounded-lg border border-input bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="history-page-filter"
          >
            <option value="">{t("allPages")}</option>
            <option value={historyDocumentOf(null)}>{t("home")}</option>
            {pages?.map((p) => (
              <option key={p._id} value={historyDocumentOf(p._id)}>
                {p.listName}
              </option>
            ))}
            {deletedPageOptions.map(([id, name]) => (
              <option key={id} value={historyDocumentOf(id)}>
                {`${name} (${t("deletedPage")})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* List */}
      {list.isPending ? (
        <div className="flex h-48 items-center justify-center text-muted-foreground" role="status">
          <Loader2 className="size-6 animate-spin" />
          <span className="sr-only">{tc("loading")}</span>
        </div>
      ) : list.isError ? (
        <ListError error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground">
          <History className="size-12 opacity-40" />
          <p className="max-w-sm text-sm">{pinned ? t("emptyPinned") : t("empty")}</p>
        </div>
      ) : (
        <div className="mt-5 space-y-6" data-testid="history-list">
          {groups.map((group) => (
            <section key={group.day || "unknown"} data-testid="history-day">
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {dayHeading(group.day, locale, t)}
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-soft">
                {group.rows.map((row) => (
                  <HistoryRowItem key={row.id} view={describe(row)} onOpen={(el) => openRow(row, el)} />
                ))}
              </ul>
            </section>
          ))}
          {/* Infinite scroll (§6.2.4): the sentinel fetches the next cursor page;
              the button is the keyboard / reduced-viewport fallback. */}
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
                data-testid="history-load-more"
              >
                {isFetchingNextPage ? <Loader2 className="size-4 animate-spin" /> : t("loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Sheets and dialogs ── */}
      {dialog?.kind === "actions" && (
        <HistoryActionsSheet view={describe(dialog.row)} onAction={onAction} onClose={close} />
      )}

      {dialog?.kind === "preview" && (
        <BottomSheet
          title={t("preview.title")}
          subtitle={pageNameOf(dialog.row)}
          onClose={close}
          className="sm:max-w-lg"
          footer={
            <div className="border-t border-border p-4">
              <Button
                variant="gradient"
                className="w-full rounded-xl"
                onClick={() => setDialog({ kind: "confirmRestore", row: dialog.row })}
              >
                <RotateCcw className="size-4" />
                {t("actions.restore")}
              </Button>
            </div>
          }
        >
          <HistoryPreview profileId={profileId} row={dialog.row} liveSettings={liveSettings} />
        </BottomSheet>
      )}

      {dialog?.kind === "compare" && (
        <BottomSheet
          title={t("compare.title")}
          subtitle={describe(dialog.row).summary}
          onClose={close}
          className="sm:max-w-3xl"
        >
          <HistoryCompare
            profileId={profileId}
            row={dialog.row}
            liveSettings={liveSettings}
            liveBlocks={liveBlocks}
            strings={strings}
            onRestoreBlock={(block, _change, target) =>
              setDialog({ kind: "confirmBlock", row: dialog.row, block, target })
            }
          />
        </BottomSheet>
      )}

      {dialog?.kind === "blocks" && (
        <HistoryBlockPicker
          profileId={profileId}
          view={describe(dialog.row)}
          strings={strings}
          onPick={(block, _change, target) => setDialog({ kind: "confirmBlock", row: dialog.row, block, target })}
          onClose={close}
        />
      )}

      {dialog?.kind === "pin" && (
        <PinLabelDialog
          initialLabel={dialog.row.pinned?.label ?? ""}
          busy={actions.busy}
          onSubmit={async (label) => {
            const row = dialog.row;
            const ok = await actions.pin(row, label);
            if (ok) close();
          }}
          onClose={close}
        />
      )}

      {/* §6.6 — with the §3.4 list of what a restore does not touch. */}
      <ConfirmDialog
        open={dialog?.kind === "confirmRestore"}
        type="warning"
        title={t("restore.title")}
        message={
          dialog?.kind === "confirmRestore" ? (
            <>
              <p>{t("restore.message", { page: pageNameOf(dialog.row) })}</p>
              <p className="mt-3 font-semibold text-foreground">{t("restore.notRestored")}</p>
              <ul className="mt-1 list-disc ps-5 text-start text-xs" data-testid="history-not-restored">
                <li>{t("restore.keepUrl")}</li>
                <li>{t("restore.keepPage")}</li>
                <li>{t("restore.keepOther")}</li>
              </ul>
            </>
          ) : (
            ""
          )
        }
        confirmText={t("restore.confirm")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          if (dialog?.kind !== "confirmRestore") return;
          const { row } = dialog;
          close();
          void actions.restore(row);
        }}
        onCancel={close}
      />

      {/* §6.7 */}
      <ConfirmDialog
        open={dialog?.kind === "confirmBlock"}
        type="warning"
        title={t("block.title")}
        message={
          dialog?.kind === "confirmBlock"
            ? t(dialog.target.mode === "undo_edit" ? "block.undoMessage" : "block.message", {
                block: strings.blockName(dialog.block.type),
              })
            : ""
        }
        confirmText={t("block.confirm")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          if (dialog?.kind !== "confirmBlock") return;
          const { target, block } = dialog;
          close();
          void actions.restoreBlock(target.historyId, block.id);
        }}
        onCancel={close}
      />

      {/* §6.8 */}
      <ConfirmDialog
        open={dialog?.kind === "confirmPage"}
        type="info"
        title={t("restorePage.title")}
        message={
          dialog?.kind === "confirmPage"
            ? t("restorePage.message", { page: dialog.row.page?.listName || t("page") })
            : ""
        }
        confirmText={t("restorePage.confirm")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          if (dialog?.kind !== "confirmPage") return;
          const { row } = dialog;
          close();
          void actions.restorePage(row);
        }}
        onCancel={close}
      />

      {/* §6.9 unpin — the §5.7 warning; "old" is unknowable client-side, so always. */}
      <ConfirmDialog
        open={dialog?.kind === "confirmUnpin"}
        type="warning"
        title={t("pin.unpinTitle")}
        message={t("pin.unpinMessage")}
        confirmText={t("pin.unpin")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          if (dialog?.kind !== "confirmUnpin") return;
          const { row } = dialog;
          close();
          void actions.unpin(row);
        }}
        onCancel={close}
      />

      <SaveToast toast={toastState} onDismiss={() => setToastState(null)} />
    </div>
  );
}

function HistoryRowItem({ view, onOpen }: { view: HistoryRowView; onOpen: (trigger: HTMLElement) => void }) {
  const { row } = view;
  const meta = [view.who, view.page].filter(Boolean).join(" · ");
  const showBadges = view.sourceBadge || row.pinned;
  return (
    <li>
      <button
        type="button"
        onClick={(e) => onOpen(e.currentTarget)}
        className="flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        data-testid="history-row"
        data-history-id={row.id}
        data-source={row.source}
      >
        <span className="min-w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-foreground">
          {view.time}
          {view.range && (
            <span className="block whitespace-nowrap text-[10px] font-normal text-muted-foreground">
              <bdi>{view.range.from}</bdi>
              {"–"}
              <bdi>{view.range.to}</bdi>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{view.summary}</span>
          {meta && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{meta}</span>}
          {showBadges && (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              {view.sourceBadge && <SourceBadge label={view.sourceLabel} />}
              {row.pinned && <PinChip label={row.pinned.label} />}
            </span>
          )}
        </span>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
      </button>
    </li>
  );
}

function ListError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const err = toHistoryError(error);
  const forbidden = err.code === "forbidden";
  return (
    <div
      className="mt-10 flex flex-col items-center gap-3 text-center text-muted-foreground"
      role="alert"
      data-testid="history-error"
    >
      {forbidden ? <Lock className="size-12 opacity-40" /> : <History className="size-12 opacity-40" />}
      <p className="max-w-sm text-sm">{historyErrorMessage(err, t, tc("genericError"))}</p>
      {!forbidden && err.code !== "unauthorized" && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {tc("retry")}
        </Button>
      )}
    </div>
  );
}
