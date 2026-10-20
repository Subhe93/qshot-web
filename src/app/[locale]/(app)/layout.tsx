"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { AppShell } from "@/components/app-shell";
import { UpgradePlanDialog } from "@/components/plan/upgrade-dialog";
import { PlanLiveUpdates } from "@/components/plan/plan-live-updates";
import { ContactSaveToast } from "@/components/contacts/save-toast";

/** `/login?next=<path+query>` — only for a real destination; the default
 *  dashboard needs no return trip. */
function loginHref(pathname: string): string {
  const search = typeof window === "undefined" ? "" : window.location.search;
  const next = `${pathname}${search}`;
  if (!pathname || pathname === "/" || pathname === "/dashboard") return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuthStore((s) => s.token);

  // Client-side auth guard. Zustand persist hydrates on mount. The page the
  // user was heading to (locale-less path + query) rides along as `next` so
  // sign-in can return there — a deep link such as
  // `/platform-links?platform=…&code=…` must survive the round trip.
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration((state) => {
      if (!state.token) router.replace(loginHref(pathname));
    });
    if (useAuthStore.persist.hasHydrated() && !useAuthStore.getState().token) {
      router.replace(loginHref(pathname));
    }
    return unsub;
  }, [router, pathname]);

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
      router.replace(loginHref(pathname));
    }
  }, [token, router, pathname]);

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
      <ContactSaveToast />
    </AppShell>
  );
}
