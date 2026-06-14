"use client";

import { useEffect, useState } from "react";
import type { SocialLinksBlock, SocialLinkItem } from "@/lib/types/blocks";
import { argbToCss } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";
import {
  socialIconUrl,
  platformByName,
  isDynamicPlatform,
} from "@/lib/builder/social-platforms";

/**
 * Read-only preview of a `social_links` block, mirroring the mobile
 * `SocialLinksWidget`
 * (lib/features/website/widget/editor/social_links_widget.dart). Every one of the
 * 8 SocialLinksLayoutType variants is laid out exactly as the Flutter widget:
 *
 *  - gridAlignStart / End / Center → Wrap (spacing 15) of 44x44 rounded icons,
 *    aligned start / end / center; padded 8 (start/end also Centered).
 *  - grid                          → Wrap (spacing 20) of 0.2.sw squares with a
 *    rounded-20 icon + centered label below.
 *  - layoutSlider                  → horizontal scroll, Wrap spacing 15 of 44x44
 *    icons; padded h24 v8, centered.
 *  - list / listAlignEnd           → Column (spacing 15) of 50-tall rows:
 *    [icon 50, gap 15, name] — listAlignEnd reverses to [name(end), gap, icon].
 *  - listAlignCenter               → Column (spacing 15) of centered
 *    [icon 36, gap 6, name].
 *
 * Hidden links are filtered out. Icons resolve via `socialIconUrl` (colored, or
 * the dark variant when icon_type === "darkFilled"). When `adaptive_icon_color`
 * is on, the mobile recolors the dark SVG so ONLY pure-black strokes/fills become
 * the chip color, leaving any other colors intact (SocialChipColorMapper). We
 * reproduce that faithfully by fetching the dark SVG and recoloring just its black
 * paints inline; if the fetch fails we fall back to a CSS mask tint.
 */
export function SocialLinksBlockView({ block }: { block: SocialLinksBlock }) {
  const items = (block.links ?? []).filter((l) => !l.hidden);
  if (items.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground/60">
        No social links yet
      </p>
    );
  }

  const layout = block.layout_type ?? "list";

  // Mirrors block.getEffectiveChipColor(pageBg): only when adaptive is on. We use
  // the explicit custom color, else harmonize the block's own background color.
  const chipColor = effectiveChipColor(block);
  // When a chip color applies the mobile switches to the darkFilled icon variant
  // (and tints it). Otherwise the variant follows icon_type.
  const variant: "colored" | "dark" =
    chipColor != null || block.icon_type === "darkFilled" ? "dark" : "colored";

  const renderIcon = (item: SocialLinkItem, size: number, radius: number) => (
    <SocialIcon
      item={item}
      size={size}
      radius={radius}
      variant={variant}
      chipColor={chipColor}
    />
  );

  // ── Grid alignments (start / center / end) ──
  if (
    layout === "gridAlignStart" ||
    layout === "gridAlignCenter" ||
    layout === "gridAlignEnd"
  ) {
    const justify =
      layout === "gridAlignStart"
        ? "justify-start"
        : layout === "gridAlignEnd"
          ? "justify-end"
          : "justify-center";
    return (
      <div className="p-2">
        <div className={`flex flex-wrap gap-[15px] ${justify}`}>
          {items.map((item, i) => (
            <a
              key={item.id ?? i}
              href={item.link || undefined}
              onClick={(e) => e.preventDefault()}
              className="block"
            >
              {renderIcon(item, 44, 10)}
            </a>
          ))}
        </div>
      </div>
    );
  }

  // ── Plain grid: square cells with label below ──
  if (layout === "grid") {
    return (
      <div className="p-2">
        <div className="flex flex-wrap justify-center gap-5">
          {items.map((item, i) => (
            <a
              key={item.id ?? i}
              href={item.link || undefined}
              onClick={(e) => e.preventDefault()}
              className="flex w-[20%] min-w-[64px] flex-col"
            >
              <SocialIcon
                item={item}
                size="100%"
                radius={20}
                variant={variant}
                chipColor={chipColor}
                square
              />
              <span
                dir={dirOf(displayName(item))}
                className="mt-[5px] text-center text-xs text-foreground"
              >
                {displayName(item)}
              </span>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // ── Slider: horizontal scroll of 44x44 icons ──
  if (layout === "layoutSlider") {
    return (
      <div className="flex justify-center">
        <div className="flex gap-[15px] overflow-x-auto px-6 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, i) => (
            <a
              key={item.id ?? i}
              href={item.link || undefined}
              onClick={(e) => e.preventDefault()}
              className="block shrink-0"
            >
              {renderIcon(item, 44, 10)}
            </a>
          ))}
        </div>
      </div>
    );
  }

  // ── Lists (list / listAlignEnd / listAlignCenter) ──
  const isEnd = layout === "listAlignEnd";
  const isCenter = layout === "listAlignCenter";
  return (
    <div className="flex flex-col gap-[15px] px-[30px] py-2">
      {items.map((item, i) => {
        const name = displayName(item);
        const dir = dirOf(name);
        if (isCenter) {
          return (
            <a
              key={item.id ?? i}
              href={item.link || undefined}
              onClick={(e) => e.preventDefault()}
              className="flex flex-col items-center"
            >
              {renderIcon(item, 36, 8)}
              <span
                dir={dir}
                className="mt-1.5 text-center text-sm text-foreground"
              >
                {name}
              </span>
            </a>
          );
        }
        return (
          <a
            key={item.id ?? i}
            href={item.link || undefined}
            onClick={(e) => e.preventDefault()}
            className="flex h-[50px] items-center"
          >
            {!isEnd && (
              <>
                {renderIcon(item, 50, 10)}
                <span className="w-[15px] shrink-0" />
              </>
            )}
            <span
              dir={dir}
              className={`flex-1 truncate text-sm text-foreground ${
                isEnd ? "text-end" : "text-start"
              }`}
            >
              {name}
            </span>
            {isEnd && (
              <>
                <span className="w-[15px] shrink-0" />
                {renderIcon(item, 50, 10)}
              </>
            )}
          </a>
        );
      })}
    </div>
  );
}

/**
 * A single social icon. For dynamic (custom-uploaded) icons and the normal
 * colored/dark variants we render a plain <img>. When an adaptive chip color
 * applies, the mobile recolors the monochrome dark SVG so ONLY its pure-black
 * paints become the chip color (SocialChipColorMapper). We reproduce that by
 * fetching the dark SVG and recoloring just its black fills/strokes inline,
 * preserving any other colors (e.g. white glyphs). If the fetch hasn't resolved
 * or fails, we fall back to the previous CSS mask tint so the icon never blanks.
 */
function SocialIcon({
  item,
  size,
  radius,
  variant,
  chipColor,
  square,
}: {
  item: SocialLinkItem;
  size: number | string;
  radius: number;
  variant: "colored" | "dark";
  chipColor?: string;
  square?: boolean;
}) {
  const url = socialIconUrl(item, variant);
  const dynamic = isDynamicPlatform(item.type) && !!item.icon;
  const dimension = typeof size === "number" ? `${size}px` : size;
  const box: React.CSSProperties = square
    ? { width: "100%", aspectRatio: "1 / 1", borderRadius: radius }
    : { width: dimension, height: dimension, borderRadius: radius };

  // Adaptive tint: only for non-dynamic, bundled brand icons (custom uploads keep
  // their image). Bundled icons are served from /brand-icons/, so we can fetch and
  // recolor only their black paints.
  const adaptive = !!chipColor && !dynamic && url.startsWith("/brand-icons/");
  const recolored = useRecoloredSvg(adaptive ? url : undefined, chipColor);

  if (adaptive && recolored) {
    return (
      <span
        aria-hidden
        className="block shrink-0 overflow-hidden [&>svg]:h-full [&>svg]:w-full"
        style={box}
        dangerouslySetInnerHTML={{ __html: recolored }}
      />
    );
  }

  // Fall back to the mask tint while the SVG loads or if the fetch failed. Still
  // only applies to non-dynamic icons.
  if (chipColor && !dynamic) {
    return (
      <span
        aria-hidden
        className="block shrink-0 overflow-hidden"
        style={{
          ...box,
          backgroundColor: chipColor,
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className="block shrink-0 object-contain"
      style={box}
    />
  );
}

// Client-side cache of recolored SVG markup, keyed by `${url}|${chipColor}`.
const recolorCache = new Map<string, string>();

/**
 * Fetch the bundled dark brand SVG at `url` and recolor only its pure-black
 * paints to `chipColor`, mirroring the mobile SocialChipColorMapper (which
 * substitutes only 0xFF000000). Returns the sanitized inline markup, or
 * undefined while loading / on failure (caller falls back to the mask tint).
 */
function useRecoloredSvg(
  url: string | undefined,
  chipColor: string | undefined,
): string | undefined {
  const key = url && chipColor ? `${url}|${chipColor}` : undefined;
  // Tracks only the async fetch result; the cache hit is read synchronously
  // below so the effect never needs to call setState for the non-async paths.
  const [fetched, setFetched] = useState<Map<string, string>>(recolorCache);

  useEffect(() => {
    if (!key || !url || !chipColor || recolorCache.has(key)) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("fetch failed"))))
      .then((text) => {
        recolorCache.set(key, recolorBlackPaints(text, chipColor));
        // Swap in a new Map reference to re-render with the cached result.
        if (!cancelled) setFetched(new Map(recolorCache));
      })
      .catch(() => {
        // Leave it uncached → caller falls back to the mask tint.
      });
    return () => {
      cancelled = true;
    };
  }, [key, url, chipColor]);

  return key ? fetched.get(key) : undefined;
}

/**
 * Replace only pure-black paints in SVG markup with `replacement`, leaving every
 * other color intact. Covers the formats the brand SVGs use (`fill="black"`) plus
 * defensive coverage for `#000`, `#000000`, and rgb/argb black, on both `fill`
 * and `stroke` attributes. As a light sanitization the markup is also stripped of
 * any <script> tags before being rendered inline.
 */
function recolorBlackPaints(svg: string, replacement: string): string {
  const black =
    /(fill|stroke)\s*=\s*"(black|#000|#000000|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*1\s*\)|0xff000000)"/gi;
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(black, (_m, attr) => `${attr}="${replacement}"`);
}

/** item.displayName(item.type.text): the name, else the platform's label. */
function displayName(item: SocialLinkItem): string {
  const n = item.name?.trim();
  if (n) return n;
  return platformByName(item.type)?.label ?? item.type;
}

/**
 * Mirrors SocialLinksBlock.getEffectiveChipColor(pageBg):
 *  - null unless adaptive_icon_color is on.
 *  - custom_icon_color wins outright.
 *  - else harmonize the block's own background color (page bg is not available to
 *    a single block view; the block bg is the closest faithful base).
 * Returns a CSS color string or undefined.
 */
function effectiveChipColor(block: SocialLinksBlock): string | undefined {
  if (!block.adaptive_icon_color) return undefined;
  if (block.custom_icon_color != null) {
    return argbToCss(block.custom_icon_color);
  }
  const base = block.use_background_color ? block.background_color : null;
  if (base == null) return undefined;
  return harmonizeChipColor(base);
}

/**
 * Port of SocialLinksBlock._harmonizeChipColor: shift the base color's lightness
 * by 0.1 away from mid so the chip stays monochromatic but visually distinct.
 */
function harmonizeChipColor(argb: number): string {
  const r = ((argb >>> 16) & 0xff) / 255;
  const g = ((argb >>> 8) & 0xff) / 255;
  const b = (argb & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const shiftedL =
    l < 0.5 ? Math.min(1, l + 0.1) : Math.max(0, l - 0.1);
  return hslToCss(h, s, shiftedL);
}

function hslToCss(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return `rgb(${Math.round((r + m) * 255)}, ${Math.round(
    (g + m) * 255,
  )}, ${Math.round((b + m) * 255)})`;
}
