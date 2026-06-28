"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { CalendarRange, ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import {
  getDashboardCalendar,
  listProviders,
  idOf,
  STATUS_META,
  type CalendarItem,
  type CalendarPlatformItem,
  type CalendarGoogleItem,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { cn } from "@/lib/utils";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { PaneHeader, PaneLoading } from "../shared";

type View = "week" | "month";

// ── date helpers ───────────────────────────────────────────────────────────
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parse(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
/** Sunday→Saturday of the week containing `anchor`. */
function weekDaysFor(anchor: Date): Date[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
/** 6×7 grid of days for the visible month (leading days back to Sunday). */
function monthGrid(cursor: Date): Date[] {
  const first = startOfMonth(cursor);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
/** The from/to (YYYY-MM-DD) range covering the visible week or month grid. */
function rangeFor(cursor: Date, view: View): { from: string; to: string } {
  const days = view === "month" ? monthGrid(cursor) : weekDaysFor(cursor);
  return { from: ymd(days[0]), to: ymd(days[days.length - 1]) };
}
/** Group items by local YYYY-MM-DD of their start time, each list sorted by start. */
function itemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const it of items) {
    const d = parse(it.startTimeUTC);
    if (!d) continue;
    const key = ymd(d);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  for (const list of map.values()) {
    list.sort(
      (a, b) =>
        (parse(a.startTimeUTC)?.getTime() ?? 0) -
        (parse(b.startTimeUTC)?.getTime() ?? 0),
    );
  }
  return map;
}

const GOOGLE_COLOR = "#ffaf05";
const isGoogleAllDay = (i: CalendarItem) =>
  i.source === "google" && i.isAllDay === true;
const platformColor = (i: CalendarPlatformItem): string => {
  const status = i.booking?.status ?? i.status;
  return (status && STATUS_META[status]?.color) || "#3b82f6";
};

export function CalendarPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const tc = useTranslations("common");
  const locale = useLocale();

  const [providerId, setProviderId] = useState("");
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => ymd(new Date()));
  const [googleEvent, setGoogleEvent] = useState<CalendarGoogleItem | null>(null);
  // Day whose bookings are shown in a popup (month view).
  const [dayModal, setDayModal] = useState<string | null>(null);

  const providers = useQuery({
    queryKey: ["booking-providers", profileId],
    queryFn: () => listProviders(profileId),
  });

  const { from, to } = useMemo(() => rangeFor(cursor, view), [cursor, view]);

  const calendar = useQuery({
    queryKey: ["booking-calendar", profileId, providerId, from, to],
    queryFn: () =>
      getDashboardCalendar({
        profileId,
        providerId: providerId || undefined,
        from,
        to,
      }),
  });

  const byDay = useMemo(() => itemsByDay(calendar.data ?? []), [calendar.data]);

  // Localized short weekday labels, Sunday-first (2023-01-01 is a Sunday).
  const weekdayLabels = useMemo(() => {
    const base = new Date(2023, 0, 1);
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(addDays(base, i)));
  }, [locale]);

  const fmtTime = (value?: string): string => {
    const d = parse(value);
    return d ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(d) : "";
  };
  const periodLabel = useMemo(() => {
    if (view === "month") {
      return new Intl.DateTimeFormat(locale, {
        month: "long",
        year: "numeric",
      }).format(cursor);
    }
    const w = weekDaysFor(cursor);
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    return `${fmt.format(w[0])} – ${fmt.format(w[6])}`;
  }, [cursor, view, locale]);

  function navigate(delta: number) {
    setCursor((c) => (view === "month" ? addMonths(c, delta) : addDays(c, delta * 7)));
  }
  function goToday() {
    const now = new Date();
    setCursor(now);
    setSelectedDay(ymd(now));
  }

  // Platform bookings open the existing booking-detail flow; Google busy blocks
  // open a lightweight read-only modal.
  function onSelect(item: CalendarItem) {
    setDayModal(null);
    if (item.source === "platform") {
      const ref = item.booking?.bookingRef || item.id;
      useBookingUi.getState().selectSection("bookings");
      useBookingUi.getState().selectBooking(ref);
    } else {
      setGoogleEvent(item);
    }
  }

  // Month view: clicking a day opens a popup listing that day's bookings.
  function openDay(key: string) {
    setSelectedDay(key);
    setDayModal(key);
  }

  return (
    <div className="flex h-full flex-col">
      <PaneHeader title={t("calendar.title")} />

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-44 sm:w-52">
            <SearchableSelect
              value={providerId}
              options={[
                { value: "", label: t("calendar.allProviders") },
                ...(providers.data ?? []).map(
                  (p): SelectOption<string> => ({ value: idOf(p), label: p.name }),
                ),
              ]}
              onChange={setProviderId}
              title={t("providers.title")}
              searchPlaceholder={tc("search")}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={t("calendar.prev")}
              className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[9rem] text-center text-sm font-semibold">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => navigate(1)}
              aria-label={t("calendar.next")}
              className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={goToday}
              className="ml-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
            >
              {t("calendar.today")}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium capitalize",
                  view === v
                    ? "bg-foreground text-white"
                    : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {t(`calendar.${v}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => calendar.refetch()}
            aria-label={tc("retry")}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <RefreshCw className={cn("size-4", calendar.isFetching && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />
          {t("calendar.booking")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: GOOGLE_COLOR }} />
          {t("calendar.busy")}
        </span>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {calendar.isLoading ? (
          <PaneLoading />
        ) : calendar.isError ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
            <p className="text-sm">{tc("genericError")}</p>
            <button
              type="button"
              onClick={() => calendar.refetch()}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-white"
            >
              {tc("retry")}
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {view === "week" ? (
              <WeekView
                days={weekDaysFor(cursor)}
                byDay={byDay}
                weekdayLabels={weekdayLabels}
                fmtTime={fmtTime}
                onSelect={onSelect}
              />
            ) : (
              <MonthView
                cursor={cursor}
                byDay={byDay}
                weekdayLabels={weekdayLabels}
                selectedDay={selectedDay}
                onSelectDay={openDay}
              />
            )}
          </div>
        )}
      </div>

      {dayModal && (
        <DayEventsModal
          dateStr={dayModal}
          items={byDay.get(dayModal) ?? []}
          locale={locale}
          fmtTime={fmtTime}
          emptyLabel={t("calendar.empty")}
          busyLabel={t("calendar.busy")}
          allDayLabel={t("calendar.allDay")}
          onSelect={onSelect}
          onClose={() => setDayModal(null)}
        />
      )}

      {googleEvent && (
        <GoogleDetailModal
          item={googleEvent}
          locale={locale}
          busyLabel={t("calendar.busy")}
          allDayLabel={t("calendar.allDay")}
          onClose={() => setGoogleEvent(null)}
        />
      )}
    </div>
  );
}

/** Hour label like "9 AM" for the week grid's vertical axis. */
function fmtHour(h: number, locale: string): string {
  const d = new Date(2000, 0, 1, h, 0, 0, 0);
  return new Intl.DateTimeFormat(locale, { hour: "numeric" }).format(d);
}

/** Weekly grid: 7 day columns × hours; timed events are absolutely positioned
 * at their start and sized by duration. Google all-day events sit in a strip
 * above the grid. Color encodes the source/status. */
function WeekView({
  days,
  byDay,
  weekdayLabels,
  fmtTime,
  onSelect,
}: {
  days: Date[];
  byDay: Map<string, CalendarItem[]>;
  weekdayLabels: string[];
  fmtTime: (v?: string) => string;
  onSelect: (i: CalendarItem) => void;
}) {
  const locale = useLocale();
  const weekItems = days.flatMap((d) => byDay.get(ymd(d)) ?? []);
  const timed = weekItems.filter((i) => !isGoogleAllDay(i));

  // Fit the visible hour band to the events (default 8:00–20:00).
  let minH = 8;
  let maxH = 20;
  for (const it of timed) {
    const s = parse(it.startTimeUTC);
    const e = parse(it.endTimeUTC);
    if (s) minH = Math.min(minH, s.getHours());
    if (e) maxH = Math.max(maxH, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
  }
  minH = Math.max(0, minH);
  maxH = Math.min(24, Math.max(maxH, minH + 1));
  const hours = Array.from({ length: maxH - minH }, (_, i) => minH + i);
  const ROW = 48; // px per hour
  const today = ymd(new Date());
  const cols = `48px repeat(7, minmax(0, 1fr))`;
  const hasAllDay = days.some((d) =>
    (byDay.get(ymd(d)) ?? []).some(isGoogleAllDay),
  );

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div className="min-w-[660px]">
        {/* Day headers */}
        <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const isToday = ymd(d) === today;
            return (
              <div key={ymd(d)} className="px-1 py-2 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {weekdayLabels[d.getDay()]}
                </p>
                <p
                  className={cn(
                    "mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                    isToday && "bg-primary text-white",
                  )}
                >
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* All-day (Google) strip */}
        {hasAllDay && (
          <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
            <div className="px-1 py-1 text-end text-[10px] text-muted-foreground">
              all-day
            </div>
            {days.map((d) => (
              <div key={ymd(d)} className="space-y-0.5 p-1">
                {(byDay.get(ymd(d)) ?? []).filter(isGoogleAllDay).map((i) => (
                  <button
                    key={`${i.source}-${i.id}`}
                    type="button"
                    onClick={() => onSelect(i)}
                    className="block w-full truncate rounded px-1 py-0.5 text-start text-[10px]"
                    style={{ backgroundColor: `${GOOGLE_COLOR}26`, color: "#9a6a00" }}
                  >
                    {i.source === "google" ? i.summary || "Busy" : "Busy"}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          {/* Hour axis */}
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: ROW }} className="relative border-b border-border/40">
                <span className="absolute -top-2 right-1 text-[10px] text-muted-foreground">
                  {fmtHour(h, locale)}
                </span>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((d) => {
            const dayTimed = (byDay.get(ymd(d)) ?? []).filter((i) => !isGoogleAllDay(i));
            return (
              <div key={ymd(d)} className="relative border-l border-border/40">
                {hours.map((h) => (
                  <div key={h} style={{ height: ROW }} className="border-b border-border/30" />
                ))}
                {dayTimed.map((it) => {
                  const s = parse(it.startTimeUTC);
                  if (!s) return null;
                  const e = parse(it.endTimeUTC);
                  const startMin = (s.getHours() - minH) * 60 + s.getMinutes();
                  const endMin = e
                    ? (e.getHours() - minH) * 60 + e.getMinutes()
                    : startMin + 30;
                  const top = (startMin / 60) * ROW;
                  const height = Math.max(18, ((endMin - startMin) / 60) * ROW - 2);
                  const google = it.source === "google";
                  const color = google ? GOOGLE_COLOR : platformColor(it);
                  const title = google
                    ? it.summary || "Busy"
                    : it.booking?.customerId?.name ??
                      it.booking?.serviceId?.name ??
                      "Booking";
                  return (
                    <button
                      key={`${it.source}-${it.id}`}
                      type="button"
                      onClick={() => onSelect(it)}
                      style={{
                        top,
                        height,
                        backgroundColor: `${color}26`,
                        borderColor: `${color}80`,
                        color,
                      }}
                      className="absolute inset-x-0.5 overflow-hidden rounded-md border px-1 py-0.5 text-start text-[10px] leading-tight"
                    >
                      <span className="block font-semibold">{fmtTime(it.startTimeUTC)}</span>
                      <span className="block truncate">{title}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Monthly grid: each day cell shows colored dots for the kinds of events it
 * has; clicking a cell opens that day's events in a popup (DayEventsModal). */
function MonthView({
  cursor,
  byDay,
  weekdayLabels,
  selectedDay,
  onSelectDay,
}: {
  cursor: Date;
  byDay: Map<string, CalendarItem[]>;
  weekdayLabels: string[];
  selectedDay: string;
  onSelectDay: (s: string) => void;
}) {
  const grid = monthGrid(cursor);
  const month = cursor.getMonth();
  const today = ymd(new Date());
  return (
    <div className="rounded-2xl border border-border bg-card p-2">
      <div className="grid grid-cols-7">
        {weekdayLabels.map((w) => (
          <div key={w} className="py-1 text-center text-[11px] font-medium text-muted-foreground">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month;
          const dayItems = byDay.get(key) ?? [];
          const nBook = dayItems.filter((i) => i.source === "platform").length;
          const nGoogle = dayItems.filter((i) => i.source === "google").length;
          const isToday = key === today;
          const isSel = key === selectedDay;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(key)}
              className={cn(
                "flex aspect-square flex-col items-center justify-start rounded-lg p-1 text-xs transition-colors",
                isSel ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted",
                !inMonth && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[12px]",
                  isToday ? "bg-primary font-bold text-white" : "font-medium",
                )}
              >
                {d.getDate()}
              </span>
              {(nBook > 0 || nGoogle > 0) && (
                <span className="mt-auto flex gap-0.5 pb-0.5">
                  {nBook > 0 && <span className="size-1.5 rounded-full" style={{ backgroundColor: "#3b82f6" }} />}
                  {nGoogle > 0 && <span className="size-1.5 rounded-full" style={{ backgroundColor: GOOGLE_COLOR }} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Popup listing a selected day's events (month view). Bottom-sheet on mobile,
 * centered dialog on desktop — same chrome as the other calendar modals. */
function DayEventsModal({
  dateStr,
  items,
  locale,
  fmtTime,
  emptyLabel,
  busyLabel,
  allDayLabel,
  onSelect,
  onClose,
}: {
  dateStr: string;
  items: CalendarItem[];
  locale: string;
  fmtTime: (v?: string) => string;
  emptyLabel: string;
  busyLabel: string;
  allDayLabel: string;
  onSelect: (i: CalendarItem) => void;
  onClose: () => void;
}) {
  const label = dateStr
    ? new Intl.DateTimeFormat(locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date(`${dateStr}T00:00:00`))
    : "";
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-[0_2px_24px_rgba(0,0,0,0.18)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <p className="text-sm font-bold">{label}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <AgendaRow
                  key={`${it.source}-${it.id}`}
                  item={it}
                  timeLabel={
                    isGoogleAllDay(it)
                      ? allDayLabel
                      : `${fmtTime(it.startTimeUTC)} – ${fmtTime(it.endTimeUTC)}`
                  }
                  busyLabel={busyLabel}
                  onSelect={() => onSelect(it)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** A single row in the day list — clickable. Color/badge encode the source. */
function AgendaRow({
  item,
  timeLabel,
  busyLabel,
  onSelect,
}: {
  item: CalendarItem;
  timeLabel: string;
  busyLabel: string;
  onSelect: () => void;
}) {
  if (item.source === "google") {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-stretch gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-3 text-start hover:bg-muted"
      >
        <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: GOOGLE_COLOR }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{timeLabel}</p>
          <p className="truncate text-sm font-semibold text-muted-foreground">
            {item.summary || busyLabel}
          </p>
        </div>
        <span
          className="self-center rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ backgroundColor: `${GOOGLE_COLOR}1f`, color: GOOGLE_COLOR }}
        >
          {busyLabel}
        </span>
      </button>
    );
  }
  const color = platformColor(item);
  const customer = item.booking?.customerId?.name;
  const service = item.booking?.serviceId?.name;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-stretch gap-3 rounded-2xl bg-card p-3 text-start shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
    >
      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{timeLabel}</p>
        <p className="truncate text-sm font-semibold">{customer ?? "—"}</p>
        {service && <p className="truncate text-xs text-muted-foreground">{service}</p>}
      </div>
    </button>
  );
}

/** Read-only detail for a Google busy block (platform items use the bookings pane). */
function GoogleDetailModal({
  item,
  locale,
  busyLabel,
  allDayLabel,
  onClose,
}: {
  item: CalendarGoogleItem;
  locale: string;
  busyLabel: string;
  allDayLabel: string;
  onClose: () => void;
}) {
  const fmt = (v?: string) => {
    const d = parse(v);
    return d
      ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(d)
      : "";
  };
  const when = item.isAllDay
    ? allDayLabel
    : `${fmt(item.startTimeUTC)} – ${new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
        parse(item.endTimeUTC) ?? new Date(),
      )}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-5 shadow-[0_2px_24px_rgba(0,0,0,0.18)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${GOOGLE_COLOR}1f`, color: GOOGLE_COLOR }}
            >
              <CalendarRange className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold">{item.summary || busyLabel}</p>
              <span
                className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: `${GOOGLE_COLOR}1f`, color: GOOGLE_COLOR }}
              >
                Google
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="text-sm font-medium">{when}</p>
      </div>
    </div>
  );
}
