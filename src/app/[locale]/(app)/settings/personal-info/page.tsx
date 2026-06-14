"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Upload, User } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteAccount,
  getAccount,
  updateImage,
  updateName,
} from "@/lib/api/account";
import { cdnUrl } from "@/lib/api/qrcodes";
import { useAuthStore } from "@/stores/auth-store";

export default function PersonalInfoPage() {
  const t = useTranslations("settings.personal");
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);

  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
  });
  const user = account?.user;

  // `name` is null until the user edits; the field falls back to the account
  // value, so we never need an effect to seed local state.
  const [name, setName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const nameValue = name ?? user?.name ?? "";

  const imageMutation = useMutation({
    mutationFn: (file: File) => updateImage(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] });
      setStatus(t("imageUpdated"));
    },
    onError: () => setStatus(t("error")),
  });

  const nameMutation = useMutation({
    mutationFn: () => updateName(nameValue.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["account"] });
      setStatus(t("updated"));
    },
    onError: () => setStatus(t("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      logout();
      router.replace("/login");
    },
    onError: () => {
      setConfirmDelete(false);
      setStatus(t("error"));
    },
  });

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) imageMutation.mutate(file);
    e.target.value = "";
  }

  function onUpdate() {
    setStatus(null);
    if (!nameValue.trim()) {
      setNameError(t("required"));
      return;
    }
    setNameError(null);
    nameMutation.mutate();
  }

  const avatar = user?.image ? cdnUrl(user.image) : null;

  return (
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground rtl:rotate-180"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Avatar + upload */}
      <div className="mt-8 flex flex-col items-center">
        <div className="brand-gradient rounded-full p-[2px]">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-white">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              <User className="size-10 text-black/20" />
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPickImage}
        />
        <button
          type="button"
          disabled={imageMutation.isPending}
          onClick={() => fileRef.current?.click()}
          className="mt-2 flex items-center gap-1.5 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {imageMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {t("upload")}
        </button>
      </div>

      {/* Personal info */}
      <h2 className="mt-6 text-lg font-bold">{t("personalSection")}</h2>
      <div className="mt-3.5">
        <FancyField
          id="name"
          label={t("name")}
          iconSrc="/brand/ic_gradient_hash.svg"
          maxLength={20}
          value={nameValue}
          error={nameError ?? undefined}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Account info */}
      <h2 className="mt-6 text-lg font-bold">{t("accountSection")}</h2>
      <div className="mt-3.5 space-y-[9px]">
        <FancyField
          id="email"
          label={t("email")}
          iconSrc="/brand/ic_gradient_email.svg"
          readOnly
          value={user?.email ?? ""}
        />
        <FancyField
          id="password"
          type="password"
          label={t("password")}
          iconSrc="/brand/ic_gradient_password.svg"
          readOnly
          value="********"
          suffix={
            <Link
              href="/settings/personal-info/change-password"
              className="brand-gradient-text text-sm font-semibold"
            >
              {t("edit")}
            </Link>
          }
        />
      </div>

      {status && (
        <p className="mt-4 text-center text-sm text-muted-foreground">{status}</p>
      )}

      <div className="mt-8 space-y-2.5">
        <Button
          variant="gradient"
          className="w-full"
          disabled={nameMutation.isPending}
          onClick={onUpdate}
        >
          {nameMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            t("update")
          )}
        </Button>
        <Button
          variant="outline"
          className="w-full border-2 border-error font-semibold text-error hover:bg-error/5"
          onClick={() => setConfirmDelete(true)}
        >
          {t("deleteAccount")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        danger
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
