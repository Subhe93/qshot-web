"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { PasswordEye } from "@/components/ui/password-eye";
import { Button } from "@/components/ui/button";
import { changePassword, getPasswordStatus } from "@/lib/api/account";

const MIN = 8;

export default function ChangePasswordPage() {
  const t = useTranslations("settings.password");
  const router = useRouter();

  const { data: hasPassword, isLoading } = useQuery({
    queryKey: ["password-status"],
    queryFn: getPasswordStatus,
  });

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      changePassword({
        oldPassword: hasPassword ? oldPassword : undefined,
        newPassword,
      }),
    onSuccess: () => router.replace("/settings/personal-info"),
    onError: () => setStatus(t("error")),
  });

  function onSubmit() {
    setStatus(null);
    const next: Record<string, string> = {};
    if (hasPassword && oldPassword.length < MIN)
      next.old = t("min", { min: MIN });
    if (newPassword.length < MIN) next.new = t("min", { min: MIN });
    if (confirm !== newPassword) next.confirm = t("notMatch");
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  }

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

      {isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <p className="mt-5 text-sm text-muted-foreground">{t("intro")}</p>

          <div className="mt-8 space-y-[9px]">
            {hasPassword && (
              <FancyField
                id="old-password"
                type={showOld ? "text" : "password"}
                label={t("current")}
                iconSrc="/brand/ic_gradient_password.svg"
                placeholder={t("currentHint")}
                value={oldPassword}
                error={errors.old}
                onChange={(e) => setOldPassword(e.target.value)}
                suffix={
                  <PasswordEye
                    visible={showOld}
                    onToggle={() => setShowOld((v) => !v)}
                  />
                }
              />
            )}
            <FancyField
              id="new-password"
              type={showNew ? "text" : "password"}
              label={t("new")}
              iconSrc="/brand/ic_gradient_password.svg"
              placeholder={t("newHint")}
              value={newPassword}
              error={errors.new}
              onChange={(e) => setNewPassword(e.target.value)}
              suffix={
                <PasswordEye
                  visible={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                />
              }
            />
            <FancyField
              id="confirm-password"
              type={showNew ? "text" : "password"}
              label={t("confirm")}
              iconSrc="/brand/ic_gradient_password.svg"
              placeholder={t("confirmHint")}
              value={confirm}
              error={errors.confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {status && <p className="mt-4 text-sm text-error">{status}</p>}

          <Button
            variant="gradient"
            className="mt-6 w-full"
            disabled={mutation.isPending}
            onClick={onSubmit}
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              t("submit")
            )}
          </Button>

          <div className="mt-6 flex justify-center gap-1.5 text-sm text-muted-foreground">
            <span>{t("forgot")}</span>
            <Link href="/forgot-password" className="font-medium text-foreground underline">
              {t("resetIt")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
