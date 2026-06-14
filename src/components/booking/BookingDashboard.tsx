"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Home,
  CalendarCheck,
  Users,
  Contact,
  Package,
  BarChart3,
  Settings,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getBookingConfig } from "@/lib/api/booking";
import { useBookingUi, type BookingSection } from "@/stores/booking-store";
import { cn } from "@/lib/utils";
import { HomePane } from "./panes/HomePane";
import { BookingsPane } from "./panes/BookingsPane";
import { CustomersPane } from "./panes/CustomersPane";
import { ProvidersPane } from "./panes/ProvidersPane";
import { ServicesPane } from "./panes/ServicesPane";
import { AnalyticsPane } from "./panes/AnalyticsPane";
import { ConfigPane } from "./panes/ConfigPane";

const NAV: { id: BookingSection; key: string; Icon: LucideIcon }[] = [
  { id: "home", key: "home", Icon: Home },
  { id: "bookings", key: "bookings", Icon: CalendarCheck },
  { id: "customers", key: "customers", Icon: Users },
  { id: "providers", key: "providers", Icon: Contact },
  { id: "services", key: "services", Icon: Package },
  { id: "analytics", key: "analytics", Icon: BarChart3 },
  { id: "config", key: "settings", Icon: Settings },
];

export function BookingDashboard({ profileId }: { profileId: string }) {
  const t = useTranslations("booking");
  const tn = useTranslations("booking.nav");
  const section = useBookingUi((s) => s.section);
  const selectSection = useBookingUi((s) => s.selectSection);

  // Deep-link a section via the URL hash (e.g. /sites/x/booking#services).
  useEffect(() => {
    const h = window.location.hash.replace("#", "") as BookingSection;
    if (NAV.some((n) => n.id === h)) selectSection(h);
  }, [selectSection]);

  const { data: config } = useQuery({
    queryKey: ["booking-config", profileId],
    queryFn: () => getBookingConfig(profileId),
  });
  const enabled = config?.isEnabled ?? false;

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <Link
          href="/dashboard"
          className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <h1 className="text-lg font-bold">{t("title")}</h1>
        <span
          className="ms-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            backgroundColor: enabled ? "#34c3601f" : "#8184901f",
            color: enabled ? "#34c360" : "#818490",
          }}
        >
          {enabled ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <XCircle className="size-3.5" />
          )}
          {t(enabled ? "enabled" : "disabled")}
        </span>
      </header>

      {/* Mobile section tabs */}
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5 md:hidden">
        {NAV.map(({ id, key, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectSection(id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
              section === id
                ? "bg-foreground text-white"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
            {tn(key)}
          </button>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        {/* Desktop nav rail */}
        <aside className="hidden w-[92px] shrink-0 flex-col border-e border-border bg-card py-3 md:flex">
          {NAV.map(({ id, key, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectSection(id)}
              className={cn(
                "relative mx-2 flex flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition-colors",
                section === id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {section === id && (
                <span className="absolute inset-y-1 start-0 w-1 rounded-full bg-primary" />
              )}
              <Icon className="size-5" />
              {tn(key)}
            </button>
          ))}
        </aside>

        {/* Active pane */}
        <main className="min-w-0 flex-1 overflow-hidden">
          {section === "home" && <HomePane profileId={profileId} />}
          {section === "bookings" && <BookingsPane profileId={profileId} />}
          {section === "customers" && <CustomersPane profileId={profileId} />}
          {section === "providers" && <ProvidersPane profileId={profileId} />}
          {section === "services" && <ServicesPane profileId={profileId} />}
          {section === "analytics" && <AnalyticsPane profileId={profileId} />}
          {section === "config" && <ConfigPane profileId={profileId} />}
        </main>
      </div>
    </div>
  );
}
