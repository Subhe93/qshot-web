"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutGrid,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Hash,
  UserCircle,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { resolveYoutubeChannelId } from "@/lib/api/youtube";
import { brandIconUrl } from "@/lib/builder/brand-icons";
import { hexToArgbA } from "@/lib/builder/color";
import {
  FACEBOOK_FEED_ENABLED,
  INSTAGRAM_FEED_ENABLED,
  TIKTOK_FEED_ENABLED,
} from "@/lib/builder/feature-flags";
import { cn } from "@/lib/utils";
import type {
  SocialFeedBlock,
  LinkFeedConfiguration,
  StoredFeedConfiguration,
  FacebookFeedInfo,
  InstagramConnectedFeedInfo,
  TiktokFeedInfo,
  SocialFeedLayoutType,
} from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { LayoutPicker } from "./LayoutPicker";
import { FacebookPageSheet } from "./FacebookPageSheet";
import { InstagramConnectSheet } from "./InstagramConnectSheet";
import { TiktokConnectSheet } from "./TiktokConnectSheet";

type Tab = "layout" | "general";

/**
 * Which providers may be CHOSEN in the builder — the web mirror of mobile's
 * `SocialFeedSelectorSheet._items` (which is a hand-written subset of
 * `FeedConfiguration.all`, not the whole registry).
 *
 * Three gates, all in `src/lib/builder/feature-flags.ts` next to
 * TEMPLATES_ENABLED, and they are gates of two DIFFERENT kinds:
 *
 * · FACEBOOK_FEED_ENABLED / TIKTOK_FEED_ENABLED — parse-safety. On every
 *   shipped mobile build `FeedConfiguration.values` holds only
 *   youtube/vimeo/instagram, and `SocialFeedBlock.fromJson` does
 *   `FeedConfiguration.values[json['configuration']]!` — the `!` turns a
 *   web-written `"facebook"` / `"tiktok"` into a thrown null-check that escapes
 *   `BlockEntity.fromJson`, so the ENTIRE page fails to parse in the app, not
 *   just this block.
 *
 * · INSTAGRAM_FEED_ENABLED — gates the `instagram_connected` entry, and since
 *   mobile's final treatment (branch `feature/template-sites`) it is BOTH kinds
 *   of gate at once. Mobile commit 20941620 retired the legacy public
 *   `business_discovery` entry from the selector; the branch then landed its
 *   replacement as a DISTINCT configuration —
 *   `InstagramConnectedFeedConfiguration`, name `"instagram_connected"`, a
 *   per-user OAuth connect flow with the same shape as TikTok (one account per
 *   connection, no picker). Distinct value ⇒ parse safety applies exactly as
 *   for facebook/tiktok: on every build that predates the branch,
 *   `FeedConfiguration.values["instagram_connected"]!` throws and the WHOLE
 *   page fails to parse. And it stays off until the server ships the
 *   `instagram-integration/*` routes. Legacy `"instagram"` blocks are
 *   unaffected either way — every shipped build parses that value, and mobile
 *   keeps `InstagramFeedConfiguration` registered so old blocks deserialize.
 *
 * All three read from `NEXT_PUBLIC_*` env vars (default: all off), so enabling
 * a provider is a deployment decision — see feature-flags.ts.
 *
 * In every case an EXISTING block keeps its provider visible and fully
 * editable, so the user can still edit it and switch away — mobile keeps
 * `InstagramFeedConfiguration` registered for exactly that reason.
 *
 * Mobile's final new-block order (SocialFeedSelectorSheet._items on
 * `feature/template-sites`) is youtube, vimeo, facebook, tiktok,
 * instagram_connected.
 */

/**
 * The provider tables below are keyed by `StoredFeedConfiguration` — i.e. they
 * include `"instagram_connected"`, the value mobile's
 * `InstagramConnectedFeedConfiguration` registered on `feature/template-sites`
 * (`SocialFeedBlock.configuration` is typed with the same union, so writing it
 * needs no cast).
 */

/**
 * ── Legacy `"instagram"` still carries TWO `info` shapes ─────────────────────
 *
 * See `InstagramFeedInfo` in lib/types/blocks.ts. NEW blocks use the distinct
 * `configuration: "instagram_connected"`, but blocks saved before the split are
 * stored under `configuration: "instagram"` in either shape:
 *
 *   "link"      legacy → `{ link, username }`   — public `business_discovery`
 *   "connected"        → `{ connection_id, ig_user_id, username }` — OAuth,
 *                        written by this editor before mobile landed the
 *                        distinct configuration value
 *
 * The editor picks its UI from the block's OWN `info`, never from the flag, so
 * a saved legacy block opens on the legacy link field and is never silently
 * rewritten. The one place an `"instagram"` block becomes
 * `"instagram_connected"` is `setInstagramInfo` — the user completing the
 * connect flow.
 */
type InstagramMode = "link" | "connected";

/**
 * Which shape is this `info`?
 *
 * Discriminated on KEY PRESENCE, not on value truthiness. Both writers always
 * materialise their keys (empty strings included — a missing key is what
 * crashes mobile's `FeedDisplayCubit`), so a legacy block always HAS `link` and
 * a connected block always HAS `connection_id`, even when the user has not
 * filled anything in yet. Testing `!== ""` instead would misread a
 * freshly-created, still-blank legacy block as "no evidence" and let the flag
 * flip it to connected — i.e. delete the very keys we are trying to preserve.
 *
 * A block with NO evidence either way (empty `info`, e.g. a stub written by an
 * old catalog seed) is treated as legacy: now that a NEW connect-flow pick
 * lands on the distinct `"instagram_connected"` configuration, an empty
 * `"instagram"` block can only be a legacy artifact — it no longer falls
 * through to the flag.
 */
function instagramMode(info: Record<string, unknown>): InstagramMode {
  if ("connection_id" in info) return "connected";
  return "link";
}

/** The providers every released mobile build can parse. Order = mobile `FeedConfiguration.all`. */
const LINK_PROVIDERS: LinkFeedConfiguration[] = ["youtube", "vimeo", "instagram"];

/** Display order — mobile `FeedConfiguration.all`. Gating is applied on top. */
const PROVIDER_ORDER: StoredFeedConfiguration[] = [
  ...LINK_PROVIDERS,
  "facebook",
  "tiktok",
  "instagram_connected",
];

/**
 * Offered for a NEW selection? An existing block's own provider is always
 * added. Mirrors mobile `SocialFeedSelectorSheet._items` on
 * `feature/template-sites`: youtube, vimeo, facebook, tiktok,
 * instagram_connected — the legacy public `instagram` entry is retired for NEW
 * blocks (it stays in PROVIDER_ORDER only so an existing block's own pill
 * renders in its historical position).
 */
const OFFERED: Record<StoredFeedConfiguration, boolean> = {
  youtube: true,
  vimeo: true,
  instagram: false,
  facebook: FACEBOOK_FEED_ENABLED,
  tiktok: TIKTOK_FEED_ENABLED,
  instagram_connected: INSTAGRAM_FEED_ENABLED,
};

// Provider metadata mirrors the mobile FeedConfiguration subclasses
// (Youtube / Vimeo / Instagram) plus the two connect-flow providers — the
// Meta-backed Facebook Page feed and TikTok — whose `info` is gathered through
// a server-side OAuth flow instead of a link field.
// `defaultTitle` is the mobile `defaultTitleValue`, stamped onto the block when
// the user picks a provider (mobile does the same in block_selector_sheet).
const PROVIDERS: Record<
  StoredFeedConfiguration,
  { label: string; short: string; defaultTitle: string; hint: string; color: string }
> = {
  youtube: {
    label: "YouTube Videos",
    short: "YouTube",
    defaultTitle: "YouTube Videos",
    hint: "youtube.com/@channel",
    color: "#FF0000",
  },
  vimeo: {
    label: "Vimeo Showcase",
    short: "Vimeo",
    defaultTitle: "Vimeo Showcase",
    hint: "vimeo.com/channel",
    color: "#1AB7EA",
  },
  instagram: {
    label: "Instagram Page Feed",
    short: "Instagram",
    defaultTitle: "Instagram Feed",
    hint: "instagram.com/username",
    color: "#DD2A7B",
  },
  facebook: {
    label: "Facebook Feed",
    short: "Facebook",
    defaultTitle: "Facebook",
    hint: "",
    color: "#1877F2",
  },
  // mobile TiktokFeedConfiguration: title "TikTok", defaultTitleValue "TikTok".
  tiktok: {
    label: "TikTok",
    short: "TikTok",
    defaultTitle: "TikTok",
    hint: "",
    color: "#000000",
  },
  // mobile InstagramConnectedFeedConfiguration: title "Instagram",
  // defaultTitleValue "Instagram" ("Show your own Instagram posts.").
  instagram_connected: {
    label: "Instagram",
    short: "Instagram",
    defaultTitle: "Instagram",
    hint: "",
    color: "#DD2A7B",
  },
};

const DEFAULT_TITLES = Object.values(PROVIDERS).map((p) => p.defaultTitle);

function isFeedConfiguration(value: unknown): value is StoredFeedConfiguration {
  return typeof value === "string" && value in PROVIDERS;
}

// Layout picker: EVERY provider offers list / grid / swiper — mobile dev
// build 174 (fa18604d, "three layouts for every social feed") moved the
// capability onto `FeedConfiguration.supportedLayouts`, and all five
// configurations return the same three values. No schema change: the enum
// stays [swiper, list, grid]. Instagram's retired legacy shape still gets the
// tab (mobile keys this off the configuration, not the info shape).
const HAS_LAYOUT: Record<StoredFeedConfiguration, boolean> = {
  youtube: true,
  vimeo: true,
  instagram: true,
  facebook: true,
  tiktok: true,
  instagram_connected: true,
};

// Configurations that carry a `settings` map with show_profile_details
// (mobile `additionalSettings`). `TiktokFeedConfiguration` does not override
// `additionalSettings`, so it inherits the base class's `null` → no settings.
// `InstagramConnectedFeedConfiguration` DOES override it:
// `{ show_profile_details: true }`, exactly like Facebook.
const HAS_PROFILE_SETTINGS: Record<StoredFeedConfiguration, boolean> = {
  youtube: false,
  vimeo: false,
  instagram: true,
  facebook: true,
  tiktok: false,
  instagram_connected: true,
};

/**
 * `info` families. Two providers in the same family describe the same thing
 * with the same keys, so switching between them may keep `info`; crossing a
 * family boundary must clear it. A Meta `connection_id` is meaningless to
 * `tiktok-integration/feed` and vice versa, so facebook and tiktok are separate
 * families even though both are connect-flow providers — and an Instagram
 * Business Login connection is a THIRD, non-interchangeable credential (a
 * different app identity entirely: Instagram App ID/Secret, not Meta's).
 */
type InfoFamily = "link" | "facebook" | "tiktok" | "instagram";

const BASE_INFO_FAMILY: Record<StoredFeedConfiguration, InfoFamily> = {
  youtube: "link",
  vimeo: "link",
  // Overridden per-shape by infoFamily() — legacy Instagram IS a link provider.
  instagram: "link",
  facebook: "facebook",
  tiktok: "tiktok",
  // Same family as an `"instagram"` block already carrying the connected
  // shape, so the config value can flip without losing the connection.
  instagram_connected: "instagram",
};

/**
 * Instagram is the one provider whose family depends on the block, not just on
 * the configuration: its legacy shape is a link (`youtube ↔ vimeo ↔ instagram`
 * may swap `info` freely, as they always could), while its connected shape
 * holds an OAuth connection that means nothing to anyone else.
 */
function infoFamily(
  configuration: StoredFeedConfiguration,
  info: Record<string, unknown>,
): InfoFamily {
  if (configuration === "instagram") {
    return instagramMode(info) === "connected" ? "instagram" : "link";
  }
  return BASE_INFO_FAMILY[configuration];
}

// Mobile layout order in the PageView: swiper, list, grid (enum order).
// `svg` mirrors the mobile asset mapped per SocialFeedLayoutType in
// social_feed_settings_sheet.dart (Assets.svg.videoLayout*), copied into
// web-app/public/layouts/.
const LAYOUTS: { type: SocialFeedLayoutType; label: string; svg: string }[] = [
  { type: "swiper", label: "Swiper", svg: "video_layout_swiper.svg" },
  { type: "list", label: "List", svg: "video_layout_list.svg" },
  { type: "grid", label: "Grid", svg: "video_layout_grid.svg" },
];

// ─── `info` contract (see SocialFeedInfo in lib/types/blocks.ts) ─────────────
//
// The mobile FeedDisplayCubit indexes `info` in its CONSTRUCTOR (through
// `_cacheKey`), outside the try/catch that guards the fetch, and hands the
// value to non-nullable `String` params:
//   youtube   → FeedRepository.youtubeKey(block.info["channel_id"])
//   instagram → FeedRepository.instagramKey(block.info["username"])
//   vimeo     → VimeoFeedConfiguration.extractId(block.info["link"])
// A missing key is `null` there → TypeError during widget build → the app
// shows an error box. An empty string is merely a failed fetch, which the
// cubit catches and renders as retryable. So: always write the keys.

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** `youtube.com/channel/UC…` or a bare `UC…` id — the only forms we can resolve offline. */
const YOUTUBE_CHANNEL_ID = /(?:^|\/)(UC[A-Za-z0-9_-]{20,})(?:\/|$)/;

/** Mobile `YoutubeFeedConfiguration.regex` — the handle/user URL forms that
 *  need SERVER resolution to a channel id. */
const YOUTUBE_URL =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(u(ser)?|@)[/\w-]+)(\/(videos|playlists|community|streams|shorts))?$/;

/**
 * Mobile `YoutubeFeedConfiguration.postJob`: strips a trailing section segment
 * (`/videos`, `/shorts`, …) so the URL points at the channel root the backend
 * can resolve to a channel id.
 */
function stripYoutubeSection(value: string): string {
  const m = /^(.*)\/(videos|playlists|community|streams|shorts)\/?$/i.exec(
    value.trim(),
  );
  return m ? m[1] : value.trim();
}

/** Mirrors mobile InstagramFeedConfiguration.regex (also accepts a bare handle). */
const INSTAGRAM_URL = /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?$/;

/**
 * Mobile stores an already-resolved channel id (it calls
 * `GET q-profile/youtube-channel/name?url=` first). We have no such call here,
 * so we parse a `UC…` id out of the URL when present and otherwise pass the
 * URL through: wrong-but-present beats absent, because absent crashes.
 */
function youtubeChannelId(link: string): string {
  const value = link.trim();
  return YOUTUBE_CHANNEL_ID.exec(value)?.[1] ?? value;
}

function instagramUsername(link: string): string {
  const value = link.trim().replace(/^@/, "");
  return INSTAGRAM_URL.exec(value)?.[1] ?? value;
}

/**
 * The `info` keys the mobile display layer dereferences for each provider.
 *
 * `instagram` is the only entry that is not a constant: its two shapes own
 * disjoint identifier sets, and `normalizeInfo` DELETES every known key a
 * provider does not require. Resolving Instagram to one fixed list would
 * therefore strip the other shape's identifiers on open — deleting `link` from
 * every saved legacy block, or `connection_id` from a connected one. This is
 * exactly the "do not silently rewrite an old block's info" hazard, and keying
 * the list off the block's own `info` is what closes it.
 */
/**
 * Business Login shape (server-contract.md §2.3, mobile
 * `InstagramConnectCubit`): `connection_id` is required, `ig_user_id` is "a
 * redundant safety check against the connection" and hence optional — but
 * written anyway, empty string included, exactly like TikTok's `open_id`.
 * `username` is required by BOTH Instagram shapes, which is what lets an old
 * build handed a connected block still resolve the same account. These are the
 * keys of `"instagram_connected"` AND of an `"instagram"` block already
 * carrying the connected shape.
 */
const INSTAGRAM_CONNECTED_INFO_KEYS = ["connection_id", "ig_user_id", "username"];

const REQUIRED_INFO_KEYS: Record<StoredFeedConfiguration, string[]> = {
  youtube: ["link", "channel_id"],
  vimeo: ["link"],
  // Legacy shape. See requiredInfoKeys() for the connected one.
  instagram: ["link", "username"],
  facebook: ["connection_id", "page_id", "username"],
  // feed_display_cubit.dart derefs connection_id + open_id for tiktok, and
  // `_cacheKey` derefs connection_id in the CONSTRUCTOR. `open_id` is typed
  // `String?` there so it tolerates null, but we still always write it — the
  // catalog contract lists it and an empty string is never worse than absent.
  tiktok: ["connection_id", "open_id", "username"],
  instagram_connected: INSTAGRAM_CONNECTED_INFO_KEYS,
};

function requiredInfoKeys(
  configuration: StoredFeedConfiguration,
  info: Record<string, unknown>,
): string[] {
  if (configuration === "instagram" && instagramMode(info) === "connected") {
    return INSTAGRAM_CONNECTED_INFO_KEYS;
  }
  return REQUIRED_INFO_KEYS[configuration];
}

/** Every key any provider owns — used to drop another provider's leftovers. */
const KNOWN_INFO_KEYS = [
  ...new Set([
    ...Object.values(REQUIRED_INFO_KEYS).flat(),
    ...INSTAGRAM_CONNECTED_INFO_KEYS,
  ]),
];

/**
 * Fills in the provider's required keys without ever clobbering a value the
 * mobile app (or an earlier edit) already stored, and drops the keys that
 * belong to a *different* provider (mobile builds each provider's `info` from
 * scratch, so a Vimeo block carrying a stale `channel_id` is off-contract).
 * Keys we don't know about — e.g. written by a newer mobile build — ride along
 * untouched.
 */
function normalizeInfo(
  configuration: StoredFeedConfiguration,
  info: Record<string, unknown>,
): Record<string, unknown> {
  // Instagram resolves its key list from the block's OWN `info` — see
  // requiredInfoKeys(). Every other provider has a single fixed shape.
  const required = requiredInfoKeys(configuration, info);
  const next: Record<string, unknown> = { ...info };
  for (const key of KNOWN_INFO_KEYS) {
    if (!required.includes(key)) delete next[key];
  }
  for (const key of required) {
    next[key] = str(info[key]);
  }
  if (configuration === "youtube" && !next.channel_id) {
    next.channel_id = youtubeChannelId(str(next.link));
  }
  // The two link↔username derivations apply to the LEGACY Instagram shape
  // only; the connected shape has no `link` and gets its `username` from the
  // connection record.
  const legacyInstagram =
    configuration === "instagram" && instagramMode(info) === "link";
  if (legacyInstagram && !next.username) {
    next.username = instagramUsername(str(next.link));
  }
  if (configuration === "youtube" && !next.link) next.link = str(next.channel_id);
  if (legacyInstagram && !next.link) next.link = str(next.username);
  return next;
}

/** Mobile `FeedConfiguration.additionalSettings`. */
function defaultSettings(
  configuration: StoredFeedConfiguration,
  showProfile = true,
): Record<string, unknown> | null {
  return HAS_PROFILE_SETTINGS[configuration]
    ? { show_profile_details: showProfile }
    : null;
}

/**
 * SocialFeed block editor, mirroring the mobile `SocialFeedSettingsSheet`:
 * a Layout tab (only for YouTube/Vimeo) and a General/Settings tab carrying the
 * accent title, posts-count stepper (min 2, max 20), show-profile toggle
 * (Instagram only), duplicate and background colour. It additionally exposes the
 * provider selector + provider `info.link` field that the mobile gathers through
 * the dedicated feed-input screens.
 */
export function SocialFeedBlockEditor({ block }: { block: SocialFeedBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);

  // An unknown/absent `configuration` is unrepresentable on mobile (the `!` in
  // fromJson), so treat it as the safest link provider and repair it below.
  const configuration: StoredFeedConfiguration = isFeedConfiguration(
    block.configuration,
  )
    ? block.configuration
    : "youtube";
  // PENDING provider switch: picking a connect platform (facebook / tiktok /
  // instagram_connected) first shows that platform's SETTINGS — title, source
  // row reading "Not connected", posts count, profile toggle — without writing
  // anything to the block. Only the source row's tap opens the connect sheet,
  // and only a SUCCESSFUL connect stamps the block (the mobile invariant: an
  // unconnected connect-provider block is unrepresentable). Re-picking the
  // block's real provider, or closing the editor, simply drops the pending
  // state. `effective` is what the UI renders; `configuration` is what the
  // block IS.
  const [pendingProvider, setPendingProvider] =
    useState<StoredFeedConfiguration | null>(null);
  // The profile toggle's value while pending (nothing on the block to hold
  // it); applied by the stamp. Mobile's additionalSettings default: true.
  const [pendingShowProfile, setPendingShowProfile] = useState(true);
  const effective = pendingProvider ?? configuration;
  const hasLayout = HAS_LAYOUT[effective];

  const [tab, setTab] = useState<Tab>(hasLayout ? "layout" : "general");
  const [pageSheet, setPageSheet] = useState(false);
  const [tiktokSheet, setTiktokSheet] = useState(false);
  const [instagramSheet, setInstagramSheet] = useState(false);

  const setBlock = (patch: Partial<SocialFeedBlock>) => updateBlock(block.id, patch);

  const info = block.info ?? {};

  // Which UI a LEGACY `"instagram"` block gets — read from its own `info`, so
  // a saved legacy block opens on the legacy link field no matter what the
  // flag says, and a pre-split connected block stays editable even while the
  // flag is off. `"instagram_connected"` blocks don't consult this: their
  // configuration value IS the discriminator.
  const igMode = instagramMode(info);

  // The connect-flow UI serves both the new configuration and a pre-split
  // `"instagram"` block that already carries the connected `info` shape.
  const usesInstagramConnect =
    configuration === "instagram_connected" ||
    (configuration === "instagram" && igMode === "connected");

  // Repair-on-open: a block added from the block catalog arrives as
  // `{configuration:"instagram", info:{}}` with no settings/posts_count, and
  // that empty `info` is exactly what makes the mobile FeedDisplayCubit throw
  // during build. Writing the missing keys (and only the missing ones — a
  // well-formed mobile block produces no patch, hence no spurious dirty flag)
  // downgrades that crash to the cubit's catchable "couldn't load" state.
  useEffect(() => {
    const patch: Partial<SocialFeedBlock> = {};
    if (block.configuration !== configuration) {
      patch.configuration = configuration;
    }
    const current = block.info ?? {};
    const normalized = normalizeInfo(configuration, current);
    const keys = new Set([...Object.keys(current), ...Object.keys(normalized)]);
    if ([...keys].some((k) => current[k] !== normalized[k])) {
      patch.info = normalized;
    }
    if (block.settings === undefined) {
      patch.settings = defaultSettings(configuration);
    }
    if (block.posts_count == null) patch.posts_count = 4;
    if (!block.layout_type) patch.layout_type = "list";
    if (Object.keys(patch).length > 0) updateBlock(block.id, patch);
    // Runs per block; `block` identity changes on every store patch, so the id
    // is the correct dependency — the body is a no-op once repaired.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  // Mobile fetches YouTube via info.channel_id and Instagram via info.username;
  // read any of them so a mobile-created block shows its value here.
  const link =
    (info["link"] as string | undefined) ??
    (info["channel_id"] as string | undefined) ??
    (info["username"] as string | undefined) ??
    "";
  const postsCount = block.posts_count ?? 4;
  const settings = block.settings ?? null;
  const showProfile =
    (settings?.["show_profile_details"] as boolean | undefined) ?? true;

  // Facebook (Meta) info — written by the connect flow, never typed by hand.
  const facebookInfo: Partial<FacebookFeedInfo> = {
    connection_id: (info["connection_id"] as string | undefined) ?? undefined,
    page_id: (info["page_id"] as string | undefined) ?? undefined,
    username: (info["username"] as string | undefined) ?? undefined,
  };
  const facebookConnected = !!facebookInfo.connection_id && !!facebookInfo.page_id;

  // TikTok info — written by the connect flow, never typed by hand. `open_id`
  // is optional in the contract, so `connection_id` alone means connected.
  const tiktokInfo: Partial<TiktokFeedInfo> = {
    connection_id: (info["connection_id"] as string | undefined) ?? undefined,
    open_id: (info["open_id"] as string | undefined) ?? undefined,
    username: (info["username"] as string | undefined) ?? undefined,
  };
  const tiktokConnected = !!tiktokInfo.connection_id;

  // Instagram Business Login info — the connected shape. `ig_user_id` is
  // optional in the contract, so `connection_id` alone means connected.
  const instagramInfo: Partial<InstagramConnectedFeedInfo> = {
    connection_id: (info["connection_id"] as string | undefined) ?? undefined,
    ig_user_id: (info["ig_user_id"] as string | undefined) ?? undefined,
    username: (info["username"] as string | undefined) ?? undefined,
  };
  const instagramConnected = !!instagramInfo.connection_id;

  function setConfiguration(next: StoredFeedConfiguration) {
    // Re-picking the current provider must be inert — and it also cancels a
    // pending switch (the user backing out of an unconnected platform).
    // Without the inert-guard, an Instagram block would compare its own family
    // against the family a FRESH Instagram block would get and, with the flag
    // on, "cross" from link to connected — wiping a saved legacy block's
    // `info` on a stray tap.
    if (next === configuration) {
      setPendingProvider(null);
      return;
    }
    // Instagram + Facebook carry a settings map with show_profile_details
    // (mobile additionalSettings); the RSS providers carry none.
    const nextSettings = HAS_PROFILE_SETTINGS[next]
      ? { ...(settings ?? {}), show_profile_details: showProfile ?? true }
      : null;
    // Crossing an `info` family boundary clears `info`: a Meta connection_id
    // means nothing to `tiktok-integration/feed` or to `instagram/feed`, and
    // none of them mean anything to an RSS provider. youtube ↔ vimeo ↔ LEGACY
    // instagram keep theirs exactly as before. Either way the new provider's
    // required keys are then materialised, so `info` is never left in a shape
    // the mobile display layer dereferences to null.
    //
    // The target family is computed from an EMPTY `info` because that is what
    // a newly picked provider starts from. Picking `instagram_connected` from
    // a pre-split connected `"instagram"` block stays inside the "instagram"
    // family, so the stored connection survives the value flip.
    const crossesFamily = infoFamily(next, {}) !== infoFamily(configuration, info);
    const nextInfo = normalizeInfo(next, crossesFamily ? {} : info);
    // Mobile parity invariant: a connect-flow block is BORN from a completed
    // connect — an unconnected facebook/tiktok/instagram_connected block is
    // unrepresentable on mobile and must stay unrepresentable here. Stamping
    // materialised-EMPTY ids let auto-save ship `connection_id: ""` to the
    // server (seen live 2026-08-19: the whole save 422'd on the validator, and
    // even once the enum learns the value, an empty connection renders
    // nothing). So picking a connect provider without a usable connection goes
    // PENDING: the platform's settings show, with the source row reading "Not
    // connected" — tapping it opens the connect sheet, whose success handler
    // (`setFacebookInfo` / `setTiktokInfo` / `setInstagramInfo`) performs the
    // stamp. Cancelling leaves the block on its previous provider. A pre-split
    // connected `"instagram"` block picking `instagram_connected` still stamps
    // directly: its family is preserved, so `nextInfo` carries the stored
    // connection.
    const nid = nextInfo as Record<string, unknown>;
    if (
      (next === "facebook" && !(str(nid.connection_id) && str(nid.page_id))) ||
      (next === "tiktok" && !str(nid.connection_id)) ||
      (next === "instagram_connected" && !str(nid.connection_id))
    ) {
      setPendingProvider(next);
      setPendingShowProfile(true); // mobile additionalSettings default
      setTab("general");
      return;
    }
    setPendingProvider(null);
    // Mobile stamps `configuration.defaultTitleValue` when the block is
    // created; do the same while the title is still untouched.
    const title = (block.title ?? "").trim();
    const nextTitle =
      title === "" || DEFAULT_TITLES.includes(title)
        ? PROVIDERS[next].defaultTitle
        : block.title;
    setBlock({
      configuration: next,
      settings: nextSettings,
      info: nextInfo,
      title: nextTitle,
    });
    setTab(HAS_LAYOUT[next] ? "layout" : "general");
  }

  /**
   * A successful Facebook page pick: the exact contract `info` shape PLUS the
   * full provider stamp (configuration / settings / title). The stamp matters
   * because, since the connect-first guard in `setConfiguration`, this handler
   * may be the FIRST writer of `configuration: "facebook"` — picking the pill
   * only opens the sheet. Re-picking a page on an existing facebook block
   * makes the stamp a no-op.
   */
  function setFacebookInfo(value: FacebookFeedInfo) {
    const title = (block.title ?? "").trim();
    setBlock({
      configuration: "facebook",
      info: {
        connection_id: value.connection_id,
        page_id: value.page_id,
        username: value.username,
      },
      settings: {
        ...(settings ?? {}),
        // While the switch was pending the toggle's value lived in local
        // state (the block wasn't facebook yet to hold it).
        show_profile_details: pendingProvider ? pendingShowProfile : showProfile,
      },
      title:
        // web-contract §5.3: the title is the PAGE NAME — "Facebook" is only
        // the fallback when no page name exists. (Mobile stamps the same.)
        title === "" || DEFAULT_TITLES.includes(title)
          ? value.username || PROVIDERS.facebook.defaultTitle
          : block.title,
    });
    setPendingProvider(null);
  }

  /**
   * A successful TikTok connect: contract `info` (catalog 2026-08-03) plus the
   * full provider stamp — see `setFacebookInfo` for why. TikTok carries no
   * `settings` map (mobile `additionalSettings` is the base-class null).
   */
  function setTiktokInfo(value: TiktokFeedInfo) {
    const title = (block.title ?? "").trim();
    setBlock({
      configuration: "tiktok",
      info: {
        connection_id: value.connection_id,
        open_id: value.open_id,
        username: value.username,
      },
      settings: null,
      title:
        title === "" || DEFAULT_TITLES.includes(title)
          ? PROVIDERS.tiktok.defaultTitle
          : block.title,
    });
    setPendingProvider(null);
  }

  /**
   * A successful connect flow: writes the exact Business Login contract shape
   * into `info` AND stamps `configuration: "instagram_connected"` — the value
   * mobile's `InstagramConnectCubit` blocks carry on `feature/template-sites`.
   * This is the ONE place a legacy `"instagram"` block turns into a connected
   * one — a deliberate, user-initiated action from the connect sheet — which
   * is why `link` is dropped here and never on open. Settings and title follow
   * the same rules a fresh pick gets in `setConfiguration`: the profile toggle
   * is preserved (mobile `additionalSettings` default: true), and an untouched
   * or provider-default title becomes the mobile `defaultTitleValue`
   * "Instagram".
   */
  function setInstagramInfo(value: InstagramConnectedFeedInfo) {
    const title = (block.title ?? "").trim();
    setBlock({
      // ⚠️ Written as `"instagram"` (the PRE-SPLIT value), NOT mobile's
      // `"instagram_connected"` — user decision 2026-08-21: the deployed
      // save-validator's enum has no `instagram_connected` and the backend
      // declined to add it for now, so the connected shape ships under the
      // legacy value and every renderer discriminates on `info` shape
      // (`connection_id` present = connected). The editor already reads such
      // blocks correctly (`instagramMode`). Revisit when the backend adds the
      // value — mobile build 166+ writes `instagram_connected` and CANNOT save
      // against this validator, so the enum addition remains inevitable.
      configuration: "instagram",
      info: {
        connection_id: value.connection_id,
        ig_user_id: value.ig_user_id,
        username: value.username,
      },
      settings: {
        ...(settings ?? {}),
        show_profile_details: pendingProvider ? pendingShowProfile : showProfile,
      },
      title:
        title === "" || DEFAULT_TITLES.includes(title)
          ? PROVIDERS.instagram_connected.defaultTitle
          : block.title,
    });
    setPendingProvider(null);
  }

  // Debounced server resolution of a YouTube handle URL → channel id, mobile
  // `FeedInputCubit._fetchYoutube` (`GET q-profile/youtube-channel/name?url=`).
  // The offline `UC…` extraction below covers channel-id URLs; HANDLE urls
  // (`youtube.com/@channel` — the hint we show!) can only be resolved by the
  // backend. Without this the stored channel_id was the raw URL, which the
  // public RSS endpoint (`videos.xml?channel_id=`) cannot serve — the feed
  // rendered empty on the published site for every handle-entered block.
  const youtubeResolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (youtubeResolveTimer.current) clearTimeout(youtubeResolveTimer.current);
    },
    [],
  );
  function scheduleYoutubeResolve(link: string) {
    if (youtubeResolveTimer.current) clearTimeout(youtubeResolveTimer.current);
    // Mobile debounces input with kSearchDelayDuration before fetching.
    youtubeResolveTimer.current = setTimeout(async () => {
      const id = await resolveYoutubeChannelId(link);
      if (id == null) return; // offline extraction stays as the fallback
      // Stale guards: the block must still exist, still be YouTube, and still
      // hold the link this resolution was scheduled for.
      const current = useEditorStore
        .getState()
        .blocks.find((b) => b.id === block.id) as SocialFeedBlock | undefined;
      if (
        current == null ||
        current.configuration !== "youtube" ||
        (current.info?.link as string | undefined) !== link
      ) {
        return;
      }
      updateBlock(block.id, {
        info: { ...current.info, channel_id: id },
      } as Partial<SocialFeedBlock>);
    }, 600);
  }

  function setLink(value: string) {
    // Write the provider-specific key mobile reads (channel_id / username),
    // derived from the link the way mobile derives it, plus `link` itself.
    // YouTube: postJob-strip trailing sections first (mobile stores the
    // STRIPPED link), then the offline id extraction now + the authoritative
    // server resolution shortly after.
    const link =
      configuration === "youtube" ? stripYoutubeSection(value) : value;
    const next: Record<string, unknown> = { ...info, link };
    if (configuration === "youtube") {
      next.channel_id = youtubeChannelId(link);
      if (YOUTUBE_URL.test(link) && !YOUTUBE_CHANNEL_ID.test(link)) {
        scheduleYoutubeResolve(link);
      }
    }
    if (configuration === "instagram") next.username = instagramUsername(value);
    setBlock({ info: next });
  }

  function setPostsCount(value: number) {
    setBlock({ posts_count: Math.min(20, Math.max(2, value)) });
  }

  // Offered providers, in mobile's `FeedConfiguration.all` order, plus this
  // block's own provider even when it is gated off — so an existing instagram /
  // facebook / tiktok block stays editable AND switchable.
  //
  // For a block still on `"instagram"` the `instagram_connected` pill is
  // suppressed — two pills would both render the brand name "Instagram", and
  // for the link shape tapping it would wipe the legacy `info` BEFORE any
  // account is connected (family crossing). Those blocks upgrade through the
  // connect UI instead: `setInstagramInfo` flips the configuration only once
  // the flow actually succeeds.
  const providerOptions: StoredFeedConfiguration[] = PROVIDER_ORDER.filter(
    (p) => {
      if (p === configuration) return true;
      if (p === "instagram_connected" && configuration === "instagram") {
        return false;
      }
      return OFFERED[p];
    },
  );

  const tabs: SheetTab<Tab>[] = [
    ...(hasLayout
      ? [{ value: "layout" as const, label: t("tabs.layout"), Icon: LayoutGrid }]
      : []),
    { value: "general", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      {/* Provider selector — mirrors FeedConfiguration.all. `facebook` is only
          offered when the flag is on, or when this block already uses it. */}
      <div className="flex gap-1 rounded-xl bg-surface p-1">
        {providerOptions.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setConfiguration(p)}
            className={cn(
              "flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
              effective === p ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
            )}
          >
            {/* Brand casing, not `capitalize` — that renders "Tiktok". */}
            {PROVIDERS[p].short}
          </button>
        ))}
      </div>

      {tabs.length > 1 && <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />}

      {tab === "layout" && hasLayout && (
        <LayoutPicker
          options={LAYOUTS}
          // Mobile fromJson falls back to `list` for an unknown/absent value.
          value={block.layout_type ?? "list"}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "general" && (
        <div className="space-y-4">
          {/* Accent title field */}
          <div>
            <label className="mb-1.5 block px-1 text-[13px] font-semibold text-foreground">
              {t("fields.title")}
            </label>
            <input
              type="text"
              value={block.title ?? ""}
              onChange={(e) => setBlock({ title: e.target.value })}
              placeholder={PROVIDERS[effective].label}
              dir="auto"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Source: a link field for the RSS providers and for a LEGACY
              Instagram block, or a server-side OAuth connect flow for Facebook
              Pages, TikTok and Instagram Business Login (the
              `instagram_connected` configuration, plus pre-split `"instagram"`
              blocks already carrying the connected `info` shape — `igMode`
              comes from the block's own `info`, never from the flag). */}
          <GroupedCard>
            {effective === "facebook" ? (
              <GroupedRow
                customIcon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandIconUrl("colored", "facebook.svg")}
                    alt=""
                    className="size-[30px] shrink-0"
                  />
                }
                title={t("socialFeed.facebook.title")}
                trailing={
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={cn(
                        "max-w-40 truncate text-[13px]",
                        facebookConnected ? "text-foreground/60" : "text-foreground/30",
                      )}
                    >
                      {facebookConnected
                        ? facebookInfo.username || facebookInfo.page_id
                        : t("socialFeed.facebook.choosePage")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  </span>
                }
                onClick={() => setPageSheet(true)}
              />
            ) : effective === "tiktok" ? (
              <GroupedRow
                customIcon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandIconUrl("colored", "tiktok.svg")}
                    alt=""
                    className="size-[30px] shrink-0"
                  />
                }
                title={t("socialFeed.tiktok.title")}
                trailing={
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={cn(
                        "max-w-40 truncate text-[13px]",
                        tiktokConnected ? "text-foreground/60" : "text-foreground/30",
                      )}
                    >
                      {tiktokConnected
                        ? tiktokInfo.username || tiktokInfo.connection_id
                        : t("socialFeed.tiktok.chooseAccount")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  </span>
                }
                onClick={() => setTiktokSheet(true)}
              />
            ) : effective === "instagram_connected" || usesInstagramConnect ? (
              <GroupedRow
                customIcon={
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brandIconUrl("colored", "instagram.svg")}
                    alt=""
                    className="size-[30px] shrink-0"
                  />
                }
                title={t("socialFeed.instagram.title")}
                trailing={
                  <span className="flex min-w-0 items-center gap-1">
                    <span
                      className={cn(
                        "max-w-40 truncate text-[13px]",
                        instagramConnected
                          ? "text-foreground/60"
                          : "text-foreground/30",
                      )}
                    >
                      {instagramConnected
                        ? instagramInfo.username || instagramInfo.connection_id
                        : t("socialFeed.instagram.chooseAccount")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  </span>
                }
                onClick={() => setInstagramSheet(true)}
              />
            ) : effective === "instagram" &&
              igMode === "link" &&
              INSTAGRAM_FEED_ENABLED ? null : (
              // ^ Legacy public-scrape Instagram is RETIRED (mobile deleted the
              // business_discovery path — web-implementation-contract §3.4):
              // no link field; the "switchToConnect" row below is the only
              // source control. The link editor survives solely behind a
              // disabled flag, where reconnecting isn't possible.
              <GroupedRow
                Icon={LinkIcon}
                color={PROVIDERS[effective].color}
                title={PROVIDERS[effective].label}
                trailing={
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={PROVIDERS[effective].hint}
                    dir="ltr"
                    // A blank source is the one state neither app can render —
                    // and on mobile a blank Vimeo link is fatal
                    // (`extractId` force-unwraps its regex match). Flag it.
                    aria-invalid={link.trim() === ""}
                    className={cn(
                      "w-44 rounded-lg border bg-foreground/[0.04] px-2 py-1.5 text-end text-[13px] text-foreground outline-none placeholder:text-foreground/30 focus:bg-foreground/[0.07]",
                      link.trim() === ""
                        ? "border-red-500/50"
                        : "border-transparent",
                    )}
                  />
                }
              />
            )}

            {/* Legacy Instagram block, with the replacement available: offer
                the upgrade EXPLICITLY rather than performing it on open. The
                block keeps working through the old `business_discovery` path
                until the user taps this, and only then does `info` change
                shape. Hidden while the flag is off, because the routes behind
                it are not deployed. */}
            {effective === "instagram" &&
              igMode === "link" &&
              INSTAGRAM_FEED_ENABLED && (
                <GroupedRow
                  customIcon={
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandIconUrl("colored", "instagram.svg")}
                      alt=""
                      className="size-[30px] shrink-0"
                    />
                  }
                  title={t("socialFeed.instagram.switchToConnect")}
                  trailing={
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  }
                  onClick={() => setInstagramSheet(true)}
                />
              )}
          </GroupedCard>

          {effective === "instagram" &&
            igMode === "link" &&
            INSTAGRAM_FEED_ENABLED && (
              <p className="px-1 text-xs text-muted-foreground">
                {t("socialFeed.instagram.legacyNotice")}
              </p>
            )}

          <GroupedCard>
            {/* Number of feed posts — min 2, max 20 (mobile NumberPickerBottomSheet) */}
            <GroupedRow
              Icon={Hash}
              color="#a855f7"
              title={t("socialFeed.numberOfPosts")}
              trailing={
                <Stepper value={postsCount} min={2} max={20} onChange={setPostsCount} />
              }
            />

            {/* Show profile overview — Instagram / Facebook (mobile
                additionalSettings). Rendered even when `settings` has not been
                written yet: mobile itself defaults it to
                `configuration.additionalSettings`. */}
            {HAS_PROFILE_SETTINGS[effective] && (
              <GroupedRow
                Icon={UserCircle}
                color={PROVIDERS[effective].color}
                title={t("socialFeed.showProfileOverview")}
                trailing={
                  <ToggleSwitch
                    // While a switch is pending the block can't hold the value
                    // (it isn't that provider yet) — local state holds it and
                    // the connect stamp writes it.
                    checked={pendingProvider ? pendingShowProfile : showProfile}
                    onChange={(v) =>
                      pendingProvider
                        ? setPendingShowProfile(v)
                        : setBlock({
                            settings: { ...(settings ?? {}), show_profile_details: v },
                          })
                    }
                  />
                }
              />
            )}

            {/* Duplicate */}
            <GroupedRow
              Icon={Copy}
              color="#7c3aed"
              title={t("fields.duplicate")}
              onClick={() => addBlock({ ...block, id: crypto.randomUUID() })}
            />

            {/* Background color */}
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#000000")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>
        </div>
      )}

      {/* `value` (the sheet's current selection) only exists when the block
          already IS that provider — with the connect-first guard the sheets
          also open from a block still on ANOTHER provider, whose info keys
          (e.g. a TikTok connection_id) must not masquerade as a selection. */}
      {pageSheet && (
        <FacebookPageSheet
          value={
            configuration === "facebook" && facebookConnected
              ? (facebookInfo as FacebookFeedInfo)
              : null
          }
          onSelect={setFacebookInfo}
          onClose={() => setPageSheet(false)}
        />
      )}

      {tiktokSheet && (
        <TiktokConnectSheet
          value={
            configuration === "tiktok" && tiktokConnected
              ? (tiktokInfo as TiktokFeedInfo)
              : null
          }
          onSelect={setTiktokInfo}
          onClose={() => setTiktokSheet(false)}
        />
      )}

      {instagramSheet && (
        <InstagramConnectSheet
          value={
            configuration === "instagram_connected" && instagramConnected
              ? (instagramInfo as InstagramConnectedFeedInfo)
              : null
          }
          onSelect={setInstagramInfo}
          onClose={() => setInstagramSheet(false)}
        />
      )}
    </div>
  );
}

// ─── Number stepper (mobile NumberPickerBottomSheet, min 2 / max 20) ──────────

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations("builder");
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={t("socialFeed.decrease")}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground disabled:opacity-30"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
      </button>
      <span className="min-w-7 rounded-lg bg-primary/20 px-2.5 py-1 text-center text-sm font-semibold text-primary">
        {value}
      </span>
      <button
        type="button"
        aria-label={t("socialFeed.increase")}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="flex size-7 items-center justify-center rounded-lg bg-foreground/[0.06] text-foreground disabled:opacity-30"
      >
        <ChevronRight className="size-4 rtl:rotate-180" />
      </button>
    </div>
  );
}

