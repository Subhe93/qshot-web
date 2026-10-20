"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Layers, Loader2, Plus } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  BATCH_STATUSES,
  MAX_BATCH_SIZE,
  MAX_NOTE_LENGTH,
  MIN_BATCH_SIZE,
  PLATFORM_CODES,
  listAdminPlatforms,
  listBatches,
  parseAdminError,
  requestBatch,
  type BatchStatus,
  type BatchWithCounts,
  type PendingBatchSummary,
  type PlatformCode,
  retryUnlessRefused,
} from "@/lib/api/admin-platform-redirect";
import {
  BatchStatusPill,
  EmptyState,
  Field,
  Notice,
  Pager,
  Panel,
  PlatformMark,
  Select,
  SkeletonRows,
  useAdminErrorMessage,
  useLoadError,
  useFormatDate,
  useFormatNumber,
} from "./shared";
import { PLATFORM_CARDS_BASE } from "./tabs";
import { STATS_QUERY_KEY } from "./overview-tab";
import { PLATFORMS_QUERY_KEY } from "./platforms-tab";

export const BATCHES_QUERY_KEY = ["admin", "platform-cards", "batches"] as const;

const PAGE_SIZE = 20;

/** Batches: filterable, paginated list + the "Request cards" sheet. */
export function BatchesTab() {
  const t = useTranslations("adminPlatformCards");
  const fmtD = useFormatDate();
  const fmtN = useFormatNumber();

  const [platform, setPlatform] = useState<PlatformCode | "">("");
  const [status, setStatus] = useState<BatchStatus | "">("");
  const [page, setPage] = useState(1);
  const [sheet, setSheet] = useState(false);

  const q = useQuery({
    queryKey: [...BATCHES_QUERY_KEY, { platform, status, page }],
    queryFn: () => listBatches({ platform, status, page, limit: PAGE_SIZE }),
    retry: retryUnlessRefused,
    placeholderData: (prev) => prev,
  });
  const loadError = useLoadError(q.error);

  const batches = q.data?.batches ?? [];

  return (
    <div className="space-y-4">
      <Panel
        title={t("batchesTab.title")}
        description={t("batchesTab.desc")}
        actions={
          <Button variant="gradient" size="sm" onClick={() => setSheet(true)}>
            <Plus className="size-4" />
            {t("batchesTab.request")}
          </Button>
        }
      >
        {/* Filters */}
        <div className="grid grid-cols-2 gap-3 border-b border-border p-4 sm:max-w-md">
          <Field label={t("platform")} htmlFor="b-platform">
            <Select
              id="b-platform"
              value={platform}
              onChange={(e) => {
                setPlatform(e.target.value as PlatformCode | "");
                setPage(1);
              }}
            >
              <option value="">{t("filters.allPlatforms")}</option>
              {PLATFORM_CODES.map((p) => (
                <option key={p} value={p}>
                  {t(`platforms.${p}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("filters.status")} htmlFor="b-status">
            <Select
              id="b-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as BatchStatus | "");
                setPage(1);
              }}
            >
              <option value="">{t("filters.any")}</option>
              {BATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`batchStatus.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {q.isLoading ? (
          <SkeletonRows rows={5} />
        ) : loadError ? (
          <Notice tone="error" className="m-4">
            {loadError}
          </Notice>
        ) : batches.length === 0 ? (
          <EmptyState
            Icon={Layers}
            title={t("batchesTab.empty")}
            description={t("batchesTab.emptyDesc")}
            action={
              <Button variant="outline" size="sm" onClick={() => setSheet(true)}>
                <Plus className="size-4" />
                {t("batchesTab.request")}
              </Button>
            }
          />
        ) : (
          <ul className={q.isFetching ? "divide-y divide-border opacity-60" : "divide-y divide-border"}>
            {batches.map((b) => (
              <BatchRow key={b._id} batch={b} fmtD={fmtD} fmtN={fmtN} />
            ))}
          </ul>
        )}
        <Pager pagination={q.data?.pagination} onPage={setPage} />
      </Panel>

      {sheet && <RequestBatchSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

function BatchRow({
  batch: b,
  fmtD,
  fmtN,
}: {
  batch: BatchWithCounts;
  fmtD: (iso: string | null | undefined) => string;
  fmtN: (n: number | null | undefined) => string;
}) {
  const t = useTranslations("adminPlatformCards");
  return (
    <li>
      <Link
        href={`${PLATFORM_CARDS_BASE}/batches/${b._id}`}
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5"
      >
        <PlatformMark platform={b.platform} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {t(`platforms.${b.platform}`)}
            </span>
            <BatchStatusPill status={b.status} />
            <span className="font-mono text-[11px] text-muted-foreground">…{b._id.slice(-6)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {b.note || t("batchesTab.noNote")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("batchesTab.meta", {
              when: fmtD(b.createdAt),
              who: b.createdByEmail ?? "—",
            })}
          </p>
        </div>
        <div className="hidden shrink-0 text-end text-xs text-muted-foreground sm:block">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {fmtN(b.generated)}
            <span className="text-xs font-normal text-muted-foreground"> / {fmtN(b.requested)}</span>
          </p>
          <p>
            {t("batchesTab.assignedShort", { count: fmtN(b.counts.assigned) })}
            {b.counts.disabled > 0 && ` · ${t("batchesTab.disabledShort", { count: fmtN(b.counts.disabled) })}`}
          </p>
        </div>
        <span className="shrink-0 text-end text-sm font-semibold tabular-nums text-foreground sm:hidden">
          {fmtN(b.generated)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
      </Link>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Request sheet                                                               */
/* -------------------------------------------------------------------------- */

export function RequestBatchSheet({
  onClose,
  initialPlatform,
}: {
  onClose: () => void;
  initialPlatform?: PlatformCode;
}) {
  const t = useTranslations("adminPlatformCards");
  const router = useRouter();
  const queryClient = useQueryClient();
  const errMsg = useAdminErrorMessage();
  const fmtD = useFormatDate();

  // Live platform rows so the picker shows each platform's status.
  const platforms = useQuery({ queryKey: PLATFORMS_QUERY_KEY, queryFn: listAdminPlatforms });

  const [platform, setPlatform] = useState<PlatformCode>(initialPlatform ?? "google_reviews");
  const [count, setCount] = useState("");
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingBatchSummary | null>(null);
  const [countError, setCountError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      requestBatch({
        platform,
        count: Number(count),
        note: note.trim() || undefined,
        force: force || undefined,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: BATCHES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PLATFORMS_QUERY_KEY });
      onClose();
      router.push(`${PLATFORM_CARDS_BASE}/batches/${res.batch._id}`);
    },
    onError: async (e) => {
      const parsed = await parseAdminError(e);
      setError(errMsg(parsed));
      if (parsed.kind === "code" && parsed.code === "PENDING_BATCH") {
        setPending((parsed.extra.pendingBatch as PendingBatchSummary | undefined) ?? null);
      } else {
        setPending(null);
      }
    },
  });

  function submit() {
    setError(null);
    setPending(null);
    const n = Number(count);
    if (!Number.isInteger(n) || n < MIN_BATCH_SIZE || n > MAX_BATCH_SIZE) {
      setCountError(t("requestSheet.countRange", { min: MIN_BATCH_SIZE, max: MAX_BATCH_SIZE }));
      return;
    }
    setCountError(null);
    mutation.mutate();
  }

  const selected = platforms.data?.find((p) => p.platform === platform);

  return (
    <BottomSheet
      title={t("requestSheet.title")}
      subtitle={t("requestSheet.subtitle")}
      onClose={onClose}
      footer={
        <div className="border-t border-border p-4">
          <Button variant="gradient" className="w-full" disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : t("requestSheet.submit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={t("platform")} htmlFor="rb-platform">
          <Select
            id="rb-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformCode)}
          >
            {PLATFORM_CODES.map((p) => {
              const row = platforms.data?.find((x) => x.platform === p);
              return (
                <option key={p} value={p}>
                  {t(`platforms.${p}`)}
                  {row ? ` — ${t(`platformStatus.${row.status}`)}` : ""}
                </option>
              );
            })}
          </Select>
        </Field>
        {selected && (
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-xs text-muted-foreground">
            <PlatformMark platform={selected.platform} size={32} />
            <span>
              {t("requestSheet.platformInfo", {
                total: selected.counts.total,
                unassigned: selected.counts.unassigned,
              })}
            </span>
          </div>
        )}

        <Field
          label={t("requestSheet.count")}
          htmlFor="rb-count"
          hint={t("requestSheet.countRange", { min: MIN_BATCH_SIZE, max: MAX_BATCH_SIZE })}
          error={countError}
        >
          <Input
            id="rb-count"
            type="number"
            inputMode="numeric"
            min={MIN_BATCH_SIZE}
            max={MAX_BATCH_SIZE}
            step={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            placeholder="500"
          />
        </Field>

        <Field
          label={t("requestSheet.note")}
          htmlFor="rb-note"
          hint={t("requestSheet.noteHint", { max: MAX_NOTE_LENGTH })}
        >
          <Textarea
            id="rb-note"
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("requestSheet.notePlaceholder")}
            className="min-h-16"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{t("requestSheet.force")}</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">
              {t("requestSheet.forceHelp")}
            </span>
          </span>
        </label>

        {error && (
          <Notice tone="error">
            <p>{error}</p>
            {pending && (
              <Link
                href={`${PLATFORM_CARDS_BASE}/batches/${pending._id}`}
                onClick={onClose}
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold underline"
              >
                {t("requestSheet.openPending", {
                  count: pending.generated,
                  when: fmtD(pending.createdAt),
                })}
                <ChevronRight className="size-3 rtl:rotate-180" />
              </Link>
            )}
          </Notice>
        )}

        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("requestSheet.flow")}</p>
      </div>
    </BottomSheet>
  );
}
