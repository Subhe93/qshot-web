"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { CalendarCheck, CheckCircle2, Star, XCircle, CreditCard } from "lucide-react";
import {
  getBookingAnalytics,
  getStripeStatus,
  listBookings,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { StatusBadge, PaneLoading } from "../shared";

export function HomePane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const tk = useTranslations("booking.kpi");
  const locale = useLocale();
  const selectSection = useBookingUi((s) => s.selectSection);

  const analytics = useQuery({
    queryKey: ["booking-analytics", profileId],
    queryFn: () => getBookingAnalytics(profileId),
  });
  const stripe = useQuery({
    queryKey: ["booking-stripe", profileId],
    queryFn: () => getStripeStatus(profileId),
  });
  const upcoming = useQuery({
    queryKey: ["booking-upcoming", profileId],
    queryFn: () => listBookings({ profileId, status: "confirmed", limit: 5 }),
  });

  if (analytics.isLoading) return <PaneLoading />;

  const a = analytics.data ?? {};
  const ov = a.overview ?? {};
  const stripeConnected = stripe.data?.connected ?? !!stripe.data?.chargesEnabled;
  const fmtMoney = (n?: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: a.currency || "USD",
      maximumFractionDigits: 0,
    }).format(n ?? 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Stripe status */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: stripeConnected ? "#3b82f60f" : "#ffaf0514",
            border: `1px solid ${stripeConnected ? "#3b82f633" : "#ffaf054d"}`,
          }}
        >
          <CreditCard
            className="size-5"
            style={{ color: stripeConnected ? "#3b82f6" : "#ffaf05" }}
          />
          <div>
            <p className="text-sm font-semibold">{t("stripe")}</p>
            <p className="text-xs text-muted-foreground">
              {stripeConnected ? stripe.data?.accountId ?? "Connected" : t("notConnected")}
            </p>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<CalendarCheck />} color="#3b82f6" label={tk("total")} value={ov.totalBookings ?? 0} />
          <Kpi icon={<CheckCircle2 />} color="#34c360" label={tk("confirmed")} value={ov.confirmedBookings ?? 0} />
          <Kpi icon={<Star />} color="#c389ff" label={tk("completed")} value={ov.completedBookings ?? 0} />
          <Kpi icon={<XCircle />} color="#f35054" label={tk("cancelled")} value={ov.cancelledBookings ?? 0} />
        </div>

        {/* Last 30 days */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("analytics.last30Days")}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xl font-extrabold text-success">
                {fmtMoney(a.last30Days?.revenue)}
              </p>
              <p className="text-xs text-muted-foreground">{tk("revenue")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-primary">
                {a.last30Days?.bookingCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">{t("nav.bookings")}</p>
            </div>
          </div>
        </div>

        {/* Upcoming */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">{t("home.upcoming")}</h2>
            <button
              type="button"
              onClick={() => selectSection("bookings")}
              className="text-sm font-medium text-primary"
            >
              {t("home.viewAll")}
            </button>
          </div>
          <div className="space-y-2">
            {(upcoming.data?.items ?? []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {t("bookings.empty")}
              </p>
            ) : (
              upcoming.data!.items.map((b) => (
                <button
                  key={b.bookingRef}
                  type="button"
                  onClick={() => {
                    useBookingUi.getState().selectSection("bookings");
                    useBookingUi.getState().selectBooking(b.bookingRef);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-start shadow-[0_2px_12px_rgba(0,0,0,0.05)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {b.customer?.name ?? b.customerId?.name ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.service?.name} ·{" "}
                      {b.startTimeUTC || b.slotStart
                        ? new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          }).format(new Date(b.startTimeUTC || b.slotStart!))
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: `${color}0f`, border: `1px solid ${color}26` }}
    >
      <span style={{ color }} className="[&>svg]:size-5">
        {icon}
      </span>
      <p className="mt-2 text-2xl font-extrabold" style={{ color }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: `${color}b3` }}>
        {label}
      </p>
    </div>
  );
}
