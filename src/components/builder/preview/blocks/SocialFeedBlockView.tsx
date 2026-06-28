import type { SocialFeedBlock } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";

/**
 * Read-only preview of a SocialFeedModule, mirroring the mobile `FeedWidget`.
 *
 * The mobile widget fetches the live YouTube / Vimeo / Instagram feed and then
 * renders it through `RSSContent` (YouTube/Vimeo) or `InstagramProfile`
 * (Instagram). In the builder we cannot fetch external feeds, so — exactly like
 * the prompt asks — we render representative post tiles that honour the
 * `configuration` and `layout_type`, matching the mobile dimensions, ratios and
 * spacing precisely:
 *
 *  - Header: title at horizontal 24, headlineMedium bold (`FeedWidget.build`).
 *  - YouTube / Vimeo (`RSSContent`):
 *      • list   → Column of 16:9 `VideoCard`s, horizontal 20, 5px vertical gaps.
 *      • swiper → AspectRatio (16/9 * 1.1), viewportFraction 0.9 centered card.
 *      • grid   → horizontal scroller of 148-high cards, horizontal 24, 4px gaps.
 *    `VideoCard`: 16:9, rounded-8, black38 outside border, white-0.2 fill,
 *    centered 60×60 translucent-white play circle (30×30 glyph), bottom title.
 *  - Instagram (`InstagramProfile`): optional gradient-ringed profile header +
 *    stats, then a 2-column square thumbnail grid (`SliverGridDelegateWithFixedCrossAxisCount`).
 *  - Trailing divider at horizontal 20, indent/endIndent 8, foreground @ 0.2.
 *
 * `posts_count` (default 4 — mobile `postsCount` default) caps the tile count.
 */
// Mobile FeedConfiguration.defaultTitleValue — used when no title is set.
const DEFAULT_FEED_TITLE: Record<string, string> = {
  youtube: "YouTube Videos",
  vimeo: "Vimeo Showcase",
  instagram: "Instagram Feed",
};

export function SocialFeedBlockView({ block }: { block: SocialFeedBlock }) {
  const configuration = block.configuration;
  const title =
    (block.title ?? "").trim() || DEFAULT_FEED_TITLE[configuration] || "";
  const dir = dirOf(title);
  const count = Math.min(20, Math.max(0, block.posts_count ?? 4));
  // Mobile SocialFeedBlock.init default layout is "list".
  const layout = block.layout_type ?? "list";

  const showProfileDetails =
    (block.settings?.["show_profile_details"] as boolean | undefined) ?? true;

  const tiles = Array.from({ length: count });

  return (
    <div className="my-[5px] py-2">
      {/* Title — horizontal 24, headlineMedium bold */}
      {title ? (
        <div className="px-6" dir={dir}>
          <h2 className="text-[22px] font-bold leading-tight text-foreground">
            {title}
          </h2>
        </div>
      ) : null}

      <div className="h-[5px]" />

      {configuration === "instagram" ? (
        <InstagramFeed tiles={tiles} showProfileDetails={showProfileDetails} />
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
          <svg width={30} height={30} viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ─── Instagram (InstagramProfile) ────────────────────────────────────────────

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
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
