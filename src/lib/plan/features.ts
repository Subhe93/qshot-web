import type { Account } from "@/lib/api/account";

/**
 * Plan feature codes — the wire ids of mobile's `FeaturesFlag` enum
 * (constants.dart). These key `plan.planFeatures[]` on `GET account`.
 *
 * Value vocabulary (all strings): "Yes" / "No" (case-sensitive), "Multiple"
 * (no ceiling), or a numeric string ("15"). NOT the contacts entitlements
 * vocabulary ("true"/"false"/"unlimited") — the two coexist deliberately.
 */
export const PLAN_FEATURES = {
  addSocialLinkCount: "add_social_link_count",
  addToWallet: "add_to_wallet",
  addLeadForm: "add_lead_form",
  addSocialFeed: "add_social_feed",
  websitePagesCount: "website_pages_count",
  /** NOTE: the wire id really is portfolios_max_count (mobile websitesMaxCount). */
  websitesMaxCount: "portfolios_max_count",
  connectDomain: "connect_domain",
  staticQrCodeCount: "static_qr_code_count",
  dynamicQrCodeCount: "dynamic_qr_code_count",
  addBooking: "add_booking",
} as const;

const YES = "Yes";
const MULTIPLE = "Multiple";

/** Flatten plan.planFeatures[] into code → value (mobile ProfileCubit.put). */
export function planFeatureMap(account: Account | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const f of account?.plan?.planFeatures ?? []) {
    const code = f.feature?.code;
    if (code && typeof f.value === "string") map[code] = f.value;
  }
  return map;
}

function isAdmin(account: Account | undefined): boolean {
  return Boolean(account?.user?.isAdmin);
}

/**
 * Mobile `ProfileCubit.isAvailable`: true iff the value is "Yes" OR the code
 * is absent (the deliberate generous legacy default — a feature stays usable
 * before its plan code ships). Admins bypass. While the account is still
 * loading we are generous too: mobile loads the profile at splash so it has
 * no loading state, and the server stays the real boundary.
 */
export function planAvailable(account: Account | undefined, code: string): boolean {
  if (!account || isAdmin(account)) return true;
  const value = planFeatureMap(account)[code];
  return value == null || value === YES;
}

/**
 * Mobile `ProfileCubit.isCountAvailable`: absent code = allowed,
 * "Multiple" = unlimited, otherwise strictly `limit > current`
 * (an unparsable value counts as 0 = denied).
 */
export function planCountAvailable(
  account: Account | undefined,
  code: string,
  current: number,
): boolean {
  if (!account || isAdmin(account)) return true;
  const value = planFeatureMap(account)[code];
  if (value == null) return true;
  if (value === MULTIPLE) return true;
  const limit = Number.parseInt(value, 10);
  return (Number.isNaN(limit) ? 0 : limit) > current;
}

/**
 * The website ceiling (mobile getCountAvailable, duplicated in
 * website_fragment/website_settings_layout): the per-user override
 * `maxFreeProfilesCount` / `maxPremProfilesCount` — selected by `plan.free` —
 * wins when non-zero; otherwise fall back to `portfolios_max_count`.
 */
export function websiteCountAvailable(
  account: Account | undefined,
  profileCounts: number,
): boolean {
  if (!account || isAdmin(account)) return true;
  const user = account.user;
  const maxCount = account.plan?.free
    ? (user?.maxFreeProfilesCount ?? 0)
    : (user?.maxPremProfilesCount ?? 0);
  if (maxCount !== 0) return maxCount > profileCounts;
  return planCountAvailable(account, PLAN_FEATURES.websitesMaxCount, profileCounts);
}
