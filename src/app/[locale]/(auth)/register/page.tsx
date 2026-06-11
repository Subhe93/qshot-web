"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register as registerApi } from "@/lib/api/auth";
import { useAuthStore } from "@/stores/auth-store";

export default function RegisterPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z
    .object({
      name: z.string().min(1, t("errors.required")),
      email: z.string().email(t("errors.invalidEmail")),
      password: z.string().min(8, t("errors.passwordMin")),
      confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
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
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-bold">{t("registerTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("registerSubtitle")}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" {...register("name")} />
          {errors.name && (
            <p className="mt-1 text-xs text-error">{errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="mt-1 text-xs text-error">{errors.email.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="password">{t("password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-error">{errors.password.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-error">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        {serverError && <p className="text-sm text-error">{serverError}</p>}

        <Button type="submit" variant="gradient" className="w-full" disabled={isSubmitting}>
          {t("register")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary">
          {t("login")}
        </Link>
      </p>
    </div>
  );
}
