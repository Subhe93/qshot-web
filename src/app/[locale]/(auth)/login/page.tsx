"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { PasswordEye } from "@/components/ui/password-eye";
import { DividerText } from "@/components/ui/divider-text";
import { SocialButton } from "@/components/ui/social-button";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const schema = z.object({
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
    try {
      const data = await login(values.email, values.password);
      setAuth(data.token, data.user ?? null);
      router.push("/dashboard");
    } catch {
      setServerError(t("errors.generic"));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">{t("loginTitle")}</h1>
      <p className="mt-[18px] text-sm text-muted-foreground">
        {t("loginSubtitle")}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-[9px]">
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
          autoComplete="current-password"
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
          className="brand-gradient mt-5 h-12 w-full rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {t("login")}
        </button>
      </form>

      <div className="mt-6 flex justify-center gap-1.5 text-xs text-muted-foreground">
        <span>{t("forgotPassword")}</span>
        <Link href="/forgot-password" className="font-medium text-foreground underline">
          {t("resetIt")}
        </Link>
      </div>

      <div className="mt-[30px]">
        <DividerText text={t("or")} />
      </div>

      <Link
        href="/register"
        className="mt-[17px] flex h-12 w-full items-center justify-center rounded-lg border border-input"
      >
        <span className="brand-gradient-text text-sm font-bold">
          {t("register")}
        </span>
      </Link>

      <div className="mt-4 space-y-4">
        <SocialButton
          variant="apple"
          label={t("continueWithApple")}
          iconSrc="/brand/icon_social_apple.svg"
        />
        <SocialButton
          variant="google"
          label={t("continueWithGoogle")}
          iconSrc="/brand/icon_social_google.svg"
        />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t("agreeTo")}
        <span className="font-bold underline">{t("terms")}</span>
        {" & "}
        <span className="font-bold underline">{t("privacyPolicy")}</span>
      </p>
    </div>
  );
}
