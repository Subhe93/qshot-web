"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import {
  CalendarDays,
  CalendarRange,
  Globe,
  MonitorSmartphone,
  MousePointerClick,
  Smartphone,
  Tablet,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getLinkStats } from "@/lib/api/custom-links";
import { cn } from "@/lib/utils";

// Day windows offered by the switcher; all sit inside the API's 1..365 range.
const DAY_OPTIONS = [7, 30, 90] as const;

// `by_platform` is a per-DEVICE/channel breakdown (Fallback / iPhone / iPad /
// Android …), not social platforms — colour + icon each channel accordingly.
const CHANNEL_META: Record<string, { color: string; Icon: LucideIcon }> = {
  Fallback: { color: "#4488ff", Icon: Globe },
  Browser: { color: "#4488ff", Icon: Globe },
  iPhone: { color: "#0f172a", Icon: Smartphone },
  iOS: { color: "#0f172a", Icon: Smartphone },
  iPad: { color: "#0f172a", Icon: Tablet },
  Android: { color: "#3ddc84", Icon: Smartphone },
  Fire_OS: { color: "#ff9900", Icon: Tablet },
  Windows_Mobile: { color: "#0078d4", Icon: Smartphone },
  Blackberry: { color: "#111827", Icon: Smartphone },
  non_Google_Huawei: { color: "#c8102e", Icon: Smartphone },
};

function channelMeta(type: string) {
  return CHANNEL_META[type] ?? { color: "#7dd8d5", Icon: MonitorSmartphone };
}

/** Humanise a raw channel key (`non_Google_Huawei` → `Non Google Huawei`). */
function humanize(raw: string): string {
  return raw.replace(/_/g, " ");
}

export function LinksStats() {
  const t = useTranslations("smartLinks");
  const locale = useLocale();
  const [days, setDays] = useState<number>(30);

  // Clamp to the API-accepted window before it ever hits the query key/request.
  const safeDays = Math.min(365, Math.max(1, days));

  const { data, isLoading } = useQuery({
    queryKey: ["custom-links", "stats", safeDays],
    queryFn: () => getLinkStats(safeDays),
  });

  const totals = data?.totals;
  const byPlatform = [...(data?.by_platform ?? [])].sort(
    (a, b) => b.count - a.count,
  );
  const daily = data?.daily ?? [];
  const byLink = [...(data?.by_link ?? [])].sort((a, b) => b.clicks - a.clicks);
  const window = data?.window;

  const platformTotal = byPlatform.reduce((s, p) => s + p.count, 0);
  const maxDaily = Math.max(...daily.map((d) => d.count), 1);
  const maxLink = Math.max(...byLink.map((l) => l.clicks), 1);
  const windowClicks = daily.reduce((s, d) => s + d.count, 0);
  const peakDay = daily.reduce(
    (best, d) => (d.count > best.count ? d : best),
    { date: "", count: -1 },
  );

  const fmtNum = (n: number) => n.toLocaleString(locale);
  const fmtDay = (iso: string) =>
    iso
      ? new Intl.DateTimeFormat(locale, {
          day: "numeric",
          month: "short",
        }).format(new Date(iso))
      : "";

  return (
    <div className="space-y-5">
      {/* Day-window switcher + resolved date range */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-border bg-card p-0.5">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                safeDays === d
                  ? "brand-tint text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("stats.days", { days: d })}
            </button>
          ))}
        </div>
        {window && (
          <span className="text-xs font-medium text-muted-foreground">
            {fmtDay(window.from)} — {fmtDay(window.to)}
          </span>
        )}
      </div>

      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              color="#4488ff"
              Icon={MousePointerClick}
              label={t("stats.totalClicks")}
              value={fmtNum(totals?.clicks ?? 0)}
            />
            <StatCard
              color="#34c360"
              Icon={Zap}
              label={t("stats.today")}
              value={fmtNum(totals?.clicks_today ?? 0)}
            />
            <StatCard
              color="#c389ff"
              Icon={CalendarDays}
              label={t("stats.last7")}
              value={fmtNum(totals?.clicks_7d ?? 0)}
            />
            <StatCard
              color="#ffaf05"
              Icon={CalendarRange}
              label={t("stats.last30")}
              value={fmtNum(totals?.clicks_30d ?? 0)}
            />
          </div>

          {/* Daily trend (hero chart) */}
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                <h2 className="font-semibold">{t("stats.daily")}</h2>
              </div>
              <span className="text-sm font-bold text-foreground">
                {fmtNum(windowClicks)}
              </span>
            </div>
            {windowClicks === 0 ? (
              <Empty text={t("stats.empty")} />
            ) : (
              <>
                <div className="mt-5 flex h-40 items-end gap-[3px]">
                  {daily.map((d) => {
                    const isPeak = d.date === peakDay.date && d.count > 0;
                    return (
                      <div
                        key={d.date}
                        title={`${fmtDay(d.date)} · ${fmtNum(d.count)}`}
                        className="group flex h-full min-w-[3px] flex-1 flex-col items-center justify-end"
                      >
                        <div
                          className={cn(
                            "w-full rounded-t-[3px] transition-opacity group-hover:opacity-80",
                            isPeak ? "bg-primary" : "bg-primary/45",
                          )}
                          style={{
                            height: `${(d.count / maxDaily) * 100}%`,
                            minHeight: d.count > 0 ? "3px" : "0",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* X-axis: first / peak / last */}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px] text-muted-foreground">
                  <span>{fmtDay(daily[0]?.date ?? "")}</span>
                  {peakDay.count > 0 && (
                    <span className="font-medium text-primary">
                      {fmtDay(peakDay.date)} · {fmtNum(peakDay.count)}
                    </span>
                  )}
                  <span>{fmtDay(daily[daily.length - 1]?.date ?? "")}</span>
                </div>
              </>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* By platform / device */}
            <Card>
              <h2 className="font-semibold">{t("stats.byPlatform")}</h2>
              {byPlatform.length === 0 ? (
                <Empty text={t("stats.empty")} />
              ) : (
                <div className="mt-4 space-y-3.5">
                  {byPlatform.map((p) => {
                    const { color, Icon } = channelMeta(p.type);
                    const pct = platformTotal
                      ? Math.round((p.count / platformTotal) * 100)
                      : 0;
                    return (
                      <div key={p.type}>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span
                            className="flex size-6 shrink-0 items-center justify-center rounded-md"
                            style={{ backgroundColor: `${color}1a`, color }}
                          >
                            <Icon className="size-3.5" />
                          </span>
                          <span className="flex-1 truncate text-sm font-medium capitalize">
                            {humanize(p.type)}
                          </span>
                          <span className="text-sm font-semibold">
                            {fmtNum(p.count)}
                          </span>
                          <span className="w-9 text-end text-xs text-muted-foreground">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* By link (ranked) */}
            <Card>
              <h2 className="font-semibold">{t("stats.byLink")}</h2>
              {byLink.length === 0 ? (
                <Empty text={t("stats.empty")} />
              ) : (
                <div className="mt-4 space-y-3">
                  {byLink.map((l, i) => {
                    const pct = maxLink ? (l.clicks / maxLink) * 100 : 0;
                    return (
                      <div key={l.id} className="flex items-center gap-3">
                        <RankBadge rank={i + 1} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {l.name || l.link}
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="brand-gradient h-full rounded-full"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums">
                          <MousePointerClick className="size-3.5 text-muted-foreground" />
                          {fmtNum(l.clicks)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  color,
  Icon,
  label,
  value,
}: {
  color: string;
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4"
      style={{ backgroundColor: `${color}0f`, border: `1px solid ${color}26` }}
    >
      <span
        className="mb-2 flex size-9 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        <Icon className="size-[18px]" />
      </span>
      <p className="text-2xl font-extrabold leading-tight" style={{ color }}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium" style={{ color: `${color}b3` }}>
        {label}
      </p>
    </div>
  );
}

/** Podium badge: gold/silver/bronze for the top three, muted otherwise. */
function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-[#f5b301]/15 text-[#c98a00]"
      : rank === 2
        ? "bg-[#9aa4b2]/20 text-[#6b7684]"
        : rank === 3
          ? "bg-[#cd7f32]/15 text-[#b06a1f]"
          : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
        medal,
      )}
    >
      {rank}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_3px_12px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[104px] animate-pulse rounded-2xl border border-border bg-muted"
          />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-2xl border border-border bg-muted" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl border border-border bg-muted" />
        <div className="h-56 animate-pulse rounded-2xl border border-border bg-muted" />
      </div>
    </div>
  );
}
