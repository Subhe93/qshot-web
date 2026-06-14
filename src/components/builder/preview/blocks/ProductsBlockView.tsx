import type { ProductsBlock, ProductItem } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";

/**
 * Read-only preview of a ProductsModule, mirroring the mobile `ProductsWidget`
 * (lib/features/website/widget/editor/products_widget.dart). Renders all nine
 * layout_type variants with the mobile's dimensions, aspect ratios, spacing,
 * blurred cards and price formatting.
 *
 * Mobile uses `color.withValues(alpha: X)` over the page foreground color for
 * text/borders; the web preview's foreground token is `var(--foreground)`, so
 * we mirror those alpha values via rgb-from-foreground color-mix helpers.
 */

const FG = "var(--foreground)";
/** color.withValues(alpha) on the foreground color. */
function fg(alpha: number): string {
  return `color-mix(in srgb, ${FG} ${Math.round(alpha * 100)}%, transparent)`;
}

function ProductImage({ url, className }: { url?: string | null; className?: string }) {
  if (!url) {
    return <div className={className} style={{ backgroundColor: "rgba(0,0,0,0.16)" }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cdnUrl(url)} alt="" className={`${className ?? ""} object-cover`} />
  );
}

/** Mirrors ProductsWidget.buildPrice: discounted price (bold) + struck original. */
function Price({ item, centered = false }: { item: ProductItem; centered?: boolean }) {
  const hasDiscount = item.price_after_discount != null && item.price_after_discount !== "";
  const hasPrice = item.price != null && item.price !== "";
  if (!hasDiscount && !hasPrice) return null;
  const currency = item.currency ?? "";
  return (
    <div
      className="flex items-center gap-1.5"
      style={{ justifyContent: centered ? "center" : "flex-start" }}
    >
      {hasDiscount && (
        <span
          className="truncate text-sm font-bold"
          style={{ color: fg(0.95) }}
        >
          {item.price_after_discount} {currency}
        </span>
      )}
      {hasPrice && (
        <span
          className="truncate"
          style={
            hasDiscount
              ? {
                  color: fg(0.55),
                  textDecoration: "line-through",
                  textDecorationColor: fg(0.75),
                  textDecorationThickness: 2,
                  fontSize: 13,
                }
              : { color: fg(0.95), fontSize: 14, fontWeight: 700 }
          }
        >
          {item.price} {currency}
        </span>
      )}
    </div>
  );
}

function ChevronRight({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 rtl:-scale-x-100"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// ─── list / swiper / swiper2 card (BlurredBox row) ──────────────────────────
function SwipeItem({
  item,
  showArrow,
  circleImage,
}: {
  item: ProductItem;
  showArrow: boolean;
  circleImage: boolean;
}) {
  return (
    <div className="px-1 py-1" style={{ height: "100%" }}>
      <div
        className="flex h-full items-stretch overflow-hidden rounded-xl"
        style={{ backgroundColor: fg(0.05) }}
      >
        {circleImage ? (
          <div className="aspect-square h-full shrink-0 p-2.5">
            <ProductImage url={item.thumbnail_url} className="size-full rounded-full" />
          </div>
        ) : (
          <ProductImage url={item.thumbnail_url} className="aspect-square h-full shrink-0" />
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center px-3">
          <p
            dir={dirOf(item.title)}
            className="truncate text-sm font-medium"
            style={{ color: fg(0.8) }}
          >
            {item.title}
          </p>
          {item.description ? (
            <p
              dir={dirOf(item.description)}
              className="line-clamp-3 text-xs"
              style={{ color: fg(0.6) }}
            >
              {item.description}
            </p>
          ) : null}
          <Price item={item} />
        </div>
        {showArrow && (
          <div className="flex items-center pe-3.5 ps-2">
            <ChevronRight size={14} color={fg(0.6)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── promo card ─────────────────────────────────────────────────────────────
function PromoItem({
  item,
  showArrow,
  circleImage,
}: {
  item: ProductItem;
  showArrow: boolean;
  circleImage: boolean;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: fg(0.05) }}>
      <div className="flex items-center gap-3.5">
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <p
            dir={dirOf(item.title)}
            className="line-clamp-2 text-base font-bold leading-tight"
            style={{ color: fg(0.9) }}
          >
            {item.title}
          </p>
          {item.description ? (
            <p
              dir={dirOf(item.description)}
              className="mt-1.5 line-clamp-3 text-xs leading-snug"
              style={{ color: fg(0.7) }}
            >
              {item.description}
            </p>
          ) : null}
          <div className="mt-0.5">
            <Price item={item} />
          </div>
          <div
            className="mt-3 flex items-center gap-1.5 rounded-full px-3.5 py-2"
            style={{ backgroundColor: fg(0.12) }}
          >
            <span className="text-xs font-semibold" style={{ color: fg(0.9) }}>
              Open
            </span>
            {showArrow && <ChevronRight size={10} color={fg(0.9)} />}
          </div>
        </div>
        <ProductImage
          url={item.thumbnail_url}
          className={`size-[110px] shrink-0 ${circleImage ? "rounded-full" : "rounded-2xl"}`}
        />
      </div>
    </div>
  );
}

// ─── shop card (vertical, horizontal scroll) ────────────────────────────────
function ShopItem({ item, circleImage }: { item: ProductItem; circleImage: boolean }) {
  return (
    <div className="relative h-full w-[170px] shrink-0">
      {/* BlurredBox starts 70px down behind the image */}
      <div
        className="absolute inset-x-0 bottom-0 rounded-lg"
        style={{ top: 70, backgroundColor: fg(0.05) }}
      />
      <div className="relative flex h-full flex-col p-2.5">
        <div className="px-4">
          <ProductImage
            url={item.thumbnail_url}
            className={`aspect-square w-full ${circleImage ? "rounded-full" : "rounded-lg"}`}
          />
        </div>
        <p
          dir={dirOf(item.title)}
          className="mt-2.5 line-clamp-2 text-center text-sm font-bold leading-tight"
          style={{ color: fg(0.9) }}
        >
          {item.title}
        </p>
        <div className="flex-1" />
        <div style={{ color: "#757575" }}>
          <Price item={item} centered />
        </div>
        <div className="mt-2 flex justify-center">
          <span
            className="rounded-full px-4 py-2 text-xs font-semibold"
            style={{ color: fg(0.9), border: `1px solid ${fg(0.4)}` }}
          >
            Open
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── grid / grid2 card ──────────────────────────────────────────────────────
function GridCard({ item }: { item: ProductItem }) {
  return (
    <div className="flex flex-col items-center">
      <ProductImage url={item.thumbnail_url} className="aspect-square w-full rounded-[10px]" />
      <p
        dir={dirOf(item.title)}
        className="mt-2 w-full truncate text-center text-sm font-medium"
        style={{ color: fg(0.8) }}
      >
        {item.title}
      </p>
      <p
        dir={dirOf(item.description)}
        className="w-full truncate text-center text-xs"
        style={{ color: fg(0.6) }}
      >
        {item.description}
      </p>
      <Price item={item} centered />
    </div>
  );
}

// ─── swiper3 card ───────────────────────────────────────────────────────────
function Swiper3Card({ item }: { item: ProductItem }) {
  return (
    <div className="flex h-full flex-col px-1">
      <div className="min-h-0 flex-1">
        <ProductImage url={item.thumbnail_url} className="size-full rounded-[10px]" />
      </div>
      <p
        dir={dirOf(item.title)}
        className="mt-2 truncate text-start text-sm font-medium"
        style={{ color: fg(0.8) }}
      >
        {item.title}
      </p>
      <p
        dir={dirOf(item.description)}
        className="truncate text-xs"
        style={{ color: fg(0.6) }}
      >
        {item.description}
      </p>
      <Price item={item} />
    </div>
  );
}

// ─── banner card (16:9 + centered text) ─────────────────────────────────────
function BannerCard({ item }: { item: ProductItem }) {
  return (
    <div className="flex flex-col items-center">
      <ProductImage url={item.thumbnail_url} className="aspect-video w-full rounded-xl" />
      <p
        dir={dirOf(item.title)}
        className="mt-2 w-full truncate text-center text-sm font-semibold"
        style={{ color: fg(0.85) }}
      >
        {item.title}
      </p>
      {item.description ? (
        <p
          dir={dirOf(item.description)}
          className="w-full truncate text-center text-xs"
          style={{ color: fg(0.6) }}
        >
          {item.description}
        </p>
      ) : null}
      <Price item={item} centered />
    </div>
  );
}

export function ProductsBlockView({ block }: { block: ProductsBlock }) {
  const items = (block.items ?? []).filter((i) => !i.hidden);
  const showArrow = !!block.show_arrow;
  const circleImage = !!block.circle_image;
  const layout = block.layout_type;

  let content: React.ReactNode = null;

  switch (layout) {
    case "list":
      content = (
        <div className="flex flex-col">
          {items.map((item) => (
            <div key={item.id} className="h-[100px] px-4">
              <SwipeItem item={item} showArrow={showArrow} circleImage={circleImage} />
            </div>
          ))}
        </div>
      );
      break;

    case "swiper":
      // SizedBox height 100, viewportFraction 0.9 → horizontal snap row.
      content = (
        <div className="flex snap-x snap-mandatory gap-0 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <div key={item.id} className="h-[100px] w-[90%] shrink-0 snap-center">
              <SwipeItem item={item} showArrow={showArrow} circleImage={circleImage} />
            </div>
          ))}
        </div>
      );
      break;

    case "swiper2": {
      // height 200, two stacked cards per page (viewportFraction 0.9).
      const pages: ProductItem[][] = [];
      for (let i = 0; i < items.length; i += 2) pages.push(items.slice(i, i + 2));
      content = (
        <div className="flex h-[200px] snap-x snap-mandatory gap-0 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pages.map((page, pi) => (
            <div key={pi} className="flex h-full w-[90%] shrink-0 snap-center flex-col">
              <div className="min-h-0 flex-1">
                <SwipeItem item={page[0]} showArrow={showArrow} circleImage={circleImage} />
              </div>
              <div className="min-h-0 flex-1">
                {page[1] ? (
                  <SwipeItem item={page[1]} showArrow={showArrow} circleImage={circleImage} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      );
      break;
    }

    case "promo":
      content = (
        <div className="flex flex-col gap-2 px-4">
          {items.map((item) => (
            <PromoItem
              key={item.id}
              item={item}
              showArrow={showArrow}
              circleImage={circleImage}
            />
          ))}
        </div>
      );
      break;

    case "shop":
      content = (
        <div className="flex h-[250px] gap-2 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <ShopItem key={item.id} item={item} circleImage={circleImage} />
          ))}
        </div>
      );
      break;

    case "swiper3":
      // AspectRatio 1 around the swiper; viewportFraction 0.9.
      content = (
        <div className="aspect-square w-full">
          <div className="flex h-full snap-x snap-mandatory gap-0 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => (
              <div key={item.id} className="h-full w-[90%] shrink-0 snap-center">
                <Swiper3Card item={item} />
              </div>
            ))}
          </div>
        </div>
      );
      break;

    case "grid":
      // Horizontal scroll row of fixed 120px square cards.
      content = (
        <div className="flex justify-center pb-2.5 pt-2">
          <div className="flex items-start gap-2 overflow-x-auto px-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => (
              <div key={item.id} className="w-[120px] shrink-0">
                <GridCard item={item} />
              </div>
            ))}
          </div>
        </div>
      );
      break;

    case "grid2":
      // 2-column grid, childAspectRatio 0.72, spacing 10/14.
      content = (
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 px-4 py-1">
          {items.map((item) => (
            <div key={item.id} style={{ aspectRatio: "0.72" }}>
              <GridCard item={item} />
            </div>
          ))}
        </div>
      );
      break;

    case "banner":
      content = (
        <div className="flex flex-col gap-3 px-4">
          {items.map((item) => (
            <BannerCard key={item.id} item={item} />
          ))}
        </div>
      );
      break;

    default:
      content = null;
  }

  return (
    <div className="py-2">
      <Foldable
        foldable={block.foldable}
        header={
          block.title ? (
            <h2
              dir={dirOf(block.title)}
              className="px-6 text-2xl font-bold text-foreground"
            >
              {block.title}
            </h2>
          ) : null
        }
      >
        <div className="pt-1.5">{content}</div>
      </Foldable>
    </div>
  );
}
