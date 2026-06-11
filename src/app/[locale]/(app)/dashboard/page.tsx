"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { listProfiles } from "@/lib/api/profiles";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["profiles"],
    queryFn: listProfiles,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button variant="gradient">
          <Plus className="size-4" />
          {t("newProfile")}
        </Button>
      </div>

      <div className="mt-8">
        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-border bg-muted"
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
            {t("empty")}
          </div>
        )}

        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">{t("empty")}</p>
            <Button variant="gradient" className="mt-4">
              <Plus className="size-4" />
              {t("createFirst")}
            </Button>
          </div>
        )}

        {!isLoading && (data?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data!.map((p) => (
              <div
                key={p._id}
                className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="brand-gradient mb-3 h-20 rounded-lg" />
                <h3 className="font-semibold">{p.name}</h3>
                {p.user_name && (
                  <p className="text-sm text-muted-foreground">@{p.user_name}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
