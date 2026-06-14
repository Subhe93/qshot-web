"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { AppShell } from "@/components/app-shell";

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

  if (!token) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
