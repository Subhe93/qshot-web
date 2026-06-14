"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import {
  User,
  Globe,
  ArrowLeftRight,
  Share2,
  Star,
  Mail,
  MessageCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { getAccount } from "@/lib/api/account";
import { LanguageSwitcher } from "@/components/language-switcher";

function Row({
  icon,
  color,
  title,
  onClick,
  right,
  danger,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${onClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {icon}
      </span>
      <span
        className={`flex-1 text-sm font-medium ${danger ? "text-error" : "text-foreground"}`}
      >
        {title}
      </span>
      {right ?? (
        <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
      )}
    </div>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
  });

  const signOut = () => {
    logout();
    router.replace("/login");
  };

  const user = account?.user;
  const plan = account?.plan;
  const name = user?.name ?? "—";
  const email = user?.email ?? "";
  // Guard against an unparseable / out-of-range expireSubscribe value —
  // Intl.DateTimeFormat.format() throws "Invalid time value" on an Invalid Date.
  const expiry = (() => {
    if (!account?.expireSubscribe) return null;
    const d = new Date(account.expireSubscribe);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  })();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        {/* Profile hero card */}
        <div className="brand-gradient overflow-hidden rounded-3xl text-white shadow-sm md:col-span-2">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/70 bg-white/20">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt={name}
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-8 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{name}</p>
              <p className="truncate text-sm text-white/80">{email}</p>
            </div>
          </div>

          {plan && !plan.free && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.svg" alt="" className="size-7" />
              <div className="h-7 w-px bg-white/30" />
              <div>
                <p className="font-bold capitalize">{plan.name}</p>
                {expiry && (
                  <p className="text-xs text-white/80">
                    {t("expiresOn", { date: expiry })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-white/20 border-t border-white/15 bg-white/5 rtl:divide-x-reverse">
          <Stat value={account?.profileCounts ?? 0} label={t("statWebsite")} />
          <Stat
            value={account?.qrCodeStaticCount ?? 0}
            label={t("statStatic")}
          />
          <Stat
            value={account?.qrCodeDynamicCount ?? 0}
            label={t("statDynamic")}
          />
        </div>
      </div>

      <Group title={t("accountGroup")}>
        <Row
          icon={<User className="size-5" />}
          color="#4488ff"
          title={t("personalInfo")}
          onClick={() => router.push("/settings/personal-info")}
        />
        <Row
          icon={<ArrowLeftRight className="size-5" />}
          color="#5856d6"
          title={t("transfer")}
          onClick={() => router.push("/settings/transfer")}
        />
        <Row
          icon={<Globe className="size-5" />}
          color="#34c759"
          title={t("language")}
          right={<LanguageSwitcher />}
        />
        {/* Sign out merged into the group on desktop; a standalone button on mobile */}
        <div className="hidden md:block">
          <Row
            icon={<LogOut className="size-5" />}
            color="#ef4444"
            title={t("signOut")}
            danger
            right={<span />}
            onClick={signOut}
          />
        </div>
      </Group>

      <Group title={t("supportGroup")}>
        <Row
          icon={<Share2 className="size-5" />}
          color="#4488ff"
          title={t("shareApp")}
          onClick={() => {
            if (navigator.share)
              navigator.share({ url: window.location.origin }).catch(() => {});
          }}
        />
        <Row
          icon={<Star className="size-5" />}
          color="#ff9500"
          title={t("rateApp")}
        />
        <Row
          icon={<Mail className="size-5" />}
          color="#5856d6"
          title={t("contactEmail")}
          onClick={() => {
            window.location.href = "mailto:info@iwings.io";
          }}
        />
        <Row
          icon={<MessageCircle className="size-5" />}
          color="#25d366"
          title={t("contactWhatsapp")}
        />
      </Group>
      </div>

      {/* Mobile-only standalone sign-out at the bottom */}
      <div className="overflow-hidden rounded-2xl bg-card shadow-[0_2px_16px_rgba(0,0,0,0.06)] md:hidden">
        <Row
          icon={<LogOut className="size-5" />}
          color="#ef4444"
          title={t("signOut")}
          danger
          right={<span />}
          onClick={signOut}
        />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="px-2 py-4 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-white/80">{label}</p>
    </div>
  );
}
