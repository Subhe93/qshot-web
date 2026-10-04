"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck, CircleAlert, Layers } from "lucide-react";
import type { BookingBlock, BookingLayoutType } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";
import { useEditorStore } from "@/stores/editor-store";
import { cdnUrl } from "@/lib/api/qrcodes";
import { siteUrl } from "@/lib/site-domain";
import {
  formatDuration,
  formatFromPrice,
  formatPrice,
  formatServiceCount,
  initialOf,
  isLeaf,
  leafCount,
  leavesOf,
  onSiteHint,
  selectBookingServices,
  selectedLeaves,
  type BookingFormatStrings,
  type BookingServiceNode,
} from "@/lib/booking/booking-tree";
import {
  useBookingFocusInvalidation,
  useBookingServicesTree,
} from "@/lib/booking/use-booking-tree";
import { useOpenBookingDashboard } from "@/lib/booking/use-open-booking-dashboard";
import { cn } from "@/lib/utils";
import { Foldable } from "../Foldable";
import { useDesktopPreview, DESKTOP_BLOCK_TITLE } from "../desktop-preview";
import { useBookingProfileId } from "../booking-context";

/**
 * Preview of a BookingModule, mirroring the mobile `BookingWidget` and its
 * `booking/booking_block_{list,grid,swiper,promo,tile,format,states,placeholder}`
 * files (docs/booking-block-layouts.md §3.2, §5.3, §5.4).
 *
 * The block shows the site's REAL services tree — categories and their
 * sub-services — in one of four layouts modelled on the Products block:
 * `list` (Products list), `grid` (grid2), `swiper` (swiper3/shop), `promo`.
 *
 * States (owner's view): a layout-shaped shimmer while loading, an inline error
 * with Retry when the fetch failed and nothing is cached, an owner-only "No
 * services yet" notice with Manage booking, or the layout. The old
 * call-to-action card survives ONLY as the placeholder for template preview
 * cards / dashboard tiles, where there is no real profile to fetch from.
 *
 * Taps: in edit mode the canvas wrapper is `pointer-events-none`, so a tap
 * opens the settings sheet and every layout shows its initial state (collapsed,
 * root level, `All` chip) — only Manage booking and Retry stay live. In preview
 * mode categories navigate in place and leaves/buttons open the published page.
 * Leaving preview resets that in-place state (mobile `didUpdateWidget`).
 *
 * Names follow their own text direction (`dir="auto"`, Dart `BookingName`)
 * while staying aligned to the LAYOUT's start — the canvas is pinned to LTR,
 * so that is an explicit `text-left`, never the logical `text-start`, which
 * would jump an Arabic name to the right edge.
 *
 * Spacing identity: items `gap-2` phone / `gap-4` desktop; the 20px edge inset
 * comes from the canvas + block wrapper — never from this view.
 */

const FG = "var(--foreground)";
/** color.withValues(alpha) on the foreground color. */
function fg(alpha: number): string {
  return `color-mix(in srgb, ${FG} ${Math.round(alpha * 100)}%, transparent)`;
}
const PRIMARY_TINT = "color-mix(in srgb, var(--primary) 12%, transparent)";
const SCROLL_X =
  "overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// ─── Props shared by the layouts (BookingBlockProps) ────────────────────────

interface Props {
  block: BookingBlock;
  /** Preview mode with a real profile: in-place navigation is live. */
  interactive: boolean;
  /** `null` in edit mode (the wrapper owns the tap). */
  onBook: (() => void) | null;
  s: BookingFormatStrings;
  all: string;
  book: string;
  gap: string;
  duration: (leaf: BookingServiceNode) => string | null;
  price: (leaf: BookingServiceNode) => string | null;
  hint: (leaf: BookingServiceNode) => string | null;
  categoryMeta: (category: BookingServiceNode) => string;
}

function useFormatStrings(): BookingFormatStrings {
  const t = useTranslations("builder.bookingBlock");
  return useMemo(
    () => ({
      free: t("free"),
      payOnSite: t("payOnSite"),
      oneService: t("oneService"),
      servicesCount: (count) => t("servicesCount", { count }),
      fromPrice: (price) => t("fromPrice", { price }),
      minutes: (m) => t("minutes", { m }),
      hours: (h) => t("hours", { h }),
      hoursMinutes: (h, m) => t("hoursMinutes", { h, m }),
    }),
    [t],
  );
}

// ─── Block ──────────────────────────────────────────────────────────────────

export function BookingBlockView({ block }: { block: BookingBlock }) {
  const desktop = useDesktopPreview();
  const title = block.title ?? "";

  return (
    <div className="py-2">
      <Foldable
        foldable={block.foldable}
        header={
          title ? (
            // Mobile headlineMedium bold; desktop = Nuxt shared module title.
            <h2
              dir={dirOf(title)}
              className={
                desktop
                  ? `${DESKTOP_BLOCK_TITLE} text-foreground`
                  : "px-6 text-xl font-bold text-foreground"
              }
            >
              {title}
            </h2>
          ) : null
        }
      >
        <div className="pt-1.5">
          <BookingBody block={block} />
        </div>
      </Foldable>
    </div>
  );
}

function BookingBody({ block }: { block: BookingBlock }) {
  const t = useTranslations("builder.bookingBlock");
  const s = useFormatStrings();
  const desktop = useDesktopPreview();
  const profileId = useBookingProfileId();
  const previewEnabled = useEditorStore((st) => st.previewEnabled);
  const name = useEditorStore((st) => st.name);
  const pageUrlName = useEditorStore((st) => st.pageUrlName);

  const interactive = previewEnabled && profileId != null;

  // The published page this block lives on (mobile `WebsiteUtils.extractDomain`
  // + `/<urlName>` on a sub-page). There is no public booking URL, so a tap
  // opens the page and the renderer runs the booking flow there. Computed from
  // store state only, so the window opens SYNCHRONOUSLY in the click handler
  // (a popup after an await falls outside the transient-activation window).
  const publishedUrl = useMemo(() => {
    const slug =
      name
        ?.toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") || "me";
    const site = siteUrl(slug);
    return pageUrlName ? `${site}/${pageUrlName}` : site;
  }, [name, pageUrlName]);
  const openPublishedPage = useCallback(() => {
    window.open(publishedUrl, "_blank", "noopener");
  }, [publishedUrl]);

  const props = useMemo<Props>(() => {
    const showPrice = block.show_price !== false;
    const showDuration = block.show_duration !== false;
    const duration = (leaf: BookingServiceNode) => {
      if (!showDuration) return null;
      const text = formatDuration(leaf.duration, s);
      return text ? text : null;
    };
    const price = (leaf: BookingServiceNode) => {
      if (!showPrice) return null;
      const text = formatPrice(leaf, s);
      return text ? text : null;
    };
    return {
      block,
      interactive,
      onBook: interactive ? openPublishedPage : null,
      s,
      all: t("all"),
      book: t("book"),
      gap: desktop ? "gap-4" : "gap-2",
      duration,
      price,
      hint: (leaf) => (price(leaf) == null ? null : onSiteHint(leaf, s)),
      categoryMeta: (category) => {
        const from = showPrice ? formatFromPrice(category, s) : null;
        const count = formatServiceCount(leafCount(category), s);
        return from ? `${count} · ${from}` : count;
      },
    };
  }, [block, interactive, openPublishedPage, s, t, desktop]);

  // Template cards / dashboard tiles render a site that is not a real profile:
  // nothing to fetch (mobile `editor.previewOnly`).
  if (profileId == null) return <Placeholder props={props} />;
  return <LiveBody profileId={profileId} props={props} />;
}

function LiveBody({ profileId, props }: { profileId: string; props: Props }) {
  useBookingFocusInvalidation();
  const query = useBookingServicesTree(profileId);
  const layout: BookingLayoutType = props.block.layout_type ?? "list";

  const tree = query.data;
  if (tree == null) {
    if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
    return <Shimmer layout={layout} gap={props.gap} />;
  }
  const services = selectBookingServices(tree);
  if (selectedLeaves(services).length === 0) {
    return <OwnerNotice profileId={profileId} />;
  }
  switch (layout) {
    case "grid":
      return <GridLayout props={props} services={services} />;
    case "swiper":
      return <SwiperLayout props={props} services={services} />;
    case "promo":
      return <PromoLayout props={props} services={services} />;
    default:
      return <ListLayout props={props} services={services} />;
  }
}

/** Mobile `didUpdateWidget`: leaving preview returns a layout to its initial
 *  in-place state (collapsed / root level / `All` chip). */
function useResetWhenInactive(interactive: boolean, reset: () => void) {
  useEffect(() => {
    if (!interactive) reset();
    // `reset` is a stable state setter call.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive]);
}

// ─── Shared tiles (booking_block_tile.dart) ─────────────────────────────────

/**
 * A name that keeps its own text direction (`dir="auto"`) while aligning with
 * the surrounding layout's start — explicit `text-left`, the canvas being LTR.
 */
function Name({
  text,
  className,
  style,
  lines = 1,
  centered = false,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  lines?: 1 | 2;
  centered?: boolean;
}) {
  return (
    <p
      dir="auto"
      className={cn(
        lines === 1 ? "truncate" : "line-clamp-2",
        centered ? "text-center" : "text-left",
        className,
      )}
      style={style}
    >
      {text}
    </p>
  );
}

/**
 * The picture of a service. The public API returns no service image today, so
 * this is normally a generated tile — the accent at a low alpha with the
 * service's initial (first grapheme), or a stack icon for a category. When an
 * `image` does arrive it is shown with no layout change, falling back to the
 * tile if it fails to load.
 */
function Thumb({
  node,
  size,
  circle,
}: {
  node: BookingServiceNode;
  size: number;
  circle: boolean;
}) {
  // The src that failed to load (not a flag), so a changed image is retried.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const initial = initialOf(node.name);
  const shape = circle ? { borderRadius: 9999 } : { borderRadius: size * 0.24 };
  const showImage = !!node.image && node.image !== brokenSrc;
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden"
      style={{ width: size, height: size, backgroundColor: PRIMARY_TINT, ...shape }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cdnUrl(node.image as string)}
          alt=""
          className="size-full object-cover"
          onError={() => setBrokenSrc(node.image)}
        />
      ) : node.isCategory || !initial ? (
        node.isCategory ? (
          <Layers style={{ width: size * 0.36, height: size * 0.36 }} className="text-primary" />
        ) : (
          <CalendarCheck
            style={{ width: size * 0.36, height: size * 0.36 }}
            className="text-primary"
          />
        )
      ) : (
        <span
          className="font-bold leading-none text-primary"
          style={{ fontSize: size * 0.4 }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

/** The small "Book" pill on a card. Decorative: the card owns the tap. */
function BookPill({ label }: { label: string }) {
  return (
    <span
      className="inline-block max-w-full truncate rounded-full px-3.5 py-2 text-xs font-semibold text-primary"
      style={{ backgroundColor: PRIMARY_TINT }}
    >
      {label}
    </span>
  );
}

/** A price with its optional "Pay on site" line beneath. */
function PriceText({
  props,
  leaf,
  align = "start",
}: {
  props: Props;
  leaf: BookingServiceNode;
  align?: "start" | "center" | "end";
}) {
  const price = props.price(leaf);
  if (price == null) return null;
  const hint = props.hint(leaf);
  // Physical alignment: the canvas is LTR, so start = left, end = right.
  const textAlign = align === "center" ? "text-center" : align === "end" ? "text-right" : "text-left";
  return (
    <div className={cn("flex flex-col", textAlign)}>
      <span className="truncate text-sm font-bold" style={{ color: fg(0.95) }}>
        {price}
      </span>
      {hint && (
        <span className="truncate text-xs" style={{ color: fg(0.55) }}>
          {hint}
        </span>
      )}
    </div>
  );
}

/** A chevron that points the reading direction. */
function Chevron({ size, color, className }: { size: number; color: string; className?: string }) {
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
      className={cn("shrink-0 rtl:-scale-x-100", className)}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** BlurredBox — page foreground @ 10%. */
function Card({
  radius,
  className,
  onClick,
  children,
}: {
  radius: 12 | 16;
  className?: string;
  onClick: (() => void) | null;
  children: ReactNode;
}) {
  const style = { backgroundColor: fg(0.1), borderRadius: radius };
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("block w-full text-left", className)}
        style={style}
      >
        {children}
      </button>
    );
  }
  return (
    <div className={cn("w-full", className)} style={style}>
      {children}
    </div>
  );
}

// ─── list ───────────────────────────────────────────────────────────────────

/**
 * Products `list` rows. A category is an expandable row (count, "from" price,
 * chevron) with its sub-services indented beneath; a root leaf is a plain row.
 * Categories start collapsed when there are more than two at the root.
 */
function ListLayout({ props, services }: { props: Props; services: BookingServiceNode[] }) {
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());
  useResetWhenInactive(props.interactive, () => setToggled(new Set()));
  const openByDefault = services.filter((n) => n.isCategory).length <= 2;
  const isOpen = (category: BookingServiceNode) =>
    openByDefault !== (props.interactive && toggled.has(category.id));
  const toggle = (id: string) =>
    setToggled((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const renderNode = (node: BookingServiceNode, depth: number): ReactNode[] => {
    const indent = { paddingInlineStart: depth * 20 };
    if (isLeaf(node)) {
      return [
        <div key={node.id} style={indent}>
          <Row
            node={node}
            props={props}
            onClick={props.onBook}
            trailing={
              props.price(node) == null ? null : (
                <div className="max-w-[110px]">
                  <PriceText props={props} leaf={node} align="end" />
                </div>
              )
            }
          >
            <Name
              text={node.name}
              lines={2}
              className="text-sm font-medium"
              style={{ color: fg(0.8) }}
            />
            {props.duration(node) && (
              <p className="mt-0.5 truncate text-left text-xs" style={{ color: fg(0.6) }}>
                {props.duration(node)}
              </p>
            )}
          </Row>
        </div>,
      ];
    }
    const open = isOpen(node);
    return [
      <div key={node.id} style={indent}>
        <Row
          node={node}
          props={props}
          onClick={props.interactive ? () => toggle(node.id) : null}
          trailing={
            <Chevron
              size={14}
              color={fg(0.6)}
              className={cn(
                "me-1 transition-transform duration-200",
                open && "rotate-90 rtl:-rotate-90",
              )}
            />
          }
        >
          <Name
            text={node.name}
            lines={2}
            className="text-sm font-semibold"
            style={{ color: fg(0.85) }}
          />
          <p className="mt-0.5 truncate text-left text-xs" style={{ color: fg(0.6) }}>
            {props.categoryMeta(node)}
          </p>
        </Row>
      </div>,
      open ? (
        <div key={`${node.id}-children`} className={cn("flex flex-col", props.gap)}>
          {node.children.flatMap((child) => renderNode(child, depth + 1))}
        </div>
      ) : null,
    ];
  };

  return (
    <div className={cn("flex flex-col", props.gap)}>
      {services.flatMap((node) => renderNode(node, 0))}
    </div>
  );
}

function Row({
  node,
  props,
  onClick,
  trailing,
  children,
}: {
  node: BookingServiceNode;
  props: Props;
  onClick: (() => void) | null;
  trailing: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card radius={12} onClick={onClick} className="p-2.5">
      <div className="flex items-center gap-3">
        <Thumb node={node} size={52} circle={!!props.block.circle_image} />
        <div className="min-w-0 flex-1">{children}</div>
        {trailing && <div className="ms-2 shrink-0">{trailing}</div>}
      </div>
    </Card>
  );
}

// ─── grid ───────────────────────────────────────────────────────────────────

/**
 * Two-column cards (Products `grid2`). A category is a folder card; tapping it
 * drills in and a breadcrumb `All › Hair` leads back. A leaf card carries
 * duration, price and a Book pill.
 */
function GridLayout({ props, services }: { props: Props; services: BookingServiceNode[] }) {
  const [path, setPath] = useState<string[]>([]);
  useResetWhenInactive(props.interactive, () => setPath([]));

  // Folders along the path that still exist in the current selection.
  const trail: BookingServiceNode[] = [];
  let level = services;
  for (const id of props.interactive ? path : []) {
    const folder = level.find((n) => n.isCategory && n.id === id);
    if (!folder) break;
    trail.push(folder);
    level = folder.children;
  }
  const goTo = (next: BookingServiceNode[]) => setPath(next.map((n) => n.id));

  return (
    <div className="flex flex-col">
      {trail.length > 0 && (
        <div className={cn("mb-1 flex items-center", SCROLL_X)}>
          <Crumb label={props.all} onClick={() => goTo([])} />
          {trail.map((node, i) => (
            <span key={node.id} className="flex items-center">
              <Chevron size={10} color={fg(0.4)} />
              <Crumb
                label={node.name}
                onClick={i === trail.length - 1 ? null : () => goTo(trail.slice(0, i + 1))}
              />
            </span>
          ))}
        </div>
      )}
      <div className={cn("grid grid-cols-2 py-1", props.gap)}>
        {level.map((node) => (
          <GridCard
            key={node.id}
            node={node}
            props={props}
            onOpenFolder={props.interactive ? () => goTo([...trail, node]) : null}
          />
        ))}
      </div>
    </div>
  );
}

function Crumb({ label, onClick }: { label: string; onClick: (() => void) | null }) {
  const current = onClick == null;
  const style = { color: fg(current ? 0.9 : 0.6) };
  const cls = cn("px-2 text-sm", current ? "font-bold" : "font-medium");
  if (current) return <Name text={label} className={cls} style={style} />;
  return (
    <button type="button" onClick={onClick} className="h-9 shrink-0">
      <Name text={label} className={cls} style={style} />
    </button>
  );
}

function GridCard({
  node,
  props,
  onOpenFolder,
}: {
  node: BookingServiceNode;
  props: Props;
  onOpenFolder: (() => void) | null;
}) {
  const isFolder = node.isCategory;
  const meta = isFolder ? props.categoryMeta(node) : props.duration(node);
  return (
    <Card radius={12} onClick={isFolder ? onOpenFolder : props.onBook} className="h-full p-3">
      <div className="flex h-full flex-col items-center">
        <Thumb node={node} size={56} circle={!!props.block.circle_image} />
        <Name
          text={node.name}
          lines={2}
          centered
          className="mt-2.5 w-full text-sm font-semibold"
          style={{ color: fg(0.85) }}
        />
        {meta && (
          <p className="mt-0.5 line-clamp-2 text-center text-xs" style={{ color: fg(0.6) }}>
            {meta}
          </p>
        )}
        {!isFolder && (
          <div className="mt-1">
            <PriceText props={props} leaf={node} align="center" />
          </div>
        )}
        <div className="flex-1" />
        <div className="mt-2.5 flex justify-center">
          {isFolder ? <Chevron size={12} color={fg(0.5)} /> : <BookPill label={props.book} />}
        </div>
      </div>
    </Card>
  );
}

// ─── swiper ─────────────────────────────────────────────────────────────────

/**
 * Category chips over a horizontal carousel of service cards (Products
 * `swiper3` / `shop`). Chips are All plus the root categories; a chip shows
 * every leaf in its subtree. With no categories the chip row is hidden.
 */
function SwiperLayout({ props, services }: { props: Props; services: BookingServiceNode[] }) {
  const [chip, setChip] = useState<string | null>(null);
  useResetWhenInactive(props.interactive, () => setChip(null));
  const categories = services.filter((n) => n.isCategory);
  const chosen = props.interactive ? categories.find((c) => c.id === chip) ?? null : null;
  const leaves = chosen ? leavesOf(chosen) : selectedLeaves(services);

  return (
    <div className="flex flex-col">
      {categories.length > 0 && (
        <div className={cn("flex h-11 items-center gap-2 py-1", SCROLL_X)}>
          <Chip
            label={props.all}
            selected={chosen == null}
            onClick={props.interactive ? () => setChip(null) : null}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={chosen?.id === c.id}
              onClick={props.interactive ? () => setChip(c.id) : null}
            />
          ))}
        </div>
      )}
      <div className={cn("mt-1.5 flex snap-x py-1", props.gap, SCROLL_X)}>
        {leaves.map((leaf) => (
          <div key={leaf.id} className="w-[160px] shrink-0 snap-start">
            <SwiperCard leaf={leaf} props={props} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: (() => void) | null;
}) {
  const inner = (
    <Name
      text={label}
      className={cn("text-xs font-semibold", selected ? "text-white" : undefined)}
      style={selected ? undefined : { color: fg(0.8) }}
    />
  );
  const cls = "flex h-full max-w-[180px] shrink-0 items-center rounded-full px-3.5 transition-colors";
  const style = selected ? { backgroundColor: "var(--primary)" } : { backgroundColor: fg(0.08) };
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}

function SwiperCard({ leaf, props }: { leaf: BookingServiceNode; props: Props }) {
  const duration = props.duration(leaf);
  return (
    <Card radius={16} onClick={props.onBook} className="h-full p-3">
      <div className="flex h-full flex-col items-start">
        <Thumb node={leaf} size={48} circle={!!props.block.circle_image} />
        <Name
          text={leaf.name}
          lines={2}
          className="mt-2.5 w-full text-sm font-bold leading-tight"
          style={{ color: fg(0.9) }}
        />
        {duration && (
          <p className="mt-0.5 w-full truncate text-left text-xs" style={{ color: fg(0.6) }}>
            {duration}
          </p>
        )}
        <div className="flex-1" />
        <div className="mt-2 w-full">
          <PriceText props={props} leaf={leaf} />
        </div>
        <div className="mt-2">
          <BookPill label={props.book} />
        </div>
      </div>
    </Card>
  );
}

// ─── promo ──────────────────────────────────────────────────────────────────

/**
 * One large card per bookable service (Products / Links `promo`). Categories
 * cannot be booked, so they are never cards: a leaf's category shows as the
 * small uppercase eyebrow above its name.
 */
function PromoLayout({ props, services }: { props: Props; services: BookingServiceNode[] }) {
  return (
    <div className={cn("flex flex-col", props.gap)}>
      {selectedLeaves(services).map((leaf) => (
        <PromoCard key={leaf.id} leaf={leaf} props={props} />
      ))}
    </div>
  );
}

function PromoCard({ leaf, props }: { leaf: BookingServiceNode; props: Props }) {
  const duration = props.duration(leaf);
  return (
    <Card radius={16} onClick={props.onBook} className="p-4">
      <div className="flex items-center gap-3.5">
        <div className="flex min-w-0 flex-1 flex-col">
          {leaf.parentName && (
            <Name
              text={leaf.parentName.toUpperCase()}
              className="mb-1 text-xs font-bold tracking-wide text-primary"
            />
          )}
          <p
            dir="auto"
            className="line-clamp-2 text-left text-base font-bold leading-tight"
            style={{ color: fg(0.9) }}
          >
            {leaf.name}
            {duration && (
              <span className="text-sm font-medium" style={{ color: fg(0.6) }}>
                {` · ${duration}`}
              </span>
            )}
          </p>
          {leaf.description && (
            <p
              dir="auto"
              className="mt-1.5 line-clamp-2 text-left text-xs leading-snug"
              style={{ color: fg(0.7) }}
            >
              {leaf.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2.5">
            <div className="min-w-0 flex-1">
              <PriceText props={props} leaf={leaf} />
            </div>
            <BookPill label={props.book} />
          </div>
        </div>
        {/* The API has no service image today; the card only grows a picture
            if one arrives (Dart: `if (leaf.image != null)`). */}
        {leaf.image && <Thumb node={leaf} size={96} circle={!!props.block.circle_image} />}
      </div>
    </Card>
  );
}

// ─── States (booking_block_states.dart) ─────────────────────────────────────

function ShimmerBox({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl", className)}
      style={{ backgroundColor: fg(0.08), ...style }}
    />
  );
}

/** Loading placeholder shaped like the layout that is about to appear. */
function Shimmer({ layout, gap }: { layout: BookingLayoutType; gap: string }) {
  switch (layout) {
    case "grid":
      return (
        <div className={cn("grid grid-cols-2 py-1", gap)}>
          {[0, 1, 2, 3].map((i) => (
            <ShimmerBox key={i} className="h-[170px]" />
          ))}
        </div>
      );
    case "swiper":
      return (
        <div className="flex flex-col">
          <div className="flex gap-2 py-1">
            {[0, 1, 2].map((i) => (
              <ShimmerBox key={i} className="h-8 w-16 rounded-full" />
            ))}
          </div>
          <div className={cn("mt-1.5 flex overflow-hidden py-1", gap)}>
            {[0, 1, 2].map((i) => (
              <ShimmerBox key={i} className="h-[190px] w-[160px] shrink-0 rounded-2xl" />
            ))}
          </div>
        </div>
      );
    case "promo":
      return (
        <div className={cn("flex flex-col", gap)}>
          {[0, 1].map((i) => (
            <ShimmerBox key={i} className="h-[140px] rounded-2xl" />
          ))}
        </div>
      );
    default:
      return (
        <div className={cn("flex flex-col", gap)}>
          {[0, 1, 2].map((i) => (
            <ShimmerBox key={i} className="h-[72px]" />
          ))}
        </div>
      );
  }
}

const NOTICE_FRAME = {
  backgroundColor: fg(0.04),
  border: `1px solid ${fg(0.1)}`,
};

/**
 * Why the block has nothing to draw. Visitors never see this — the published
 * site falls back to the button — so it speaks to the owner. Manage booking
 * stays live in edit mode too (`pointer-events-auto` under the canvas's
 * `pointer-events-none` wrapper).
 */
function OwnerNotice({ profileId }: { profileId: string }) {
  const t = useTranslations("builder.bookingBlock");
  const openDashboard = useOpenBookingDashboard();
  return (
    <div className="py-2">
      <div className="flex flex-col items-center rounded-[14px] px-5 pb-2 pt-5" style={NOTICE_FRAME}>
        <Layers className="size-7" style={{ color: fg(0.45) }} />
        <p className="mt-3 text-center text-sm font-semibold" style={{ color: fg(0.85) }}>
          {t("noServicesTitle")}
        </p>
        <p className="mt-1 text-center text-xs" style={{ color: fg(0.6) }}>
          {t("noServicesBody")}
        </p>
        <p className="mt-2.5 text-center text-xs italic" style={{ color: fg(0.4) }}>
          {t("ownerOnly")}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openDashboard(profileId);
          }}
          className="pointer-events-auto mt-1 px-3 py-2 text-sm font-semibold text-primary"
        >
          {t("manageBooking")}
        </button>
      </div>
    </div>
  );
}

/** A fetch failed: an inline line with Retry, never a toast. */
function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("builder.bookingBlock");
  return (
    <div className="py-2">
      <div className="flex items-center gap-2.5 rounded-xl py-1.5 pe-1.5 ps-4" style={NOTICE_FRAME}>
        <CircleAlert className="size-4 shrink-0" style={{ color: fg(0.5) }} />
        <p className="min-w-0 flex-1 text-xs" style={{ color: fg(0.7) }}>
          {t("loadFailed")}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
          className="pointer-events-auto px-3 py-1.5 text-sm font-semibold text-primary"
        >
          {t("retry")}
        </button>
      </div>
    </div>
  );
}

// ─── Placeholder (booking_block_placeholder.dart) ───────────────────────────

/**
 * The block's original look — calendar, blurb and the `button_label` call to
 * action — kept only for template preview cards and dashboard tiles, which
 * render a site that is not a real profile. Not a layout.
 */
function Placeholder({ props }: { props: Props }) {
  const t = useTranslations("builder.bookingBlock");
  const desktop = useDesktopPreview();
  const buttonLabel = props.block.button_label || t("bookNow");
  return (
    <div className="py-2">
      <div className="flex flex-col items-center rounded-[14px] p-5" style={NOTICE_FRAME}>
        {/* Cupertino calendar icon, size 36, #4CAF50 @ 70% */}
        <svg
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4CAF50"
          strokeOpacity={0.7}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
          <path d="M3 9h18M8 2.5v4M16 2.5v4" />
        </svg>
        <p className="mt-2.5 text-center text-xs" style={{ color: fg(0.5) }}>
          {t("placeholder")}
        </p>
        {/* Desktop = Nuxt ServiceCard.vue .book-now-btn: black label on white. */}
        <span
          dir={dirOf(buttonLabel)}
          className={cn(
            "mt-3.5 rounded-[10px] px-6 py-2.5 text-sm",
            desktop ? "font-medium" : "font-semibold text-primary",
          )}
          style={
            desktop
              ? { backgroundColor: "#ffffff", color: "#000" }
              : { backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }
          }
        >
          {buttonLabel}
        </span>
      </div>
    </div>
  );
}
