"use client";

import { create } from "zustand";
import { useTranslations } from "next-intl";
import { Lock, ShieldCheck, X } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * The web mirror of mobile `Utils.buyPlan` + `UpgradePlanDialog`: a single
 * dialog instance lives in the app layout; any gate opens it through the
 * store. (Mobile hardcodes the body in English — here it's translated.)
 */
interface UpgradeDialogState {
  open: boolean;
  show: () => void;
  close: () => void;
}

export const useUpgradeDialog = create<UpgradeDialogState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));

export function UpgradePlanDialog() {
  const t = useTranslations("plan");
  const router = useRouter();
  const { open, close } = useUpgradeDialog();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("close")}
          className="absolute end-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>

        <span className="brand-gradient mx-auto flex size-14 items-center justify-center rounded-full text-white">
          <Lock className="size-6" />
        </span>
        <p className="mt-4 text-lg font-bold text-foreground">
          {t("upgradeToAccess")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t("upgradeBody")}</p>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-primary" />
          {t("cancelAnytime")}
        </p>

        <Button
          variant="gradient"
          className="mt-5 w-full"
          onClick={() => {
            close();
            router.push("/upgrade");
          }}
        >
          {t("upgrade")}
        </Button>
      </div>
    </div>
  );
}
