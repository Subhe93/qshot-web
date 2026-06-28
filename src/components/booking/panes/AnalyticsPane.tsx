"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { CalendarCheck, CheckCircle2, Star, XCircle } from "lucide-react";
import { getBookingAnalytics } from "@/lib/api/booking";
import { PaneLoading } from "../shared";

export function AnalyticsPane({ profileId }: { profileId: string }) {
  const t = useTranslations("booking.analytics");
  const tk = useTranslations("booking.kpi");
  const tb = useTranslations("booking");
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["booking-analytics", profileId],
    queryFn: () => getBookingAnalytics(profileId),
  });

  if (isLoading) return <PaneLoading />;
  const a = data ?? {};
  const ov = a.overview ?? {};
  const money = (n?: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: a.currency || "USD",
      maximumFractionDigits: 0,
    }).format(n ?? 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <h2 className="text-xl font-bold">{t("title")}</h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card icon={<CalendarCheck />} color="#3b82f6" label={tk("total")} value={String(ov.totalBookings ?? 0)} />
          <Card icon={<CheckCircle2 />} color="#34c360" label={tk("confirmed")} value={String(ov.confirmedBookings ?? 0)} />
          <Card icon={<Star />} color="#c389ff" label={tk("completed")} value={String(ov.completedBookings ?? 0)} />
          <Card icon={<XCircle />} color="#f35054" label={tk("cancelled")} value={String(ov.cancelledBookings ?? 0)} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("last30Days")}
          </p>
          {/* revenue · collected · on-site due · bookings (mobile parity). */}
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div>
              <p className="text-xl font-extrabold text-success">{money(a.last30Days?.revenue)}</p>
              <p className="text-xs text-muted-foreground">{t("revenue")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-success">{money(a.last30Days?.collectedRevenue)}</p>
              <p className="text-xs text-muted-foreground">{tb("collected")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-warning">{money(a.last30Days?.onSiteDue)}</p>
              <p className="text-xs text-muted-foreground">{tb("onSiteDue")}</p>
            </div>
            <div>
              <p className="text-xl font-extrabold text-primary">{a.last30Days?.bookingCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">{t("bookings")}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Breakdown title={t("byProvider")} rows={a.byProvider ?? []} money={money} />
          <Breakdown title={t("byService")} rows={a.byService ?? []} money={money} />
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: `${color}0f`, border: `1px solid ${color}26` }}>
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

function Breakdown({
  title,
  rows,
  money,
}: {
  title: string;
  rows: Array<{ name?: string; _id?: string; bookingCount?: number; count?: number; revenue?: number }>;
  money: (n?: number) => string;
}) {
  const countOf = (r: { bookingCount?: number; count?: number }) => r.bookingCount ?? r.count ?? 0;
  const max = Math.max(...rows.map(countOf), 1);
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">—</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="truncate font-medium">{r.name ?? r._id ?? "—"}</span>
                <span className="text-muted-foreground">
                  {countOf(r)} · {money(r.revenue)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(countOf(r) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
