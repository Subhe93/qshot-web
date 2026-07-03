"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, Copy, Globe, Loader2 } from "lucide-react";
import {
  approveDomainRequest,
  listDomainRequests,
  type DnsRecord,
  type DomainRequest,
} from "@/lib/api/admin";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FancyField } from "@/components/ui/fancy-field";
import { Button } from "@/components/ui/button";
import { AdminShell, AdminHeader } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type Tab = "pending" | "active";

/** Format an ISO timestamp; falls back to the raw string when unparseable. */
function formatDate(iso?: string): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return iso;
  return new Date(ts).toLocaleString();
}

// ─── Copyable value pill ──────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true));
      }}
      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? (
        <Check className="size-4 text-success" />
      ) : (
        <Copy className="size-4" />
      )}
    </button>
  );
}

// ─── DNS record row ───────────────────────────────────────────────────────────

function DnsRow({ record, copyLabel }: { record: DnsRecord; copyLabel: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-foreground/[0.07] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-foreground">
          {record.type}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            record.status
              ? "bg-success/15 text-success"
              : "bg-warning/15 text-warning",
          )}
        >
          {record.status ? "Verified" : "Pending"}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
            {record.name}
          </span>
          <CopyButton value={record.name} label={copyLabel} />
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {record.value}
          </span>
          <CopyButton value={record.value} label={copyLabel} />
        </div>
      </div>
    </div>
  );
}

// ─── Request card ─────────────────────────────────────────────────────────────

function RequestCard({
  request,
  onApprove,
  copyLabel,
  approveLabel,
}: {
  request: DomainRequest;
  onApprove?: (request: DomainRequest) => void;
  copyLabel: string;
  approveLabel: string;
}) {
  const created = formatDate(request.createdAt);
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="brand-tint flex size-11 shrink-0 items-center justify-center rounded-2xl text-primary">
          <Globe className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {request.name}
          </p>
          {created && (
            <p className="mt-0.5 text-xs text-muted-foreground">{created}</p>
          )}
        </div>
        {onApprove && (
          <Button
            variant="gradient"
            size="sm"
            onClick={() => onApprove(request)}
            className="shrink-0"
          >
            {approveLabel}
          </Button>
        )}
      </div>

      {request.dnsRecords.length > 0 && (
        <div className="mt-4 space-y-2">
          {request.dnsRecords.map((record) => (
            <DnsRow key={record.id} record={record} copyLabel={copyLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Approve sheet ────────────────────────────────────────────────────────────

function ApproveSheet({
  request,
  onClose,
  onSuccess,
}: {
  request: DomainRequest;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [name, setName] = useState(request.name);
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => approveDomainRequest(name.trim(), request.id),
    onSuccess: () => {
      setConfirming(false);
      onSuccess();
    },
  });

  const canSubmit = name.trim().length > 0 && !mutation.isPending;

  return (
    <>
      <BottomSheet
        title={t("requests.approve")}
        onClose={onClose}
        footer={
          <div className="border-t border-border p-4">
            <Button
              variant="gradient"
              className="w-full"
              disabled={!canSubmit}
              onClick={() => setConfirming(true)}
            >
              {mutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {t("requests.approve")}
            </Button>
            {mutation.isError && (
              <p className="mt-2 text-center text-xs text-error">
                {t("search.error")}
              </p>
            )}
          </div>
        }
      >
        <FancyField
          id="approve-hostname"
          label={t("requests.hostnameLabel")}
          iconSrc="/brand/ic_gradient_hash.svg"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </BottomSheet>

      <ConfirmDialog
        open={confirming}
        type="info"
        title={t("requests.confirmTitle")}
        message={t("requests.confirmMsg", { name: name.trim() })}
        confirmText={t("requests.approve")}
        cancelText={tc("cancel")}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DomainRequestsPage() {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [approving, setApproving] = useState<DomainRequest | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "domain-requests"],
    queryFn: listDomainRequests,
  });

  const pending = data?.activeRequests ?? [];
  const active = data?.completedRequests ?? [];
  const list = tab === "pending" ? pending : active;

  const TABS: { value: Tab; label: string; count: number }[] = [
    { value: "pending", label: t("requests.pending"), count: pending.length },
    { value: "active", label: t("requests.active"), count: active.length },
  ];

  return (
    <AdminShell>
      <AdminHeader
        title={t("requests.title")}
        description={t("tools.requests.desc")}
        backHref="/admin"
        Icon={Globe}
      />

      {/* Tab bar */}
      <div className="flex max-w-md gap-1 rounded-xl bg-muted p-1">
        {TABS.map((tb) => {
          const activeTab = tab === tb.value;
          return (
            <button
              key={tb.value}
              type="button"
              onClick={() => setTab(tb.value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors",
                activeTab
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tb.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs font-bold",
                  activeTab
                    ? "bg-primary/15 text-primary"
                    : "bg-foreground/10 text-muted-foreground",
                )}
              >
                {tb.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div>
        {isLoading && (
          <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}

        {!isLoading && isError && (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-error">
            {t("search.error")}
          </p>
        )}

        {!isLoading && !isError && list.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <span className="brand-tint flex size-12 items-center justify-center rounded-2xl text-primary">
              <Globe className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("requests.empty")}
            </p>
          </div>
        )}

        {!isLoading && !isError && list.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            {list.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                copyLabel={t("requests.copy")}
                approveLabel={t("requests.approve")}
                onApprove={
                  tab === "pending"
                    ? (r) => setApproving(r)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {approving && (
        <ApproveSheet
          request={approving}
          onClose={() => setApproving(null)}
          onSuccess={() => {
            setApproving(null);
            void queryClient.invalidateQueries({
              queryKey: ["admin", "domain-requests"],
            });
            setToast(t("requests.accepted"));
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-150 -translate-x-1/2 rounded-lg bg-dark px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </AdminShell>
  );
}
