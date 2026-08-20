/**
 * Builder feature flags.
 *
 * The three SOCIAL FEED gates below are read from the environment so that
 * turning a provider on is a **deployment** decision rather than a code change.
 * `TEMPLATES_ENABLED` deliberately stays a constant — see its note.
 */

/**
 * Parses a `NEXT_PUBLIC_*` value into a boolean.
 *
 * ⚠️ CALLERS MUST PASS THE FULL LITERAL `process.env.NEXT_PUBLIC_…` EXPRESSION.
 * Next inlines these at BUILD time by textually replacing the member expression
 * `process.env.NEXT_PUBLIC_FOO` wherever it appears — including when it is a
 * call argument, which is the exact form the Next docs sanction
 * (`environment-variables.md` → "Bundling Environment Variables for the
 * Browser": `setupAnalyticsService(process.env.NEXT_PUBLIC_ANALYTICS_ID)`).
 * A computed lookup (`process.env[name]`) or an aliased object
 * (`const env = process.env; env.NEXT_PUBLIC_FOO`) is explicitly documented as
 * NOT inlined, and would silently evaluate to `undefined` in the browser — i.e.
 * every flag would fall back to its default and the env var would look ignored.
 * These flags are consumed by `SocialFeedBlockEditor`, a `"use client"`
 * component, so the browser path is the one that matters.
 *
 * `undefined` (unset) and `""` both mean "not configured" → the default wins,
 * so an existing deployment that sets none of these behaves exactly as before.
 * An unrecognised value also falls back to the default rather than guessing:
 * a typo must never silently expose an unreleased provider.
 */
function envFlag(raw: string | undefined, fallback: boolean): boolean {
  const v = raw?.trim().toLowerCase();
  if (!v) return fallback;
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return fallback;
}

/**
 * TEMPLATES_ENABLED — the whole-site Templates/Theme feature (ThemeSheet,
 * Style-panel "Templates" row, new-site auto-open gate). ENABLED (re-enabled
 * 2026-07-26 to match the mobile app's commit b9f3cbec, which flipped its two
 * mirror gates: `_themeGateEnabled` in website_editor_layout.dart and
 * `_showTemplates` in website_style_layout.dart). It was hidden 2026-07-22
 * while the feature waited on its release; the implementation was complete
 * throughout — only these UI entry points were ever gated. Serialization is
 * NOT affected either way: a mobile-saved `settings.template` round-trips
 * untouched. Set to `false` to hide the entry points again.
 *
 * NOT env-driven, on purpose. The three feed gates below are waiting on
 * *external* events (a mobile store release, a server route going live) that
 * differ per environment, which is what makes them deployment decisions. This
 * one is already resolved — the mobile release it mirrored has shipped — so an
 * env var would only add a way to get it wrong. Flip the constant if the mobile
 * gates ever flip back.
 */
export const TEMPLATES_ENABLED = true;

/**
 * FACEBOOK_FEED_ENABLED — the Meta/Facebook Page value for
 * `SocialFeedModule.configuration`. Kept OFF until the mobile release carrying
 * `feature/social-feed-refactor` is live, because shipped builds parse the field
 * with `FeedConfiguration.values[json['configuration']]!` — a bang on a map
 * lookup, so an unknown provider throws and takes down the parse of the WHOLE
 * page, not just this block. Blocks that already use `facebook` stay editable
 * regardless of this flag; only the option to newly pick it is hidden.
 *
 * Env: `NEXT_PUBLIC_FACEBOOK_FEED_ENABLED` — default **false**.
 */
export const FACEBOOK_FEED_ENABLED = envFlag(
  process.env.NEXT_PUBLIC_FACEBOOK_FEED_ENABLED,
  false,
);

/**
 * TIKTOK_FEED_ENABLED — the TikTok value for `SocialFeedModule.configuration`
 * (mobile commit 121470ef, 2026-08-04, branch `feature/template-sites`). Kept
 * OFF for exactly the reason FACEBOOK_FEED_ENABLED is off, only more so:
 * `SocialFeedBlock.fromJson` resolves the field with
 * `FeedConfiguration.values[json['configuration']]!`, and `TiktokFeedConfiguration`
 * was registered in `FeedConfiguration.all` only in that commit — so on EVERY
 * build shipped to date the bang throws and the whole page fails to parse, not
 * just this block. Our copy of the server's website-JSON validator also still
 * pins `socialFeedBlock.configuration` to
 * `["youtube","vimeo","instagram","facebook"]`, so a web-written `"tiktok"`
 * may additionally be rejected with a 422 on save.
 * Blocks that already use `tiktok` (created on a mobile feature build) stay
 * fully editable regardless of this flag; only newly PICKING it is hidden.
 * Flip to `true` together with FACEBOOK_FEED_ENABLED once the mobile release
 * carrying both providers is live and the validator enum has been re-issued.
 *
 * Env: `NEXT_PUBLIC_TIKTOK_FEED_ENABLED` — default **false**.
 */
export const TIKTOK_FEED_ENABLED = envFlag(
  process.env.NEXT_PUBLIC_TIKTOK_FEED_ENABLED,
  false,
);

/**
 * INSTAGRAM_FEED_ENABLED — whether Instagram may be picked for a NEW
 * `SocialFeedModule`. Turned OFF 2026-08-03 to mirror mobile commit 20941620,
 * which commented `FeedConfiguration.values["instagram"]!` out of
 * `SocialFeedSelectorSheet._items`.
 *
 * What it gates is the REPLACEMENT, not the thing that was removed: the NEW
 * `instagram_connected` configuration — **Business Login for Instagram**
 * (`InstagramConnectedFeedConfiguration`, mobile branch
 * `feature/template-sites`), a per-user OAuth connect flow with the same shape
 * as Facebook and TikTok, which mobile's selector now offers in Instagram's
 * slot. While this flag is on, picking Instagram opens the CONNECT sheet
 * (`InstagramConnectSheet`) and writes
 * `info = { connection_id, ig_user_id, username }`; the legacy link field is
 * only ever shown for a block that already carries the legacy shape.
 *
 * The server side IS deployed: the routes moved to `instagram-integration/*`
 * (mobile `Links.instagram*` — same rename TikTok shipped with) and were
 * verified live on api.qshot.com 2026-08-12 — `instagram-integration/feed`
 * answers its own contract envelope (`404 not_found` for an unknown
 * `connection_id`) and `instagram-integration/connect` answers
 * `401 connection_unauthorized` without a bearer; the old `instagram/*` paths
 * are dead. So deployment no longer holds this flag down.
 *
 * What DOES hold it down — and makes this, like the two flags above, a
 * parse-safety gate now — is the mobile release: `instagram_connected` is
 * registered in `FeedConfiguration.all` only on `feature/template-sites`, and
 * on every build shipped to date `FeedConfiguration.values[…]!` throws on it
 * and fails the parse of the WHOLE page. Flip it per-environment once the
 * mobile release carrying that branch is live. Legacy `"instagram"` blocks
 * stay parseable, renderable and editable regardless of this flag — see
 * `StoredFeedConfiguration` in `lib/types/blocks.ts`.
 *
 * Env: `NEXT_PUBLIC_INSTAGRAM_FEED_ENABLED` — default **false**.
 */
export const INSTAGRAM_FEED_ENABLED = envFlag(
  process.env.NEXT_PUBLIC_INSTAGRAM_FEED_ENABLED,
  false,
);
