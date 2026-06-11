"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { PasswordEye } from "@/components/ui/password-eye";
import { register as registerApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState(false);

  const schema = z.object({
    name: z.string().min(1, t("errors.required")),
    email: z.string().email(t("errors.invalidEmail")),
    password: z.string().min(8, t("errors.passwordMin")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    if (!agree) {
      setAgreeError(true);
      return;
    }
    try {
      const data = await registerApi(values.name, values.email, values.password);
      if (data?.token) {
        setAuth(data.token, data.user ?? null);
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    } catch {
      setServerError(t("errors.generic"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("registerTitle")}
        </h1>
        <Link href="/login" aria-label="Close">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cancel.svg" alt="" width={24} height={24} />
        </Link>
      </div>
      <p className="mt-[18px] text-sm text-muted-foreground">
        {t("registerSubtitle")}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-[9px]">
        <FancyField
          id="name"
          label={t("name")}
          iconSrc="/brand/ic_gradient_hash.svg"
          placeholder={t("nameHint")}
          maxLength={20}
          error={errors.name?.message}
          {...register("name")}
        />
        <FancyField
          id="email"
          type="email"
          autoComplete="email"
          label={t("email")}
          iconSrc="/brand/ic_gradient_email.svg"
          placeholder={t("emailHint")}
          error={errors.email?.message}
          {...register("email")}
        />
        <FancyField
          id="password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          label={t("password")}
          iconSrc="/brand/ic_gradient_password.svg"
          placeholder={t("passwordHint")}
          error={errors.password?.message}
          suffix={
            <PasswordEye
              visible={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />
          }
          {...register("password")}
        />

        {serverError && <p className="text-sm text-error">{serverError}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="brand-gradient mt-6 h-12 w-full rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {t("getStarted")}
        </button>
      </form>

      <div className="mt-5 flex items-center justify-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={agree}
          onClick={() => {
            setAgree((v) => !v);
            setAgreeError(false);
          }}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            agree ? "bg-black" : "bg-input",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 size-5 rounded-full bg-white transition-all",
              agree ? "start-[1.375rem]" : "start-0.5",
            )}
          />
        </button>
        <p className="text-xs text-muted-foreground">
          {t("agreeOn")}
          <span className="font-bold underline">{t("termsOfService")}</span>
          {" & "}
          <span className="font-bold underline">{t("privacyPolicy")}</span>
        </p>
      </div>
      {agreeError && (
        <p className="mt-2 text-center text-xs text-error">
          {t("agreeWarning")}
        </p>
      )}
    </div>
  );
}
