"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Loader2, Minus, Smartphone, Star } from "lucide-react";
import { getAccount } from "@/lib/api/account";
import { getPlansTable, type Plan } from "@/lib/api/admin";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

/**
 * The customer-facing plan comparison, rendered from `GET plans/table2`
 * exactly like the mobile paywall (purchase_plan_layout). The table is
 * DISPLAY-ONLY — gating reads plan.planFeatures on the account, never this.
 * There is no web checkout yet: purchases are IAP-only, so the page points
 * to the mobile app (CONTRACT-plan-gating §7).
 */

/** ARGB int (mobile Color) → #rrggbb. */
function argb(v?: number): string | undefined {
  return typeof v === "number"
    ? `#${(v & 0xffffff).toString(16).padStart(6, "0")}`
    : undefined;
}
/** Mobile isUnlocked: 0 / false / null = locked. */
function isUnlocked(v: unknown): boolean {
  return v !== 0 && v !== false && v !== null && v !== undefined && v !== "0";
}
/** Mobile buildValue: `true` renders as a check; other values as their text. */
function valueText(v: unknown): string | null {
  if (v === true) return null;
  return String(v);
}

export default function UpgradePage() {
  const t = useTranslations("plan");
  const table = useQuery({ queryKey: ["plans-table"], queryFn: getPlansTable });
  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
    staleTime: 60_000,
  });
  const currentName = account?.plan?.name;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <PageHeader
        Icon={Star}
        title={t("upgradePlan")}
        subtitle={t("upgradePlanDesc")}
      />

      {/* No web checkout yet — subscriptions live in the mobile app. */}
      <p className="mt-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
        <Smartphone className="size-4 shrink-0 text-primary" />
        {t("purchaseNote")}
      </p>

      {table.isLoading && (
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {table.isError && (
        <div className="mt-10 text-center">
          <p className="font-bold text-foreground">{t("loadFailed")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => table.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {table.data && (
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {table.data.plans.map((p) => (
            <PlanCard
              key={p._id}
              plan={p}
              features={table.data.features}
              current={Boolean(currentName && p.plan_name === currentName)}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  plan,
  features,
  current,
  t,
}: {
  plan: Plan;
  features: Record<string, string>;
  current: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const from = argb(plan.colors?.from);
  const to = argb(plan.colors?.to) ?? from;
  const highlight = argb(plan.highlight) ?? "#4488ff";

  return (
    <div
      className="relative flex flex-col rounded-2xl border p-5"
      style={{
        borderColor: plan.popular ? highlight : undefined,
        background: from ? `linear-gradient(135deg, ${from}, ${to})` : undefined,
      }}
    >
      {plan.popular && (
        <span
          className="absolute -top-3 start-4 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
          style={{ backgroundColor: highlight }}
        >
          <Star className="size-3 fill-current" />
          {t("mostPopular")}
        </span>
      )}

      <p className="text-lg font-bold text-foreground">{plan.plan_name}</p>
      {plan.best_for && (
        <p className="mt-0.5 text-xs text-muted-foreground">{plan.best_for}</p>
      )}
      {current && (
        <span className="mt-2 inline-flex w-fit rounded-full bg-foreground/10 px-2.5 py-1 text-[11px] font-semibold text-foreground">
          {t("currentPlan")}
        </span>
      )}

      <ul className="mt-4 space-y-2">
        {Object.entries(features).map(([key, label]) => {
          const v = plan.values?.[key];
          const unlocked = isUnlocked(v);
          const text = valueText(v);
          return (
            <li
              key={key}
              className={`flex items-center gap-2 text-sm ${unlocked ? "text-foreground" : "text-muted-foreground/60"}`}
            >
              {unlocked ? (
                <Check className="size-4 shrink-0" style={{ color: highlight }} />
              ) : (
                <Minus className="size-4 shrink-0" />
              )}
              <span className="min-w-0 flex-1">{label}</span>
              {unlocked && text && (
                <span className="shrink-0 text-xs font-semibold">{text}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
