"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link } from "@/i18n/navigation";
import {
  getWebsiteStatistics,
  type StatType,
} from "@/lib/api/statistics";

// `value` is the API `date` param (mobile StatisticsDateRange.value: m1=1, m3=3,
// m6=6, y1=365); `days` is only the local chart window length.
const RANGES = [
  { key: "month", value: 1, days: 30 },
  { key: "months3", value: 3, days: 90 },
  { key: "months6", value: 6, days: 180 },
  { key: "year", value: 365, days: 365 },
] as const;

const PIE_COLORS = ["#4488ff", "#c389ff", "#34c360", "#ffaf05", "#7dd8d5"];

/** 2-letter ISO country code → flag emoji (regional indicator symbols). */
function flagEmoji(code?: string): string {
  if (!code || !/^[a-zA-Z]{2}$/.test(code)) return "";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => base + c.charCodeAt(0) - 65),
  );
}

export default function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("analytics");
  const locale = useLocale();
  const [type, setType] = useState<StatType>("views");
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);

  const accent = type === "views" ? "#7dd8d5" : "#ff815a";

  const { data, isLoading } = useQuery({
    queryKey: ["statistics", id, type, range.value],
    queryFn: () => getWebsiteStatistics({ id, type, date: range.value }),
  });

  const total = data?.details.totalData ?? 0;
  const prev = data?.details.totalDataPrevious ?? 0;
  const delta = total - prev;

  const chartData = (data?.details.dailyData ?? []).map((d) => ({
    label: new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
    }).format(new Date(d.date)),
    count: d.count,
  }));

  const countries = [...(data?.countryView ?? [])].sort(
    (a, b) => b.number - a.number,
  );
  const maxCountry = countries[0]?.number || 1;
  const pieData = (() => {
    const top = countries.slice(0, 4);
    const rest = countries.slice(4).reduce((s, c) => s + c.number, 0);
    const arr = top.map((c) => ({ name: c.country, value: c.number }));
    if (rest > 0) arr.push({ name: t("others"), value: rest });
    return arr;
  })();

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Type toggle */}
      <div className="mt-5 flex rounded-xl border border-input p-0.5">
        {(["views", "clicks"] as StatType[]).map((ty) => (
          <button
            key={ty}
            type="button"
            onClick={() => setType(ty)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              type === ty ? "bg-foreground text-white" : "text-muted-foreground"
            }`}
          >
            {t(ty)}
          </button>
        ))}
      </div>

      {/* Range tabs */}
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r)}
            className={`shrink-0 rounded-[10px] px-4 py-2 text-sm font-medium transition-colors ${
              range.key === r.key
                ? "bg-foreground text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t(r.key)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Trend card */}
          <Card>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t(type)}</p>
                <p className="text-3xl font-bold">{total.toLocaleString()}</p>
              </div>
              {delta !== 0 && (
                <span
                  className={`text-xs font-semibold ${delta > 0 ? "text-success" : "text-error"}`}
                >
                  {delta > 0
                    ? t("moreThanUsual", { n: delta })
                    : t("fewerThanUsual", { n: Math.abs(delta) })}
                </span>
              )}
            </div>
            <div className="mt-4 h-48">
              {chartData.length === 0 ? (
                <Empty text={t("empty")} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="statFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#eee" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={accent}
                      strokeWidth={2}
                      fill="url(#statFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Countries */}
          <Card>
            <h2 className="font-semibold">{t("byCountry")}</h2>
            {countries.length === 0 ? (
              <Empty text={t("empty")} />
            ) : (
              <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={32} outerRadius={64} paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-2.5">
                  {countries.slice(0, 6).map((c) => (
                    <div key={c.countryCode + c.country} className="flex items-center gap-3">
                      <span className="flex w-24 shrink-0 items-center gap-1.5 truncate text-sm">
                        {flagEmoji(c.countryCode) && (
                          <span aria-hidden>{flagEmoji(c.countryCode)}</span>
                        )}
                        <span className="truncate">{c.country}</span>
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(c.number / maxCountry) * 100}%`, backgroundColor: "#4488ff" }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-end text-sm font-medium">{c.number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Module clicks */}
          <Card>
            <h2 className="font-semibold">{t("byBlock")}</h2>
            {Object.keys(data?.moduleClicks ?? {}).length === 0 ? (
              <Empty text={t("empty")} />
            ) : (
              <div className="mt-3 space-y-4">
                {Object.entries(data!.moduleClicks).map(([mod, items]) => {
                  const max = Math.max(...items.map((i) => i.count), 1);
                  return (
                    <div key={mod}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {mod}
                      </p>
                      <div className="space-y-2">
                        {items.map((it, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="w-28 shrink-0 truncate text-sm">{it.name}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${(it.count / max) * 100}%`, backgroundColor: "#ff815a" }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-end text-sm font-medium">{it.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[0_3px_12px_rgba(0,0,0,0.06)]">
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-24 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
