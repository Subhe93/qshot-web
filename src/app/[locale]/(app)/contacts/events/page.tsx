"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Loader2, Play, Square } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FC,
  endContactEvent,
  getActiveContactEvent,
  listContactEvents,
  readContactsError,
  startContactEvent,
  type ContactEvent,
} from "@/lib/api/contacts";
import {
  GateBoundary,
  resolveGate,
  useContactsEntitlements,
} from "@/components/contacts/shared";

/**
 * Event mode — web port of mobile `contact_events_layout.dart`. While a
 * session runs, EVERY contact added — from any source — gets its tag and
 * `metadata.eventId`; starting a session ends any other one, and every
 * session has a mandatory end time (api-spec §8.2 / feature-guide §6.6).
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
  const queryClient = useQueryClient();
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

  const endM = useMutation({
    mutationFn: (id: string) => endContactEvent(id),
    onSuccess: () => {
      setConfirmEnd(null);
      void queryClient.invalidateQueries({ queryKey: ["contact-event-active"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-events"] });
    },
  });

  const active = activeQ.data;
  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      {/* Active session */}
      {active ? (
        <div className="rounded-xl border border-success/40 bg-success/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-success">
                {t("evActiveLabel")}
              </p>
              <p className="mt-0.5 truncate font-bold text-foreground" dir="auto">
                {active.name}
              </p>
              {active.endsAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("evEndsAt", { time: fmt.format(new Date(active.endsAt)) })}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={endM.isPending}
              onClick={() => setConfirmEnd(active)}
            >
              <Square className="size-4" />
              {t("evEnd")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="font-bold text-foreground">{t("evNoActive")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("evNoActiveHint")}</p>
          <Button
            variant="gradient"
            size="sm"
            className="mt-3"
            onClick={() => setStartOpen(true)}
          >
            <Play className="size-4" />
            {t("evStart")}
          </Button>
        </div>
      )}

      {/* History */}
      <div>
        <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("evHistory")}
        </p>
        {historyQ.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (historyQ.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Calendar className="mx-auto mb-2 size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t("evHistoryEmpty")}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            {(historyQ.data ?? []).map((ev) => (
              <div
                key={ev._id}
                className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground" dir="auto">
                    {ev.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {ev.endedAt
                      ? t("evEndedAt", { time: fmt.format(new Date(ev.endedAt)) })
                      : ev.startedAt
                        ? fmt.format(new Date(ev.startedAt))
                        : ""}
                  </span>
                </span>
                {ev.contactsCount != null && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("evContacts", { n: ev.contactsCount })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {startOpen && <StartSheet onClose={() => setStartOpen(false)} />}

      <ConfirmDialog
        open={confirmEnd != null}
        title={t("evEndTitle")}
        message={t("evEndMessage", { name: confirmEnd?.name ?? "" })}
        confirmText={t("evEnd")}
        cancelText={t("cancel")}
        onConfirm={() => confirmEnd && endM.mutate(confirmEnd._id)}
        onCancel={() => setConfirmEnd(null)}
      />
    </div>
  );
}

function StartSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("contacts");
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const clean = name.trim();
    if (!clean) {
      setError(t("evNameRequired"));
      return;
    }
    if (endsAt && new Date(endsAt).getTime() <= Date.now()) {
      setError(t("evEndsPast"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await startContactEvent(
        clean,
        endsAt ? new Date(endsAt).toISOString() : undefined,
      );
      void queryClient.invalidateQueries({ queryKey: ["contact-event-active"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-events"] });
      onClose();
    } catch (e) {
      const err = await readContactsError(e);
      setError(err.message || t("genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet title={t("evStartTitle")} onClose={onClose}>
      <div className="space-y-4 pb-4">
        <p className="text-sm text-muted-foreground">{t("evStartNote")}</p>
        <div>
          <label className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground">
            {t("evNameLabel")}
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("evNameHint")}
            dir="auto"
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground">
            {t("evEndsLabel")}
          </label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none"
          />
        </div>
        {error && <p className="text-sm text-error">{error}</p>}
        <Button variant="gradient" className="w-full" disabled={busy} onClick={start}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : t("evStartConfirm")}
        </Button>
      </div>
    </BottomSheet>
  );
}
