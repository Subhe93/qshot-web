"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, ExternalLink, Loader2, Unlink2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MAX_REASON_LENGTH,
  disableCode,
  enableCode,
  getCode,
  parseAdminError,
  unlinkCode,
  type AdminCode,
  type CodeHistoryEntry,
  type PlatformCode,
  retryUnlessRefused,
} from "@/lib/api/admin-platform-redirect";
import {
  BatchStatusPill,
  CodeStatusPill,
  CopyValue,
  Field,
  KV,
  Notice,
  Pill,
  PlatformMark,
  SkeletonRows,
  useAdminErrorMessage,
  useLoadError,
  useFormatDate,
  useFormatNumber,
} from "./shared";
import { PLATFORM_CARDS_BASE } from "./tabs";

export const CODE_QUERY_KEY = ["admin", "platform-cards", "code"] as const;

/** Query keys that show code rows anywhere — invalidated after every code action. */
const CODE_LIST_KEYS = [
  ["admin", "platform-cards", "codes"],
  ["admin", "platform-cards", "batch"],
  ["admin", "platform-cards", "batches"],
  ["admin", "platform-cards", "stats"],
  ["admin", "platform-cards", "platforms"],
  ["admin", "platform-cards", "account"],
] as const;

type Action = "disable" | "unlink";

/**
 * Card detail drawer: `GET /codes/:platform/:code` (owner, link, hits, history)
 * with Disable (reason) / Enable / Unlink (reason → shows `previousUserId`).
 */
export function CodeDrawer({
  platform,
  code,
  onClose,
}: {
  platform: PlatformCode;
  code: string;
  onClose: () => void;
}) {
  const t = useTranslations("adminPlatformCards");
  const tc = useTranslations("common");
  const fmtD = useFormatDate();
  const fmtN = useFormatNumber();
  const queryClient = useQueryClient();
  const errMsg = useAdminErrorMessage();

  const q = useQuery({
    queryKey: [...CODE_QUERY_KEY, platform, code],
    queryFn: () => getCode(platform, code),
    retry: retryUnlessRefused,
  });
  const loadError = useLoadError(q.error);

  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [confirmEnable, setConfirmEnable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: [...CODE_QUERY_KEY, platform, code] });
    for (const k of CODE_LIST_KEYS) queryClient.invalidateQueries({ queryKey: [...k] });
  }

  const disableM = useMutation({
    mutationFn: () => disableCode(platform, code, reason.trim() || undefined),
    onSuccess: (r) => {
      refresh();
      setAction(null);
      setReason("");
      setDone(r.changed ? t("codeDrawer.disabled") : t("codeDrawer.noChange"));
    },
    onError: async (e) => setError(errMsg(await parseAdminError(e))),
  });
  const enableM = useMutation({
    mutationFn: () => enableCode(platform, code),
    onSuccess: (r) => {
      refresh();
      setConfirmEnable(false);
      setDone(r.changed ? t("codeDrawer.enabled") : t("codeDrawer.noChange"));
    },
    onError: async (e) => {
      setConfirmEnable(false);
      setError(errMsg(await parseAdminError(e)));
    },
  });
  const unlinkM = useMutation({
    mutationFn: () => unlinkCode(platform, code, reason.trim() || undefined),
    onSuccess: (r) => {
      refresh();
      setAction(null);
      setReason("");
      setDone(
        r.previousUserId
          ? t("codeDrawer.unlinked", { userId: r.previousUserId })
          : t("codeDrawer.unlinkedNoOwner"),
      );
    },
    onError: async (e) => setError(errMsg(await parseAdminError(e))),
  });

  const busy = disableM.isPending || enableM.isPending || unlinkM.isPending;
  const c = q.data;

  return (
    <BottomSheet
      title={t("codeDrawer.title", { code })}
      subtitle={t(`platforms.${platform}`)}
      onClose={onClose}
      footer={
        c ? (
          <div className="flex flex-wrap gap-2 border-t border-border p-4">
            {c.status === "disabled" ? (
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setDone(null);
                  setConfirmEnable(true);
                }}
              >
                <CheckCircle2 className="size-4 text-success" />
                {t("codeDrawer.enable")}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="flex-1 text-error"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setDone(null);
                  setReason("");
                  setAction("disable");
                }}
              >
                <Ban className="size-4" />
                {t("codeDrawer.disable")}
              </Button>
            )}
            {c.status === "assigned" && (
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setDone(null);
                  setReason("");
                  setAction("unlink");
                }}
              >
                <Unlink2 className="size-4" />
                {t("codeDrawer.unlink")}
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {q.isLoading ? (
        <SkeletonRows rows={5} className="p-0" />
      ) : loadError ? (
        <Notice tone="error">{loadError}</Notice>
      ) : c ? (
        <div className="space-y-4">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <PlatformMark platform={c.platform} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg font-bold tracking-wider text-foreground">{c.code}</span>
                <CodeStatusPill status={c.status} />
                <Pill tone="muted" dot={false}>
                  {t(`source.${c.source}`)}
                </Pill>
              </div>
              <CopyValue value={c.cardUrl} className="mt-0.5 max-w-full text-muted-foreground" />
            </div>
          </div>

          {done && <Notice tone="success">{done}</Notice>}
          {error && !action && <Notice tone="error">{error}</Notice>}

          {c.status === "disabled" && (
            <Notice tone="info">
              {t("codeDrawer.disabledSince", { when: fmtD(c.disabledAt) })}
              {c.disabledReason ? ` — ${c.disabledReason}` : ""}
            </Notice>
          )}

          {/* Owner */}
          <Section title={t("codeDrawer.owner")}>
            {c.user || c.userId ? (
              <>
                <KV label={t("codeDrawer.name")}>{c.user?.name ?? "—"}</KV>
                <KV label={t("codeDrawer.email")}>{c.user?.email ?? "—"}</KV>
                <KV label={t("codeDrawer.userId")} mono>
                  {c.userId ? (
                    <Link
                      href={`${PLATFORM_CARDS_BASE}/support?userId=${c.userId}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-primary underline"
                    >
                      {c.userId}
                      <ExternalLink className="size-3" />
                    </Link>
                  ) : (
                    "—"
                  )}
                </KV>
                {c.userDeleted && (
                  <Pill tone="error" dot={false} className="mb-2">
                    {t("codeDrawer.orphaned")}
                  </Pill>
                )}
                <KV label={t("codeDrawer.assignedAt")}>{fmtD(c.assignedAt)}</KV>
                <KV label={t("codeDrawer.label")}>{c.label ?? "—"}</KV>
              </>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">{t("codeDrawer.noOwner")}</p>
            )}
          </Section>

          {/* Link */}
          <Section title={t("codeDrawer.link")}>
            {c.link ? (
              <>
                <KV label={t("codeDrawer.linkUrl")}>
                  <CopyValue value={c.link.url} className="max-w-full" />
                </KV>
                <KV label={t("codeDrawer.linkHost")} mono>
                  {c.link.host}
                </KV>
                <KV label={t("codeDrawer.linkUpdated")}>{fmtD(c.link.updatedAt)}</KV>
              </>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">{t("codeDrawer.noLink")}</p>
            )}
          </Section>

          {/* Scans + batch */}
          <Section title={t("codeDrawer.activity")}>
            <KV label={t("codeDrawer.hits")}>{fmtN(c.hits)}</KV>
            <KV label={t("codeDrawer.lastHit")}>{fmtD(c.lastHitAt)}</KV>
            <KV label={t("codeDrawer.created")}>{fmtD(c.createdAt)}</KV>
            <KV label={t("codeDrawer.batch")}>
              {c.batch ? (
                <Link
                  href={`${PLATFORM_CARDS_BASE}/batches/${c.batch._id}`}
                  onClick={onClose}
                  className="inline-flex flex-wrap items-center justify-end gap-1.5 text-primary underline"
                >
                  <span className="font-mono text-xs">…{c.batch._id.slice(-6)}</span>
                  <BatchStatusPill status={c.batch.status} />
                </Link>
              ) : (
                "—"
              )}
            </KV>
          </Section>

          {/* History */}
          <Section title={t("codeDrawer.history")}>
            {c.history && c.history.length > 0 ? (
              <ol className="space-y-1.5 py-2">
                {[...c.history].reverse().map((h, i) => (
                  <HistoryLine key={i} entry={h} />
                ))}
              </ol>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">{t("codeDrawer.noHistory")}</p>
            )}
          </Section>
        </div>
      ) : null}

      {/* Reason sheet for disable / unlink */}
      {action && c && (
        <BottomSheet
          title={action === "disable" ? t("codeDrawer.disableTitle", { code }) : t("codeDrawer.unlinkTitle", { code })}
          onClose={() => setAction(null)}
          footer={
            <div className="flex gap-2 border-t border-border p-4">
              <Button variant="outline" className="flex-1" onClick={() => setAction(null)} disabled={busy}>
                {tc("cancel")}
              </Button>
              <Button
                variant={action === "disable" ? "destructive" : "gradient"}
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  if (action === "disable") disableM.mutate();
                  else unlinkM.mutate();
                }}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : action === "disable" ? (
                  t("codeDrawer.disable")
                ) : (
                  t("codeDrawer.unlink")
                )}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {action === "disable" ? t("codeDrawer.disableHelp") : t("codeDrawer.unlinkHelp")}
            </p>
            {action === "unlink" && c.user && (
              <div className="rounded-2xl bg-surface px-4">
                <KV label={t("codeDrawer.owner")}>{c.user.email ?? c.user.name ?? c.userId}</KV>
              </div>
            )}
            <Field label={t("reason")} htmlFor="code-reason" hint={t("reasonHint", { max: MAX_REASON_LENGTH })}>
              <Textarea
                id="code-reason"
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-16"
              />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </BottomSheet>
      )}

      <ConfirmDialog
        open={confirmEnable}
        type="info"
        title={t("codeDrawer.enableTitle")}
        message={t("codeDrawer.enableMsg", { code })}
        confirmText={t("codeDrawer.enable")}
        cancelText={tc("cancel")}
        onConfirm={() => enableM.mutate()}
        onCancel={() => setConfirmEnable(false)}
      />
    </BottomSheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-2xl border border-border px-4 [&>div+div]:border-t [&>div+div]:border-border">
        {children}
      </div>
    </section>
  );
}

export function HistoryLine({ entry }: { entry: CodeHistoryEntry }) {
  const fmtD = useFormatDate();
  const { action, at, by, note, reason, ...rest } = entry;
  const extra = Object.entries(rest).filter(([, v]) => v !== undefined && v !== null);
  return (
    <li className="text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{action}</span>
        <span className="text-muted-foreground">{fmtD(at)}</span>
      </div>
      {(note || reason || by) && (
        <p className="text-muted-foreground [overflow-wrap:anywhere]">
          {[note, reason].filter(Boolean).join(" — ")}
          {by ? ` · ${by}` : ""}
        </p>
      )}
      {extra.length > 0 && (
        <p className="font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
          {extra.map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`).join(" ")}
        </p>
      )}
    </li>
  );
}

/** Compact row used by the Cards tab, batch detail and the account view. */
export function CodeRow({
  code: c,
  onOpen,
  showPlatform = true,
  showBatch = false,
}: {
  code: AdminCode;
  onOpen: (c: AdminCode) => void;
  showPlatform?: boolean;
  showBatch?: boolean;
}) {
  const t = useTranslations("adminPlatformCards");
  const tc = useTranslations("common");
  const fmtD = useFormatDate();
  const fmtN = useFormatNumber();
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(c);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5"
      >
        {showPlatform && <PlatformMark platform={c.platform} size={32} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wider text-foreground">{c.code}</span>
            <CodeStatusPill status={c.status} />
            {c.userDeleted && (
              <Pill tone="error" dot={false}>
                {t("codeDrawer.orphaned")}
              </Pill>
            )}
            <span className="hidden text-[11px] text-muted-foreground sm:inline">{t(`source.${c.source}`)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {c.user?.email ?? (c.userId ? c.userId : t("cardsTab.unowned"))}
            {c.label ? ` · ${c.label}` : ""}
            {showBatch && c.batch ? ` · …${c.batch._id.slice(-6)}` : ""}
          </p>
        </div>
        <div className="hidden shrink-0 text-end text-xs text-muted-foreground md:block">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {t("cardsTab.hits", { count: fmtN(c.hits) })}
          </p>
          <p>{c.lastHitAt ? fmtD(c.lastHitAt) : t("cardsTab.neverScanned")}</p>
        </div>
        <span
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="shrink-0"
        >
          <CopyValue value={c.cardUrl} display={<span className="sr-only">{tc("copy")}</span>} mono={false} />
        </span>
      </div>
    </li>
  );
}
