import {
  PLATFORM_REDIRECT_ERROR_CODES as C,
  PLATFORM_REDIRECT_SYNTHETIC as S,
  type PlatformRedirectError,
} from "@/lib/platform-redirect/errors";

/** A `useTranslations("platformLinks")` function. */
export type T = (key: string, values?: Record<string, string | number>) => string;

/**
 * Localised sentence for a refusal (integration guide §7.3/§7.4 tables).
 * `label` is the platform's admin-editable title. Only codes with their own
 * sentence are mapped; everything else falls back to `genericError`, never to
 * the server's English `message`.
 */
export function platformRedirectErrorMessage(
  error: PlatformRedirectError,
  t: T,
  label: string,
  genericError: string,
): string {
  const x = error.extra;
  switch (error.code) {
    case C.hostNotAllowed:
      return t("errHostNotAllowed", { label });
    case C.linkFormatNotAllowed:
      return t("errLinkFormat", { label });
    case C.invalidUrl:
      if (x.reason === "too_long") return t("errInvalidUrlTooLong");
      if (x.reason === "first_party") return t("errInvalidUrlFirstParty", { label });
      if (x.reason === "denied") return t("errInvalidUrlDenied");
      return t("errInvalidUrl");
    case C.platformPaused:
      return t("errPlatformPaused", { label: x.label ?? label });
    case C.platformNotAvailable:
    case C.platformUnknown:
      return t("errPlatformGone");
    case C.featureNotInPlan:
      return t("errNotInPlan");
    case C.featureDisabled:
      return t("unavailableTitle");
    case C.invalidCode:
      return t("errInvalidCode");
    case C.codeNotFound:
      return t("errCodeNotFound");
    case C.codeAlreadyAssigned:
      return t("errCodeAssigned");
    case C.codeDisabled:
      return t("errCodeDisabled");
    case C.codeNotYours:
      return t("errNotYours");
    case C.quotaExceeded:
      return x.limit != null ? t("errQuota", { limit: x.limit }) : t("errQuotaNoLimit");
    case C.tooManyAttempts:
      return t("errTooMany");
    case C.invalidLabel:
      return t("errInvalidLabel", { maxLength: x.maxLength ?? 60 });
    case S.throttled:
      return t("errThrottled");
    case S.network:
      return t("errNetwork");
    default:
      return genericError;
  }
}

/** Whether the refusal should show the server's `examples` under the message. */
export function errorShowsExamples(error: PlatformRedirectError): boolean {
  return (
    (error.code === C.hostNotAllowed || error.code === C.linkFormatNotAllowed) &&
    error.extra.examples.length > 0
  );
}

/**
 * "2 hours ago" / "just now" / "in 3 days", device-local. Falls back to a
 * short date for anything older than a month so a row never says
 * "380 days ago".
 */
export function formatRelative(date: Date, locale: string, now: number = Date.now()): string {
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs > 30 * day) {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(date);
  }
  let rtf: Intl.RelativeTimeFormat;
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  } catch {
    rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  }
  if (abs < minute) return rtf.format(0, "second").replace(/^in 0 seconds$|^0 seconds ago$/, "now");
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  return rtf.format(Math.round(diff / day), "day");
}

/** `m:ss` for the TOO_MANY_ATTEMPTS countdown. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Shorten a URL for a one-line row: scheme dropped, long paths elided. */
export function displayUrl(url: string, max = 56): string {
  const bare = url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (bare.length <= max) return bare;
  return `${bare.slice(0, Math.max(12, max - 14))}…${bare.slice(-12)}`;
}
