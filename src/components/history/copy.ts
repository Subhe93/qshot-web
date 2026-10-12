"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { HistoryApiError, HistoryRow } from "@/lib/api/history";
import { blockLabelKey, localDayOf, type HistoryStrings } from "@/lib/history/summary";

/** A `useTranslations(...)` function (no global message typing in this app). */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** `09:12` in the user's locale and time zone; `""` for an unreadable instant. */
export function formatClock(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

export interface ClockRange {
  from: string;
  to: string;
}

/**
 * `09:00` → `09:12` when the session spans more than one minute (§6.2.3 "the
 * time range startedAt–endedAt when they differ"); `null` otherwise. Two
 * parts, not one string: the UI isolates each with `<bdi>` so an Arabic
 * "10:00 ص" keeps its own order on either side of the dash.
 */
export function formatRange(startedAt: string, endedAt: string, locale: string): ClockRange | null {
  const from = formatClock(startedAt, locale);
  const to = formatClock(endedAt, locale);
  if (!from || !to || from === to) return null;
  return { from, to };
}

/** Day header for a `groupByDay` key: Today / Yesterday / a long date. */
export function dayHeading(day: string, locale: string, t: Translate): string {
  if (!day) return "";
  const now = new Date();
  if (day === localDayOf(now.toISOString())) return t("today");
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDayOf(yesterday.toISOString())) return t("yesterday");
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(y === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

/** A settings value for the compare list: strings as-is, else compact JSON, clipped. */
export function compactValue(value: unknown, max = 80): string {
  if (value === null || value === undefined) return "—";
  let text: string;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value) ?? String(value);
    } catch {
      text = String(value);
    }
  }
  if (text === "") return "—";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export type HistoryActionContext = "restore" | "block" | "page" | "pin" | "list";

/**
 * §9 error → one sentence. Only codes with their own meaning get a specific
 * line; the rest fall back to the generic message rather than English server
 * text. `unauthorized` is handled globally (the client signs the user out),
 * so it only needs a harmless fallback here.
 */
export function historyErrorMessage(
  error: HistoryApiError,
  t: Translate,
  genericError: string,
  context: HistoryActionContext = "list",
): string {
  switch (error.code) {
    case "forbidden":
      return t("cantView");
    case "not_found":
      return context === "block" ? t("block.notFound") : t("notFound");
    case "validation":
      return t("restore.invalid");
    case "deleted_page":
      return t("restore.deletedPage");
    case "conflict":
      if (context === "pin") return t("pin.limit");
      // §5.8: "already restored" and "no free URL name" share one 409 and are
      // told apart only by English prose — one neutral sentence covers both
      // (the caller reloads the list, which shows `restoredPageId` if set).
      if (context === "page") return t("restorePage.conflict");
      return genericError;
    case "network":
      return t("network");
    default:
      return genericError;
  }
}

/** Who made the row (§6.2.3): "You" / "Company account" / "QShot support" / nothing. */
export function actorLabel(row: HistoryRow, selfId: string | null, t: Translate): string | null {
  const actor = row.actor;
  if (!actor) return null;
  if (actor.role === "admin") return t("support");
  if (selfId && actor.userId === selfId) return t("you");
  if (actor.role === "company") return t("company");
  // Another owner-role user id (a co-owner, or the id is unknown locally):
  // the row carries only an id, never a name — show nothing rather than guess.
  return null;
}

/** The §6.3 strings, from next-intl, for `summaryLine` / `summaryParts`. */
export function useHistoryStrings(): HistoryStrings {
  const t = useTranslations("history");
  const tb = useTranslations("builder.blocks");
  return useMemo<HistoryStrings>(
    () => ({
      blockName: (type) => {
        const key = blockLabelKey(type);
        return key ? tb(key) : type || tb("block");
      },
      blocksAdded: (n) => t("summary.blocksAdded", { count: n }),
      blocksRemoved: (n) => t("summary.blocksRemoved", { count: n }),
      blocksEdited: (n) => t("summary.blocksEdited", { count: n }),
      blockAdded: (name) => t("summary.blockAdded", { name }),
      blockRemoved: (name) => t("summary.blockRemoved", { name }),
      blockEdited: (name) => t("summary.blockEdited", { name }),
      reordered: t("summary.reordered"),
      designChanged: t("summary.designChanged"),
      pageSettingsChanged: t("summary.pageSettingsChanged"),
      sourceLabel: (source) => t(`source.${source}`),
    }),
    [t, tb],
  );
}

/** Everything a row shows, resolved once by the screen and shared by the sheets. */
export interface HistoryRowView {
  row: HistoryRow;
  /** `endedAt` as a clock time. */
  time: string;
  /** `startedAt` → `endedAt`, or `null` when they fall in the same minute. */
  range: ClockRange | null;
  who: string | null;
  page: string;
  summary: string;
  /** §3.3 label; shown as a badge for every source but `editor`. */
  sourceLabel: string;
}
