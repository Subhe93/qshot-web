"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Cloud,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  User,
} from "lucide-react";
import { FancyField } from "@/components/ui/fancy-field";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminProfileSearch } from "@/components/admin/admin-profile-search";
import {
  AdminShell,
  AdminHeader,
  AdminGrid,
} from "@/components/admin/admin-ui";
import { cdnUrl } from "@/lib/api/qrcodes";
import {
  createCloudflareDomain,
  deleteCloudflareDomain,
  listCloudflareDomains,
  type AdminProfileSummary,
  type CloudflareDomain,
} from "@/lib/api/admin";

/** Read a string field off a profile's loose `settings` bag. */
function settingStr(s: AdminProfileSummary, key: string): string | undefined {
  const v = s.settings?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Small status pill; SSL-active / provisioned reads as success, else muted. */
function StatusChip({
  label,
  active,
  Icon,
}: {
  label: string;
  active?: boolean;
  Icon?: LucideIcon;
}) {
  return (
    <span
      className={
        active
          ? "inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success"
          : "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
      }
    >
      {Icon && <Icon className="size-3" />}
      {label}
    </span>
  );
}

export default function AdminCloudflarePage() {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "cloudflare-domains"],
    queryFn: listCloudflareDomains,
  });
  const domains = data ?? [];

  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CloudflareDomain | null>(
    null,
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCloudflareDomain(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "cloudflare-domains"],
      });
      setPendingDelete(null);
    },
    onError: () => setPendingDelete(null),
  });

  return (
    <AdminShell>
      <AdminHeader
        title={t("cloudflare.title")}
        description={t("tools.cloudflare.desc")}
        backHref="/admin"
        Icon={Cloud}
        actions={
          <Button variant="gradient" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            {t("cloudflare.create")}
          </Button>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {!isLoading && isError && (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-error">
          {t("search.error")}
        </p>
      )}

      {!isLoading && !isError && domains.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Cloud className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">{t("cloudflare.empty")}</p>
        </div>
      )}

      {!isLoading && !isError && domains.length > 0 && (
        <AdminGrid cols={2}>
          {domains.map((domain) => {
            const sslActive = domain.ssl?.status === "active";
            const deleting =
              deleteMutation.isPending && pendingDelete?.id === domain.id;
            return (
              <div
                key={domain.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-[0_2px_16px_rgba(0,0,0,0.04)] sm:p-5"
              >
                <span className="brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm">
                  <Cloud className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {domain.hostname}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {domain.status && (
                      <StatusChip
                        label={domain.status}
                        active={domain.status === "active"}
                      />
                    )}
                    {domain.ssl?.status && (
                      <StatusChip
                        label={`SSL: ${domain.ssl.status}`}
                        active={sslActive}
                        Icon={ShieldCheck}
                      />
                    )}
                  </div>
                  {domain.created_at && (
                    <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                      <Calendar className="size-3.5 shrink-0" />
                      {new Date(domain.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Delete"
                  disabled={deleting}
                  onClick={() => setPendingDelete(domain)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-error transition-colors hover:bg-error/10 disabled:opacity-60"
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            );
          })}
        </AdminGrid>
      )}

      {creating && <CreateDomainSheet onClose={() => setCreating(false)} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("cloudflare.title")}
        message={t("cloudflare.deleteConfirm", {
          hostname: pendingDelete?.hostname ?? "",
        })}
        confirmText={t("cloudflare.title")}
        cancelText={t("open")}
        danger
        onConfirm={() => {
          if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </AdminShell>
  );
}

/**
 * "+ Create" sheet: a hostname field plus a profile picker that reuses
 * AdminProfileSearch (with an `onSelect` so it captures the profileId instead of
 * navigating). Both are required before create.
 */
function CreateDomainSheet({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin");
  const queryClient = useQueryClient();

  const [hostname, setHostname] = useState("");
  const [profile, setProfile] = useState<AdminProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createCloudflareDomain(hostname.trim(), profile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "cloudflare-domains"],
      });
      onClose();
    },
    onError: () => setError(t("search.error")),
  });

  function onCreate() {
    setError(null);
    if (!hostname.trim() || !profile) {
      setError(t("cloudflare.pickProfile"));
      return;
    }
    createMutation.mutate();
  }

  const avatar = profile ? cdnUrl(settingStr(profile, "picture")) : null;
  const displayName = profile
    ? (settingStr(profile, "name") ?? profile.name)
    : "";

  return (
    <BottomSheet
      title={t("cloudflare.create")}
      onClose={onClose}
      footer={
        <div className="border-t border-border p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={createMutation.isPending}
            onClick={onCreate}
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("cloudflare.create")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FancyField
          id="cf-hostname"
          label={t("cloudflare.hostnameLabel")}
          iconSrc="/brand/ic_gradient_hash.svg"
          value={hostname}
          onChange={(e) => setHostname(e.target.value)}
        />

        {profile ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="size-full object-cover" />
              ) : (
                <User className="size-5 text-muted-foreground" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {displayName}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{profile.name}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setProfile(null)}
              className="brand-gradient-text shrink-0 text-sm font-semibold"
            >
              {t("cloudflare.pickProfile")}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-1.5 text-xs font-normal text-muted-foreground">
              {t("cloudflare.pickProfile")}
            </p>
            <AdminProfileSearch onSelect={(p) => setProfile(p)} />
          </div>
        )}

        {error && <p className="text-center text-sm text-error">{error}</p>}
      </div>
    </BottomSheet>
  );
}
