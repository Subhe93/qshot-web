"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Loader2, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  CODE_STATUSES,
  MAX_REASON_LENGTH,
  exportBatch,
  getBatch,
  markBatchPrinted,
  parseAdminError,
  saveBlob,
  voidBatch,
  type AdminCode,
  type Batch,
  type CodeStatus,
  retryUnlessRefused,
} from "@/lib/api/admin-platform-redirect";
import {
  BatchStatusPill,
  CopyValue,
  EmptyState,
  Field,
  KV,
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
import { BATCHES_QUERY_KEY } from "./batches-tab";
import { CodeDrawer, CodeRow } from "./code-drawer";

export const BATCH_QUERY_KEY = ["admin", "platform-cards", "batch"] as const;
const PAGE_SIZE = 50;
type BatchDetailData = Awaited<ReturnType<typeof getBatch>>;

/** Batch detail: counts, codes table, printer file, mark printed, void. */
export function BatchDetail({ batchId }: { batchId: string }) {
  const t = useTranslations("adminPlatformCards");
  const tc = useTranslations("common");
  const fmtD = useFormatDate();
  const fmtN = useFormatNumber();
  const queryClient = useQueryClient();
  const errMsg = useAdminErrorMessage();

  const [status, setStatus] = useState<CodeStatus | "">("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AdminCode | null>(null);

  const q = useQuery({
    queryKey: [...BATCH_QUERY_KEY, batchId, { status, page }],
    queryFn: () => getBatch(batchId, { status, page, limit: PAGE_SIZE }),
    retry: retryUnlessRefused,
    placeholderData: (prev) => prev,
  });
  const loadError = useLoadError(q.error);

  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmPrinted, setConfirmPrinted] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  /** Show the server's batch row immediately, then refetch counts + codes. */
  function refresh(batch?: Batch) {
    if (batch) {
      queryClient.setQueriesData<BatchDetailData>({ queryKey: [...BATCH_QUERY_KEY, batchId] }, (old) =>
        old ? { ...old, batch } : old,
      );
    }
    queryClient.invalidateQueries({ queryKey: [...BATCH_QUERY_KEY, batchId] });
    queryClient.invalidateQueries({ queryKey: BATCHES_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: PLATFORMS_QUERY_KEY });
  }

  const exportM = useMutation({
    mutationFn: () => exportBatch(q.data!.batch),
    onSuccess: (file) => {
      saveBlob(file);
      setActionError(null);
      setDone(t("export.done", { file: file.filename }));
      refresh();
    },
    onError: async (e) => {
      setDone(null);
      setActionError(errMsg(await parseAdminError(e)));
    },
  });
  const printedM = useMutation({
    mutationFn: () => markBatchPrinted(batchId),
    onSuccess: (r) => {
      setConfirmPrinted(false);
      setActionError(null);
      setDone(r.changed ? t("batchDetail.printedDone") : t("codeDrawer.noChange"));
      refresh(r.batch);
    },
    onError: async (e) => {
      setConfirmPrinted(false);
      setDone(null);
      setActionError(errMsg(await parseAdminError(e)));
    },
  });
  const voidM = useMutation({
    mutationFn: () => voidBatch(batchId, voidReason.trim() || undefined),
    onSuccess: (r) => {
      setVoidOpen(false);
      setVoidReason("");
      setActionError(null);
      setDone(t("batchDetail.voidDone", { count: fmtN(r.disabledCount) }));
      refresh(r.batch);
    },
    onError: async (e) => {
      setDone(null);
      setActionError(errMsg(await parseAdminError(e)));
    },
  });

  const data = q.data;
  const b = data?.batch;
  const counts = data?.counts;
  const busy = exportM.isPending || printedM.isPending || voidM.isPending;

  if (q.isLoading) {
    return (
      <Panel>
        <SkeletonRows rows={6} />
      </Panel>
    );
  }
  if (loadError || !data || !b || !counts) {
    return (
      <Panel>
        <EmptyState
          Icon={Ban}
          title={t("batchDetail.notFound")}
          description={loadError ?? undefined}
          action={
            <Link href={`${PLATFORM_CARDS_BASE}/batches`} className="text-sm font-semibold text-primary underline">
              {t("batchDetail.backToList")}
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`${PLATFORM_CARDS_BASE}/batches`}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        ← {t("batchDetail.backToList")}
      </Link>

      <Panel>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
          <PlatformMark platform={b.platform} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                {t("batchDetail.title", { platform: t(`platforms.${b.platform}`) })}
              </h2>
              <BatchStatusPill status={b.status} />
            </div>
            <p className="mt-1 text-sm text-foreground">{b.note || t("batchesTab.noNote")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <CopyValue value={b._id} display={<span className="font-mono">{b._id}</span>} />
              <span>{t("batchesTab.meta", { when: fmtD(b.createdAt), who: b.createdByEmail ?? "—" })}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => exportM.mutate()}>
              {exportM.isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {t("batchDetail.download")}
            </Button>
            {b.status === "generated" && (
              <Button variant="gradient" size="sm" disabled={busy} onClick={() => setConfirmPrinted(true)}>
                <Printer className="size-4" />
                {t("batchDetail.markPrinted")}
              </Button>
            )}
            {b.status !== "void" && (
              <Button
                variant="outline"
                size="sm"
                className="text-error"
                disabled={busy}
                onClick={() => {
                  setVoidReason("");
                  setVoidOpen(true);
                }}
              >
                <Ban className="size-4" />
                {t("batchDetail.void")}
              </Button>
            )}
          </div>
        </div>

        {(actionError || done) && (
          <div className="px-4 pb-4 sm:px-5">
            {actionError ? <Notice tone="error">{actionError}</Notice> : <Notice tone="success">{done}</Notice>}
          </div>
        )}

        {/* Counts */}
        <dl className="grid grid-cols-3 gap-px border-t border-border bg-border text-center sm:grid-cols-6">
          {(
            [
              ["requested", b.requested],
              ["generated", b.generated],
              ["total", counts.total],
              ["unassigned", counts.unassigned],
              ["assigned", counts.assigned],
              ["disabled", counts.disabled],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="bg-card px-2 py-3">
              <dd className="text-base font-semibold tabular-nums text-foreground">{fmtN(v)}</dd>
              <dt className="truncate text-[11px] text-muted-foreground">{t(`stats.${k}`)}</dt>
            </div>
          ))}
        </dl>

        {/* Lifecycle */}
        <div className="grid grid-cols-1 gap-x-6 border-t border-border px-4 sm:grid-cols-2 sm:px-5">
          <KV label={t("batchDetail.printedAt")}>
            {b.printedAt ? fmtD(b.printedAt) : "—"}
          </KV>
          <KV label={t("batchDetail.exports")}>
            {t("batchDetail.exportCount", { count: fmtN(b.exportCount) })}
            {b.lastExportedAt ? ` · ${fmtD(b.lastExportedAt)}` : ""}
          </KV>
          {b.status === "void" && (
            <>
              <KV label={t("batchDetail.voidedAt")}>{fmtD(b.voidedAt)}</KV>
              <KV label={t("reason")}>{b.voidReason ?? "—"}</KV>
            </>
          )}
        </div>
        {b.generated < b.requested && (
          <div className="px-4 pb-4 sm:px-5">
            <Notice tone="info">{t("batchDetail.shortfall", { count: fmtN(b.requested - b.generated) })}</Notice>
          </div>
        )}
      </Panel>

      {/* Codes */}
      <Panel
        title={t("batchDetail.codes")}
        actions={
          <Select
            aria-label={t("filters.status")}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as CodeStatus | "");
              setPage(1);
            }}
            className="w-40 text-xs"
          >
            <option value="">{t("filters.any")}</option>
            {CODE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`codeStatus.${s}`)}
              </option>
            ))}
          </Select>
        }
      >
        {data.codes.length === 0 ? (
          <EmptyState title={t("cardsTab.empty")} />
        ) : (
          <ul className={q.isFetching ? "divide-y divide-border opacity-60" : "divide-y divide-border"}>
            {data.codes.map((c) => (
              <CodeRow key={c._id} code={c} onOpen={setOpen} showPlatform={false} />
            ))}
          </ul>
        )}
        <Pager pagination={data.pagination} onPage={setPage} />
      </Panel>

      {open && <CodeDrawer platform={open.platform} code={open.code} onClose={() => setOpen(null)} />}

      <ConfirmDialog
        open={confirmPrinted}
        type="info"
        title={t("batchDetail.printedTitle")}
        message={t("batchDetail.printedMsg", { count: fmtN(b.generated) })}
        confirmText={t("batchDetail.markPrinted")}
        cancelText={tc("cancel")}
        onConfirm={() => printedM.mutate()}
        onCancel={() => setConfirmPrinted(false)}
      />

      {voidOpen && (
        <BottomSheet
          title={t("batchDetail.voidTitle")}
          onClose={() => setVoidOpen(false)}
          footer={
            <div className="flex gap-2 border-t border-border p-4">
              <Button variant="outline" className="flex-1" onClick={() => setVoidOpen(false)} disabled={busy}>
                {tc("cancel")}
              </Button>
              <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => voidM.mutate()}>
                {voidM.isPending ? <Loader2 className="size-4 animate-spin" /> : t("batchDetail.void")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Notice tone="info">{t("batchDetail.voidHelp", { count: fmtN(counts.unassigned) })}</Notice>
            <Field label={t("reason")} htmlFor="void-reason" hint={t("reasonHint", { max: MAX_REASON_LENGTH })}>
              <Textarea
                id="void-reason"
                value={voidReason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setVoidReason(e.target.value)}
                className="min-h-16"
              />
            </Field>
            {actionError && <Notice tone="error">{actionError}</Notice>}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
