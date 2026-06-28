"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Home,
  CalendarCheck,
  CalendarRange,
  Users,
  Contact,
  Package,
  BarChart3,
  Settings,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  LayoutTemplate,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getBookingConfig } from "@/lib/api/booking";
import { getProfile } from "@/lib/api/profiles";
import { useBookingUi, type BookingSection } from "@/stores/booking-store";
import { cn } from "@/lib/utils";
import { HomePane } from "./panes/HomePane";
import { CalendarPane } from "./panes/CalendarPane";
import { BookingsPane } from "./panes/BookingsPane";
import { CustomersPane } from "./panes/CustomersPane";
import { ProvidersPane } from "./panes/ProvidersPane";
import { ServicesPane } from "./panes/ServicesPane";
import { AnalyticsPane } from "./panes/AnalyticsPane";
import { ConfigPane } from "./panes/ConfigPane";

const NAV: { id: BookingSection; key: string; Icon: LucideIcon }[] = [
  { id: "home", key: "home", Icon: Home },
  { id: "calendar", key: "calendar", Icon: CalendarRange },
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

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["booking-config", profileId],
    queryFn: () => getBookingConfig(profileId),
  });
  // Booking is gated on the config EXISTING: until the owner saves the settings
  // once (which creates an already-active config), everything else stays hidden.
  const configured = !!config;
  const enabled = config?.isEnabled ?? false;

  // Profile name for the header + a quick jump back to this profile's builder.
  const { data: profile } = useQuery({
    queryKey: ["profile-name", profileId],
    queryFn: () => getProfile(profileId),
  });
  const profileName =
    (typeof profile?.settings?.name === "object"
      ? profile?.settings?.name?.text
      : undefined) ||
    profile?.user_name ||
    profile?.name ||
    "";
  // Public URL handle (slug), mirroring the builder/profile-card derivation.
  const slug =
    (profile?.user_name || profile?.name || "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "me";
  const profileUrl = `${slug}.qshot.com`;

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
        <Link
          href="/dashboard"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("title")}
          </p>
          <h1 className="truncate text-xl font-extrabold leading-tight text-foreground">
            {profileName || t("title")}
          </h1>
        </div>

        <div className="ms-auto flex min-w-0 shrink items-center gap-2">
          {/* Profile URL — clicking opens this profile's builder. */}
          <Link
            href={`/builder/${profileId}`}
            title={t("openBuilder")}
            className="flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-semibold text-foreground hover:bg-border"
          >
            <LayoutTemplate className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">{profileUrl}</span>
          </Link>
          {configured && (
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
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
          )}
        </div>
      </header>

      {configLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !configured ? (
        // First mandatory step: set up booking. Until the settings are saved
        // (which creates an active config), nothing else is shown.
        <main className="min-h-0 flex-1 overflow-hidden">
          <ConfigPane profileId={profileId} onboarding />
        </main>
      ) : (
        <>
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
              {section === "calendar" && <CalendarPane profileId={profileId} />}
              {section === "bookings" && <BookingsPane profileId={profileId} />}
              {section === "customers" && <CustomersPane profileId={profileId} />}
              {section === "providers" && <ProvidersPane profileId={profileId} />}
              {section === "services" && <ServicesPane profileId={profileId} />}
              {section === "analytics" && <AnalyticsPane profileId={profileId} />}
              {section === "config" && <ConfigPane profileId={profileId} />}
            </main>
          </div>
        </>
      )}
    </div>
  );
}
