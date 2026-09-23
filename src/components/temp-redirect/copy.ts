import type { TempRedirectError } from "@/lib/temp-redirect/errors";

/** A `useTranslations("tempRedirect")` function. */
type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * Mobile `formatMoment`: time alone when the moment is today, otherwise date +
 * time. Device-local for display; the wire is always UTC.
 */
export function formatMoment(moment: Date, locale: string): string {
  const now = new Date();
  const sameDay =
    moment.getFullYear() === now.getFullYear() &&
    moment.getMonth() === now.getMonth() &&
    moment.getDate() === now.getDate();
  const time: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat(
    locale,
    sameDay ? time : { month: "short", day: "numeric", ...time },
  ).format(moment);
}

/** Mobile `TRK.presetDays`: singular, 2–10, and an 11+ form (Arabic needs it). */
export function presetDaysLabel(t: T, count: number): string {
  if (count === 1) return t("presetDay");
  return count >= 11 ? t("presetDaysMany", { count }) : t("presetDays", { count });
}

/** Mobile `TRK.activeHits` — same three-way split. */
export function activeHitsLabel(t: T, count: number): string {
  if (count === 1) return t("activeHit");
  return count >= 11 ? t("activeHitsMany", { count }) : t("activeHits", { count });
}

/**
 * Mobile `tempRedirectErrorMessage`: only codes with their own sentence are
 * mapped; the untyped 400, a transport failure and the rest fall back to the
 * generic message rather than English server text. The rate limiter counts per
 * IP (a conference booth is one IP), so THROTTLED gets "try later" — the one
 * message that does not invite another tap.
 */
export function tempRedirectErrorMessage(
  error: TempRedirectError | null,
  t: T,
  genericError: string,
): string {
  if (error) {
    if (error.isPlanError) return t("locked");
    if (error.isDisabled) return t("unavailable");
    if (error.isInvalidUrl) return t("badUrl");
    if (error.isThrottled) return t("unavailable");
    if (error.isInvalidEndTime && error.limitDays != null) {
      return t("badTime", { days: error.limitDays });
    }
  }
  return genericError;
}
