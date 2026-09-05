"use client";

import { useQuery } from "@tanstack/react-query";
import { getAccount, type Account } from "@/lib/api/account";
import {
  planAvailable,
  planCountAvailable,
  websiteCountAvailable,
} from "./features";

export interface PlanGate {
  account: Account | undefined;
  isAdmin: boolean;
  /** Yes/No feature — mobile ProfileCubit.isAvailable semantics. */
  isAvailable: (code: string) => boolean;
  /** Counter feature — mobile ProfileCubit.isCountAvailable semantics. */
  isCountAvailable: (code: string, current: number) => boolean;
  /** Website ceiling with the per-user override (CONTRACT §4). */
  websiteCountAvailable: (profileCounts: number) => boolean;
}

/**
 * The plan gate, backed by the app-wide `["account"]` query singleton.
 * All checks are GENEROUS while the account loads (see features.ts) —
 * the server is the real boundary.
 */
export function usePlan(): PlanGate {
  const { data: account } = useQuery({
    queryKey: ["account"],
    queryFn: getAccount,
    staleTime: 60_000,
  });
  return {
    account,
    isAdmin: Boolean(account?.user?.isAdmin),
    isAvailable: (code) => planAvailable(account, code),
    isCountAvailable: (code, current) => planCountAvailable(account, code, current),
    websiteCountAvailable: (n) => websiteCountAvailable(account, n),
  };
}
