import type { Account } from "@/lib/api/account";
import { planFeatureMap } from "@/lib/plan/features";

/**
 * What the plan allows for temporary redirects (mobile
 * `TempRedirectEntitlement`).
 *
 * ⚠️ Deliberately NOT `planAvailable` / `usePlan().isAvailable`. These two codes
 * follow the contacts convention — the strings `"true"`/`"false"`, and a
 * MISSING code means DISABLED — the opposite of the legacy "Yes"/"No",
 * missing-means-allowed map they arrive in. Routing them through
 * `planAvailable` locks paying users out ("true" ≠ "Yes") and unlocks users
 * whose plan lacks the code.
 */
export const TEMP_REDIRECT_CODES = {
  enabled: "temporary_redirect",
  maxDays: "temporary_redirect_max_days",
} as const;

export interface TempRedirectEntitlement {
  enabled: boolean;
  /** `null` = no ceiling (admin). `0` = not allowed. */
  maxDays: number | null;
}

/** Dart `int.tryParse`: an optional sign and digits, nothing else. */
function tryParseInt(value: string | null | undefined): number | null {
  if (value == null) return null;
  const text = value.trim();
  return /^[+-]?\d+$/.test(text) ? Number.parseInt(text, 10) : null;
}

/** Parses the two raw plan values; anything missing resolves to locked. */
export function parseTempRedirectEntitlement(input: {
  isAdmin: boolean;
  enabledValue: string | null | undefined;
  maxDaysValue: string | null | undefined;
}): TempRedirectEntitlement {
  if (input.isAdmin) return { enabled: true, maxDays: null };
  return {
    enabled: input.enabledValue === "true",
    // Missing or unparsable is the most restrictive answer, never a licence.
    maxDays: tryParseInt(input.maxDaysValue) ?? 0,
  };
}

export function tempRedirectEntitlementEquals(
  a: TempRedirectEntitlement,
  b: TempRedirectEntitlement,
): boolean {
  return a.enabled === b.enabled && a.maxDays === b.maxDays;
}

/** The entitlement of a loaded account (`plan.planFeatures` + `user.isAdmin`). */
export function tempRedirectEntitlementOf(account: Account): TempRedirectEntitlement {
  const features = planFeatureMap(account);
  return parseTempRedirectEntitlement({
    isAdmin: Boolean(account.user?.isAdmin),
    enabledValue: features[TEMP_REDIRECT_CODES.enabled],
    maxDaysValue: features[TEMP_REDIRECT_CODES.maxDays],
  });
}

/**
 * Mobile `TempRedirectGate.planLocked`: a 0-day ceiling is locked too — the
 * server can ship one code without the other, and a picker with no valid range
 * is not a usable screen. Gates the START flow only; reading and stopping are
 * never gated.
 */
export function isTempRedirectPlanLocked(entitlement: TempRedirectEntitlement): boolean {
  return (
    !entitlement.enabled || (entitlement.maxDays != null && entitlement.maxDays <= 0)
  );
}
