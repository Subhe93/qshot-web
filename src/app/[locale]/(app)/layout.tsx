"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth-store";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
        <span className="brand-gradient-text text-xl font-bold">QShot</span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            {t("common.logout")}
          </Button>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
