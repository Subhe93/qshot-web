"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft,
  CalendarCheck,
  CircleCheck,
  UserX,
  Banknote,
  Ban,
  Loader2,
  MousePointer2,
} from "lucide-react";
import {
  listBookings,
  getBooking,
  updateBookingStatus,
  refundBooking,
  BOOKING_STATUSES,
  STATUS_META,
  type BookingStatus,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import {
  MasterDetail,
  PaneHeader,
  StatusBadge,
  SectionCard,
  InfoRow,
  EmptyState,
  PaneLoading,
} from "../shared";

export function BookingsPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const ts = useTranslations("booking.status");
  const locale = useLocale();
  const [filter, setFilter] = useState<BookingStatus | null>(null);
  const detail = useBookingUi((s) => s.detail);
  const selectBooking = useBookingUi((s) => s.selectBooking);

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", profileId, filter],
    queryFn: () => listBookings({ profileId, status: filter, limit: 50 }),
  });
  const items = data?.items ?? [];
  const selectedRef = detail.type === "booking" ? detail.ref : null;

  const list = (
    <div>
      <PaneHeader title={t("nav.bookings")} />
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2.5">
        <Chip active={filter === null} label={ts("all")} onClick={() => setFilter(null)} />
        {BOOKING_STATUSES.map((s) => (
          <Chip
            key={s}
            active={filter === s}
            label={ts(STATUS_META[s].key)}
            color={STATUS_META[s].color}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      {isLoading ? (
        <PaneLoading />
      ) : items.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="size-10 opacity-40" />} text={t("bookings.empty")} />
      ) : (
        <div className="space-y-2 p-3">
          {items.map((b) => {
            const date =
              b.startTimeUTC || b.slotStart
                ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(b.startTimeUTC || b.slotStart!),
                  )
                : "";
            return (
              <button
                key={b.bookingRef}
                type="button"
                onClick={() => selectBooking(b.bookingRef)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-start transition-colors ${
                  selectedRef === b.bookingRef ? "border-primary" : "border-transparent hover:bg-muted/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {b.customer?.name ?? b.customerId?.name ?? "—"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.service?.name} · {date}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const detailNode = selectedRef ? (
    <BookingDetail profileId={profileId} bookingRef={selectedRef} />
  ) : (
    <EmptyState icon={<MousePointer2 className="size-10 opacity-40" />} text={t("bookings.selectHint")} />
  );

  return <MasterDetail list={list} detail={detailNode} hasDetail={!!selectedRef} />;
}

function Chip({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors"
      style={
        active
          ? {
              backgroundColor: `${color ?? "#1f1f26"}1f`,
              borderColor: `${color ?? "#1f1f26"}73`,
              color: color ?? "#1f1f26",
            }
          : { backgroundColor: "var(--muted)", borderColor: "transparent", color: "var(--muted-foreground)" }
      }
    >
      {label}
    </button>
  );
}

function BookingDetail({ profileId, bookingRef }: { profileId: string; bookingRef: string }) {
  const t = useTranslations("booking");
  const td = useTranslations("booking.detail");
  const locale = useLocale();
  const qc = useQueryClient();
  const clearDetail = useBookingUi((s) => s.clearDetail);

  const { data: b, isLoading } = useQuery({
    queryKey: ["booking", bookingRef],
    queryFn: () => getBooking(bookingRef),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["booking", bookingRef] });
    qc.invalidateQueries({ queryKey: ["bookings", profileId] });
  };
  const status = useMutation({
    mutationFn: (s: BookingStatus) => updateBookingStatus(bookingRef, s),
    onSuccess: invalidate,
  });
  const refund = useMutation({
    mutationFn: () => refundBooking(bookingRef),
    onSuccess: invalidate,
  });

  if (isLoading) return <PaneLoading />;
  if (!b) return <EmptyState text={t("bookings.empty")} />;

  const meta = STATUS_META[b.status];
  const money = (n?: number) =>
    n == null
      ? undefined
      : new Intl.NumberFormat(locale, { style: "currency", currency: b.currency || "USD" }).format(n);
  const start = b.startTimeUTC || b.slotStart;
  const cust = b.customer ?? b.customerId;
  const canComplete = b.status === "confirmed";
  const canRefund = (b.refundable ?? ["confirmed", "completed"].includes(b.status)) && (b.totalAmount ?? 0) > 0;
  const canCancel = ["pending_payment", "confirmed"].includes(b.status);

  return (
    <div className="flex h-full flex-col">
      {/* Hero */}
      <div
        className="flex flex-col items-center gap-2 px-4 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}b3)` }}
      >
        <button
          type="button"
          onClick={clearDetail}
          className="absolute start-3 flex size-9 items-center justify-center rounded-full bg-white/20 md:hidden"
          aria-label="Back"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <p className="text-lg font-bold">{t(`status.${meta.key}`)}</p>
        <p className="text-xs text-white/80">#{b.bookingRef}</p>
        {money(b.totalAmount) && <p className="text-2xl font-extrabold">{money(b.totalAmount)}</p>}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <SectionCard title={td("customer")}>
          <InfoRow label={t("providers.name")} value={cust?.name} />
          <InfoRow label={t("providers.email")} value={cust?.email} />
          <InfoRow label={t("providers.phone")} value={cust?.phone ?? undefined} />
        </SectionCard>

        <SectionCard title={td("schedule")}>
          <InfoRow label={td("service")} value={b.service?.name} />
          <InfoRow label={td("duration")} value={b.service?.duration ? `${b.service.duration} ${t("units.min")}` : undefined} />
          <InfoRow label={td("provider")} value={b.provider?.name} />
          <InfoRow
            label={td("date")}
            value={start ? new Intl.DateTimeFormat(locale, { dateStyle: "full" }).format(new Date(start)) : undefined}
          />
          <InfoRow
            label={td("time")}
            value={start ? new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(new Date(start)) : undefined}
          />
        </SectionCard>

        <SectionCard title={td("payment")}>
          <InfoRow label={td("total")} value={money(b.totalAmount)} bold />
          <InfoRow label={td("deposit")} value={money(b.depositAmount)} />
          <InfoRow label={td("paymentStatus")} value={b.paymentStatus} />
          <InfoRow label={td("refunded")} value={money(b.refundedAmount)} color="#ffaf05" />
        </SectionCard>

        {(b.notes || b.cancellationReason) && (
          <SectionCard title={td("details")}>
            {b.notes && <p className="px-4 py-3 text-sm">{b.notes}</p>}
            {b.cancellationReason && (
              <p className="px-4 py-3 text-sm text-error">{b.cancellationReason}</p>
            )}
          </SectionCard>
        )}
      </div>

      {/* Actions */}
      {(canComplete || canRefund || canCancel) && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-card p-3">
          {canComplete && (
            <button
              type="button"
              onClick={() => status.mutate("completed")}
              disabled={status.isPending}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-success text-sm font-semibold text-white"
            >
              <CircleCheck className="size-4" />
              {t("bookings.markCompleted")}
            </button>
          )}
          {canComplete && (
            <button
              type="button"
              onClick={() => status.mutate("no_show")}
              disabled={status.isPending}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] text-sm font-semibold"
              style={{ borderColor: "#f350547d", color: "#f35054" }}
            >
              <UserX className="size-4" />
              {t("bookings.markNoShow")}
            </button>
          )}
          {canRefund && (
            <button
              type="button"
              onClick={() => refund.mutate()}
              disabled={refund.isPending}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] text-sm font-semibold"
              style={{ borderColor: "#ffaf057d", color: "#ffaf05" }}
            >
              {refund.isPending ? <Loader2 className="size-4 animate-spin" /> : <Banknote className="size-4" />}
              {t("bookings.refund")} {money(b.totalAmount)}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => status.mutate("cancelled")}
              disabled={status.isPending}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] text-sm font-semibold"
              style={{ borderColor: "#81849080", color: "#818490" }}
            >
              {status.isPending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              {t("bookings.cancel")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
