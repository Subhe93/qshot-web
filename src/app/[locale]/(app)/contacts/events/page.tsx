"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  ChevronRight,
  Clock,
  Info,
  Play,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  FC,
  endContactEvent,
  getActiveContactEvent,
  listContactEvents,
  readContactsError,
  sortContactEvents,
  startContactEvent,
  type ContactEvent,
} from "@/lib/api/contacts";
import {
  GateBoundary,
  contactsCountLabel,
  formatMoment,
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";
import { EventBanner } from "@/components/contacts/event-banner";
import { useContactSaveToast } from "@/components/contacts/save-toast";

/**
 * Event mode — web port of mobile `contact_events_layout.dart`. While a
 * session runs, EVERY contact added — from any source — gets its tag and
 * `metadata.eventId`; starting a session ends any other one, and every
 * session has a forced close (api-spec §8.2 / ux-design §14.1).
 * Gated by `contacts_event_mode` (a Business-tier feature).
 */
export default function ContactEventsPage() {
  const t = useTranslations("contacts");
  const ent = useContactsEntitlements();
  const gate = resolveGate(ent, FC.eventMode);

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label={t("close")}
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("evTitle")}</h1>
      </div>

      <div className="mt-5">
        <GateBoundary
          gate={gate}
          lockedTitle={t("evLockedTitle")}
          lockedBody={t("evLockedBody")}
          onRetry={() => void ent.refetch()}
        >
          <Events />
        </GateBoundary>
      </div>
    </div>
  );
}

function Events() {
  const t = useTranslations("contacts");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const showToast = useContactSaveToast((s) => s.show);
  const activeQ = useQuery({
    queryKey: ["contact-event-active"],
    queryFn: getActiveContactEvent,
  });
  const historyQ = useQuery({
    queryKey: ["contact-events"],
    queryFn: listContactEvents,
  });

  const [startOpen, setStartOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState<ContactEvent | null>(null);

  // Mobile `Application.contactsChangedTag`: the book re-reads its rows and
  // the banner re-reads the session after every start/end.
  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ["contact-event-active"] });
    void queryClient.invalidateQueries({ queryKey: ["contact-events"] });
    void queryClient.invalidateQueries({ queryKey: ["contacts"] });
    void queryClient.invalidateQueries({ queryKey: ["contacts-summary"] });
  }

  // Mobile pops the sheet first and says a failure out loud (toast) — the
  // cubit's `actionError` listener — rather than keeping a form open.
  const startM = useMutation({
    mutationFn: ({ name, endsAt }: { name: string; endsAt: string }) =>
      startContactEvent(name, endsAt),
    onSuccess: invalidateAll,
    onError: async (e) => {
      const err = await readContactsError(e);
      showToast({ message: err.message || t("genericError") });
    },
  });
  const endM = useMutation({
    mutationFn: (id: string) => endContactEvent(id),
    onSuccess: invalidateAll,
    onError: async (e) => {
      const err = await readContactsError(e);
      showToast({ message: err.message || t("genericError") });
    },
  });
  const busy = startM.isPending || endM.isPending;

  const active = activeQ.data ?? null;
  // Mobile `Future.wait`s both reads before drawing anything; `null` is a
  // valid active value, so gate on pending/error, never on truthiness.
  const loading = activeQ.isPending || historyQ.isPending;
  const failed =
    (activeQ.isError && activeQ.data === undefined) ||
    (historyQ.isError && historyQ.data === undefined);

  if (loading) {
    return (
      <div className="space-y-2.5" aria-busy>
        {[120, 64, 64, 64, 64].map((h, i) => (
          <div
            key={i}
            className="animate-pulse rounded-[14px] bg-muted"
            style={{ height: h }}
          />
        ))}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="rounded-xl border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("genericError")}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            void activeQ.refetch();
            void historyQ.refetch();
          }}
        >
          <RefreshCw className="size-4" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  const history = sortContactEvents(historyQ.data ?? []);
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Active session */}
      {active ? (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs font-bold text-secondary">{t("evActiveLabel")}</p>
          <EventBanner
            event={active}
            busy={busy}
            onTap={() => router.push(`/contacts/events/${active._id}`)}
            onEnd={() => setConfirmEnd(active)}
          />
          {/* Starting another session ends this one — mobile still offers it. */}
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => setStartOpen(true)}
          >
            <Plus className="size-4" />
            {t("evStart")}
          </Button>
        </div>
      ) : (
        <div className="rounded-[14px] bg-muted p-4">
          <p className="text-sm font-bold text-foreground">{t("evNoActive")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("evNoActiveHint")}</p>
          <Button
            variant="gradient"
            className="mt-3.5 w-full"
            disabled={busy}
            onClick={() => setStartOpen(true)}
          >
            <Play className="size-4" />
            {t("evStart")}
          </Button>
        </div>
      )}

      {/* History */}
      <div>
        <p className="mb-2.5 text-sm font-bold text-foreground">{t("evHistory")}</p>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Calendar className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("evHistoryEmpty")}</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {history.map((ev) => {
              const when = ev.startedAt ?? ev.endsAt;
              const parts = [
                when ? dateFmt.format(new Date(when)) : null,
                ev.contactsCount != null ? contactsCountLabel(t, ev.contactsCount) : null,
              ].filter(Boolean);
              return (
                <li key={ev._id}>
                  <Link
                    href={`/contacts/events/${ev._id}`}
                    className="flex items-center gap-3 rounded-[14px] bg-card px-3 py-2.5 shadow-[0_3px_10px_rgba(0,0,0,0.06)] transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full",
                        ev.isActive
                          ? "bg-secondary/12 text-secondary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {ev.isActive ? (
                        <CalendarCheck className="size-4" />
                      ) : (
                        <Calendar className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-sm font-bold text-foreground"
                        dir="auto"
                      >
                        {ev.name}
                      </span>
                      {parts.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {parts.join(" · ")}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60 rtl:rotate-180" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {startOpen && (
        <StartSheet
          hasActive={active != null}
          onClose={() => setStartOpen(false)}
          onStart={(name, endsAt) => {
            setStartOpen(false);
            startM.mutate({ name, endsAt });
          }}
        />
      )}

      <ConfirmDialog
        open={confirmEnd != null}
        type="warning"
        title={t("evEndTitle")}
        message={t("evEndMessage", { name: confirmEnd?.name ?? "" })}
        confirmText={t("evEnd")}
        cancelText={t("cancel")}
        onConfirm={() => {
          const target = confirmEnd;
          setConfirmEnd(null);
          if (target) endM.mutate(target._id);
        }}
        onCancel={() => setConfirmEnd(null)}
      />
    </div>
  );
}

/** Local wall time → the `datetime-local` value format (no seconds). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Mobile `ContactEventsCubit.defaultEndsAt`: tonight 23:59 local. */
function defaultEndsAt(): Date {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return d;
}

/**
 * Name + end time; hands `(name, endsAt)` back on confirm. The default end
 * is tonight 23:59 — every session has a forced close (§14.1) — and the note
 * says that starting ends any other session (highlighted when one runs).
 */
function StartSheet({
  hasActive,
  onClose,
  onStart,
}: {
  hasActive: boolean;
  onClose: () => void;
  onStart: (name: string, endsAtIso: string) => void;
}) {
  const t = useTranslations("contacts");
  const locale = useLocale();
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState(() => toLocalInput(defaultEndsAt()));
  const [nameError, setNameError] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);

  const now = new Date();
  const max = new Date(now.getTime() + 365 * 86_400_000);
  const parsedEnd = endsAt ? new Date(endsAt) : null;
  const endValid = parsedEnd != null && !Number.isNaN(parsedEnd.getTime());

  function confirm() {
    const clean = name.trim();
    if (!clean) {
      setNameError(t("evNameRequired"));
      return;
    }
    if (!endValid || parsedEnd.getTime() <= Date.now()) {
      setTimeError(t("evEndsPast"));
      return;
    }
    onStart(clean, parsedEnd.toISOString());
  }

  return (
    <BottomSheet title={t("evStartTitle")} onClose={onClose}>
      <div className="space-y-3.5 pb-4">
        <div>
          <label
            htmlFor="ev-name"
            className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground"
          >
            {t("evNameLabel")}
          </label>
          <input
            id="ev-name"
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && confirm()}
            placeholder={t("evNameHint")}
            dir="auto"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? "ev-name-error" : undefined}
            className="h-11 w-full rounded-xl bg-muted px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {nameError && (
            <p id="ev-name-error" role="alert" className="mt-1.5 text-xs text-error">
              {nameError}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="ev-ends"
            className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground"
          >
            {t("evEndsLabel")}
          </label>
          <div className="relative">
            <Clock className="pointer-events-none absolute start-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="ev-ends"
              type="datetime-local"
              value={endsAt}
              min={toLocalInput(now)}
              max={toLocalInput(max)}
              onChange={(e) => {
                setEndsAt(e.target.value);
                if (timeError) setTimeError(null);
              }}
              aria-invalid={!!timeError}
              aria-describedby={timeError ? "ev-ends-error" : undefined}
              className="h-11 w-full rounded-xl border border-input bg-card ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {endValid && !timeError && (
            <p className="mt-1 px-1 text-xs text-muted-foreground">
              {formatMoment(locale, parsedEnd)}
            </p>
          )}
          {timeError && (
            <p id="ev-ends-error" role="alert" className="mt-1.5 text-xs text-error">
              {timeError}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2">
          <Info
            className={cn(
              "mt-0.5 size-3.5 shrink-0",
              hasActive ? "text-warning" : "text-muted-foreground",
            )}
          />
          <p className={cn("text-xs", hasActive ? "text-foreground" : "text-muted-foreground")}>
            {t("evStartNote")}
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <Button variant="gradient" className="w-full" onClick={confirm}>
            <Play className="size-4" />
            {t("evStartConfirm")}
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
