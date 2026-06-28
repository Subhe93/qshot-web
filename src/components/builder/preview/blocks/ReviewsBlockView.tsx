import type { ReviewsBlock, ReviewItem } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";

/**
 * Read-only preview of a ReviewsModule, mirroring the mobile `ReviewsWidget`
 * (lib/features/website/widget/editor/reviews_widget.dart). Renders the three
 * layout_type variants — cards / list / testimonial — with the mobile's exact
 * dimensions, spacing, aspect ratios and star ratings, plus the optional
 * "add review" outlined button and a translucent bottom divider.
 *
 * Mobile draws text/borders as `color.withValues(alpha: X)` over the page
 * foreground color; the web preview's foreground token is `var(--foreground)`,
 * so those alpha values are mirrored via color-mix helpers. Star ratings use a
 * fixed amber (Colors.amber) like the mobile StarRatingWidget.
 */

const FG = "var(--foreground)";
/** color.withValues(alpha) on the page foreground color. */
function fg(alpha: number): string {
  return `color-mix(in srgb, ${FG} ${Math.round(alpha * 100)}%, transparent)`;
}

const AMBER = "#FFC107"; // Colors.amber

// ─── Star rating (mirrors StarRatingWidget: filled / half / outline rounded) ──

function Stars({ rating, size }: { rating: number; size: number }) {
  return (
    <div className="flex" style={{ color: AMBER }}>
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        const kind =
          rating >= starValue
            ? "full"
            : rating >= starValue - 0.5
              ? "half"
              : "empty";
        return <Star key={i} kind={kind} size={size} />;
      })}
    </div>
  );
}

function Star({ kind, size }: { kind: "full" | "half" | "empty"; size: number }) {
  // Material rounded star path (approximation of Icons.star_rounded).
  const path =
    "M12 17.27l5.18 3.12c.5.3 1.11-.16.98-.73l-1.37-5.89 4.56-3.95c.43-.38.2-1.1-.36-1.14l-6-.51-2.34-5.53c-.22-.52-.96-.52-1.18 0L9.13 8.16l-6 .51c-.56.04-.79.76-.36 1.14l4.56 3.95-1.37 5.89c-.13.57.48 1.03.98.73L12 17.27z";
  if (kind === "half") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id={`half-${size}`}>
            <stop offset="50%" stopColor={AMBER} />
            <stop offset="50%" stopColor={AMBER} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={path} fill={`url(#half-${size})`} stroke={AMBER} strokeWidth={1} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d={path}
        fill={kind === "full" ? AMBER : "none"}
        stroke={AMBER}
        strokeWidth={kind === "full" ? 0 : 1.5}
      />
    </svg>
  );
}

// ─── Avatar (circle photo, or person-fill fallback at fg@0.1 / icon fg@0.4) ──

function Avatar({ item, size }: { item: ReviewItem; size: number }) {
  const url = item.reviewer_photo_url ? cdnUrl(item.reviewer_photo_url) : null;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: fg(0.1) }}
    >
      {url ? (
        // referrerPolicy: Google profile photos (lh3.googleusercontent.com)
        // 403/429 when hotlinked with a referrer — send none so they load.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
        />
      ) : (
        <svg
          width={size * 0.55}
          height={size * 0.55}
          viewBox="0 0 24 24"
          fill={fg(0.4)}
          aria-hidden
        >
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v1h18v-1c0-3.5-4-6-9-6z" />
        </svg>
      )}
    </div>
  );
}

// ─── Card item (cards layout): padding 16, rounded 12, fill fg@0.05, border fg@0.1 ──

function CardItem({ item }: { item: ReviewItem }) {
  const name = item.reviewer_name ?? "";
  const text = item.text ?? "";
  const time = item.relative_time_description ?? "";
  return (
    <div className="px-1 py-1" style={{ height: "100%" }}>
      <div
        className="flex h-full flex-col rounded-xl p-4"
        style={{ backgroundColor: fg(0.05), border: `1px solid ${fg(0.1)}` }}
      >
        <div className="flex items-center">
          <Avatar item={item} size={36} />
          <div className="ms-2.5 min-w-0 flex-1">
            <p
              dir={dirOf(name)}
              className="truncate text-sm font-semibold"
              style={{ color: fg(0.9) }}
            >
              {name}
            </p>
            <Stars rating={item.rating ?? 0} size={16} />
          </div>
        </div>
        <p
          dir={dirOf(text)}
          className="mt-2.5 flex-1 overflow-hidden text-xs leading-[1.4]"
          style={{ color: fg(0.7), display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4 }}
        >
          {text}
        </p>
        {time && (
          <p className="text-xs" style={{ color: fg(0.4) }}>
            {time}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── List item: padding h20 v10, avatar 40, name expanded + stars 14, text 3 lines ──

function ListItem({ item }: { item: ReviewItem }) {
  const name = item.reviewer_name ?? "";
  const text = item.text ?? "";
  const time = item.relative_time_description ?? "";
  return (
    <div className="flex items-start px-5 py-2.5">
      <Avatar item={item} size={40} />
      <div className="ms-3 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            dir={dirOf(name)}
            className="min-w-0 flex-1 truncate text-sm font-semibold"
            style={{ color: fg(0.9) }}
          >
            {name}
          </p>
          <Stars rating={item.rating ?? 0} size={14} />
        </div>
        <p
          dir={dirOf(text)}
          className="mt-1 overflow-hidden text-xs leading-[1.4]"
          style={{ color: fg(0.7), display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3 }}
        >
          {text}
        </p>
        {time && (
          <p className="mt-1 text-[11px]" style={{ color: fg(0.4) }}>
            {time}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Testimonial item: centered, text bodyLarge fg@0.8, stars 18, avatar 28 + name ──

function TestimonialItem({ item }: { item: ReviewItem }) {
  const name = item.reviewer_name ?? "";
  const text = item.text ?? "";
  const time = item.relative_time_description ?? "";
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-2 text-center">
      <p
        dir={dirOf(text)}
        className="overflow-hidden text-base leading-snug"
        style={{ color: fg(0.8), display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4 }}
      >
        {text}
      </p>
      <div className="mt-3">
        <Stars rating={item.rating ?? 0} size={18} />
      </div>
      <div className="mt-2 flex items-center justify-center gap-2">
        <Avatar item={item} size={28} />
        <p
          dir={dirOf(name)}
          className="truncate text-sm font-semibold"
          style={{ color: fg(0.8) }}
        >
          {name}
        </p>
      </div>
      {time && (
        <p className="mt-1 truncate text-xs" style={{ color: fg(0.4) }}>
          {time}
        </p>
      )}
    </div>
  );
}

// ─── Horizontal snap-scroll swiper (cards / testimonial) ──────────────────────

function Swiper({
  items,
  height,
  viewportFraction,
  render,
}: {
  items: ReviewItem[];
  height: number;
  viewportFraction: number;
  render: (item: ReviewItem) => React.ReactNode;
}) {
  const pct = `${viewportFraction * 100}%`;
  return (
    <div style={{ height }}>
      <div className="flex h-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <div
            key={item.id ?? i}
            className="h-full shrink-0 snap-center"
            style={{ width: pct }}
          >
            {render(item)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReviewsBlockView({ block }: { block: ReviewsBlock }) {
  const items = (block.reviews ?? []).filter((r) => !r.hidden);
  const title = block.title?.trim() ?? "";
  const layout = block.layout_type ?? "cards";
  const showAddReview =
    !!block.show_add_review_button &&
    !!block.add_review_url &&
    block.add_review_url.length > 0;

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
      {items.length === 0 ? (
        <p className="px-6 py-4 text-center text-xs text-muted-foreground/60">
          No reviews yet
        </p>
      ) : layout === "cards" ? (
        <Swiper
          items={items}
          height={180}
          viewportFraction={0.85}
          render={(item) => <CardItem item={item} />}
        />
      ) : layout === "testimonial" ? (
        <Swiper
          items={items}
          height={220}
          viewportFraction={1}
          render={(item) => <TestimonialItem item={item} />}
        />
      ) : (
        // list
        <div className="flex flex-col">
          {items.map((item, i) => (
            <div key={item.id ?? i}>
              <ListItem item={item} />
              {i < items.length - 1 && (
                <div className="px-6">
                  <div className="h-px" style={{ backgroundColor: fg(0.1) }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddReview && items.length > 0 && (
        <div className="px-6 pt-3.5">
          <a
            href={block.add_review_url || undefined}
            onClick={(e) => e.preventDefault()}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold"
            style={{ color: FG, border: `1px solid ${fg(0.3)}` }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 17.27l5.18 3.12c.5.3 1.11-.16.98-.73l-1.37-5.89 4.56-3.95c.43-.38.2-1.1-.36-1.14l-6-.51-2.34-5.53c-.22-.52-.96-.52-1.18 0L9.13 8.16l-6 .51c-.56.04-.79.76-.36 1.14l4.56 3.95-1.37 5.89c-.13.57.48 1.03.98.73L12 17.27z" />
            </svg>
            Add review
          </a>
        </div>
      )}

      <div className="h-[5px]" />
      {/* Divider(indent 8, endIndent 8) at foreground@20% — inside the
          expandable body so it hides when the block is collapsed (mobile). */}
      <div className="px-5">
        <div className="mx-2 h-px" style={{ backgroundColor: fg(0.2) }} />
      </div>
      </Foldable>
    </div>
  );
}
