"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Loader2, Search, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  MAX_REASON_LENGTH,
  getAccountView,
  listLinksByHost,
  parseAdminError,
  removeAccountLink,
  type AdminCode,
  type CodeLink,
  type PlatformCode,
  retryUnlessRefused,
} from "@/lib/api/admin-platform-redirect";
import {
  CopyValue,
  EmptyState,
  Field,
  KV,
  Notice,
  Pager,
  Panel,
  Pill,
  PlatformMark,
  SkeletonRows,
  useAdminErrorMessage,
  useLoadError,
  useFormatDate,
  useFormatNumber,
} from "./shared";
import { CodeDrawer, CodeRow } from "./code-drawer";
import { PLATFORM_CARDS_BASE } from "./tabs";

export const ACCOUNT_QUERY_KEY = ["admin", "platform-cards", "account"] as const;
export const BY_HOST_QUERY_KEY = ["admin", "platform-cards", "by-host"] as const;

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Support & abuse: account lookup (+ remove link) and "who points at a host". */
export function SupportTab() {
  return (
    <div className="space-y-4">
      {/* useSearchParams needs a Suspense boundary for static rendering. */}
      <Suspense fallback={<Panel><SkeletonRows rows={3} /></Panel>}>
        <AccountLookupFromParams />
      </Suspense>
      <ByHostLookup />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Account lookup                                                              */
/* -------------------------------------------------------------------------- */

/** Reads `?userId=` (deep link from the card drawer); remounts the lookup when it changes. */
function AccountLookupFromParams() {
  const params = useSearchParams();
  const initial = params.get("userId") ?? "";
  return <AccountLookup key={initial} initialUserId={initial} />;
}

function AccountLookup({ initialUserId: initial }: { initialUserId: string }) {
  const t = useTranslations("adminPlatformCards");
  const tc = useTranslations("common");
  const fmtD = useFormatDate();
  const fmtN = useFormatNumber();
  const errMsg = useAdminErrorMessage();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(initial);
  const [userId, setUserId] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [open, setOpen] = useState<AdminCode | null>(null);
  const [removing, setRemoving] = useState<CodeLink | null>(null);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [...ACCOUNT_QUERY_KEY, userId],
    queryFn: () => getAccountView(userId),
    enabled: OBJECT_ID_RE.test(userId),
    retry: retryUnlessRefused,
  });
  const loadError = useLoadError(q.error);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!OBJECT_ID_RE.test(v)) {
      setFormError(t("support.invalidUserId"));
      return;
    }
    setFormError(null);
    setDone(null);
    setActionError(null);
    setUserId(v);
  }

  const removeM = useMutation({
    mutationFn: () => removeAccountLink(userId, removing!.platform as PlatformCode, reason.trim() || undefined),
    onSuccess: (r) => {
      setConfirm(false);
      setRemoving(null);
      setReason("");
      setActionError(null);
      setDone(r.removed ? t("support.linkRemoved") : t("support.linkAlreadyGone"));
      queryClient.invalidateQueries({ queryKey: [...ACCOUNT_QUERY_KEY, userId] });
      queryClient.invalidateQueries({ queryKey: BY_HOST_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin", "platform-cards", "platforms"] });
    },
    onError: async (e) => {
      setConfirm(false);
      setActionError(errMsg(await parseAdminError(e)));
    },
  });

  const data = q.data;

  return (
    <Panel title={t("support.accountTitle")} description={t("support.accountDesc")}>
      <form onSubmit={submit} className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:p-5">
        <Field label={t("support.userId")} htmlFor="s-user" error={formError} className="flex-1">
          <Input
            id="s-user"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="67b43ad943e44a2e382e6e33"
            className="font-mono"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" variant="gradient" className="sm:mb-0">
          <Search className="size-4" />
          {t("support.lookup")}
        </Button>
      </form>

      {!userId ? (
        <EmptyState Icon={UserRound} title={t("support.accountEmpty")} description={t("support.accountEmptyDesc")} />
      ) : q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : loadError ? (
        <Notice tone="error" className="m-4">
          {loadError}
        </Notice>
      ) : data ? (
        <div className="space-y-4 p-4 sm:p-5">
          {/* User */}
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-card text-muted-foreground">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{data.user.name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{data.user.email ?? "—"}</p>
              <CopyValue value={data.user._id} className="text-muted-foreground" />
            </div>
            {data.user.isCompany && (
              <Pill tone="info" dot={false}>
                {t("support.company")}
              </Pill>
            )}
          </div>

          {done && <Notice tone="success">{done}</Notice>}
          {actionError && !removing && <Notice tone="error">{actionError}</Notice>}

          {/* Links */}
          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("support.links", { count: data.links.length })}
            </h3>
            {data.links.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">{t("support.noLinks")}</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {data.links.map((l) => (
                  <li key={`${l.platform}-${l.url}`} className="flex items-center gap-3 px-3 py-2.5">
                    <PlatformMark platform={l.platform ?? ""} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {l.platform ? t(`platforms.${l.platform}`) : "—"}
                      </p>
                      <CopyValue value={l.url} className="max-w-full text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">
                        {l.host} · {fmtD(l.updatedAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-error"
                      onClick={() => {
                        setReason("");
                        setActionError(null);
                        setDone(null);
                        setRemoving(l);
                      }}
                    >
                      <Trash2 className="size-4" />
                      <span className="hidden sm:inline">{t("support.removeLink")}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Codes */}
          <section>
            <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("support.codes", { count: fmtN(data.codes.length) })}
            </h3>
            {data.codes.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">{t("support.noCodes")}</p>
            ) : (
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {data.codes.map((c) => (
                  <CodeRow key={c._id} code={c} onOpen={setOpen} showBatch />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {open && <CodeDrawer platform={open.platform} code={open.code} onClose={() => setOpen(null)} />}

      {removing && (
        <BottomSheet
          title={t("support.removeLinkTitle", {
            platform: removing.platform ? t(`platforms.${removing.platform}`) : "",
          })}
          onClose={() => setRemoving(null)}
          footer={
            <div className="flex gap-2 border-t border-border p-4">
              <Button variant="outline" className="flex-1" onClick={() => setRemoving(null)} disabled={removeM.isPending}>
                {tc("cancel")}
              </Button>
              <Button variant="destructive" className="flex-1" disabled={removeM.isPending} onClick={() => setConfirm(true)}>
                {removeM.isPending ? <Loader2 className="size-4 animate-spin" /> : t("support.removeLink")}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Notice tone="info">{t("support.removeLinkHelp")}</Notice>
            <div className="rounded-2xl bg-surface px-4">
              <KV label={t("codeDrawer.linkUrl")}>
                <span className="font-mono text-xs">{removing.url}</span>
              </KV>
              <KV label={t("codeDrawer.owner")}>{data?.user.email ?? userId}</KV>
            </div>
            <Field label={t("reason")} htmlFor="rm-reason" hint={t("reasonHint", { max: MAX_REASON_LENGTH })}>
              <Textarea
                id="rm-reason"
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-16"
              />
            </Field>
            {actionError && <Notice tone="error">{actionError}</Notice>}
          </div>
          <ConfirmDialog
            open={confirm}
            danger
            title={t("support.removeLinkConfirmTitle")}
            message={t("support.removeLinkConfirmMsg", {
              platform: removing.platform ? t(`platforms.${removing.platform}`) : "",
              email: data?.user.email ?? userId,
            })}
            confirmText={t("support.removeLink")}
            cancelText={tc("cancel")}
            onConfirm={() => removeM.mutate()}
            onCancel={() => setConfirm(false)}
          />
        </BottomSheet>
      )}
    </Panel>
  );
}

/* -------------------------------------------------------------------------- */
/* Who points at a host                                                        */
/* -------------------------------------------------------------------------- */

const HOST_PAGE_SIZE = 25;

function ByHostLookup() {
  const t = useTranslations("adminPlatformCards");
  const fmtD = useFormatDate();

  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [host, setHost] = useState("");
  const [page, setPage] = useState(1);
  const [formError, setFormError] = useState<string | null>(null);

  const q = useQuery({
    queryKey: [...BY_HOST_QUERY_KEY, host, page],
    queryFn: () => listLinksByHost({ host, page, limit: HOST_PAGE_SIZE }),
    enabled: host.length > 0,
    retry: retryUnlessRefused,
    placeholderData: (prev) => prev,
  });
  const loadError = useLoadError(q.error);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Accept a pasted URL too — keep only the host part.
    let v = draft.trim().toLowerCase();
    try {
      if (/^[a-z]+:\/\//.test(v)) v = new URL(v).hostname;
    } catch {
      /* keep as typed */
    }
    v = v.replace(/^\.+/, "").replace(/[/:].*$/, "");
    if (!v || v.length > 253) {
      setFormError(t("support.invalidHost"));
      return;
    }
    setFormError(null);
    setDraft(v);
    setHost(v);
    setPage(1);
  }

  const links = q.data?.links ?? [];

  return (
    <Panel title={t("support.hostTitle")} description={t("support.hostDesc")}>
      <form onSubmit={submit} className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:p-5">
        <Field label={t("support.host")} htmlFor="s-host" error={formError} hint={t("support.hostHint")} className="flex-1">
          <Input
            id="s-host"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="g.page"
            className="font-mono"
            spellCheck={false}
            maxLength={253}
          />
        </Field>
        <Button type="submit" variant="gradient">
          <Search className="size-4" />
          {t("support.lookup")}
        </Button>
      </form>

      {!host ? (
        <EmptyState Icon={Globe} title={t("support.hostEmpty")} description={t("support.hostEmptyDesc")} />
      ) : q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : loadError ? (
        <Notice tone="error" className="m-4">
          {loadError}
        </Notice>
      ) : links.length === 0 ? (
        <EmptyState Icon={Globe} title={t("support.hostNoResults", { host })} />
      ) : (
        <ul className={q.isFetching ? "divide-y divide-border opacity-60" : "divide-y divide-border"}>
          {links.map((l, i) => (
            <li key={`${l.user?._id ?? i}-${l.platform}`} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <PlatformMark platform={l.platform} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {l.user?.email ?? l.user?.name ?? l.user?._id ?? "—"}
                </p>
                <CopyValue value={l.url} className="max-w-full text-muted-foreground" />
              </div>
              <div className="hidden shrink-0 text-end text-xs text-muted-foreground sm:block">
                <p className="font-mono">{l.host}</p>
                <p>{fmtD(l.updatedAt)}</p>
              </div>
              {l.user?._id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    router.replace(`${PLATFORM_CARDS_BASE}/support?userId=${l.user!._id}`);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {t("support.openAccount")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager pagination={q.data?.pagination} onPage={setPage} />
    </Panel>
  );
}
