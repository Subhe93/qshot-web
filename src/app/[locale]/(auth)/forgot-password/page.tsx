"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { sendResetEmail } from "@/lib/api/auth";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const schema = z.object({
    email: z.string().email(t("errors.invalidEmail")),
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
      await sendResetEmail(values.email);
      setSent(true);
    } catch {
      setServerError(t("errors.generic"));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          {t("forgotTitle")}
        </h1>
        <Link href="/login" aria-label="Close">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/cancel.svg" alt="" width={24} height={24} />
        </Link>
      </div>
      <p className="mt-[18px] text-sm text-muted-foreground">{t("forgotNote")}</p>

      {sent ? (
        <p className="mt-10 rounded-lg bg-muted p-4 text-center text-sm text-foreground">
          {t("resetSent")}
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-10">
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

          {serverError && (
            <p className="mt-2 text-sm text-error">{serverError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 h-12 w-full rounded-lg bg-dark text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {t("resetPassword")}
          </button>
        </form>
      )}
    </div>
  );
}
