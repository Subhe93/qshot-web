import { catalogByType } from "@/lib/builder/catalog";
import type {
  HistoryBlockRef,
  HistoryChange,
  HistoryDiff,
  HistoryRow,
  HistorySource,
} from "@/lib/api/history";

/**
 * Pure helpers for the History screen (contract §6). No React, no i18n: the
 * caller hands in already-translated strings through `HistoryStrings`, so this
 * file is testable from `npx tsx` and reusable by the admin dashboard.
 */

/** Pinned rows never counted toward `HISTORY_KEEP`; at most this many. */
export const HISTORY_PIN_MAX = 10;
/** `label` of `pin`: 1–60 characters, trimmed. */
export const HISTORY_LABEL_MAX = 60;
/** Unpinned rows kept per website, oldest deleted first. */
export const HISTORY_KEEP = 300;

export interface HistoryStrings {
  /** User-facing block name for a stored `type` (`HeaderModule` → "Heading"). */
  blockName(type: string): string;
  blocksAdded(n: number): string;
  blocksRemoved(n: number): string;
  blocksEdited(n: number): string;
  blockAdded(name: string): string;
  blockRemoved(name: string): string;
  blockEdited(name: string): string;
  reordered: string;
  designChanged: string;
  pageSettingsChanged: string;
  /** §3.3 label: "Edited", "Original version", … */
  sourceLabel(source: HistorySource): string;
}

/**
 * §6.3, part by part: one line per non-empty summary field, in the contract's
 * order; a row that changed nothing visible falls back to its source label.
 */
export function summaryParts(row: HistoryRow, s: HistoryStrings): string[] {
  const { added, removed, edited, moved, settings, info } = row.summary;
  const parts: string[] = [];
  if (added.length === 1) parts.push(s.blockAdded(s.blockName(added[0].type)));
  if (added.length > 1) parts.push(s.blocksAdded(added.length));
  if (removed.length === 1) parts.push(s.blockRemoved(s.blockName(removed[0].type)));
  if (removed.length > 1) parts.push(s.blocksRemoved(removed.length));
  if (edited.length === 1) parts.push(s.blockEdited(s.blockName(edited[0].type)));
  if (edited.length > 1) parts.push(s.blocksEdited(edited.length));
  if (moved) parts.push(s.reordered);
  if (settings.length > 0) parts.push(s.designChanged);
  if (info.length > 0) parts.push(s.pageSettingsChanged);
  if (parts.length === 0) parts.push(s.sourceLabel(row.source));
  return parts;
}

export const HISTORY_SUMMARY_SEPARATOR = " · ";

export function summaryLine(row: HistoryRow, s: HistoryStrings): string {
  return summaryParts(row, s).join(HISTORY_SUMMARY_SEPARATOR);
}

/**
 * The i18n key under `builder.blocks.*` for a stored block type, via the
 * builder catalog (the same names the block picker shows); `null` for a type
 * this builder does not know — the UI then shows the raw type.
 */
export function blockLabelKey(type: string): string | null {
  if (!type || !Object.prototype.hasOwnProperty.call(catalogByType, type)) return null;
  return catalogByType[type]?.labelKey ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Grouping by day (§6.2.2)
 * ──────────────────────────────────────────────────────────────────────────── */

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayFormatter(timeZone: string | undefined): Intl.DateTimeFormat | null {
  const key = timeZone ?? "";
  const cached = dayFormatters.get(key);
  if (cached) return cached;
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(key, fmt);
    return fmt;
  } catch {
    return null; // unknown time zone id — fall back to the runtime's local zone
  }
}

/**
 * `YYYY-MM-DD` of an ISO instant in `timeZone` (default: the runtime's local
 * zone). Unparseable input → `null`.
 */
export function localDayOf(iso: string, timeZone?: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const fmt = dayFormatter(timeZone) ?? dayFormatter(undefined);
  if (!fmt) return null;
  const parts = fmt.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  if (!year || !month || !day) return null;
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export interface HistoryDayGroup {
  /** `YYYY-MM-DD` in the given zone; `""` for rows whose `endedAt` is unreadable. */
  day: string;
  rows: HistoryRow[];
}

/**
 * Rows grouped by the local day of `endedAt`. Order is the server's own:
 * `seq` descending (§4: ascending per website, the list's sort key), then
 * `endedAt` descending, then input order — within a day AND across days (a
 * day group sits where its newest row sits). So appending a later cursor
 * page never reorders rows already on screen. Rows without a readable
 * `endedAt` form a last group with `day: ""` so nothing silently disappears.
 */
export function groupByDay(rows: HistoryRow[], timeZone?: string): HistoryDayGroup[] {
  const stamped = rows.map((row, index) => {
    const time = new Date(row.endedAt).getTime();
    return {
      row,
      index,
      seq: Number.isFinite(row.seq) ? row.seq : Number.NEGATIVE_INFINITY,
      time: Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time,
      day: localDayOf(row.endedAt, timeZone) ?? "",
    };
  });
  stamped.sort((a, b) => {
    if (b.seq !== a.seq) return b.seq - a.seq;
    if (b.time !== a.time) return b.time - a.time;
    return a.index - b.index;
  });
  // Groups in order of first appearance = by their newest row.
  const byDay = new Map<string, HistoryDayGroup>();
  for (const entry of stamped) {
    const group = byDay.get(entry.day);
    if (group) group.rows.push(entry.row);
    else byDay.set(entry.day, { day: entry.day, rows: [entry.row] });
  }
  const groups = [...byDay.values()];
  const unreadable = byDay.get("");
  if (unreadable) {
    groups.splice(groups.indexOf(unreadable), 1);
    groups.push(unreadable);
  }
  return groups;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Row actions (§6.2 table)
 * ──────────────────────────────────────────────────────────────────────────── */

export interface HistoryRowActions {
  /** Preview — always except `page_deleted`. */
  preview: boolean;
  /** See changes — not on `initial` / `page_deleted` (nothing to compare). */
  diff: boolean;
  /** Restore this version — not on `page_deleted` (use `restorePage`). */
  restore: boolean;
  /** Restore a block — the row lists added / removed / edited blocks. */
  restoreBlock: boolean;
  /** Restore page — `page_deleted` whose page was not recreated yet. */
  restorePage: boolean;
}

export function rowActions(row: HistoryRow): HistoryRowActions {
  const deleted = row.source === "page_deleted";
  const { added, removed, edited } = row.summary;
  return {
    preview: !deleted,
    diff: !deleted && row.source !== "initial",
    restore: !deleted,
    restoreBlock: !deleted && added.length + removed.length + edited.length > 0,
    restorePage: deleted && row.page?.restoredPageId == null,
  };
}

/** Every block the row's summary lists, tagged with how it changed. */
export function restorableBlocks(row: HistoryRow): { ref: HistoryBlockRef; change: HistoryChange }[] {
  const { added, removed, edited } = row.summary;
  return [
    ...added.map((ref) => ({ ref, change: "added" as const })),
    ...removed.map((ref) => ({ ref, change: "removed" as const })),
    ...edited.map((ref) => ({ ref, change: "edited" as const })),
  ];
}

export type HistoryBlockRestoreMode =
  /** A removed block comes back — send THIS row (§5.5). */
  | "bring_back"
  /** An edit is undone — send the PREVIOUS row (`diff.previous`). */
  | "undo_edit"
  /** The block as it was after this row (an added block, or re-apply an edit). */
  | "as_after";

/**
 * Which `historyId` `restoreHistoryBlock` must receive for a block of this row
 * (§5.5 / §6.7). "Undo this edit" needs the previous row, which only the diff
 * knows: pass `diffHistory(...)`'s result, or `null` to get `null` back when
 * there is no previous state.
 */
export function blockRestoreHistoryId(
  change: HistoryChange,
  row: HistoryRow,
  diff: HistoryDiff | null,
): { historyId: string; mode: HistoryBlockRestoreMode } | null {
  switch (change) {
    case "removed":
      return { historyId: row.id, mode: "bring_back" };
    case "added":
      return { historyId: row.id, mode: "as_after" };
    case "edited": {
      const previous = diff?.previous ?? null;
      return previous ? { historyId: previous.id, mode: "undo_edit" } : null;
    }
    default:
      return null;
  }
}
