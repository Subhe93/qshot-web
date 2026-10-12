"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRight, Loader2, RotateCcw, Shuffle, Undo2 } from "lucide-react";
import {
  diffHistory,
  historyQueryKeys,
  toHistoryError,
  type HistoryBlockRef,
  type HistoryChange,
  type HistoryDiff,
  type HistoryDiffBlock,
  type HistoryRow,
} from "@/lib/api/history";
import {
  blockRestoreHistoryId,
  type HistoryBlockRestoreMode,
  type HistoryStrings,
} from "@/lib/history/summary";
import { parseBlock } from "@/lib/builder/serialization";
import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HistoryFrame } from "./HistoryPreview";
import { compactValue, historyErrorMessage } from "./copy";

export interface BlockRestoreTarget {
  historyId: string;
  mode: HistoryBlockRestoreMode;
}

const CHANGE_STYLE: Record<HistoryChange, string> = {
  added: "bg-success/15 text-success",
  removed: "bg-error/15 text-error",
  edited: "bg-primary/15 text-primary",
};

export function ChangeChip({ change }: { change: HistoryChange }) {
  const t = useTranslations("history.compare");
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        CHANGE_STYLE[change],
      )}
    >
      {t(change)}
    </span>
  );
}

/**
 * §6.5 Compare: `diff` → every changed block before / after, side by side
 * (two phone-width columns from `sm`, stacked on a phone), the reorder note
 * with both orders, and the settings keys `before → after`. Each block offers
 * the §6.7 restore: a removed block comes back from THIS row, an edit is undone
 * from the PREVIOUS row (hidden when the diff has no previous state).
 */
export function HistoryCompare({
  profileId,
  row,
  liveSettings,
  liveBlocks,
  strings,
  onRestoreBlock,
}: {
  profileId: string;
  row: HistoryRow;
  liveSettings: WebsiteSettings;
  /** The page's current blocks, to name unchanged blocks in the order lists. */
  liveBlocks: Block[];
  strings: HistoryStrings;
  onRestoreBlock?: (block: HistoryBlockRef, change: HistoryChange, target: BlockRestoreTarget) => void;
}) {
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const query = useQuery({
    queryKey: historyQueryKeys.diff(profileId, row.id),
    queryFn: () => diffHistory(profileId, row.id),
    staleTime: 60_000,
    retry: false,
  });

  if (query.isPending) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground" role="status">
        <Loader2 className="size-6 animate-spin" />
        <span className="sr-only">{tc("loading")}</span>
      </div>
    );
  }
  if (query.isError) {
    const error = toHistoryError(query.error);
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
        <p>{t("compare.failed")}</p>
        <p className="text-xs">{historyErrorMessage(error, t, tc("genericError"))}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {tc("retry")}
        </Button>
      </div>
    );
  }

  const diff = query.data;
  const empty =
    diff.blocks.length === 0 && !diff.order && diff.settings.length === 0 && diff.info.length === 0;
  if (empty) {
    return <p className="py-10 text-center text-sm text-muted-foreground">{t("compare.empty")}</p>;
  }

  return (
    <div className="space-y-5">
      {diff.blocks.map((entry) => (
        <BlockDiffCard
          key={`${entry.change}:${entry.id}`}
          entry={entry}
          row={row}
          diff={diff}
          liveSettings={liveSettings}
          strings={strings}
          onRestoreBlock={onRestoreBlock}
        />
      ))}

      {diff.order && (
        <OrderCard order={diff.order} diff={diff} liveBlocks={liveBlocks} strings={strings} />
      )}

      {(diff.settings.length > 0 || diff.info.length > 0) && (
        <section className="overflow-hidden rounded-2xl bg-card shadow-soft">
          <h3 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("compare.settings")}
          </h3>
          <ul className="divide-y divide-border px-4 py-1" data-testid="history-settings-diff">
            {[
              ...diff.settings.map((s) => ({ ...s, kind: "settings" })),
              ...diff.info.map((s) => ({ ...s, kind: "info" })),
            ].map((s) => (
              <li key={`${s.kind}:${s.key}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5 text-sm">
                <span className="font-semibold text-foreground">{s.key}:</span>
                <span dir="auto" className="break-all text-muted-foreground line-through decoration-error/60">
                  {compactValue(s.before)}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                <span dir="auto" className="break-all text-foreground">
                  {compactValue(s.after)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BlockDiffCard({
  entry,
  row,
  diff,
  liveSettings,
  strings,
  onRestoreBlock,
}: {
  entry: HistoryDiffBlock;
  row: HistoryRow;
  diff: HistoryDiff;
  liveSettings: WebsiteSettings;
  strings: HistoryStrings;
  onRestoreBlock?: (block: HistoryBlockRef, change: HistoryChange, target: BlockRestoreTarget) => void;
}) {
  const t = useTranslations("history");
  const before = useMemo(() => (entry.before ? parseBlock(entry.before) : null), [entry.before]);
  const after = useMemo(() => (entry.after ? parseBlock(entry.after) : null), [entry.after]);
  const target = blockRestoreHistoryId(entry.change, row, diff);
  const name = strings.blockName(entry.type);

  let restoreLabel: string | null = null;
  if (target) {
    restoreLabel =
      target.mode === "bring_back"
        ? t("blocks.bringBack")
        : target.mode === "undo_edit"
          ? t("blocks.undoEdit")
          : t("blocks.restore");
  }

  return (
    <section
      className="overflow-hidden rounded-2xl bg-card p-3 shadow-soft sm:p-4"
      data-testid="history-block-diff"
      data-change={entry.change}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-foreground">{name}</h3>
        <ChangeChip change={entry.change} />
        {onRestoreBlock && restoreLabel && target && (
          <Button
            variant="outline"
            size="sm"
            className="ms-auto rounded-full"
            onClick={() => onRestoreBlock({ id: entry.id, type: entry.type }, entry.change, target)}
          >
            {target.mode === "undo_edit" ? (
              <Undo2 className="size-4" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            {restoreLabel}
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DiffSide label={t("compare.before")} block={before} settings={liveSettings} />
        <DiffSide label={t("compare.after")} block={after} settings={liveSettings} />
      </div>
    </section>
  );
}

function DiffSide({
  label,
  block,
  settings,
}: {
  label: string;
  block: Block | null;
  settings: WebsiteSettings;
}) {
  const t = useTranslations("history.compare");
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {block ? (
        <HistoryFrame
          settings={settings}
          blocks={[block]}
          hero={false}
          width="fill"
          className="rounded-2xl"
          bodyClassName="max-h-[60vh] overflow-y-auto"
        />
      ) : (
        <div className="flex min-h-24 items-center justify-center rounded-2xl border-2 border-dashed border-border text-xs text-muted-foreground">
          {t("none")}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  diff,
  liveBlocks,
  strings,
}: {
  order: { before: string[]; after: string[] };
  diff: HistoryDiff;
  liveBlocks: Block[];
  strings: HistoryStrings;
}) {
  const t = useTranslations("history.compare");
  const tb = useTranslations("builder.blocks");
  // Names: a changed block's type from the diff; an unchanged block's from the
  // live page; else the generic "Block".
  const typeOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of liveBlocks) map.set(b.id, b.type);
    for (const b of diff.blocks) if (b.type) map.set(b.id, b.type);
    return map;
  }, [diff.blocks, liveBlocks]);
  const nameOf = (id: string) => {
    const type = typeOf.get(id);
    return type ? strings.blockName(type) : tb("block");
  };
  return (
    <section className="overflow-hidden rounded-2xl bg-card p-4 shadow-soft" data-testid="history-order-diff">
      <div className="flex items-center gap-2">
        <Shuffle className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-bold text-foreground">{t("reordered")}</h3>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["before", "after"] as const).map((side) => (
          <div key={side}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {side === "before" ? t("orderBefore") : t("orderAfter")}
            </p>
            <ol className="list-decimal space-y-1 ps-5 text-sm text-foreground">
              {order[side].map((id, i) => (
                <li key={`${id}:${i}`}>{nameOf(id)}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
