"use client";

import { useEffect, useMemo, useState } from "react";
import type { SocialFeedBlock } from "@/lib/types/blocks";
import {
  getInstagramConnectedFeed,
  type PostFeed as PostFeedData,
  type PostFeedItem,
  type PostFeedProfile,
} from "@/lib/api/instagram";
import { getFacebookFeed } from "@/lib/api/meta";
import {
  extractVimeoId,
  getVimeoFeed,
  getYoutubeFeed,
  type VideoFeed,
  type VideoFeedItem,
} from "@/lib/api/rss-feeds";
import { getTiktokFeed } from "@/lib/api/tiktok";
import { dirOf } from "@/lib/builder/text-direction";
import { useDesktopPreview, DESKTOP_BLOCK_TITLE } from "../desktop-preview";

/**
 * Read-only preview of a SocialFeedModule, mirroring the mobile `FeedWidget`
 * (mobile `origin/feature/template-sites`, catalog 2026-08-12).
 *
 * Mobile routing (`editor/feed_widget.dart` · `_FeedContent._buildContent`):
 *
 *  - `youtube` / `vimeo`        → `RSSContent` (landscape 16:9 video cards —
 *                                  unchanged from the previous catalog).
 *  - `tiktok`                   → `TiktokFeedContent` (NEW): portrait 9:14
 *                                  TikTok-styled cover cards on black, NOT the
 *                                  landscape treatment it used to share with
 *                                  YouTube/Vimeo. Tapping opens the video on
 *                                  TikTok (display rules require linking out).
 *  - `facebook` /
 *    `instagram_connected`      → `PostFeedContent` (REWORKED): profile byline
 *                                  (`settings.show_profile_details`) + a
 *                                  vertical stack of native-looking post cards
 *                                  with caption, media and a Like/Comment/Share
 *                                  affordance row. Badge, media crop and action
 *                                  icons adapt to the platform.
 *  - legacy `instagram`         → RETIRED: the business_discovery path was
 *                                  deleted (web-implementation-contract §3.4);
 *                                  a `{link, username}` block renders a
 *                                  reconnect hint, never the old fake grid.
 *
 * Like the mobile widget (`FeedDisplayCubit` + `FeedRepository`), the preview
 * fetches the LIVE feed and renders the real posts — `useFeedData` below, with
 * the same per-configuration cache keys and 10-minute TTL. YouTube/Vimeo come
 * from public RSS (via `/api/feed-proxy` — the browser can't reach the XML
 * hosts cross-origin), and the connect-flow providers come from their PUBLIC
 * feed routes (`meta/feed`, `instagram-integration/feed`,
 * `tiktok-integration/feed` — keyed by the unguessable `connection_id`, no
 * bearer, see `src/lib/api/instagram.ts` on why they bypass the shared client).
 *
 * The representative placeholder tiles remain as the loading / error / empty
 * state — and for blocks whose identifiers are still blank — matching the
 * mobile dimensions, ratios, colors and spacing precisely.
 *
 * Shared chrome (`FeedWidget.build`):
 *  - Header: title at horizontal 24, headlineMedium bold.
 *  - Trailing divider at horizontal 20, indent/endIndent 8, foreground @ 0.2.
 *
 * `posts_count` (default 4 — mobile `postsCount` default) caps the tile count.
 * Mobile fetches the FULL feed and slices client-side (`VideoFeed.take` /
 * `PostFeed.take`) so changing `posts_count` never refetches; same here.
 *
 * `instagram` carries two `info` shapes: the connected one (`connection_id`
 * present — the web builder stamps it under this value while the validator's
 * enum has no `instagram_connected`) renders through the shared PostFeed; the
 * legacy `{link, username}` shape is retired (see above) and renders the
 * reconnect hint.
 */
// Mobile FeedConfiguration.defaultTitleValue — used when no title is set.
const DEFAULT_FEED_TITLE: Record<string, string> = {
  youtube: "YouTube Videos",
  vimeo: "Vimeo Showcase",
  instagram: "Instagram Feed",
  // FacebookFeedConfiguration.defaultTitleValue is plain "Facebook".
  facebook: "Facebook",
  // TiktokFeedConfiguration.defaultTitleValue is plain "TikTok" (not "… Feed").
  tiktok: "TikTok",
  // InstagramConnectedFeedConfiguration.defaultTitleValue.
  instagram_connected: "Instagram",
};

const FACEBOOK_BLUE = "#1877F2";
// tiktok_feed_content.dart — brand accents for the badge + bottom hairline.
const TIKTOK_CYAN = "#25F4EE";
const TIKTOK_PINK = "#FE2C55";
// post_feed_content.dart `_instagramGradient` (topLeft → bottomRight).
const INSTAGRAM_GRADIENT =
  "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF)";
// Mobile AppColors — the post cards sit on a FIXED light surface regardless of
// the site theme (Material(color: AppColors.background)), so the ink inside
// them is fixed too rather than using the site's foreground token.
const CARD_BG = "#F2F2F7"; // AppColors.background
const AVATAR_BG = "#E4E7ED"; // AppColors.grey.shade100
/** AppColors.black (0xFF1F1F26) at the given alpha. */
const ink = (alpha: number) => `rgba(31,31,38,${alpha})`;

// ─── Live feed data (mobile FeedDisplayCubit + FeedRepositoryImpl) ───────────

type FeedData =
  | { kind: "videos"; feed: VideoFeed }
  | { kind: "posts"; feed: PostFeedData };

type FeedState =
  /** Nothing to fetch: blank identifiers, legacy `instagram`, unknown value. */
  | { status: "placeholder" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "data"; data: FeedData };

/** Mobile `FeedRepositoryImpl._ttl` — 10 minutes. */
const FEED_TTL_MS = 10 * 60_000;

/**
 * Module-level memo shared by every rendered feed block, so the same feed used
 * twice (or re-mounted while editing) is only fetched once — the web analogue
 * of the singleton `FeedRepositoryImpl` cache. Only successes are stored;
 * errors retry on the next mount, like a fresh `FeedDisplayCubit.load()`.
 */
const feedCache = new Map<string, { data: FeedData; expiresAt: number }>();

function peekFeedCache(key: string): FeedData | null {
  const entry = feedCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    feedCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * The fetch + cache key for a block, or null when there is nothing to fetch.
 * Keys mirror mobile `FeedRepository.*Key` exactly; identifier reads mirror
 * `FeedDisplayCubit._fetch` (blank values, which would crash mobile, resolve
 * to null here so the placeholder chrome stays up instead).
 */
function feedRequest(
  configuration: string,
  info: Record<string, unknown> | undefined,
): { key: string; run: () => Promise<FeedData> } | null {
  const s = (k: string) => {
    const v = info?.[k];
    return typeof v === "string" ? v.trim() : "";
  };
  switch (configuration) {
    case "youtube": {
      const channelId = s("channel_id");
      if (!channelId) return null;
      return {
        key: `youtube:${channelId}`,
        run: async () => ({ kind: "videos", feed: await getYoutubeFeed(channelId) }),
      };
    }
    case "vimeo": {
      // Mobile keys on the EXTRACTED id (`FeedDisplayCubit._vimeoId`).
      const vimeoId = extractVimeoId(s("link"));
      if (!vimeoId) return null;
      return {
        key: `vimeo:${vimeoId}`,
        run: async () => ({ kind: "videos", feed: await getVimeoFeed(vimeoId) }),
      };
    }
    case "facebook": {
      const connectionId = s("connection_id");
      const pageId = s("page_id");
      if (!connectionId || !pageId) return null;
      return {
        key: `facebook:${connectionId}:${pageId}`,
        run: async () => ({
          kind: "posts",
          feed: await getFacebookFeed(connectionId, pageId),
        }),
      };
    }
    case "tiktok": {
      const connectionId = s("connection_id");
      if (!connectionId) return null;
      // `open_id` rides along but is NOT part of the key — mobile
      // `FeedRepository.tiktokKey` keys on the connection alone.
      const openId = s("open_id");
      return {
        key: `tiktok:${connectionId}`,
        run: async () => ({
          kind: "videos",
          feed: await getTiktokFeed(connectionId, openId || undefined),
        }),
      };
    }
    // `"instagram"` with the CONNECTED info shape (connection_id present) is
    // how the web writes Business Login blocks while the deployed validator's
    // enum lacks `instagram_connected` (user decision 2026-08-21) — same
    // fetch, same key family. A legacy `{link, username}` instagram block has
    // no connection_id and falls through to null → placeholder, as before.
    case "instagram":
    case "instagram_connected": {
      const connectionId = s("connection_id");
      if (!connectionId) return null;
      // `ig_user_id` is mobile's "redundant safety check" — sent, not keyed.
      const igUserId = s("ig_user_id");
      return {
        key: `instagram_connected:${connectionId}`,
        run: async () => ({
          kind: "posts",
          feed: await getInstagramConnectedFeed(connectionId, igUserId || undefined),
        }),
      };
    }
    default:
      return null;
  }
}

/** The state a key renders as before its fetch settles (or with no fetch). */
function initialFeedState(req: { key: string } | null): FeedState {
  if (!req) return { status: "placeholder" };
  const cached = peekFeedCache(req.key);
  // Cache hit renders without a loading flicker — mobile `FeedRepository.peek`
  // in the FeedDisplayCubit constructor.
  return cached ? { status: "data", data: cached } : { status: "loading" };
}

/**
 * Fetches the block's live feed, memoized like mobile: placeholder for
 * unfetchable configs, a cache hit renders instantly, otherwise
 * loading → data | error. Placeholder/cache/loading are derived at render
 * time (the documented "adjust state when props change" reset — the fetch
 * key doubles as the marker of which key the stored state belongs to);
 * the effect only runs the network fetch, and results landing after the
 * block changed providers are dropped via its cleanup flag.
 */
function useFeedData(block: SocialFeedBlock): FeedState {
  const configuration: string = block.configuration;
  const info = block.info;
  const req = useMemo(() => feedRequest(configuration, info), [configuration, info]);
  const key = req?.key ?? null;

  const [state, setState] = useState<{ key: string | null; value: FeedState }>(
    () => ({ key, value: initialFeedState(req) }),
  );
  if (state.key !== key) {
    setState({ key, value: initialFeedState(req) });
  }

  useEffect(() => {
    if (!req || peekFeedCache(req.key)) return;
    let stale = false;
    req.run().then(
      (data) => {
        if (stale) return;
        feedCache.set(req.key, { data, expiresAt: Date.now() + FEED_TTL_MS });
        setState({ key: req.key, value: { status: "data", data } });
      },
      () => {
        if (!stale) setState({ key: req.key, value: { status: "error" } });
      },
    );
    return () => {
      stale = true;
    };
  }, [req]);

  // While the render-time reset above is catching up, report the fresh key's
  // initial state rather than the previous key's leftover value.
  return state.key === key ? state.value : initialFeedState(req);
}

export function SocialFeedBlockView({ block }: { block: SocialFeedBlock }) {
  const desktop = useDesktopPreview();
  // Widened to string: stored documents may carry `instagram_connected`
  // (mobile `InstagramConnectedFeedConfiguration`) even where the
  // `FeedConfiguration` union hasn't caught up yet.
  const configuration: string = block.configuration;
  const title =
    (block.title ?? "").trim() || DEFAULT_FEED_TITLE[configuration] || "";
  const dir = dirOf(title);
  const count = Math.min(20, Math.max(0, block.posts_count ?? 4));
  // Mobile SocialFeedBlock.init default layout is "list".
  const layout = block.layout_type ?? "list";

  const username = (block.info?.["username"] as string | undefined) ?? "";
  // `"instagram"` carrying the connected shape (see feedRequest) renders the
  // PostFeed chrome, not the legacy profile grid.
  const instagramConnectedShape =
    configuration === "instagram" &&
    typeof block.info?.["connection_id"] === "string" &&
    (block.info["connection_id"] as string).trim() !== "";
  const tiles = Array.from({ length: count });

  // Live feed — loading/error/empty keep the placeholder tiles below, so the
  // block always has mobile-faithful chrome no matter what the network does.
  const feed = useFeedData(block);
  const live = feed.status === "data" ? feed.data : null;
  // Mobile slices the full feed to postsCount at render (`VideoFeed.take`).
  const videoItems =
    live?.kind === "videos" && live.feed.items.length > 0
      ? live.feed.items.slice(0, count)
      : null;
  const postData = live?.kind === "posts" && live.feed.items.length > 0 ? live.feed : null;

  return (
    <div className="my-[5px] py-2">
      {/* Title — mobile: horizontal 24, headlineMedium bold; desktop = Nuxt
          shared module title (Modules.vue h3.text-2xl, 400, no extra pad). */}
      {title ? (
        <div className={desktop ? undefined : "px-6"} dir={dir}>
          <h2
            className={
              desktop
                ? `${DESKTOP_BLOCK_TITLE} text-foreground`
                : "text-[22px] font-bold leading-tight text-foreground"
            }
          >
            {title}
          </h2>
        </div>
      ) : null}

      <div className="h-[5px]" />

      {configuration === "instagram" && !instagramConnectedShape ? (
        // Legacy public-scrape Instagram is RETIRED (mobile deleted the
        // business_discovery path — web-implementation-contract §3.4): render
        // a reconnect hint, not the old fake profile grid. The published Nuxt
        // site renders nothing for this shape.
        <LegacyInstagramRetired />
      ) : configuration === "tiktok" ? (
        <TikTokFeed tiles={tiles} layout={layout} items={videoItems} />
      ) : configuration === "facebook" ||
        configuration === "instagram_connected" ||
        instagramConnectedShape ? (
        <PostFeed
          tiles={tiles}
          platform={configuration === "facebook" ? "facebook" : "instagram"}
          // PostFeedContent defaults show_profile_details to FALSE (unlike the
          // legacy InstagramProfile path); the configurations write `true`
          // into settings on creation, so this only matters for old blocks.
          showProfileDetails={
            (block.settings?.["show_profile_details"] as boolean | undefined) ??
            false
          }
          name={username}
          feed={postData}
        />
      ) : (
        <RssFeed tiles={tiles} layout={layout} items={videoItems} />
      )}

      <div className="h-[5px]" />

      {/* Divider — horizontal 20, indent/endIndent 8, foreground @ 0.2 */}
      <div className="px-5">
        <div className="mx-2 h-px bg-foreground/20" />
      </div>
    </div>
  );
}

// ─── YouTube / Vimeo (RSSContent) ────────────────────────────────────────────

function RssFeed({
  tiles,
  layout,
  items,
}: {
  tiles: unknown[];
  layout: SocialFeedBlock["layout_type"];
  /** Live feed items (already sliced to posts_count); null = placeholder mode. */
  items: VideoFeedItem[] | null;
}) {
  // One card per live item, or one placeholder per tile — same chrome either way.
  const cards: (VideoFeedItem | null)[] = items ?? tiles.map(() => null);

  if (layout === "list") {
    return (
      <div className="flex flex-col px-5">
        {cards.map((item, i) => (
          <div key={i} className="py-[5px]">
            <VideoCard item={item} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-start">
          {cards.map((item, i) => (
            <div key={i} className="px-1">
              {/* SizedBox(height: 148) → width follows 16:9 = ~263 */}
              <div className="h-[148px] w-[263px]">
                <VideoCard fill item={item} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // swiper — AspectRatio (16/9 * 1.1), viewportFraction 0.9 centered card.
  return (
    <div className="w-full" style={{ aspectRatio: (16 / 9) * 1.1 }}>
      <div className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {cards.map((item, i) => (
          <div
            key={i}
            className="flex h-full w-[90%] shrink-0 snap-center items-center justify-center px-1"
          >
            <div className="w-full">
              <VideoCard item={item} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors the mobile `VideoCard` (videos_widget.dart): 16:9 (unless `fill`,
 * which fills the height inside the grid SizedBox), rounded-8, black38 outside
 * border, white-0.2 fill, cover thumbnail, centered 60×60 translucent-white
 * circular play button (30×30 glyph) and a bottom title strip (bodyMedium
 * w600 white, single marquee line → truncated here). With no live item the
 * thumbnail area stays blank and the title is a placeholder bar.
 */
function VideoCard({
  fill = false,
  item = null,
}: {
  fill?: boolean;
  item?: VideoFeedItem | null;
}) {
  return (
    <div
      className={
        fill
          ? "relative size-full overflow-hidden rounded-lg"
          : "relative w-full overflow-hidden rounded-lg"
      }
      style={{
        ...(fill ? {} : { aspectRatio: "16 / 9" }),
        border: "1px solid rgba(0,0,0,0.38)",
        backgroundColor: "rgba(255,255,255,0.2)",
      }}
    >
      {item?.thumbnailUrl ? <FeedImage src={item.thumbnailUrl} /> : null}

      {/* bottom title strip (height 20, bottom 16, start/end 16) */}
      <div className="absolute inset-x-4 bottom-4 h-5">
        {item ? (
          item.title ? (
            <p className="truncate text-sm font-semibold leading-5 text-white">
              {item.title}
            </p>
          ) : null
        ) : (
          <div className="h-3 w-3/5 rounded-full bg-white/40" />
        )}
      </div>

      {/* centered 60×60 translucent-white play circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="flex size-[60px] items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          <PlayGlyph size={30} />
        </span>
      </div>
    </div>
  );
}

/**
 * Cover image for a live feed tile. The URLs are ABSOLUTE (YouTube/Vimeo CDNs,
 * scontent.*, TikTok covers) so they are used as-is — `cdnUrl` is only for the
 * site's own relative asset paths. A failed load hides the element, revealing
 * the placeholder chrome underneath (mobile's `errorWidget`). Not a link: the
 * canvas convention is that block internals never navigate in edit mode
 * (mobile only opens permalinks when `previewEnabled`).
 */
function FeedImage({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      className="absolute inset-0 size-full object-cover"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

// ─── TikTok (TiktokFeedContent) ──────────────────────────────────────────────

/**
 * Placeholder render of `tiktok_feed_content.dart` — portrait 9:14 cover
 * cards on black, the way TikTok itself presents videos, NOT the landscape
 * treatment shared by YouTube/Vimeo. The block's `layout_type` still controls
 * the arrangement, remapped exactly like mobile:
 *
 *  - swiper → TikTok's one-at-a-time swipe: AspectRatio 9/14 viewport,
 *             viewportFraction 0.62 snap slides (mobile also scales the
 *             neighbours to 0.92 — a live-swipe effect we skip in a static
 *             preview).
 *  - list   → a 2-column portrait grid (TikTok's profile grid), 8px gaps,
 *             horizontal 16.
 *  - grid   → a horizontal scroll row of 220-high cards (width 220·9/14),
 *             8px gaps, horizontal 16.
 *
 * On mobile, tapping a card opens the video ON TikTok (`launchUrlExternal`) —
 * TikTok's display rules require linking out — which is a no-op in the builder
 * canvas, like every other feed. Unlike the post feeds, TikTok has NO profile
 * header (`TiktokFeedConfiguration` carries no `show_profile_details`).
 */
function TikTokFeed({
  tiles,
  layout,
  items,
}: {
  tiles: unknown[];
  layout: SocialFeedBlock["layout_type"];
  /** Live feed items (already sliced to posts_count); null = placeholder mode. */
  items: VideoFeedItem[] | null;
}) {
  const cards: (VideoFeedItem | null)[] = items ?? tiles.map(() => null);

  if (layout === "swiper") {
    return (
      <div className="w-full" style={{ aspectRatio: "9 / 14" }}>
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cards.map((item, i) => (
            <div key={i} className="h-full w-[62%] shrink-0 snap-center px-1">
              <TikTokCard item={item} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-start gap-2">
          {cards.map((item, i) => (
            // SizedBox(height: 220, width: 220 * 9 / 14 ≈ 141)
            <div key={i} className="h-[220px] w-[141px] shrink-0">
              <TikTokCard item={item} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // list — 2-column grid, childAspectRatio 9/14, 8px gaps, horizontal 16.
  return (
    <div className="grid grid-cols-2 gap-2 px-4">
      {cards.map((item, i) => (
        <div key={i} style={{ aspectRatio: "9 / 14" }}>
          <TikTokCard item={item} />
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors mobile `_TiktokCard`: rounded-14 black card, cover image (empty
 * state = dim glyph on black), bottom caption over a transparent→black-0.85
 * gradient (2 lines, 12px w600 white — real title when live, bars otherwise),
 * a 26×26 music badge at the top end (black-0.45, 1px cyan-0.6 ring), a
 * centered 46×46 play circle (black-0.3, 1.5px white-0.85 ring, 26px glyph)
 * and a 3px cyan→pink brand hairline along the bottom. Live items always have
 * a thumbnail — `getTiktokFeed` drops the rest, like mobile
 * `VideoFeed.fromNormalizedJson`.
 */
function TikTokCard({ item = null }: { item?: VideoFeedItem | null }) {
  return (
    <div className="relative size-full overflow-hidden rounded-[14px] bg-black">
      {/* empty-thumbnail state: centered dim image glyph (white24) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.24)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      </div>

      {item?.thumbnailUrl ? <FeedImage src={item.thumbnailUrl} /> : null}

      {/* caption over gradient — padding (10, 24, 10, 10) */}
      <div
        className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-6"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))",
        }}
      >
        {item ? (
          <p className="line-clamp-2 text-xs font-semibold leading-[1.3] text-white">
            {item.title}
          </p>
        ) : (
          <>
            <div className="h-2.5 w-11/12 rounded bg-white/50" />
            <div className="mt-1 h-2.5 w-3/5 rounded bg-white/30" />
          </>
        )}
      </div>

      {/* TikTok note badge — top end, 26×26 */}
      <span
        className="absolute end-2 top-2 flex size-[26px] items-center justify-center rounded-full"
        style={{
          backgroundColor: "rgba(0,0,0,0.45)",
          border: `1px solid rgba(37,244,238,0.6)`,
        }}
      >
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </span>

      {/* centered 46×46 play circle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="flex size-[46px] items-center justify-center rounded-full"
          style={{
            backgroundColor: "rgba(0,0,0,0.3)",
            border: "1.5px solid rgba(255,255,255,0.85)",
          }}
        >
          <PlayGlyph size={26} />
        </span>
      </div>

      {/* 3px cyan→pink brand hairline */}
      <div
        className="absolute inset-x-0 bottom-0 h-[3px]"
        style={{
          background: `linear-gradient(to right, ${TIKTOK_CYAN}, ${TIKTOK_PINK})`,
        }}
      />
    </div>
  );
}

function PlayGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

// ─── Facebook / Instagram connected (PostFeedContent) ────────────────────────

type PostPlatform = "facebook" | "instagram";

/**
 * Per-platform look-and-feel, mirroring mobile `_Brand`
 * (post_feed_content.dart): badge icon + background, media crop, and the
 * engagement action row. `_Brand.of` derives it from the feed profile's
 * `platform`; here the configuration already tells us
 * (facebook → facebook, instagram_connected → instagram).
 */
const POST_BRAND: Record<
  PostPlatform,
  {
    /** CSS aspect-ratio of the media area. */
    aspect: string;
    /** CSS background of the byline badge circle. */
    badgeBackground: string;
    actions: readonly { icon: ActionIconName; label: string }[];
  }
> = {
  facebook: {
    aspect: "4 / 3", // Facebook's typical link/photo post crop.
    badgeBackground: FACEBOOK_BLUE,
    actions: [
      { icon: "thumbsUp", label: "Like" },
      { icon: "comment", label: "Comment" },
      { icon: "shareFromSquare", label: "Share" },
    ],
  },
  instagram: {
    aspect: "1 / 1", // Instagram posts are square.
    badgeBackground: INSTAGRAM_GRADIENT,
    actions: [
      { icon: "heart", label: "Like" },
      { icon: "comment", label: "Comment" },
      { icon: "paperPlane", label: "Share" },
    ],
  },
};

/**
 * The reworked `PostFeedContent` — shared by `facebook` (info
 * `{connection_id, page_id}`) and `instagram_connected` (info
 * `{connection_id, ig_user_id}`): an optional profile byline
 * (`settings.show_profile_details`), then a VERTICAL STACK of post cards
 * capped by `posts_count` (`PostFeed.take`). Mobile renders the same stack for
 * every `layout_type` — the post feed has no swiper/grid variants — so the
 * preview does too.
 *
 * With a live feed the cards carry the real caption/media/byline; mobile
 * derives the brand from `profile.platform` (`_Brand.of`) but the server sets
 * it to exactly what the configuration already tells us, so the prop stands.
 * On mobile a card tap opens the post's permalink; a no-op on the canvas.
 */
function PostFeed({
  tiles,
  platform,
  showProfileDetails,
  name,
  feed,
}: {
  tiles: unknown[];
  platform: PostPlatform;
  showProfileDetails: boolean;
  name: string;
  /** Live feed (unsliced); null = placeholder mode. */
  feed: PostFeedData | null;
}) {
  // tiles.length is the clamped posts_count.
  const cards: (PostFeedItem | null)[] = feed
    ? feed.items.slice(0, tiles.length)
    : tiles.map(() => null);
  // Mobile hides the byline entirely when the live feed has no profile.
  const byline = feed ? (feed.profile ? feed.profile : null) : undefined;
  return (
    <div>
      {showProfileDetails && byline !== null && (
        <PostByline platform={platform} name={name} profile={byline ?? null} />
      )}
      {cards.map((item, i) => (
        // Card padding — EdgeInsets.fromLTRB(16, 0, 16, 12)
        <div key={i} className="px-4 pb-3">
          <PostCard
            platform={platform}
            name={name}
            item={item}
            profile={feed ? (feed.profile ?? null) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

/** Mobile post_feed_content.dart `_formatCount` — 1.2K / 3.4M. */
function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

/**
 * Mobile `_ProfileByline`: 44px avatar with a brand badge overlapping its
 * bottom end (white 3px ring around a 4px-padded brand circle, 11px glyph),
 * then name (bodyLarge bold) and a follower count (bodySmall, fixed
 * AppColors.black 0.5 — NOT the site foreground token, matching mobile). With
 * a live profile the row shows the real avatar/name/count; the follower row is
 * omitted when the server sends no count (mobile `if (followers != null)`),
 * and stays a placeholder bar in placeholder mode.
 */
function PostByline({
  platform,
  name,
  profile,
}: {
  platform: PostPlatform;
  name: string;
  /** Live profile; null = placeholder mode. */
  profile: PostFeedProfile | null;
}) {
  const displayName = profile ? profile.name : name;
  return (
    <div className="flex items-center gap-2.5 px-4 pb-3">
      <span className="relative shrink-0">
        <span
          className="block size-11 overflow-hidden rounded-full"
          style={{ backgroundColor: AVATAR_BG }}
        >
          {profile?.avatar_url ? (
            <span className="relative block size-full">
              <FeedImage src={profile.avatar_url} />
            </span>
          ) : null}
        </span>
        {/* PositionedDirectional(bottom: -2, end: -2) */}
        <span className="absolute -bottom-0.5 -end-0.5 block rounded-full bg-white p-[3px]">
          <span
            className="flex items-center justify-center rounded-full p-1"
            style={{ background: POST_BRAND[platform].badgeBackground }}
          >
            <BrandGlyph platform={platform} size={11} />
          </span>
        </span>
      </span>
      <div className="min-w-0 flex-1">
        {displayName ? (
          <p className="truncate text-base font-bold text-foreground">
            {displayName}
          </p>
        ) : (
          <div className="h-4 w-28 rounded bg-foreground/20" />
        )}
        {profile ? (
          profile.followers_count != null ? (
            <p className="truncate text-xs" style={{ color: ink(0.5) }}>
              {formatCount(profile.followers_count)} followers
            </p>
          ) : null
        ) : (
          // "1.2K followers" on mobile — unknown here, so a placeholder bar.
          <div className="mt-1.5 h-3 w-20 rounded bg-foreground/10" />
        )}
      </div>
    </div>
  );
}

/**
 * Mobile `_PostCard`: rounded-14 card on the FIXED light AppColors.background
 * surface (no border) containing — page row (24px avatar + 12px w700 name,
 * padding 12/10/12/6; mobile hides the row when the feed has no profile),
 * caption (bodyMedium ×4 lines max, padding 12/2/12/10; mobile skips it when
 * blank), the media crop, a 1px ink-0.08 divider, and three equal
 * Like/Comment/Share affordances (14px icon + bodySmall w600 label,
 * ink 0.55, 10px vertical padding). The affordances are purely visual on
 * mobile too — the whole card is one tap target.
 */
function PostCard({
  platform,
  name,
  item = null,
  profile,
}: {
  platform: PostPlatform;
  name: string;
  /** Live post; null = placeholder mode. */
  item?: PostFeedItem | null;
  /**
   * Live feed profile (mobile passes `pageName`/`pageAvatarUrl` from it);
   * undefined = placeholder mode, null = live feed without a profile.
   */
  profile?: PostFeedProfile | null;
}) {
  const brand = POST_BRAND[platform];
  const live = item != null;
  const pageName = live ? (profile?.name ?? "") : name;
  const caption = live ? (item.caption ?? "").trim() : "";
  return (
    <div
      className="overflow-hidden rounded-[14px]"
      style={{ backgroundColor: CARD_BG }}
    >
      {/* page row — EdgeInsets.fromLTRB(12, 10, 12, 6) */}
      {live && !profile ? null : (
        <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
          <span
            className="relative size-6 shrink-0 overflow-hidden rounded-full"
            style={{ backgroundColor: AVATAR_BG }}
          >
            {profile?.avatar_url ? <FeedImage src={profile.avatar_url} /> : null}
          </span>
          {pageName ? (
            <p
              className="min-w-0 flex-1 truncate text-xs font-bold"
              style={{ color: ink(0.9) }}
            >
              {pageName}
            </p>
          ) : (
            <span
              className="block h-2.5 w-24 rounded"
              style={{ backgroundColor: ink(0.2) }}
            />
          )}
        </div>
      )}

      {/* caption — EdgeInsets.fromLTRB(12, 2, 12, 10) */}
      {live ? (
        caption ? (
          <div className="px-3 pb-2.5 pt-0.5">
            <p
              className="line-clamp-4 text-sm leading-[1.35]"
              style={{ color: ink(0.9) }}
            >
              {caption}
            </p>
          </div>
        ) : null
      ) : (
        <div className="space-y-1.5 px-3 pb-2.5 pt-0.5">
          <div
            className="h-2.5 w-11/12 rounded"
            style={{ backgroundColor: ink(0.15) }}
          />
          <div
            className="h-2.5 w-3/5 rounded"
            style={{ backgroundColor: ink(0.1) }}
          />
        </div>
      )}

      {/* media — 4:3 for Facebook, square for Instagram */}
      <div
        className="relative w-full bg-black/10"
        style={{ aspectRatio: brand.aspect }}
      >
        {item?.thumbnail_url ? <FeedImage src={item.thumbnail_url} /> : null}
      </div>

      <div className="h-px" style={{ backgroundColor: ink(0.08) }} />

      {/* engagement affordances */}
      <div className="flex">
        {brand.actions.map(({ icon, label }) => (
          <span
            key={label}
            className="flex flex-1 items-center justify-center gap-1.5 py-2.5"
          >
            <ActionGlyph name={icon} size={14} color={ink(0.55)} />
            <span
              className="text-xs font-semibold"
              style={{ color: ink(0.55) }}
            >
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

type ActionIconName = "thumbsUp" | "comment" | "shareFromSquare" | "heart" | "paperPlane";

const ACTION_PATHS: Record<ActionIconName, React.ReactNode> = {
  thumbsUp: (
    <>
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </>
  ),
  comment: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  shareFromSquare: (
    <>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" x2="12" y1="2" y2="15" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  paperPlane: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
};

function ActionGlyph({
  name,
  size,
  color,
}: {
  name: ActionIconName;
  size: number;
  color: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ACTION_PATHS[name]}
    </svg>
  );
}

function BrandGlyph({
  platform,
  size,
}: {
  platform: PostPlatform;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {platform === "facebook" ? (
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      ) : (
        <>
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </>
      )}
    </svg>
  );
}

// ─── Instagram (legacy `InstagramProfile` — RETIRED) ─────────────────────────

/**
 * A legacy `{link, username}` Instagram block. The public business_discovery
 * path behind it was deleted (web-implementation-contract §3.4 — mobile shows
 * a reconnect prompt, never the old grid), so the preview shows a quiet
 * reconnect hint instead of fake profile chrome. English-only like the rest of
 * the preview placeholder copy; the real call to action lives in the editor.
 */
function LegacyInstagramRetired() {
  return (
    <div className="px-5">
      <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-dashed border-foreground/20 px-4 py-6">
        {/* gradient-ringed avatar stub — keeps the Instagram identity */}
        <span
          className="flex size-8 items-center justify-center rounded-full p-0.5"
          style={{
            background:
              "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
          }}
        >
          <span className="size-full rounded-full bg-black/10" />
        </span>
        <span className="text-xs text-muted-foreground">
          Reconnect Instagram to show posts
        </span>
      </div>
    </div>
  );
}
