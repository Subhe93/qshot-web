"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Blocks,
  Eye,
  FilePlus2,
  GitCompareArrows,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  RotateCcw,
  Undo2,
} from "lucide-react";
import {
  diffHistory,
  historyQueryKeys,
  type HistoryBlockRef,
  type HistoryChange,
} from "@/lib/api/history";
import {
  blockRestoreHistoryId,
  restorableBlocks,
  rowActions,
  type HistoryStrings,
} from "@/lib/history/summary";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { GroupedCard, GroupedRow } from "@/components/builder/editors/sheet-kit";
import { cn } from "@/lib/utils";
import type { BlockRestoreTarget } from "./HistoryCompare";
import { ChangeChip } from "./HistoryCompare";
import type { HistoryRowView } from "./copy";

export type HistoryAction =
  | "preview"
  | "compare"
  | "restore"
  | "restoreBlock"
  | "restorePage"
  | "pin"
  | "rename"
  | "unpin";

/** The row's meta line (time · who · page) + summary, shared by the sheets. */
export function RowSummary({ view, className }: { view: HistoryRowView; className?: string }) {
  const t = useTranslations("history");
  const rest = [view.who, view.page].filter(Boolean);
  if (view.row.saveCount > 0) rest.push(t("saves", { count: view.row.saveCount }));
  return (
    <div className={cn("rounded-2xl bg-surface px-4 py-3", className)}>
      <p className="text-sm font-semibold text-foreground">{view.summary}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {view.range ? (
          <>
            <bdi>{view.range.from}</bdi>
            {"–"}
            <bdi>{view.range.to}</bdi>
          </>
        ) : (
          view.time
        )}
        {rest.map((part, i) => (
          <span key={i}>{` · ${part}`}</span>
        ))}
      </p>
      {(view.sourceBadge || view.row.pinned) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {view.sourceBadge && <SourceBadge label={view.sourceLabel} />}
          {view.row.pinned && <PinChip label={view.row.pinned.label} />}
        </div>
      )}
    </div>
  );
}

export function SourceBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-[#b86d00]">
      {label}
    </span>
  );
}

export function PinChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
      <Pin className="size-3 shrink-0" aria-hidden />
      <span dir="auto" className="truncate">
        {label}
      </span>
    </span>
  );
}

/** §6.2 row actions, as a bottom sheet (phone) / centred card (desktop). */
export function HistoryActionsSheet({
  view,
  onAction,
  onClose,
}: {
  view: HistoryRowView;
  onAction: (action: HistoryAction) => void;
  onClose: () => void;
}) {
  const t = useTranslations("history");
  const { row } = view;
  const actions = rowActions(row);
  const pageRestored = row.source === "page_deleted" && row.page?.restoredPageId != null;

  return (
    <BottomSheet title={t("actions.title")} onClose={onClose}>
      <RowSummary view={view} className="mb-4" />
      <GroupedCard>
        {actions.preview && (
          <GroupedRow Icon={Eye} color="#4488ff" title={t("actions.preview")} onClick={() => onAction("preview")} />
        )}
        {actions.diff && (
          <GroupedRow
            Icon={GitCompareArrows}
            color="#5856d6"
            title={t("actions.compare")}
            onClick={() => onAction("compare")}
          />
        )}
        {actions.restore && (
          <GroupedRow
            Icon={RotateCcw}
            color="#34c759"
            title={t("actions.restore")}
            onClick={() => onAction("restore")}
          />
        )}
        {actions.restoreBlock && (
          <GroupedRow
            Icon={Blocks}
            color="#ff815a"
            title={t("actions.restoreBlock")}
            onClick={() => onAction("restoreBlock")}
          />
        )}
        {actions.restorePage && (
          <GroupedRow
            Icon={FilePlus2}
            color="#34c759"
            title={t("actions.restorePage")}
            onClick={() => onAction("restorePage")}
          />
        )}
        {pageRestored && (
          <GroupedRow
            Icon={FilePlus2}
            color="#8e8e93"
            title={t("actions.pageRestored")}
          />
        )}
      </GroupedCard>
      <div className="mt-3">
        <GroupedCard>
          {row.pinned ? (
            <>
              <GroupedRow Icon={Pencil} color="#4488ff" title={t("actions.rename")} onClick={() => onAction("rename")} />
              <GroupedRow Icon={PinOff} color="#f35054" title={t("actions.unpin")} onClick={() => onAction("unpin")} />
            </>
          ) : (
            <GroupedRow Icon={Pin} color="#ffaf05" title={t("actions.pin")} onClick={() => onAction("pin")} />
          )}
        </GroupedCard>
      </div>
    </BottomSheet>
  );
}

/**
 * §6.7 "Restore a block": the blocks the row's summary lists. The §5.5 rule
 * decides which row id each one needs — a removed block comes back from this
 * row, an edited one is undone from the previous row, which only the diff
 * knows, so it is fetched here; with no previous state the edit cannot be
 * undone and the button says so.
 */
export function HistoryBlockPicker({
  profileId,
  view,
  strings,
  onPick,
  onClose,
}: {
  profileId: string;
  view: HistoryRowView;
  strings: HistoryStrings;
  onPick: (block: HistoryBlockRef, change: HistoryChange, target: BlockRestoreTarget) => void;
  onClose: () => void;
}) {
  const t = useTranslations("history");
  const { row } = view;
  const blocks = restorableBlocks(row);
  const needsDiff = row.summary.edited.length > 0;
  const diff = useQuery({
    queryKey: historyQueryKeys.diff(profileId, row.id),
    queryFn: () => diffHistory(profileId, row.id),
    enabled: needsDiff,
    staleTime: 60_000,
    retry: false,
  });

  return (
    <BottomSheet title={t("blocks.title")} onClose={onClose}>
      <p className="mb-3 text-sm text-muted-foreground">{t("blocks.hint")}</p>
      <ul className="overflow-hidden rounded-2xl bg-card shadow-soft" data-testid="history-block-picker">
        {blocks.map(({ ref, change }) => {
          const target = blockRestoreHistoryId(change, row, diff.data ?? null);
          const waiting = change === "edited" && needsDiff && diff.isPending;
          const label =
            change === "removed"
              ? t("blocks.bringBack")
              : change === "edited"
                ? t("blocks.undoEdit")
                : t("blocks.restore");
          return (
            <li
              key={`${change}:${ref.id}`}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{strings.blockName(ref.type)}</p>
                <div className="mt-1 flex items-center gap-2">
                  <ChangeChip change={change} />
                  {change === "edited" && !waiting && !target && (
                    <span className="text-[11px] text-muted-foreground">{t("blocks.noPrevious")}</span>
                  )}
                </div>
              </div>
              {waiting ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              ) : target ? (
                <button
                  type="button"
                  onClick={() => onPick(ref, change, target)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {target.mode === "undo_edit" ? (
                    <Undo2 className="size-3.5" aria-hidden />
                  ) : (
                    <RotateCcw className="size-3.5" aria-hidden />
                  )}
                  {label}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
