"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { PasswordEye } from "@/components/ui/password-eye";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api/client";
import {
  cancelEmailChange,
  getAccount,
  getPasswordStatus,
  requestEmailChange,
  resendEmailChange,
  type PendingEmailChange,
} from "@/lib/api/account";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Seconds until `canResendAt` (0 when due) — mobile's resend cooldown tick. */
function secondsUntil(iso: string): number {
  const remaining = Math.ceil((new Date(iso).getTime() - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

/**
 * Change the account email — a verbatim port of the mobile ChangeEmailLayout
 * (change_email_layout.dart): a request form (new email + password only when
 * the account has one) that flips into an "awaiting confirmation" view with a
 * live resend countdown (from the server's `canResendAt`) and a cancel action.
 * The account email itself only changes after the user clicks the mailed link.
 */
export default function ChangeEmailPage() {
  const t = useTranslations("settings.changeEmail");
  const queryClient = useQueryClient();

  // Mobile fetches password-status on open (social accounts have no password
  // and skip the password field entirely).
  const { data: hasPassword, isLoading: statusLoading } = useQuery({
    queryKey: ["password-status"],
    queryFn: getPasswordStatus,
  });
  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
  });

  // The pending request — seeded from the account, then owned locally so the
  // request/resend/cancel mutations swap the view instantly (mobile _setPending).
  const [pending, setPending] = useState<PendingEmailChange | null | undefined>(
    undefined,
  );
  const effectivePending =
    pending !== undefined ? pending : (account?.pendingEmailChange ?? null);

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 1s resend countdown from `canResendAt` (mobile Timer.periodic tick).
  const [resendSeconds, setResendSeconds] = useState(0);
  const canResendAt = effectivePending?.canResendAt;
  useEffect(() => {
    if (!canResendAt) return;
    let cancelled = false;
    const tick = () => {
      if (!cancelled) setResendSeconds(secondsUntil(canResendAt));
    };
    // Deferred a tick — react-hooks/set-state-in-effect.
    const t0 = setTimeout(tick, 0);
    const h = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t0);
      clearInterval(h);
    };
  }, [canResendAt]);

  // Auto-dismiss the success toast (mobile Utils.showToast).
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(h);
  }, [toast]);

  function applyPending(next: PendingEmailChange | null) {
    setPending(next);
    // Keep the cached account (and the personal-info hint) in sync.
    queryClient.invalidateQueries({ queryKey: ["account"] });
  }

  const requestMutation = useMutation({
    mutationFn: () =>
      requestEmailChange({
        newEmail: newEmail.trim(),
        password: hasPassword ? password : undefined,
      }),
    onSuccess: (next) => {
      applyPending(next);
      setPassword("");
      setToast(t("sent"));
    },
    onError: async (e) => setStatus(await apiErrorMessage(e, t("invalidEmail"))),
  });

  const resendMutation = useMutation({
    mutationFn: resendEmailChange,
    onSuccess: (next) => {
      applyPending(next);
      setToast(t("sent"));
    },
    onError: async (e) => setStatus(await apiErrorMessage(e, t("invalidEmail"))),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelEmailChange,
    onSuccess: () => {
      applyPending(null);
      setToast(t("canceled"));
    },
    onError: async (e) => setStatus(await apiErrorMessage(e, t("invalidEmail"))),
  });

  function onSubmit() {
    setStatus(null);
    const next: Record<string, string> = {};
    const email = newEmail.trim();
    if (!email) next.email = t("required");
    else if (!EMAIL_RE.test(email)) next.email = t("invalidEmail");
    if (hasPassword && !password) next.password = t("required");
    setErrors(next);
    if (Object.keys(next).length) return;
    requestMutation.mutate();
  }

  const loading = statusLoading || accountLoading;
  const busy = resendMutation.isPending || cancelMutation.isPending;
  const canResend = resendSeconds <= 0;

  const pendingView = useMemo(() => {
    const p = effectivePending;
    if (!p) return null;
    return (
      <div className="mt-8 flex flex-col items-center text-center">
        {/* 72px gradient icon tile (mobile _PendingView: primary gradient @10%) */}
        <span className="flex size-[72px] items-center justify-center rounded-[18px] bg-primary/10">
          <Mail className="size-8 text-primary" />
        </span>
        <h2 className="mt-[18px] text-xl font-bold text-foreground">
          {t("awaiting")}
        </h2>
        <p className="mt-2 text-base font-semibold text-foreground">
          {p.newEmail}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("sentTo", { email: p.newEmail })}
        </p>

        <Button
          variant="outline"
          className="mt-8 w-full"
          disabled={busy || !canResend}
          onClick={() => {
            setStatus(null);
            resendMutation.mutate();
          }}
        >
          {resendMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : canResend ? (
            t("resend")
          ) : (
            t("resendIn", { seconds: resendSeconds })
          )}
        </Button>
        <Button
          variant="ghost"
          className="mt-[9px] w-full text-error hover:text-error"
          disabled={busy}
          onClick={() => {
            setStatus(null);
            cancelMutation.mutate();
          }}
        >
          {cancelMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("cancel")
          )}
        </Button>
      </div>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePending, busy, canResend, resendSeconds, resendMutation.isPending, cancelMutation.isPending]);

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings/personal-info"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : effectivePending ? (
        pendingView
      ) : (
        <>
          <p className="mt-5 text-sm text-muted-foreground">{t("intro")}</p>

          <div className="mt-8 space-y-[9px]">
            <FancyField
              id="new-email"
              type="email"
              label={t("newEmail")}
              iconSrc="/brand/ic_gradient_email.svg"
              placeholder={t("newEmailHint")}
              value={newEmail}
              error={errors.email}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            {hasPassword && (
              <FancyField
                id="current-password"
                type={showPassword ? "text" : "password"}
                label={t("password")}
                iconSrc="/brand/ic_gradient_password.svg"
                placeholder={t("passwordHint")}
                value={password}
                error={errors.password}
                onChange={(e) => setPassword(e.target.value)}
                suffix={
                  <PasswordEye
                    visible={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                }
              />
            )}
          </div>

          {status && <p className="mt-4 text-sm text-error">{status}</p>}

          <Button
            variant="gradient"
            className="mt-6 w-full"
            disabled={requestMutation.isPending}
            onClick={onSubmit}
          >
            {requestMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("submit")
            )}
          </Button>
        </>
      )}

      {status && effectivePending && (
        <p className="mt-4 text-center text-sm text-error">{status}</p>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center">
          <span className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
