"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { listProfiles } from "@/lib/api/profiles";
import { Plus, Sparkles } from "lucide-react";
import { ProfileSlider } from "@/components/dashboard/profile-slider";
import { CreateWebsiteWizard } from "@/components/builder/CreateWebsiteWizard";
import { AiWebsiteWizard } from "@/components/dashboard/AiWebsiteWizard";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const ta = useTranslations("aiWizard");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["profiles"],
    queryFn: listProfiles,
  });
  const items = data ?? [];
  const [creating, setCreating] = useState(false);
  const [aiCreating, setAiCreating] = useState(false);

  // Deep-link to the create wizard via /dashboard#new.
  useEffect(() => {
    if (window.location.hash.startsWith("#new")) setCreating(true);
  }, []);

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col p-4 sm:p-6">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAiCreating(true)}
            className="relative flex h-11 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Sparkles className="size-4" />
            {ta("aiCreate")}
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase">
              {ta("beta")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="brand-gradient flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white hover:opacity-90"
          >
            <Plus className="size-4" />
            {t("newProfile")}
          </button>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1">
        {isLoading && (
          <div className="flex h-full items-stretch gap-5 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-full w-[86vw] max-w-95 shrink-0 animate-pulse rounded-[22px] bg-muted sm:w-90"
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            {t("empty")}
          </div>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">{t("empty")}</p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="brand-gradient mt-4 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="size-4" />
              {t("createFirst")}
            </button>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <ProfileSlider items={items} onCreate={() => setCreating(true)} />
        )}
      </div>

      {creating && <CreateWebsiteWizard onClose={() => setCreating(false)} />}
      {aiCreating && (
        <AiWebsiteWizard
          onClose={() => setAiCreating(false)}
          onUseManual={() => {
            setAiCreating(false);
            setCreating(true);
          }}
        />
      )}
    </div>
  );
}
