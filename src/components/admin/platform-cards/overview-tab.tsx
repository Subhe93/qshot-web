"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, RefreshCw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CODE_SOURCES,
  CODE_STATUSES,
  PLATFORM_CODES,
  exportAllCodes,
  getPlatformStats,
  parseAdminError,
  saveBlob,
  type ExportFilters,
  type PlatformCode,
  type PlatformStats,
} from "@/lib/api/admin-platform-redirect";
import {
  EmptyState,
  Field,
  Notice,
  Panel,
  Pill,
  PlatformMark,
  Select,
  SkeletonCards,
  SkeletonRows,
  useAdminErrorMessage,
  useLoadError,
  useFormatDate,
  useFormatNumber,
} from "./shared";
import { PLATFORM_CARDS_BASE } from "./tabs";

export const STATS_QUERY_KEY = ["admin", "platform-cards", "stats"] as const;

const STAT_KEYS = ["total", "assigned", "unassigned", "disabled", "orphaned"] as const;
const COLUMNS = [
  "total",
  "unassigned",
  "assigned",
  "disabled",
  "pre_printed",
  "generated",
  "orphaned",
] as const satisfies readonly (keyof PlatformStats)[];

/** Overview: `GET /stats` per platform + totals, and the full xlsx export. */
export function OverviewTab() {
  const t = useTranslations("adminPlatformCards");
  const fmtN = useFormatNumber();
  const stats = useQuery({ queryKey: STATS_QUERY_KEY, queryFn: () => getPlatformStats() });
  const loadError = useLoadError(stats.error);

  const platforms = stats.data
    ? (Object.entries(stats.data.platforms) as [PlatformCode, PlatformStats][])
    : [];
  const pending = platforms.filter(([, s]) => s.pendingBatch).length;

  return (
    <div className="space-y-6">
      {/* Totals */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("overview.totals")}
          </p>
          <button
            type="button"
            onClick={() => stats.refetch()}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={stats.isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
            {t("refresh")}
          </button>
        </div>
        {stats.isLoading ? (
          <SkeletonCards />
        ) : stats.data ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {STAT_KEYS.map((k) => (
              <StatTile key={k} label={t(`stats.${k}`)} value={fmtN(stats.data.totals[k])} />
            ))}
            <StatTile
              label={t("stats.pendingBatches")}
              value={fmtN(pending)}
              tone={pending > 0 ? "warning" : undefined}
            />
          </div>
        ) : null}
      </div>

      {/* Per platform */}
      <Panel title={t("overview.perPlatform")} description={t("overview.perPlatformDesc")}>
        {stats.isLoading ? (
          <SkeletonRows rows={6} />
        ) : loadError ? (
          <Notice tone="error" className="m-4">
            {loadError}
          </Notice>
        ) : platforms.length === 0 ? (
          <EmptyState title={t("overview.empty")} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-start font-medium">{t("platform")}</th>
                    {COLUMNS.map((c) => (
                      <th key={c} className="px-3 py-2 text-end font-medium">
                        {t(`stats.${c}`)}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-start font-medium">{t("stats.spaceUsedPercent")}</th>
                    <th className="px-4 py-2 text-start font-medium">{t("stats.pendingBatch")}</th>
                  </tr>
                </thead>
                <tbody>
                  {platforms.map(([code, s]) => (
                    <tr key={code} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <PlatformMark platform={code} size={28} />
                          <span className="font-medium text-foreground">{t(`platforms.${code}`)}</span>
                        </span>
                      </td>
                      {COLUMNS.map((c) => (
                        <td key={c} className="px-3 py-2.5 text-end tabular-nums text-foreground">
                          <span className={s[c] === 0 ? "text-muted-foreground/60" : undefined}>
                            {fmtN(s[c])}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <SpaceBar percent={s.spaceUsedPercent} />
                      </td>
                      <td className="px-4 py-2.5">
                        <PendingBatchCell stats={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone cards */}
            <ul className="divide-y divide-border md:hidden">
              {platforms.map(([code, s]) => (
                <li key={code} className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <PlatformMark platform={code} size={32} />
                      <span className="text-sm font-semibold text-foreground">
                        {t(`platforms.${code}`)}
                      </span>
                    </span>
                    <PendingBatchCell stats={s} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    {COLUMNS.map((c) => (
                      <div key={c} className="rounded-xl bg-surface px-2.5 py-2">
                        <dt className="truncate text-muted-foreground">{t(`stats.${c}`)}</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">{fmtN(s[c])}</dd>
                      </div>
                    ))}
                  </dl>
                  <SpaceBar percent={s.spaceUsedPercent} label />
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <ExportPanel />
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "warning";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
      <p className={tone === "warning" ? "text-xl font-bold text-[#b57600]" : "text-xl font-bold text-foreground"}>
        {value}
      </p>
      <p className="truncate text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Share of the code space already issued (server warns at 90 %). */
function SpaceBar({ percent, label }: { percent: number; label?: boolean }) {
  const t = useTranslations("adminPlatformCards");
  const pct = Math.max(0, Math.min(100, percent));
  const hot = pct >= 90;
  return (
    <div className="min-w-[7rem]">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={hot ? "h-full rounded-full bg-error" : "h-full rounded-full bg-primary"}
            style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
          />
        </div>
        <span className="w-12 text-end text-xs tabular-nums text-muted-foreground">
          {pct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
        </span>
      </div>
      {label && <p className="mt-1 text-[11px] text-muted-foreground">{t("stats.spaceUsedPercent")}</p>}
    </div>
  );
}

function PendingBatchCell({ stats }: { stats: PlatformStats }) {
  const t = useTranslations("adminPlatformCards");
  const fmtD = useFormatDate();
  const b = stats.pendingBatch;
  if (!b) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Link
      href={`${PLATFORM_CARDS_BASE}/batches/${b._id}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-[#b57600] hover:bg-warning/25"
      title={fmtD(b.createdAt)}
    >
      <AlertTriangle className="size-3" />
      {t("overview.pendingLink", { count: b.generated })}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

/** Seconds the button stays disabled after a `ThrottlerException` (5 / 300 s). */
const THROTTLE_COOLDOWN_S = 60;

function ExportPanel() {
  const t = useTranslations("adminPlatformCards");
  const errMsg = useAdminErrorMessage();
  const [filters, setFilters] = useState<ExportFilters>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const mutation = useMutation({
    mutationFn: () => exportAllCodes(filters),
    onSuccess: (file) => {
      setError(null);
      saveBlob(file);
      setDone(t("export.done", { file: file.filename }));
    },
    onError: async (e) => {
      setDone(null);
      const parsed = await parseAdminError(e);
      if (parsed.kind === "framework" && parsed.name === "ThrottlerException") {
        setCooldown(THROTTLE_COOLDOWN_S);
      }
      setError(errMsg(parsed));
    },
  });

  const set = (k: keyof ExportFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Panel
      title={t("export.title")}
      description={t("export.desc")}
      actions={
        <Button
          variant="gradient"
          size="sm"
          disabled={mutation.isPending || cooldown > 0}
          onClick={() => {
            setDone(null);
            mutation.mutate();
          }}
        >
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {cooldown > 0 ? t("export.cooldown", { seconds: cooldown }) : t("export.button")}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 sm:p-5">
        <Field label={t("platform")} htmlFor="exp-platform">
          <Select id="exp-platform" value={filters.platform ?? ""} onChange={set("platform")}>
            <option value="">{t("filters.allPlatforms")}</option>
            {PLATFORM_CODES.map((p) => (
              <option key={p} value={p}>
                {t(`platforms.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("filters.status")} htmlFor="exp-status">
          <Select id="exp-status" value={filters.status ?? ""} onChange={set("status")}>
            <option value="">{t("filters.any")}</option>
            {CODE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`codeStatus.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("filters.source")} htmlFor="exp-source">
          <Select id="exp-source" value={filters.source ?? ""} onChange={set("source")}>
            <option value="">{t("filters.any")}</option>
            {CODE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`source.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("filters.batchId")} htmlFor="exp-batch">
          <Input
            id="exp-batch"
            value={filters.batchId ?? ""}
            onChange={set("batchId")}
            placeholder="6ad6…"
            className="font-mono"
          />
        </Field>
        <Field label={t("filters.userEmail")} htmlFor="exp-email">
          <Input
            id="exp-email"
            type="email"
            value={filters.userEmail ?? ""}
            onChange={set("userEmail")}
            placeholder="name@example.com"
            maxLength={120}
          />
        </Field>
      </div>
      {(error || done) && (
        <div className="px-4 pb-4 sm:px-5">
          {error && <Notice tone="error">{error}</Notice>}
          {done && !error && <Notice tone="success">{done}</Notice>}
        </div>
      )}
      <p className="flex items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:px-5">
        <Pill tone="muted" dot={false}>
          xlsx
        </Pill>
        {t("export.hint")}
      </p>
    </Panel>
  );
}
