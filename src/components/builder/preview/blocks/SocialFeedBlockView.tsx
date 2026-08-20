import type { SocialFeedBlock } from "@/lib/types/blocks";
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
 *  - legacy `instagram`         → `InstagramProfile` (unchanged).
 *
 * The mobile widget fetches the live feed (`FeedDisplayCubit`) and renders the
 * result. In the builder we cannot: the posts are NEVER stored in the website
 * JSON — YouTube/Vimeo come from public RSS, and the connect-flow providers
 * (`facebook` via `meta/feed`, `instagram_connected` via `instagram/feed`,
 * `tiktok` via `tiktok-integration/`) are fetched by the PUBLIC renderer
 * server-side (with the visitor-IP forwarding secret — those endpoints are
 * deliberately never called from the browser, see `src/lib/api/instagram.ts`).
 * So — as before — we render representative placeholder tiles that honour
 * `configuration`, `layout_type` and `posts_count`, matching the mobile
 * dimensions, ratios, colors and spacing precisely.
 *
 * Shared chrome (`FeedWidget.build`):
 *  - Header: title at horizontal 24, headlineMedium bold.
 *  - Trailing divider at horizontal 20, indent/endIndent 8, foreground @ 0.2.
 *
 * `posts_count` (default 4 — mobile `postsCount` default) caps the tile count.
 *
 * `instagram` (legacy business_discovery) is still fully rendered even though
 * mobile `20941620` withheld it from the new-block selector: the value stays
 * valid in stored documents and must keep rendering. Its connect-flow
 * successor is the separate `instagram_connected` configuration
 * (`InstagramConnectedFeedConfiguration`, info `{connection_id, ig_user_id,
 * username}`), which renders through the shared PostFeed below.
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
  const tiles = Array.from({ length: count });

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

      {configuration === "instagram" ? (
        <InstagramFeed
          tiles={tiles}
          // Legacy InstagramProfile defaults show_profile_details to TRUE.
          showProfileDetails={
            (block.settings?.["show_profile_details"] as boolean | undefined) ??
            true
          }
        />
      ) : configuration === "tiktok" ? (
        <TikTokFeed tiles={tiles} layout={layout} />
      ) : configuration === "facebook" ||
        configuration === "instagram_connected" ? (
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
        />
      ) : (
        <RssFeed tiles={tiles} layout={layout} />
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
}: {
  tiles: unknown[];
  layout: SocialFeedBlock["layout_type"];
}) {
  if (layout === "list") {
    return (
      <div className="flex flex-col px-5">
        {tiles.map((_, i) => (
          <div key={i} className="py-[5px]">
            <VideoCard />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "grid") {
    return (
      <div className="overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-start">
          {tiles.map((_, i) => (
            <div key={i} className="px-1">
              {/* SizedBox(height: 148) → width follows 16:9 = ~263 */}
              <div className="h-[148px] w-[263px]">
                <VideoCard fill />
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
        {tiles.map((_, i) => (
          <div
            key={i}
            className="flex h-full w-[90%] shrink-0 snap-center items-center justify-center px-1"
          >
            <div className="w-full">
              <VideoCard />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors the mobile `VideoCard`: 16:9 (unless `fill`, which fills the height
 * inside the grid SizedBox), rounded-8, black38 outside border, white-0.2 fill,
 * centered 60×60 translucent-white circular play button (30×30 glyph) and a
 * bottom title strip.
 */
function VideoCard({ fill = false }: { fill?: boolean }) {
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
      {/* bottom title strip (height 20, bottom 16, start/end 16) */}
      <div className="absolute inset-x-4 bottom-4 h-5">
        <div className="h-3 w-3/5 rounded-full bg-white/40" />
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
}: {
  tiles: unknown[];
  layout: SocialFeedBlock["layout_type"];
}) {
  if (layout === "swiper") {
    return (
      <div className="w-full" style={{ aspectRatio: "9 / 14" }}>
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tiles.map((_, i) => (
            <div key={i} className="h-full w-[62%] shrink-0 snap-center px-1">
              <TikTokCard />
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
          {tiles.map((_, i) => (
            // SizedBox(height: 220, width: 220 * 9 / 14 ≈ 141)
            <div key={i} className="h-[220px] w-[141px] shrink-0">
              <TikTokCard />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // list — 2-column grid, childAspectRatio 9/14, 8px gaps, horizontal 16.
  return (
    <div className="grid grid-cols-2 gap-2 px-4">
      {tiles.map((_, i) => (
        <div key={i} style={{ aspectRatio: "9 / 14" }}>
          <TikTokCard />
        </div>
      ))}
    </div>
  );
}

/**
 * Mirrors mobile `_TiktokCard`: rounded-14 black card, cover image (empty
 * state = dim glyph on black), bottom caption over a transparent→black-0.85
 * gradient (2 lines, 12px w600 white — bars here), a 26×26 music badge at the
 * top end (black-0.45, 1px cyan-0.6 ring), a centered 46×46 play circle
 * (black-0.3, 1.5px white-0.85 ring, 26px glyph) and a 3px cyan→pink brand
 * hairline along the bottom.
 */
function TikTokCard() {
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

      {/* caption over gradient — padding (10, 24, 10, 10) */}
      <div
        className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-6"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))",
        }}
      >
        <div className="h-2.5 w-11/12 rounded bg-white/50" />
        <div className="mt-1 h-2.5 w-3/5 rounded bg-white/30" />
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
 * Placeholder render of the reworked `PostFeedContent` — shared by
 * `facebook` (info `{connection_id, page_id}`) and `instagram_connected`
 * (info `{connection_id, ig_user_id}`): an optional profile byline
 * (`settings.show_profile_details`), then a VERTICAL STACK of post cards.
 * Mobile renders the same stack for every `layout_type` — the post feed has
 * no swiper/grid variants — so the preview does too.
 *
 * Like every provider here, the real posts are fetched by the PUBLIC renderer
 * server-side (`meta/feed`, `instagram/feed`) and never from the browser, so
 * the cards are representative placeholders capped by `posts_count`. On
 * mobile a card tap opens the post's permalink; a no-op on the canvas.
 */
function PostFeed({
  tiles,
  platform,
  showProfileDetails,
  name,
}: {
  tiles: unknown[];
  platform: PostPlatform;
  showProfileDetails: boolean;
  name: string;
}) {
  return (
    <div>
      {showProfileDetails && <PostByline platform={platform} name={name} />}
      {tiles.map((_, i) => (
        // Card padding — EdgeInsets.fromLTRB(16, 0, 16, 12)
        <div key={i} className="px-4 pb-3">
          <PostCard platform={platform} name={name} />
        </div>
      ))}
    </div>
  );
}

/**
 * Mobile `_ProfileByline`: 44px avatar with a brand badge overlapping its
 * bottom end (white 3px ring around a 4px-padded brand circle, 11px glyph),
 * then name (bodyLarge bold) and a follower count (bodySmall, ink 0.5) — the
 * count is server data we never have in the builder, so it stays a bar.
 */
function PostByline({
  platform,
  name,
}: {
  platform: PostPlatform;
  name: string;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-3">
      <span className="relative shrink-0">
        <span
          className="block size-11 rounded-full"
          style={{ backgroundColor: AVATAR_BG }}
        />
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
        {name ? (
          <p className="truncate text-base font-bold text-foreground">{name}</p>
        ) : (
          <div className="h-4 w-28 rounded bg-foreground/20" />
        )}
        {/* "1.2K followers" on mobile — unknown here, so a placeholder bar. */}
        <div className="mt-1.5 h-3 w-20 rounded bg-foreground/10" />
      </div>
    </div>
  );
}

/**
 * Mobile `_PostCard`: rounded-14 card on the FIXED light AppColors.background
 * surface (no border) containing — page row (24px avatar + 12px w700 name,
 * padding 12/10/12/6), caption (bodyMedium ×4 lines max, padding 12/2/12/10 —
 * bars here), the media crop, a 1px ink-0.08 divider, and three equal
 * Like/Comment/Share affordances (14px icon + bodySmall w600 label,
 * ink 0.55, 10px vertical padding). The affordances are purely visual on
 * mobile too — the whole card is one tap target.
 */
function PostCard({
  platform,
  name,
}: {
  platform: PostPlatform;
  name: string;
}) {
  const brand = POST_BRAND[platform];
  return (
    <div
      className="overflow-hidden rounded-[14px]"
      style={{ backgroundColor: CARD_BG }}
    >
      {/* page row — EdgeInsets.fromLTRB(12, 10, 12, 6) */}
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span
          className="size-6 shrink-0 rounded-full"
          style={{ backgroundColor: AVATAR_BG }}
        />
        {name ? (
          <p
            className="min-w-0 flex-1 truncate text-xs font-bold"
            style={{ color: ink(0.9) }}
          >
            {name}
          </p>
        ) : (
          <span
            className="block h-2.5 w-24 rounded"
            style={{ backgroundColor: ink(0.2) }}
          />
        )}
      </div>

      {/* caption — EdgeInsets.fromLTRB(12, 2, 12, 10) */}
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

      {/* media — 4:3 for Facebook, square for Instagram */}
      <div
        className="w-full bg-black/10"
        style={{ aspectRatio: brand.aspect }}
      />

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

// ─── Instagram (legacy `InstagramProfile`) ───────────────────────────────────

function InstagramFeed({
  tiles,
  showProfileDetails,
}: {
  tiles: unknown[];
  showProfileDetails: boolean;
}) {
  return (
    <div className="px-2">
      {showProfileDetails ? <InstagramHeader /> : null}

      {/* SliverGrid crossAxisCount: 2 — square tiles, no gaps */}
      <div className="grid grid-cols-2">
        {tiles.map((_, i) => (
          <div key={i} className="aspect-square bg-black/10" />
        ))}
      </div>
    </div>
  );
}

function InstagramHeader() {
  const desktop = useDesktopPreview();
  return (
    <div className="pb-4">
      {/* avatar + name row, centered */}
      <div className="flex items-center justify-center gap-2.5">
        {/* gradient-ringed 50×50 avatar (2px ring + 2px pad) */}
        <span
          className="flex size-[58px] items-center justify-center rounded-full p-0.5"
          style={{
            background:
              "linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4)",
          }}
        >
          <span className="size-[50px] rounded-full bg-black/10" />
        </span>
        <div className="min-w-0">
          <div className="h-4 w-28 rounded bg-foreground/20" />
          <div className="mt-1.5 h-3 w-20 rounded bg-foreground/10" />
        </div>
      </div>

      {/* stats row: Posts / Followers / Following */}
      <div className="mt-2.5 flex items-center justify-evenly px-6">
        {["Posts", "Followers", "Following"].map((label) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className="h-4 w-8 rounded bg-foreground/20" />
            {/* Desktop = Nuxt Instagram/Grid.vue stat label: 16px / full colour. */}
            <span className={desktop ? "text-base text-foreground" : "text-xs text-muted-foreground"}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
