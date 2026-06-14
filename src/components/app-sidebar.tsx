"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Settings, LogOut, User, CalendarCheck } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { getAccount } from "@/lib/api/account";
import { LanguageSwitcher } from "@/components/language-switcher";
import { FeedbackButton } from "@/components/feedback-button";
import { AppIcon } from "@/components/qr/app-icon";
import { cn } from "@/lib/utils";

// Icons pulled from the mobile app's bottom nav (portfolio / qr_code / scanner).
const NAV = [
  { href: "/dashboard", labelKey: "profiles", svg: "/nav/portfolio.svg" },
  { href: "/qr-codes", labelKey: "qrCodes", svg: "/nav/qr_code.svg" },
  { href: "/scan", labelKey: "scanQr", svg: "/nav/scanner.svg" },
  { href: "/bookings", labelKey: "bookings", Icon: CalendarCheck },
  { href: "/settings", labelKey: "settings", Icon: Settings },
] as const;

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const storeUser = useAuthStore((s) => s.user);

  const { data: account } = useQuery({ queryKey: ["account"], queryFn: getAccount });
  const user = account?.user ?? storeUser;
  const plan = account?.plan;
  const name = user?.name ?? user?.email ?? "—";
  const planLabel = plan ? (plan.free ? ts("freePlan") : plan.name) : user?.email;

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-e border-border bg-card">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" alt="QShot" width={26} height={26} />
        <span className="brand-gradient-text text-lg font-bold">QShot</span>
      </div>

      {/* Profile card */}
      <Link
        href="/settings"
        onClick={onNavigate}
        className="brand-gradient mx-3 flex items-center gap-3 rounded-2xl p-3 text-white shadow-sm transition-opacity hover:opacity-95"
      >
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-white/20">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={name} className="size-full object-cover" />
          ) : (
            <User className="size-5 text-white" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{name}</span>
          {planLabel && (
            <span className="block truncate text-xs capitalize text-white/80">
              {planLabel}
            </span>
          )}
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "brand-tint text-primary"
                  : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {"svg" in item ? (
                <AppIcon src={item.svg} className="size-5 shrink-0" />
              ) : (
                <item.Icon className="size-5 shrink-0" />
              )}
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer: feedback + language + logout */}
      <div className="space-y-2 border-t border-border p-3">
        <FeedbackButton className="w-full justify-center" />
        <LanguageSwitcher />
        <button
          type="button"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-error/10 hover:text-error"
        >
          <LogOut className="size-5 shrink-0" />
          <span>{tc("logout")}</span>
        </button>
      </div>
    </aside>
  );
}
