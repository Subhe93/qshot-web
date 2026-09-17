"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { AppShell } from "@/components/app-shell";
import { UpgradePlanDialog } from "@/components/plan/upgrade-dialog";
import { PlanLiveUpdates } from "@/components/plan/plan-live-updates";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);

  // Client-side auth guard. Zustand persist hydrates on mount.
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration((state) => {
      if (!state.token) router.replace("/login");
    });
    if (useAuthStore.persist.hasHydrated() && !useAuthStore.getState().token) {
      router.replace("/login");
    }
    return unsub;
  }, [router]);

  // Reactive sign-out guard: the hydration check above runs ONCE. A token
  // that empties LATER — the live plan channel detecting an invalid session
  // (wrapped 401), or any store-only logout — must also land on sign-in, not
  // strand the user on the loading placeholder below (acceptance test 8 of
  // docs/PLAN-ACTIVATION-WEB.md). `token` in the deps is the re-run TRIGGER
  // only; the decision reads the store FRESH — the closure value can be the
  // stale pre-hydration null while hasHydrated() is already true, and that
  // pair would bounce a signed-in user to /login on load.
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated() && !useAuthStore.getState().token) {
      router.replace("/login");
    }
  }, [token, router]);

  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <AppShell>
      {children}
      <UpgradePlanDialog />
      <PlanLiveUpdates />
    </AppShell>
  );
}
