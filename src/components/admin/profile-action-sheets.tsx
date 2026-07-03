"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Check, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import { FancyField } from "@/components/ui/fancy-field";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { apiErrorMessage } from "@/lib/api/client";
import { checkUserName } from "@/lib/api/profiles";
import {
  addExternalDomain,
  deleteExternalDomain,
  duplicateProfile,
  getExternalDomain,
  moveProfile,
  updateExternalDomain,
  verifyProfile,
  type ExternalDomain,
} from "@/lib/api/admin";

// A simple domain validator (label.label, no scheme/path).
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Verify (confirm dialog only — the trigger stays in each caller) ──────────

export function VerifyConfirmDialog({
  open,
  profileName,
  verified,
  onClose,
}: {
  open: boolean;
  profileName: string;
  verified?: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => verifyProfile(profileName),
    onSuccess: () => {
      onClose();
      // Single toggle endpoint — refetch to reflect the new status.
      queryClient.invalidateQueries({
        queryKey: ["admin", "profile", profileName],
      });
    },
    onError: async (e) => setError(await apiErrorMessage(e, t("search.error"))),
  });

  return (
    <ConfirmDialog
      open={open}
      type="warning"
      title={t("verifyConfirmTitle")}
      message={
        error
          ? error
          : t("verifyConfirmMsg", { name: profileName })
      }
      confirmText={verified ? t("unverify") : t("verify")}
      cancelText={tc("cancel")}
      onConfirm={() => {
        setError(null);
        mutation.mutate();
      }}
      onCancel={onClose}
    />
  );
}

// ─── External domains ─────────────────────────────────────────────────────────

export function DomainsSheet({
  profileId,
  onClose,
}: {
  profileId: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const queryKey = ["admin", "external-domains", profileId];

  // A profile has AT MOST ONE external domain (single object, not a list).
  const { data: domain, isLoading } = useQuery<ExternalDomain | null>({
    queryKey,
    queryFn: () => getExternalDomain(profileId),
  });

  const [value, setValue] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: ({ domain: d, isUpdate }: { domain: string; isUpdate: boolean }) =>
      isUpdate
        ? updateExternalDomain(d, profileId)
        : addExternalDomain(d, profileId),
    onSuccess: () => {
      setValue("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: async (e) => setStatus(await apiErrorMessage(e, t("search.error"))),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteExternalDomain(profileId),
    onSuccess: () => {
      setConfirmDelete(false);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: async (e) => {
      setConfirmDelete(false);
      setStatus(await apiErrorMessage(e, t("search.error")));
    },
  });

  function onSave(isUpdate: boolean) {
    setStatus(null);
    const d = value.trim().toLowerCase();
    if (!DOMAIN_RE.test(d)) {
      setDomainError(t("extDomains.invalidDomain"));
      return;
    }
    setDomainError(null);
    saveMutation.mutate({ domain: d, isUpdate });
  }

  const dns = domain?.dnsRecords ?? [];

  return (
    <BottomSheet title={t("extDomains.title")} onClose={onClose}>
      <div className="space-y-4">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Connected/pending domain */}
        {!isLoading && domain && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Globe className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {domain.name}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    domain.status
                      ? "bg-primary/10 text-primary"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${
                      domain.status ? "bg-primary" : "bg-warning"
                    }`}
                  />
                  {domain.status ? "Connected" : "Pending"}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={tc("delete")}
                  className="flex size-8 items-center justify-center rounded-full text-error hover:bg-error/10"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {dns.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {dns.map((rec) => (
                    <li key={rec.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono font-semibold uppercase text-muted-foreground">
                          {rec.type}
                        </span>
                        <span className="truncate font-mono text-foreground">
                          {rec.name}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-muted-foreground">
                        {rec.value}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Edit the connected domain */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FancyField
                  id="admin-edit-domain"
                  label={t("extDomains.add")}
                  iconSrc="/brand/ic_gradient_hash.svg"
                  value={value}
                  error={domainError ?? undefined}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <Button
                variant="gradient"
                size="icon"
                disabled={saveMutation.isPending}
                onClick={() => onSave(true)}
                aria-label={tc("save")}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
              </Button>
            </div>
          </>
        )}

        {/* No domain yet — add one */}
        {!isLoading && !domain && (
          <>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <FancyField
                  id="admin-add-domain"
                  label={t("extDomains.add")}
                  iconSrc="/brand/ic_gradient_hash.svg"
                  value={value}
                  error={domainError ?? undefined}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <Button
                variant="gradient"
                size="icon"
                disabled={saveMutation.isPending}
                onClick={() => onSave(false)}
                aria-label={t("extDomains.add")}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
              </Button>
            </div>
            <p className="py-2 text-center text-sm text-muted-foreground">
              {t("extDomains.empty")}
            </p>
          </>
        )}

        {status && <p className="text-center text-sm text-error">{status}</p>}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={t("extDomains.title")}
        message={t("extDomains.deleteConfirm", { domain: domain?.name ?? "" })}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </BottomSheet>
  );
}

// ─── Duplicate ────────────────────────────────────────────────────────────────

export function DuplicateSheet({
  profileId,
  profileName,
  onClose,
}: {
  profileId: string;
  profileName: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const tws = useTranslations("builder.websiteSettings");
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  // Live handle availability — mirrors the mobile duplicate/create slug check.
  const [avail, setAvail] = useState<"idle" | "checking" | "ok" | "taken">(
    "idle",
  );
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const handle = newName.trim();
    if (handle.length < 3) {
      setAvail("idle");
      return;
    }
    setAvail("checking");
    const h = setTimeout(async () => {
      try {
        // 2xx = available; the endpoint throws (400) when the slug is taken.
        await checkUserName(handle);
        setAvail("ok");
      } catch {
        setAvail("taken");
      }
    }, 500);
    return () => clearTimeout(h);
  }, [newName]);

  const mutation = useMutation({
    mutationFn: () => duplicateProfile(newName.trim(), profileId),
    onSuccess: () => {
      setConfirm(false);
      setStatus(t("duplicate.done"));
      queryClient.invalidateQueries({
        queryKey: ["admin", "profile", profileName],
      });
    },
    onError: async (e) => {
      setConfirm(false);
      setStatus(await apiErrorMessage(e, t("search.error")));
    },
  });

  // Only allow duplicating to a confirmed-available handle.
  const canSubmit = newName.trim().length >= 3 && avail === "ok";

  return (
    <BottomSheet
      title={t("duplicate.title")}
      subtitle={`@${profileName}`}
      onClose={onClose}
      footer={
        <div className="border-t border-border p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => {
              setStatus(null);
              setConfirm(true);
            }}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("duplicate.title")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        <FancyField
          id="admin-duplicate-name"
          label={t("duplicate.newHandle")}
          iconSrc="/brand/ic_gradient_hash.svg"
          value={newName}
          onChange={(e) =>
            setNewName(
              e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30),
            )
          }
        />
        {/* Availability status */}
        <div className="flex h-4 items-center px-1 text-xs">
          {avail === "checking" && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              {tws("checking")}
            </span>
          )}
          {avail === "ok" && (
            <span className="flex items-center gap-1 text-success">
              <Check className="size-3" />
              {tws("available")}
            </span>
          )}
          {avail === "taken" && (
            <span className="text-error">{tws("taken")}</span>
          )}
        </div>
        {status && (
          <p className="text-center text-sm text-muted-foreground">{status}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        type="warning"
        title={t("duplicate.confirmTitle")}
        message={t("duplicate.confirmMsg", {
          name: profileName,
          newName: newName.trim(),
        })}
        confirmText={tc("create")}
        cancelText={tc("cancel")}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </BottomSheet>
  );
}

// ─── Move ─────────────────────────────────────────────────────────────────────

export function MoveSheet({
  profileName,
  onClose,
}: {
  profileName: string;
  onClose: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => moveProfile(profileName, email.trim()),
    onSuccess: () => {
      setConfirm(false);
      setStatus(t("move.done"));
      queryClient.invalidateQueries({
        queryKey: ["admin", "profile", profileName],
      });
    },
    onError: async (e) => {
      setConfirm(false);
      setStatus(await apiErrorMessage(e, t("search.error")));
    },
  });

  function onSubmit() {
    setStatus(null);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t("move.emailLabel"));
      return;
    }
    setEmailError(null);
    setConfirm(true);
  }

  return (
    <BottomSheet
      title={t("move.title")}
      subtitle={`@${profileName}`}
      onClose={onClose}
      footer={
        <div className="border-t border-border p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={mutation.isPending}
            onClick={onSubmit}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("move.title")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FancyField
          id="admin-move-email"
          type="email"
          label={t("move.emailLabel")}
          iconSrc="/brand/ic_gradient_email.svg"
          value={email}
          error={emailError ?? undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        {status && (
          <p className="text-center text-sm text-muted-foreground">{status}</p>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        type="danger"
        title={t("move.confirmTitle")}
        message={t("move.confirmMsg", {
          name: profileName,
          email: email.trim(),
        })}
        confirmText={tc("save")}
        cancelText={tc("cancel")}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirm(false)}
      />
    </BottomSheet>
  );
}
