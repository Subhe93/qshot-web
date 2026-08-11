"use client";

import { useEffect, useState } from "react";
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
  FeedConfiguration,
  LinkFeedConfiguration,
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
 * · INSTAGRAM_FEED_ENABLED — product + deployment, not parse safety. Mobile
 *   commit 20941620 commented Instagram out of the selector: the old entry used
 *   the public `business_discovery` path (username + one shared qshot token),
 *   replaced by "Business Login for Instagram", a per-user OAuth connect flow
 *   with the same shape as Facebook. What the flag now gates is that
 *   REPLACEMENT — and it stays off until the server ships it (as of 2026-08-06
 *   `instagram/connect` and `instagram/feed` are not deployed on either host).
 *   The configuration VALUE is unchanged and needs no safety gate: every
 *   shipped build parses `"instagram"`.
 *
 * All three now read from `NEXT_PUBLIC_*` env vars (default: all off), so
 * enabling a provider is a deployment decision — see feature-flags.ts.
 *
 * In every case an EXISTING block keeps its provider visible and fully
 * editable, so the user can still edit it and switch away — mobile keeps
 * `InstagramFeedConfiguration` registered for exactly that reason.
 *
 * Mobile's final new-block order is youtube, vimeo, facebook, tiktok.
 */

/**
 * ── Instagram has ONE configuration and TWO `info` shapes ────────────────────
 *
 * See `InstagramFeedInfo` in lib/types/blocks.ts. Both are stored under
 * `configuration: "instagram"`:
 *
 *   "link"      legacy → `{ link, username }`   — public `business_discovery`
 *   "connected" new    → `{ connection_id, ig_user_id, username }` — OAuth
 *
 * The editor picks its UI from the block's OWN `info`, never from the flag, so
 * a saved legacy block opens on the legacy link field and is never silently
 * rewritten. The flag only decides what a *fresh* Instagram block becomes.
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
 * Only a block with NO evidence either way (empty `info`, e.g. a stub written
 * by an old catalog seed) falls through to the flag.
 */
function instagramMode(info: Record<string, unknown>): InstagramMode {
  if ("connection_id" in info) return "connected";
  if ("link" in info || "username" in info) return "link";
  return INSTAGRAM_FEED_ENABLED ? "connected" : "link";
}

/** The providers every released mobile build can parse. Order = mobile `FeedConfiguration.all`. */
const LINK_PROVIDERS: LinkFeedConfiguration[] = ["youtube", "vimeo", "instagram"];

/** Display order — mobile `FeedConfiguration.all`. Gating is applied on top. */
const PROVIDER_ORDER: FeedConfiguration[] = [
  ...LINK_PROVIDERS,
  "facebook",
  "tiktok",
];

/** Offered for a NEW selection? An existing block's own provider is always added. */
const OFFERED: Record<FeedConfiguration, boolean> = {
  youtube: true,
  vimeo: true,
  instagram: INSTAGRAM_FEED_ENABLED,
  facebook: FACEBOOK_FEED_ENABLED,
  tiktok: TIKTOK_FEED_ENABLED,
};

// Provider metadata mirrors the mobile FeedConfiguration subclasses
// (Youtube / Vimeo / Instagram) plus the two connect-flow providers — the
// Meta-backed Facebook Page feed and TikTok — whose `info` is gathered through
// a server-side OAuth flow instead of a link field.
// `defaultTitle` is the mobile `defaultTitleValue`, stamped onto the block when
// the user picks a provider (mobile does the same in block_selector_sheet).
const PROVIDERS: Record<
  FeedConfiguration,
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
};

const DEFAULT_TITLES = Object.values(PROVIDERS).map((p) => p.defaultTitle);

function isFeedConfiguration(value: unknown): value is FeedConfiguration {
  return typeof value === "string" && value in PROVIDERS;
}

// Layout picker: YouTube / Vimeo (mobile layoutOptions != null), the Facebook
// Page feed and TikTok — the catalog entry for `tiktok` states it "renders as a
// video feed … so it honours layout_type (list / swiper / grid) like the
// YouTube and Vimeo blocks".
//
// `instagram` is false for BOTH of its info shapes. The legacy one renders
// through mobile `InstagramProfile` (a fixed 2-column grid, no layout options)
// and so does `SocialFeedBlockView`, which keys off `configuration` alone. The
// connected shape is planned to reuse `PostFeedContent`, but no mobile code
// registers it yet, so its `layoutOptions` are unknown — and offering a picker
// that neither renderer honours would be a lie. Revisit when mobile lands it.
const HAS_LAYOUT: Record<FeedConfiguration, boolean> = {
  youtube: true,
  vimeo: true,
  instagram: false,
  facebook: true,
  tiktok: true,
};

// Configurations that carry a `settings` map with show_profile_details
// (mobile `additionalSettings`). `TiktokFeedConfiguration` does not override
// `additionalSettings`, so it inherits the base class's `null` → no settings.
const HAS_PROFILE_SETTINGS: Record<FeedConfiguration, boolean> = {
  youtube: false,
  vimeo: false,
  instagram: true,
  facebook: true,
  tiktok: false,
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

const BASE_INFO_FAMILY: Record<FeedConfiguration, InfoFamily> = {
  youtube: "link",
  vimeo: "link",
  // Overridden per-shape by infoFamily() — legacy Instagram IS a link provider.
  instagram: "link",
  facebook: "facebook",
  tiktok: "tiktok",
};

/**
 * Instagram is the one provider whose family depends on the block, not just on
 * the configuration: its legacy shape is a link (`youtube ↔ vimeo ↔ instagram`
 * may swap `info` freely, as they always could), while its connected shape
 * holds an OAuth connection that means nothing to anyone else.
 */
function infoFamily(
  configuration: FeedConfiguration,
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
const REQUIRED_INFO_KEYS: Record<FeedConfiguration, string[]> = {
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
};

/**
 * Business Login shape (server-contract.md §2.3): `connection_id` is required,
 * `ig_user_id` is "a redundant safety check against the connection" and hence
 * optional — but written anyway, empty string included, exactly like TikTok's
 * `open_id`. `username` is required by BOTH shapes, which is what lets an old
 * build handed a connected block still resolve the same account.
 */
const INSTAGRAM_CONNECTED_INFO_KEYS = ["connection_id", "ig_user_id", "username"];

function requiredInfoKeys(
  configuration: FeedConfiguration,
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
  configuration: FeedConfiguration,
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
  configuration: FeedConfiguration,
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
  const configuration: FeedConfiguration = isFeedConfiguration(block.configuration)
    ? block.configuration
    : "youtube";
  const hasLayout = HAS_LAYOUT[configuration];

  const [tab, setTab] = useState<Tab>(hasLayout ? "layout" : "general");
  const [pageSheet, setPageSheet] = useState(false);
  const [tiktokSheet, setTiktokSheet] = useState(false);
  const [instagramSheet, setInstagramSheet] = useState(false);

  const setBlock = (patch: Partial<SocialFeedBlock>) => updateBlock(block.id, patch);

  const info = block.info ?? {};

  // Which Instagram UI this particular block gets — read from its own `info`,
  // so a saved legacy block opens on the legacy link field no matter what the
  // flag says, and a connected block stays editable even while the flag is off.
  const igMode = instagramMode(info);

  // Repair-on-open: a block added from the block catalog arrives as
  // `{configuration:"instagram", info:{}}` with no settings/posts_count, and
  // that empty `info` is exactly what makes the mobile FeedDisplayCubit throw
  // during build. Writing the missing keys (and only the missing ones — a
  // well-formed mobile block produces no patch, hence no spurious dirty flag)
  // downgrades that crash to the cubit's catchable "couldn't load" state.
  useEffect(() => {
    const patch: Partial<SocialFeedBlock> = {};
    if (block.configuration !== configuration) patch.configuration = configuration;
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

  function setConfiguration(next: FeedConfiguration) {
    // Re-picking the current provider must be inert. Without this, an Instagram
    // block would compare its own family against the family a FRESH Instagram
    // block would get and, with the flag on, "cross" from link to connected —
    // wiping a saved legacy block's `info` on a stray tap.
    if (next === configuration) return;
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
    // The target family is computed from an EMPTY `info` because that is what a
    // newly picked provider starts from — for Instagram that resolves through
    // the flag, i.e. picking Instagram today lands on the connect flow.
    const crossesFamily = infoFamily(next, {}) !== infoFamily(configuration, info);
    const nextInfo = normalizeInfo(next, crossesFamily ? {} : info);
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

  /** Writes the exact Facebook contract shape into `info`. */
  function setFacebookInfo(value: FacebookFeedInfo) {
    setBlock({
      info: {
        connection_id: value.connection_id,
        page_id: value.page_id,
        username: value.username,
      },
    });
  }

  /** Writes the exact TikTok contract shape into `info` (catalog 2026-08-03). */
  function setTiktokInfo(value: TiktokFeedInfo) {
    setBlock({
      info: {
        connection_id: value.connection_id,
        open_id: value.open_id,
        username: value.username,
      },
    });
  }

  /**
   * Writes the exact Business Login contract shape into `info`
   * (server-contract.md §1 + plan.md §4). This is the ONE place a legacy block
   * turns into a connected one — a deliberate, user-initiated action from the
   * connect sheet — which is why `link` is dropped here and never on open.
   */
  function setInstagramInfo(value: InstagramConnectedFeedInfo) {
    setBlock({
      info: {
        connection_id: value.connection_id,
        ig_user_id: value.ig_user_id,
        username: value.username,
      },
    });
  }

  function setLink(value: string) {
    // Write the provider-specific key mobile reads (channel_id / username),
    // derived from the link the way mobile derives it, plus `link` itself.
    const next: Record<string, unknown> = { ...info, link: value };
    if (configuration === "youtube") next.channel_id = youtubeChannelId(value);
    if (configuration === "instagram") next.username = instagramUsername(value);
    setBlock({ info: next });
  }

  function setPostsCount(value: number) {
    setBlock({ posts_count: Math.min(20, Math.max(2, value)) });
  }

  // Offered providers, in mobile's `FeedConfiguration.all` order, plus this
  // block's own provider even when it is gated off — so an existing instagram /
  // facebook / tiktok block stays editable AND switchable.
  const providerOptions: FeedConfiguration[] = PROVIDER_ORDER.filter(
    (p) => OFFERED[p] || p === configuration,
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
              configuration === p ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
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
              placeholder={PROVIDERS[configuration].label}
              dir="auto"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          {/* Source: a link field for the RSS providers and for a LEGACY
              Instagram block, or a server-side OAuth connect flow for Facebook
              Pages, TikTok and Instagram Business Login. Instagram is the only
              one that can be either — `igMode` comes from the block's own
              `info`, never from the flag. */}
          <GroupedCard>
            {configuration === "facebook" ? (
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
                        : t("socialFeed.facebook.notConnected")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  </span>
                }
                onClick={() => setPageSheet(true)}
              />
            ) : configuration === "tiktok" ? (
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
                        : t("socialFeed.tiktok.notConnected")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  </span>
                }
                onClick={() => setTiktokSheet(true)}
              />
            ) : configuration === "instagram" && igMode === "connected" ? (
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
                        : t("socialFeed.instagram.notConnected")}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-foreground/25 rtl:rotate-180" />
                  </span>
                }
                onClick={() => setInstagramSheet(true)}
              />
            ) : (
              <GroupedRow
                Icon={LinkIcon}
                color={PROVIDERS[configuration].color}
                title={PROVIDERS[configuration].label}
                trailing={
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={PROVIDERS[configuration].hint}
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
            {configuration === "instagram" &&
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

          {configuration === "instagram" &&
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
            {HAS_PROFILE_SETTINGS[configuration] && (
              <GroupedRow
                Icon={UserCircle}
                color={PROVIDERS[configuration].color}
                title={t("socialFeed.showProfileOverview")}
                trailing={
                  <ToggleSwitch
                    checked={showProfile}
                    onChange={(v) =>
                      setBlock({
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

      {pageSheet && (
        <FacebookPageSheet
          value={facebookConnected ? (facebookInfo as FacebookFeedInfo) : null}
          onSelect={setFacebookInfo}
          onClose={() => setPageSheet(false)}
        />
      )}

      {tiktokSheet && (
        <TiktokConnectSheet
          value={tiktokConnected ? (tiktokInfo as TiktokFeedInfo) : null}
          onSelect={setTiktokInfo}
          onClose={() => setTiktokSheet(false)}
        />
      )}

      {instagramSheet && (
        <InstagramConnectSheet
          value={
            instagramConnected
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

