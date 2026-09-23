"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarCheck } from "lucide-react";
import { type ContactEvent } from "@/lib/api/contacts";
import { contactsCountLabel, formatMoment } from "@/components/contacts/shared";

/**
 * The active-session banner at the top of the book — web mirror of mobile
 * `event_banner.dart` (ux-design §14.1): *"Damascus Expo · 14 contacts ·
 * ends 18:00"* with **End**. Its whole job is to make the session
 * impossible to forget.
 */
export function EventBanner({
  event,
  busy = false,
  onTap,
  onEnd,
}: {
  event: ContactEvent;
  /** Greys the End action while a request runs. */
  busy?: boolean;
  onTap: () => void;
  onEnd?: () => void;
}) {
  const t = useTranslations("contacts");
  const locale = useLocale();
  const summary = eventBannerSummary(t, locale, event);

  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-secondary/25 bg-secondary/10 pe-1 ps-3">
      <button
        type="button"
        onClick={onTap}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-start"
      >
        <CalendarCheck className="size-3.5 shrink-0 text-secondary" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-foreground" dir="auto">
            {event.name}
          </span>
          {summary && (
            <span className="block truncate text-xs text-muted-foreground">
              {summary}
            </span>
          )}
        </span>
      </button>
      {onEnd && (
        <button
          type="button"
          disabled={busy}
          onClick={onEnd}
          className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-secondary hover:bg-secondary/10 disabled:opacity-50"
        >
          {t("evEnd")}
        </button>
      )}
    </div>
  );
}

/**
 * "14 contacts · ends 18:00" — the count is omitted when unknown; the end
 * time shows the date too when it is not today (mobile `EventBanner.summary`).
 */
export function eventBannerSummary(
  t: ReturnType<typeof useTranslations>,
  locale: string,
  event: ContactEvent,
): string {
  const parts: string[] = [];
  if (event.contactsCount != null) parts.push(contactsCountLabel(t, event.contactsCount));
  if (event.endsAt) parts.push(t("evEndsAt", { time: formatMoment(locale, event.endsAt) }));
  return parts.join(" · ");
}
