"use client";

import { use, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, CalendarCheck, RefreshCw, Users } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  FC,
  getContactEvent,
  toggleFavorite,
  type ContactEvent,
  type ContactEventDetails,
} from "@/lib/api/contacts";
import {
  GateBoundary,
  SOURCE_LABEL_KEY,
  contactsCountLabel,
  formatDateTime,
  formatMoment,
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import { ContactRow } from "@/components/contacts/contact-row";
import { quickActionPref, type ContactQuickAction } from "@/lib/contacts-prefs";
import { cn } from "@/lib/utils";

/**
 * One session — web port of mobile `contact_event_details_layout.dart`
 * (ux-design §14.1): when it ran, a source summary row, and its contacts as
 * book rows. Gated by `contacts_event_mode` like the events page.
 */
export default function ContactEventDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const gate = resolveGate(ent, FC.eventMode);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      {gate !== "enabled" && <TopBar title={t("evTitle")} />}
      <GateBoundary
        gate={gate}
        lockedTitle={t("evLockedTitle")}
        lockedBody={t("evLockedBody")}
        onRetry={() => void ent.refetch()}
      >
        <Details id={id} />
      </GateBoundary>
    </div>
  );
}

function TopBar({ title }: { title: string }) {
  const t = useTranslations("contacts");
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/contacts/events"
        className="text-muted-foreground hover:text-foreground rtl:rotate-180"
        aria-label={t("close")}
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="min-w-0 truncate text-2xl font-bold" dir="auto">
        {title}
      </h1>
    </div>
  );
}

function Details({ id }: { id: string }) {
  const t = useTranslations("contacts");
  const router = useRouter();
  const queryClient = useQueryClient();

  const detailsQ = useQuery({
    queryKey: ["contact-event", id],
    queryFn: () => getContactEvent(id),
  });

  // Same one-tap action preference as the book (mobile ContactQuickAction),
  // read deferred so the SSR markup matches hydration.
  const [quickAction, setQuickAction] = useState<ContactQuickAction>("call");
  useEffect(() => {
    const handle = setTimeout(() => setQuickAction(quickActionPref.get()), 0);
    return () => clearTimeout(handle);
  }, []);

  const favM = useMutation({
    mutationFn: (contactId: string) => toggleFavorite(contactId),
    onSuccess: (updated) => {
      queryClient.setQueryData<ContactEventDetails>(["contact-event", id], (prev) =>
        prev
          ? {
              ...prev,
              contacts: prev.contacts.map((c) => (c._id === updated._id ? updated : c)),
            }
          : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["contacts"] });
      void queryClient.invalidateQueries({ queryKey: ["contacts-summary"] });
    },
  });

  const details = detailsQ.data;
  const name = details?.event.name ?? "";

  return (
    <>
      <TopBar title={name || t("evTitle")} />

      <div className="mt-5">
        {detailsQ.isLoading ? (
          <Shimmer />
        ) : detailsQ.isError || !details ? (
          // Mobile ErrorPlaceholder — an error is never dressed as "empty".
          <div className="mx-auto max-w-md py-20 text-center">
            <p className="text-sm text-muted-foreground">{t("genericError")}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void detailsQ.refetch()}
            >
              <RefreshCw className="size-4" />
              {t("retry")}
            </Button>
          </div>
        ) : (
          <>
            <Header event={details.event} total={details.total} />

            {Object.keys(details.summary).length > 0 && (
              <div className="mt-3">
                <Sources summary={details.summary} />
              </div>
            )}

            <div className="mt-5">
              {details.contacts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-12 text-center">
                  <Users className="mx-auto mb-3 size-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t("evDetailsEmpty")}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  {details.contacts.map((c) => (
                    <ContactRow
                      key={c._id}
                      contact={c}
                      quickAction={quickAction}
                      onOpen={() => router.push(`/contacts/${c._id}`)}
                      onToggleFavorite={() => favM.mutate(c._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Mobile `_buildShimmer`: one header-sized block, then row-sized ones. */
function Shimmer() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={cn("animate-pulse rounded-[14px] bg-muted", i === 0 ? "h-24" : "h-[72px]")}
        />
      ))}
    </div>
  );
}

/**
 * "Active now · 14 contacts · ends 18:00" or "Ended 14 Aug, 18:00 ·
 * 14 contacts" — mobile `_buildHeader`.
 */
function Header({ event, total }: { event: ContactEvent; total: number }) {
  const t = useTranslations("contacts");
  const locale = useLocale();
  const parts: string[] = [];
  if (event.isActive) {
    parts.push(t("evActiveLabel"));
  } else {
    const ended = event.endedAt ?? event.endsAt;
    parts.push(ended ? t("evEndedAt", { time: formatDateTime(locale, ended) }) : t("evEnded"));
  }
  parts.push(contactsCountLabel(t, total));
  if (event.isActive && event.endsAt) {
    parts.push(t("evEndsAt", { time: formatMoment(locale, event.endsAt) }));
  }
  const Icon = event.isActive ? CalendarCheck : Calendar;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-xl px-3 py-2.5",
        event.isActive ? "bg-secondary/10" : "bg-muted",
      )}
    >
      <Icon
        className={cn(
          "size-3.5 shrink-0",
          event.isActive ? "text-secondary" : "text-muted-foreground",
        )}
      />
      <p className="min-w-0 flex-1 text-xs font-semibold text-foreground">
        {parts.join(" · ")}
      </p>
    </div>
  );
}

/** Source → count chips: "QR 7 · Card 4 · Manual 1" — mobile `_buildSources`. */
function Sources({ summary }: { summary: Record<string, number> }) {
  const t = useTranslations("contacts");
  const entries = Object.entries(summary).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground">{t("evSources")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(([source, count]) => (
          <span
            key={source}
            className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
          >
            {/* Unknown sources read as manual, like mobile `sourceLabel`. */}
            {t(SOURCE_LABEL_KEY[source] ?? "sourceManual")} · {count}
          </span>
        ))}
      </div>
    </div>
  );
}
