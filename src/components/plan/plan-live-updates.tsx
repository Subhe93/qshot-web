"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { getAccount, type Account, type AccountPlan } from "@/lib/api/account";
import {
  openAccountEvents,
  type ChannelStatus,
  type PlanChangedEvent,
} from "@/lib/sse/account-events";
import { accountEntry } from "@/lib/local-store";
import { useAuthStore } from "@/stores/auth-store";
import { useUpgradeDialog } from "@/components/plan/upgrade-dialog";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Live plan activation (docs/PLAN-ACTIVATION-WEB.md): one SSE channel per
 * signed-in tab. `ready` silently re-reads the account; `plan.changed`
 * de-duplicates across tabs, refetches, refreshes every plan-dependent query
 * in place (no reload, no sign-out), and only THEN shows the message.
 * The event itself grants nothing — `GET /account` is the sole truth.
 */

const useChannelStore = create<{ status: ChannelStatus }>(() => ({
  status: "connecting",
}));

/** Last handled activationId — per ACCOUNT, shared between this account's
 *  tabs (two tabs get the same event; the message must show once). */
const lastActivation = accountEntry<string>({
  name: "plan-last-activation",
  fallback: "",
  validate: (v): v is string => typeof v === "string",
});

/** Every plan-dependent read beyond the account itself: gates via contacts
 *  entitlements, and the server's per-row over-plan flags on sites and QRs.
 *  Called after plan.changed AND after ready (§4.3 — ready covers a change
 *  missed while disconnected, so those rows must refresh then too). */
function invalidatePlanDependent(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["contacts-entitlements"] });
  queryClient.invalidateQueries({ queryKey: ["profiles"] });
  queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
}

const KNOWN_REASONS = new Set([
  "manual_activation",
  "admin_grant",
  "promo",
  "plan_change",
  "renewal",
]);

/** true = celebrate, false = neutral notice. Unknown direction stays neutral. */
function isUpgrade(prev: AccountPlan | undefined, next: AccountPlan | undefined): boolean {
  if (typeof prev?.order === "number" && typeof next?.order === "number") {
    return next.order > prev.order;
  }
  if (prev?.free && next && !next.free) return true;
  return false;
}

export function PlanLiveUpdates() {
  const t = useTranslations("plan");
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const status = useChannelStore((s) => s.status);
  const [toast, setToast] = useState<string | null>(null);

  // Contract §4.1: periodic polling every 60s ONLY while the channel is not
  // live. In react-query v5 each observer runs its OWN interval timer — this
  // is the only observer that sets one, so the shared ["account"] query is
  // untouched elsewhere and the timer dies with `false` when connected.
  useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
    refetchInterval: status === "connected" ? false : 60_000,
  });

  // Auto-dismiss the message.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6_000);
    return () => clearTimeout(id);
  }, [toast]);

  // Latest-ref pattern: the handler lives in a ref (re-assigned after every
  // render, inside an effect per react-hooks/refs) so the channel effect
  // below only re-runs on token changes — the stream opens once at the
  // authenticated root and closes on sign-out.
  const handlePlanChanged = useRef<(e: PlanChangedEvent) => void>(() => {});
  useEffect(() => {
    handlePlanChanged.current = async (event: PlanChangedEvent) => {
    // 1–2. De-duplicate across tabs, then store the new id. A tolerated
    // storage failure just means the message may repeat (§4.6).
    const id = event.activationId ?? "";
    if (id) {
      if (lastActivation.get() === id) return;
      lastActivation.set(id);
    }

    // 3. Refetch and WAIT — the message only ever follows a successful read.
    // fetchQuery (NOT refetchQueries): it JOINS an in-flight fetch instead of
    // silently cancelling it (refetchQueries defaults cancelRefetch:true — a
    // concurrent ready-invalidation would abort ours, resolve early, and show
    // the message off stale data, the exact §4.7 prohibition), returns the
    // fresh value, and throws on failure.
    const prev = queryClient.getQueryData<Account>(["account"])?.plan;
    let account: Account;
    try {
      account = await queryClient.fetchQuery({
        queryKey: ["account"],
        queryFn: getAccount,
        staleTime: 0,
      });
    } catch {
      return; // no message — the next read (poll, focus, ready) picks it up
    }
    const next = account.plan;

    invalidatePlanDependent(queryClient);
    // The paywall is moot the moment the plan actually changed.
    useUpgradeDialog.getState().close();

    // 4. The message — tone by reason + direction (§4.4).
    const planName = next?.name ?? event.planName ?? "";
    const reason =
      event.reason && KNOWN_REASONS.has(event.reason)
        ? event.reason
        : "plan_change";
    if (reason === "renewal") {
      setToast(t("planRenewed", { planName }));
    } else if (reason === "plan_change" && !isUpgrade(prev, next)) {
      setToast(t("planChanged", { planName }));
    } else {
      setToast(t("planActivated", { planName }));
    }
    };
  });

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    openAccountEvents({
      signal: controller.signal,
      onStatus: (s) => useChannelStore.setState({ status: s }),
      onReady: () => {
        // Covers everything missed while disconnected/hidden — silent.
        queryClient.invalidateQueries({ queryKey: ["account"] });
        invalidatePlanDependent(queryClient);
      },
      onPlanChanged: (e) => void handlePlanChanged.current(e),
      onAuthError: () => {
        // Invalid session (400-wrapped 401): the (app) layout guard routes
        // to sign-in once the store empties.
        useAuthStore.getState().logout();
      },
    });
    return () => controller.abort();
  }, [token, queryClient]);

  if (!toast) return null;
  return (
    // z-200: ABOVE every dialog/sheet layer in the app (they top out at 150 —
    // the likeliest real-world moment for this toast is while the upgrade
    // dialog's dark overlay is open).
    <div className="fixed bottom-6 left-1/2 z-200 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-dark px-4 py-3 text-sm font-medium text-white shadow-xl">
      <Sparkles className="size-4 shrink-0 text-[#c389ff]" />
      {toast}
    </div>
  );
}
