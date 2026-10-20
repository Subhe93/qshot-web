"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Link2, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MAX_LABEL_LENGTH,
  PLATFORM_STATUSES,
  getPlatformHistory,
  listAdminPlatforms,
  parseAdminError,
  updatePlatform,
  type AdminPlatform,
  type PlatformHistoryEntry,
  type PlatformPatch,
  type PlatformStatus,
} from "@/lib/api/admin-platform-redirect";
import {
  CopyValue,
  EmptyState,
  Field,
  KV,
  Notice,
  Panel,
  Pill,
  PlatformMark,
  PlatformStatusPill,
  Select,
  SkeletonRows,
  useAdminErrorMessage,
  useLoadError,
  useFormatDate,
  useFormatNumber,
} from "./shared";
import { STATS_QUERY_KEY } from "./overview-tab";

export const PLATFORMS_QUERY_KEY = ["admin", "platform-cards", "platforms"] as const;

/** Platforms: six rows with status switch, overrides editor, rules and history. */
export function PlatformsTab() {
  const t = useTranslations("adminPlatformCards");
  const q = useQuery({ queryKey: PLATFORMS_QUERY_KEY, queryFn: listAdminPlatforms });
  const loadError = useLoadError(q.error);

  const [editing, setEditing] = useState<AdminPlatform | null>(null);
  const [history, setHistory] = useState<AdminPlatform | null>(null);

  return (
    <div className="space-y-4">
      <Notice tone="info">{t("platformsTab.statusHelp")}</Notice>

      {q.isLoading ? (
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : !q.data || q.data.length === 0 ? (
        <Panel>
          <EmptyState title={t("platformsTab.empty")} />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {q.data.map((p) => (
            <PlatformRow
              key={p.platform}
              platform={p}
              onEdit={() => setEditing(p)}
              onHistory={() => setHistory(p)}
            />
          ))}
        </div>
      )}

      {editing && <OverridesSheet platform={editing} onClose={() => setEditing(null)} />}
      {history && <HistorySheet platform={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

function PlatformRow({
  platform: p,
  onEdit,
  onHistory,
}: {
  platform: AdminPlatform;
  onEdit: () => void;
  onHistory: () => void;
}) {
  const t = useTranslations("adminPlatformCards");
  const tc = useTranslations("common");
  const fmtD = useFormatDate();
  const fmtN = useFormatNumber();
  const queryClient = useQueryClient();
  const errMsg = useAdminErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PlatformStatus | null>(null);

  const statusMutation = useMutation({
    mutationFn: (status: PlatformStatus) => updatePlatform(p.platform, { status }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: PLATFORMS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
    },
    onError: async (e) => setError(errMsg(await parseAdminError(e))),
  });

  function onStatusChange(next: PlatformStatus) {
    if (next === p.status) return;
    // Leaving `active` stops every scan of this platform — ask first.
    if (p.status === "active") {
      setPendingStatus(next);
      return;
    }
    statusMutation.mutate(next);
  }

  const hasOverrides =
    p.overrides.label != null || p.overrides.urlHint != null || p.overrides.order != null;

  return (
    <Panel className="flex flex-col">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        <PlatformMark platform={p.platform} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{p.label}</h3>
            <PlatformStatusPill status={p.status} />
            <Pill tone="info" dot={false}>
              {t(`purpose.${p.purpose}`)}
            </Pill>
            {hasOverrides && (
              <Pill tone="warning" dot={false}>
                {t("platformsTab.overridden")}
              </Pill>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{p.platform}</span>
            <span className="mx-1.5">·</span>
            <span className="font-mono">/{p.path}/{"{code}"}</span>
          </p>
        </div>
        <div className="w-32 shrink-0 sm:w-36">
          <Select
            aria-label={t("platformsTab.statusLabel")}
            value={p.status}
            disabled={statusMutation.isPending}
            onChange={(e) => onStatusChange(e.target.value as PlatformStatus)}
            className="text-xs"
          >
            {PLATFORM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`platformStatus.${s}`)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Counts */}
      <dl className="grid grid-cols-5 gap-px border-y border-border bg-border text-center">
        {(
          [
            ["total", p.counts.total],
            ["assigned", p.counts.assigned],
            ["unassigned", p.counts.unassigned],
            ["disabled", p.counts.disabled],
            ["links", p.linksCount],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="bg-card px-1 py-2.5">
            <dd className="text-sm font-semibold tabular-nums text-foreground">{fmtN(v)}</dd>
            <dt className="truncate text-[11px] text-muted-foreground">{t(`stats.${k}`)}</dt>
          </div>
        ))}
      </dl>

      <div className="flex-1 space-y-3 p-4 text-sm sm:p-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("platformsTab.urlHint")}</p>
          <p className="mt-0.5 flex items-center gap-1 font-mono text-xs text-foreground">
            <CopyValue value={p.urlHint} />
          </p>
        </div>

        <details className="group rounded-xl bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-foreground">
            <span className="flex items-center gap-2">
              <Link2 className="size-3.5 text-muted-foreground" />
              {t("platformsTab.rules", { count: p.rules.length })}
            </span>
            <span className="text-muted-foreground group-open:hidden">{t("show")}</span>
            <span className="hidden text-muted-foreground group-open:inline">{t("hide")}</span>
          </summary>
          <ul className="space-y-1 px-3 pb-3 text-xs text-muted-foreground">
            {p.rules.map((r) => (
              <li key={r} className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
                <span className="[overflow-wrap:anywhere]">{r}</span>
              </li>
            ))}
            {p.allowedHosts.length > 0 && (
              <li className="pt-2">
                <span className="font-medium text-foreground">{t("platformsTab.allowedHosts")}: </span>
                <span className="font-mono">{p.allowedHosts.join(", ")}</span>
              </li>
            )}
          </ul>
        </details>

        {error && <Notice tone="error">{error}</Notice>}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
        <p className="text-[11px] text-muted-foreground">
          {p.updatedAt
            ? t("platformsTab.updated", { when: fmtD(p.updatedAt), who: p.updatedByEmail ?? "—" })
            : t("platformsTab.neverChanged", { status: t(`platformStatus.${p.defaultStatus}`) })}
        </p>
        <span className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onHistory}>
            <History className="size-4" />
            {t("platformsTab.history")}
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
            {tc("edit")}
          </Button>
        </span>
      </footer>

      <ConfirmDialog
        open={pendingStatus !== null}
        type="warning"
        title={t("platformsTab.confirmTitle")}
        message={t("platformsTab.confirmMsg", {
          label: p.label,
          status: pendingStatus ? t(`platformStatus.${pendingStatus}`) : "",
        })}
        confirmText={t("platformsTab.confirmButton")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          if (pendingStatus) statusMutation.mutate(pendingStatus);
          setPendingStatus(null);
        }}
        onCancel={() => setPendingStatus(null)}
      />
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Overrides sheet                                                             */
/* -------------------------------------------------------------------------- */

function OverridesSheet({ platform: p, onClose }: { platform: AdminPlatform; onClose: () => void }) {
  const t = useTranslations("adminPlatformCards");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const errMsg = useAdminErrorMessage();

  const [label, setLabel] = useState(p.overrides.label ?? "");
  const [urlHint, setUrlHint] = useState(p.overrides.urlHint ?? "");
  const [order, setOrder] = useState(p.overrides.order == null ? "" : String(p.overrides.order));
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (patch: PlatformPatch) => updatePlatform(p.platform, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLATFORMS_QUERY_KEY });
      onClose();
    },
    onError: async (e) => setError(errMsg(await parseAdminError(e))),
  });

  function save() {
    setError(null);
    const patch: PlatformPatch = {};
    const nextLabel = label.trim() || null;
    const nextHint = urlHint.trim() || null;
    const nextOrder = order.trim() === "" ? null : Number(order);
    if (nextOrder !== null && (!Number.isInteger(nextOrder) || nextOrder < 0)) {
      setError(t("platformsTab.orderInvalid"));
      return;
    }
    if (nextLabel !== (p.overrides.label ?? null)) patch.label = nextLabel;
    if (nextHint !== (p.overrides.urlHint ?? null)) patch.urlHint = nextHint;
    if (nextOrder !== (p.overrides.order ?? null)) patch.order = nextOrder;
    if (Object.keys(patch).length === 0) return onClose();
    mutation.mutate(patch);
  }

  return (
    <BottomSheet
      title={t("platformsTab.editTitle", { label: p.label })}
      subtitle={p.platform}
      onClose={onClose}
      footer={
        <div className="flex gap-2 border-t border-border p-4">
          <Button
            variant="outline"
            className="shrink-0"
            disabled={mutation.isPending}
            onClick={() => {
              setError(null);
              mutation.mutate({ label: null, urlHint: null, order: null });
            }}
          >
            <RotateCcw className="size-4" />
            {t("platformsTab.resetOverrides")}
          </Button>
          <Button variant="gradient" className="flex-1" disabled={mutation.isPending} onClick={save}>
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : tc("save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">{t("platformsTab.editHelp")}</p>
        <Field
          label={t("platformsTab.labelField")}
          htmlFor="ov-label"
          hint={t("platformsTab.defaultIs", { value: t(`platforms.${p.platform}`) })}
        >
          <Input
            id="ov-label"
            value={label}
            maxLength={MAX_LABEL_LENGTH}
            placeholder={t(`platforms.${p.platform}`)}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Field
          label={t("platformsTab.urlHint")}
          htmlFor="ov-hint"
          hint={p.overrides.urlHint == null ? t("platformsTab.defaultIs", { value: p.urlHint }) : undefined}
        >
          <Input
            id="ov-hint"
            value={urlHint}
            placeholder={p.overrides.urlHint == null ? p.urlHint : ""}
            onChange={(e) => setUrlHint(e.target.value)}
            className="font-mono text-xs"
          />
        </Field>
        <Field
          label={t("platformsTab.orderField")}
          htmlFor="ov-order"
          hint={t("platformsTab.orderHint", { value: p.order })}
        >
          <Input
            id="ov-order"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={order}
            placeholder={String(p.order)}
            onChange={(e) => setOrder(e.target.value)}
          />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    </BottomSheet>
  );
}

/* -------------------------------------------------------------------------- */
/* History sheet                                                               */
/* -------------------------------------------------------------------------- */

function HistorySheet({ platform: p, onClose }: { platform: AdminPlatform; onClose: () => void }) {
  const t = useTranslations("adminPlatformCards");
  const fmtD = useFormatDate();
  const q = useQuery({
    queryKey: [...PLATFORMS_QUERY_KEY, p.platform, "history"],
    queryFn: () => getPlatformHistory(p.platform),
  });
  const error = useLoadError(q.error);

  return (
    <BottomSheet title={t("platformsTab.historyTitle", { label: p.label })} subtitle={p.platform} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-surface px-4">
          <KV label={t("platformsTab.statusLabel")}>
            <PlatformStatusPill status={p.status} />
          </KV>
          <KV label={t("platformsTab.defaultStatus")}>{t(`platformStatus.${p.defaultStatus}`)}</KV>
          <KV label={t("platformsTab.lastChange")}>{fmtD(p.updatedAt)}</KV>
          <KV label={t("platformsTab.changedBy")}>{p.updatedByEmail ?? "—"}</KV>
        </div>

        {q.isLoading ? (
          <SkeletonRows rows={3} className="p-0" />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : !q.data || q.data.length === 0 ? (
          <EmptyState Icon={History} title={t("platformsTab.noHistory")} description={t("platformsTab.noHistoryDesc")} className="py-8" />
        ) : (
          <ol className="space-y-2">
            {q.data.map((h, i) => (
              <HistoryItem key={i} entry={h} />
            ))}
          </ol>
        )}
      </div>
    </BottomSheet>
  );
}

/** Generic renderer — the live history list was empty while this was built, so
 *  every field is optional and unknown fields are shown as compact JSON. */
function HistoryItem({ entry }: { entry: PlatformHistoryEntry }) {
  const fmtD = useFormatDate();
  const { action, at, by, byEmail, note, ...rest } = entry;
  const detail = Object.entries(rest).filter(([, v]) => v !== undefined && v !== null);
  return (
    <li className="rounded-2xl border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{String(action ?? "—")}</span>
        <span className="text-xs text-muted-foreground">{fmtD(typeof at === "string" ? at : null)}</span>
      </div>
      {(byEmail || by) && (
        <p className="mt-0.5 text-xs text-muted-foreground">{String(byEmail ?? by)}</p>
      )}
      {note && <p className="mt-1 text-xs text-foreground">{String(note)}</p>}
      {detail.length > 0 && (
        <dl className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
          {detail.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="shrink-0">{k}:</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">
                {typeof v === "string" ? v : JSON.stringify(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
