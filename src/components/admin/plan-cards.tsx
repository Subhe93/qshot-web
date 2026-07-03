"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronDown, Loader2 } from "lucide-react";
import { FancyField } from "@/components/ui/fancy-field";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  activateSubscribe,
  getPlansTable,
  type Plan,
  type PlanTable,
} from "@/lib/api/admin";
import { apiErrorMessage } from "@/lib/api/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ARGB int (mobile Color) → #rrggbb. */
function argb(v?: number): string | undefined {
  return typeof v === "number"
    ? `#${(v & 0xffffff).toString(16).padStart(6, "0")}`
    : undefined;
}
/** Mobile isUnlocked: 0 / false / null = locked (hidden). */
function isUnlocked(v: unknown): boolean {
  return v !== 0 && v !== false && v !== null && v !== undefined && v !== "0";
}

/**
 * Admin subscription assigner — mirrors the mobile GivePlanLayout: a list of rich
 * gradient plan cards (popular banner, best-for, expandable feature matrix), and
 * tapping a plan opens an email step → activate-subscribe. Used both on the
 * standalone /admin/plans page and inside the profile-control subscription sheet.
 */
export function PlanCards({
  prefillEmail = "",
  single = false,
}: {
  prefillEmail?: string;
  /** Force a single column (used inside the narrow subscription popup so feature
   *  labels aren't truncated). The standalone page uses the responsive grid. */
  single?: boolean;
}) {
  const t = useTranslations("admin");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: getPlansTable,
  });
  const table: PlanTable = data ?? { plans: [], features: {} };
  const paid = table.plans.filter((p) => !p.free);

  const [selected, setSelected] = useState<Plan | null>(null);

  if (selected) {
    return (
      <AssignStep
        plan={selected}
        prefillEmail={prefillEmail}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}
      {isError && (
        <p className="py-10 text-center text-sm text-error">
          {t("search.error")}
        </p>
      )}
      {!isLoading && !isError && paid.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t("search.empty")}
        </p>
      )}
      {paid.length > 0 && (
        <div
          className={`grid grid-cols-1 items-start gap-4 ${
            single ? "" : "lg:grid-cols-2"
          }`}
        >
          {paid.map((plan) => (
            <RichPlanCard
              key={plan._id}
              plan={plan}
              features={table.features}
              actionLabel={t("plans.assign")}
              onSelect={() => setSelected(plan)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RichPlanCard({
  plan,
  features,
  actionLabel,
  onSelect,
}: {
  plan: Plan;
  features: Record<string, string>;
  actionLabel: string;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(!!plan.popular);

  const from = argb(plan.colors?.from);
  const to = argb(plan.colors?.to) ?? from;
  const highlight = argb(plan.highlight) ?? "#4488ff";
  const gradient = from
    ? `linear-gradient(135deg, ${from}, ${to})`
    : undefined;

  const unlocked = Object.keys(features).filter((k) =>
    isUnlocked(plan.values?.[k]),
  );
  const shown = expanded ? unlocked : unlocked.slice(0, 5);

  return (
    <div
      className="overflow-hidden rounded-3xl text-neutral-900"
      style={{
        border: `2px solid ${highlight}`,
        background: gradient ?? "linear-gradient(135deg, #eef2ff, #e0e7ff)",
      }}
    >
      {plan.popular && (
        <div
          className="px-3 py-2 text-center text-sm font-semibold text-white"
          style={{ background: highlight }}
        >
          ⭐ Most popular
        </div>
      )}
      <div className="p-5">
        <h3 className="text-xl font-bold">{plan.plan_name ?? plan._id}</h3>
        {plan.best_for && (
          <p className="mt-1 truncate text-sm font-medium text-neutral-900/60">
            {plan.best_for}
          </p>
        )}

        <button
          type="button"
          onClick={onSelect}
          className="mt-4 w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
          style={
            plan.popular
              ? { background: highlight, borderColor: highlight, color: "#fff" }
              : { background: "#fff", borderColor: highlight, color: "#111" }
          }
        >
          {actionLabel}
        </button>

        {shown.length > 0 && (
          <ul className="mt-4 space-y-2">
            {shown.map((k) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-neutral-900/70" />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {features[k]}
                </span>
                <FeatureValue value={plan.values?.[k]} />
              </li>
            ))}
          </ul>
        )}

        {unlocked.length > 5 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-neutral-900/70"
          >
            <ChevronDown
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            {!expanded && `+${unlocked.length - 5}`}
          </button>
        )}
      </div>
    </div>
  );
}

function FeatureValue({ value }: { value: unknown }) {
  if (value === true) {
    return <Check className="size-4 text-emerald-600" />;
  }
  return (
    <span className="shrink-0 text-sm font-semibold text-neutral-900/80">
      {String(value)}
    </span>
  );
}

function AssignStep({
  plan,
  prefillEmail,
  onBack,
}: {
  plan: Plan;
  prefillEmail: string;
  onBack: () => void;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("common");

  const [email, setEmail] = useState(prefillEmail);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ msg: string; error: boolean } | null>(
    null,
  );
  const [confirming, setConfirming] = useState(false);

  const planName = plan.plan_name ?? plan._id;

  const mutation = useMutation({
    mutationFn: () => activateSubscribe(email.trim(), plan._id),
    onSuccess: () => {
      setConfirming(false);
      setStatus({ msg: t("plans.done"), error: false });
    },
    onError: async (e) => {
      setConfirming(false);
      // Surface the backend's real reason (e.g. "User already has an active
      // subscription.") instead of a generic error.
      setStatus({ msg: await apiErrorMessage(e, t("search.error")), error: true });
    },
  });

  function onSubmit() {
    setStatus(null);
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(t("plans.emailLabel"));
      return;
    }
    setEmailError(null);
    setConfirming(true);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {planName}
      </button>

      <FancyField
        id="assign-email"
        type="email"
        label={t("plans.emailLabel")}
        iconSrc="/brand/ic_gradient_email.svg"
        value={email}
        error={emailError ?? undefined}
        onChange={(e) => setEmail(e.target.value)}
      />

      {status && (
        <p
          className={`text-center text-sm ${
            status.error ? "text-error" : "text-emerald-600"
          }`}
        >
          {status.msg}
        </p>
      )}

      <Button
        variant="gradient"
        className="w-full"
        disabled={mutation.isPending}
        onClick={onSubmit}
      >
        {mutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          t("plans.assign")
        )}
      </Button>

      <ConfirmDialog
        open={confirming}
        type="warning"
        title={t("plans.confirmTitle")}
        message={t("plans.confirmMsg", { plan: planName, email: email.trim() })}
        confirmText={t("plans.assign")}
        cancelText={tc("cancel")}
        onConfirm={() => mutation.mutate()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
