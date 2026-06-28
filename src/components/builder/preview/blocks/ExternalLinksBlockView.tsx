import type { ExternalLinkItem, ExternalLinksBlock } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";

/**
 * Read-only preview for ExternalLinksBlock ("ExternalLinksModule"), faithful to
 * the Flutter `ExternalLinksWidget`. Renders all six layout_type variants:
 *
 *  - list      : full-width swipe cards, each 100px tall, horizontal padding 16.
 *  - largeGrid : AspectRatio(1) swiper, viewportFraction 0.9, square card with a
 *                rounded image filling the card + title + marquee description.
 *  - swiper    : height 100, viewportFraction 0.9 swiper of swipe cards.
 *  - swiper2   : height 200, two stacked swipe cards per page.
 *  - grid      : horizontally scrolling row of 120px-wide cards (120px image).
 *  - promo     : full-width "promo" rows — text column + Open pill + 110x110 image.
 *
 * The mobile foreground color is the theme text color; here we use the CSS
 * `--foreground` token via `currentColor` so alpha tints match (0.8/0.6 etc).
 */

const FALLBACK = (
  <div className="flex size-full items-center justify-center bg-black/20 text-white/40">
    <svg viewBox="0 0 24 24" width={28} height={28} fill="currentColor" aria-hidden="true">
      <path d="M3.9 12a3.1 3.1 0 0 1 3.1-3.1h4V7H7a5 5 0 0 0 0 10h4v-1.9H7A3.1 3.1 0 0 1 3.9 12zM8 13h8v-2H8v2zm5-6v1.9h4A3.1 3.1 0 0 1 17 15h-4V17h4a5 5 0 0 0 0-10h-4z" />
    </svg>
  </div>
);

function Thumb({ url }: { url?: string | null }) {
  if (!url) return FALLBACK;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cdnUrl(url)} alt="" className="size-full object-cover" />
  );
}

/** Chevron-right glyph (FontAwesomeIcons.chevronRight). */
function Chevron({ size, opacity }: { size: number; opacity: number }) {
  return (
    <svg
      viewBox="0 0 320 512"
      width={size}
      height={size}
      fill="currentColor"
      style={{ opacity }}
      className="rtl:rotate-180"
      aria-hidden="true"
    >
      <path d="M285.5 273L91.4 467a24 24 0 0 1-34 0l-22.7-22.7a24 24 0 0 1 0-33.9L188.5 256 34.7 101.6a24 24 0 0 1 0-33.9L57.4 45a24 24 0 0 1 34 0l194 194a24 24 0 0 1 0 34z" />
    </svg>
  );
}

/**
 * The mobile `buildSwipeItem`: a BlurredBox row with a square image (circle if
 * circleImage), title (w500 @0.8) + up-to-3-line description (@0.6), and an
 * optional trailing chevron (@0.6). Used by list / swiper / swiper2.
 */
function SwipeItem({
  item,
  showArrow,
  circleImage,
}: {
  item: ExternalLinkItem;
  showArrow: boolean;
  circleImage: boolean;
}) {
  const title = item.title ?? "";
  const desc = item.description ?? "";
  return (
    // Padding(vertical: 4, horizontal: 4) around each swipe item.
    <div className="size-full px-1 py-1">
      <div className="flex h-full items-stretch overflow-hidden rounded-xl bg-foreground/[0.06] text-foreground">
        {circleImage ? (
          // Padding(10) + AspectRatio(1) + ClipOval
          <div className="flex aspect-square h-full shrink-0 items-center justify-center p-2.5">
            <div className="aspect-square h-full overflow-hidden rounded-full">
              <Thumb url={item.thumbnail_url} />
            </div>
          </div>
        ) : (
          <div className="aspect-square h-full shrink-0 overflow-hidden">
            <Thumb url={item.thumbnail_url} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 ps-3 pe-1">
          {title && (
            <span
              dir={dirOf(title)}
              className="truncate text-sm font-medium text-foreground/80"
            >
              {title}
            </span>
          )}
          {desc && (
            <span
              dir={dirOf(desc)}
              className="line-clamp-3 text-xs text-foreground/60"
            >
              {desc}
            </span>
          )}
        </div>

        {showArrow && (
          <div className="flex shrink-0 items-center ps-2 pe-3.5 text-foreground">
            <Chevron size={14} opacity={0.6} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The mobile `buildPromoItem`: a BlurredBox card — text column (title w700 @0.9,
 * 2 lines; description @0.7, 3 lines; an "Open" pill with optional chevron) and a
 * 110x110 thumbnail (circle if circleImage, else rounded 14).
 */
function PromoItem({
  item,
  showArrow,
  circleImage,
}: {
  item: ExternalLinkItem;
  showArrow: boolean;
  circleImage: boolean;
}) {
  const title = item.title ?? "";
  const desc = item.description ?? "";
  return (
    <div className="flex items-center gap-3.5 overflow-hidden rounded-2xl bg-foreground/[0.06] p-4 text-foreground">
      <div className="flex min-w-0 flex-1 flex-col items-start">
        {title && (
          <span
            dir={dirOf(title)}
            className="line-clamp-2 text-base font-bold leading-tight text-foreground/90"
          >
            {title}
          </span>
        )}
        {desc && (
          <span
            dir={dirOf(desc)}
            className="mt-1.5 line-clamp-3 text-xs leading-snug text-foreground/70"
          >
            {desc}
          </span>
        )}
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.12] py-2 ps-3.5 pe-3.5 text-xs font-semibold text-foreground/90">
          Open
          {showArrow && <Chevron size={10} opacity={0.9} />}
        </span>
      </div>
      <div
        className={
          "size-[110px] shrink-0 overflow-hidden " +
          (circleImage ? "rounded-full" : "rounded-2xl")
        }
      >
        <Thumb url={item.thumbnail_url} />
      </div>
    </div>
  );
}

/** Grid / largeGrid card: image on top + title + description below. */
function GridCard({
  item,
  imageMode,
}: {
  item: ExternalLinkItem;
  imageMode: "fixed" | "fill";
}) {
  const title = item.title ?? "";
  const desc = item.description ?? "";
  return (
    // largeGrid (fill) fills the square swiper card; grid (fixed) is a 120px tile.
    <div
      className={
        "flex h-full flex-col text-foreground " +
        (imageMode === "fill" ? "w-full" : "w-[120px]")
      }
    >
      <div
        className={
          "overflow-hidden rounded-[10px] " +
          (imageMode === "fill" ? "flex-1" : "h-[120px]")
        }
      >
        <Thumb url={item.thumbnail_url} />
      </div>
      <div className="mt-2">
        {title && (
          <span
            dir={dirOf(title)}
            className="block truncate text-start text-sm font-medium text-foreground/80"
          >
            {title}
          </span>
        )}
        {desc && (
          <span
            dir={dirOf(desc)}
            className="block truncate text-start text-xs text-foreground/60"
          >
            {desc}
          </span>
        )}
      </div>
    </div>
  );
}

export function ExternalLinksBlockView({ block }: { block: ExternalLinksBlock }) {
  const items = (block.links ?? []).filter((it) => !it.hidden);
  const title = block.title?.trim() ?? "";
  const layout = block.layout_type ?? "list";
  const showArrow = !!block.show_arrow;
  const circleImage = !!block.circle_image;

  let body: React.ReactNode;

  if (items.length === 0) {
    body = (
      <p className="px-6 py-4 text-center text-xs text-muted-foreground/60">
        No links yet
      </p>
    );
  } else if (layout === "list") {
    // Column of full-width swipe cards, each 100 tall, horizontal padding 16.
    body = (
      <div className="flex flex-col">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="h-[100px] px-4">
            <SwipeItem item={item} showArrow={showArrow} circleImage={circleImage} />
          </div>
        ))}
      </div>
    );
  } else if (layout === "swiper") {
    // height 100, viewportFraction 0.9, no loop.
    body = (
      <div className="h-[100px] w-full">
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto px-[5%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <div key={item.id ?? i} className="h-full w-[90%] shrink-0 snap-center">
              <SwipeItem item={item} showArrow={showArrow} circleImage={circleImage} />
            </div>
          ))}
        </div>
      </div>
    );
  } else if (layout === "swiper2") {
    // height 200, two stacked swipe items per page.
    const pages: ExternalLinkItem[][] = [];
    for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
    body = (
      <div className="h-[200px] w-full">
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto px-[5%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((pair, p) => (
            <div
              key={p}
              className="flex h-full w-[90%] shrink-0 snap-center flex-col"
            >
              <div className="h-1/2">
                <SwipeItem
                  item={pair[0]}
                  showArrow={showArrow}
                  circleImage={circleImage}
                />
              </div>
              <div className="h-1/2">
                {pair[1] ? (
                  <SwipeItem
                    item={pair[1]}
                    showArrow={showArrow}
                    circleImage={circleImage}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (layout === "largeGrid") {
    // AspectRatio(1) swiper, viewportFraction 0.9 — card image fills the card.
    body = (
      <div className="aspect-square w-full">
        <div className="flex h-full snap-x snap-mandatory overflow-x-auto px-[5%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <div
              key={item.id ?? i}
              className="flex h-full w-[90%] shrink-0 snap-center justify-center px-1"
            >
              <GridCard item={item} imageMode="fill" />
            </div>
          ))}
        </div>
      </div>
    );
  } else if (layout === "grid") {
    // Horizontally scrolling row of 120-wide cards, padding top 8 / bottom 10.
    body = (
      <div className="flex items-start gap-2 overflow-x-auto px-6 pb-2.5 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="shrink-0">
            <GridCard item={item} imageMode="fixed" />
          </div>
        ))}
      </div>
    );
  } else {
    // promo
    body = (
      <div className="flex flex-col gap-2 px-4">
        {items.map((item, i) => (
          <PromoItem
            key={item.id ?? i}
            item={item}
            showArrow={showArrow}
            circleImage={circleImage}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="py-2">
      <Foldable
        foldable={block.foldable}
        header={
          title ? (
            <>
              <h2
                dir={dirOf(title)}
                className="px-6 text-xl font-bold text-foreground"
              >
                {title}
              </h2>
              <div className="h-[5px]" />
            </>
          ) : null
        }
      >
        {body}
        {/* Divider(indent 8, endIndent 8) at foreground@20% — mobile draws it at
            the end of every External/Video/Products/Reviews block body. */}
        <div className="h-[5px]" />
        <div className="px-5">
          <div
            className="mx-2 h-px"
            style={{ backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
          />
        </div>
      </Foldable>
    </div>
  );
}
