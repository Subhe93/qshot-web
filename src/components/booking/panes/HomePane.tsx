"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { CalendarCheck, CheckCircle2, Star, DollarSign, CreditCard } from "lucide-react";
import {
  getBookingAnalytics,
  getBookingConfig,
  getStripeStatus,
  toggleBookingConfig,
  listBookings,
} from "@/lib/api/booking";
import { useBookingUi } from "@/stores/booking-store";
import { StatusBadge, PaneLoading } from "../shared";
import { Switch } from "./ServicesPane";

export function HomePane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const tk = useTranslations("booking.kpi");
  const locale = useLocale();
  const qc = useQueryClient();
  const selectSection = useBookingUi((s) => s.selectSection);

  const analytics = useQuery({
    queryKey: ["booking-analytics", profileId],
    queryFn: () => getBookingAnalytics(profileId),
  });
  const stripe = useQuery({
    queryKey: ["booking-stripe", profileId],
    queryFn: () => getStripeStatus(),
  });
  const config = useQuery({
    queryKey: ["booking-config", profileId],
    queryFn: () => getBookingConfig(profileId),
  });
  const toggle = useMutation({
    mutationFn: () => toggleBookingConfig(profileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking-config", profileId] }),
  });
  // Fetch a wider window, then show genuinely upcoming, non-cancelled bookings
  // soonest-first (mobile home_wide_pane: startTime > now && status != cancelled).
  const upcoming = useQuery({
    queryKey: ["booking-upcoming", profileId],
    queryFn: () => listBookings({ profileId, limit: 50 }),
  });

  if (analytics.isLoading) return <PaneLoading />;

  const a = analytics.data ?? {};
  const ov = a.overview ?? {};
  const enabled = config.data?.isEnabled ?? false;
  const stripeConnected = stripe.data?.connected ?? !!stripe.data?.chargesEnabled;
  const now = Date.now();
  const upcomingItems = (upcoming.data?.items ?? [])
    .filter((b) => {
      const start = b.startTimeUTC || b.slotStart;
      return b.status !== "cancelled" && start && Date.parse(start) > now;
    })
    .sort((x, y) => {
      const xs = Date.parse(x.startTimeUTC || x.slotStart || "") || 0;
      const ys = Date.parse(y.startTimeUTC || y.slotStart || "") || 0;
      return xs - ys;
    })
    .slice(0, 5);
  const fmtMoney = (n?: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: a.currency || "USD",
      maximumFractionDigits: 0,
    }).format(n ?? 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Enable + Stripe cards (mobile Home _EnableCard + Stripe card) */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-soft">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t(enabled ? "enabled" : "disabled")}</p>
              <p className="truncate text-xs text-muted-foreground">{t("title")}</p>
            </div>
            <Switch on={enabled} onToggle={() => toggle.mutate()} />
          </div>
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: stripeConnected ? "#3b82f60f" : "#ffaf0514",
              border: `1px solid ${stripeConnected ? "#3b82f633" : "#ffaf054d"}`,
            }}
          >
            <CreditCard
              className="size-5 shrink-0"
              style={{ color: stripeConnected ? "#3b82f6" : "#ffaf05" }}
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("stripe")}</p>
              <p className="truncate text-xs text-muted-foreground">
                {stripeConnected ? stripe.data?.accountId ?? "Connected" : t("notConnected")}
              </p>
            </div>
          </div>
        </div>

        {/* KPI grid — 4th card is last-30-days revenue (mobile parity). */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={<CalendarCheck />} color="#3b82f6" label={tk("total")} value={ov.totalBookings ?? 0} />
          <Kpi icon={<CheckCircle2 />} color="#34c360" label={tk("confirmed")} value={ov.confirmedBookings ?? 0} />
          <Kpi icon={<Star />} color="#c389ff" label={tk("completed")} value={ov.completedBookings ?? 0} />
          <Kpi icon={<DollarSign />} color="#34c360" label={tk("revenue")} value={fmtMoney(a.last30Days?.revenue)} />
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
            {upcomingItems.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {t("bookings.empty")}
              </p>
            ) : (
              upcomingItems.map((b) => (
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
  value: number | string;
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
