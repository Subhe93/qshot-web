import type { ButtonBlock, ButtonItem } from "@/lib/types/blocks";
import { argbToCss } from "@/lib/builder/color";
import { cdnUrl } from "@/lib/api/qrcodes";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";

/**
 * Read-only preview for ButtonBlock ("ButtonModule"), faithful to the Flutter
 * `ButtonWidget` (lib/features/website/widget/editor/button_widget.dart).
 *
 * THEMES — note the mobile app does NOT re-style buttons at render time. Picking
 * a ButtonThemeType (minimal/solid/soft/outline/pill) stamps the template's
 * style onto every ButtonItem via `ButtonThemeType.applyTo` (buttons_settings_
 * cubit.dart:27), so the resolved colors are already baked into each item's
 * use-flag/color fields. This view therefore renders each button purely from its
 * own resolved style, exactly like `buildButtonTile` (button_widget.dart:151) —
 * which is what makes all five themes render correctly:
 *
 *  - solid   : primary fill, white text, radius 12.
 *  - soft    : primary @14% fill, primary text, radius 12.
 *  - outline : no fill, primary border, primary text, radius 12.
 *  - pill    : primary fill, white text, radius 100 (fully rounded).
 *  - minimal : grey @30% fill, no override text (foreground @85%), radius 8.
 *
 * Per-button color resolution mirrors mobile getters (block_entity.dart:2119):
 *  - getBackgroundColor() = use_background_color ? background_color : null
 *  - getBorderColor()     = use_border          ? border_color     : null
 *  - getTextColor()       = use_text_color       ? text_color       : null
 *  - radius               = corner_radius ?? 12
 * A null fill paints no background; a null text color falls back to the page
 * foreground at 85% (foreground.withValues(alpha: 0.85)).
 */

/** Chevron-right glyph (FontAwesomeIcons.chevronRight), flips for RTL. */
function Chevron({ size, color }: { size: number; color: string }) {
  return (
    <svg
      viewBox="0 0 320 512"
      width={size}
      height={size}
      fill={color}
      className="rtl:rotate-180"
      aria-hidden="true"
    >
      <path d="M285.5 273L91.4 467a24 24 0 0 1-34 0l-22.7-22.7a24 24 0 0 1 0-33.9L188.5 256 34.7 101.6a24 24 0 0 1 0-33.9L57.4 45a24 24 0 0 1 34 0l194 194a24 24 0 0 1 0 34z" />
    </svg>
  );
}

/**
 * One button tile — the web counterpart of `buildButtonTile`. Fixed height 56,
 * with a square (AspectRatio 1) icon slot on the leading edge, a centered title
 * that fills the remaining width, and a square trailing slot for the arrow.
 */
function ButtonTile({
  item,
  showArrow,
  compact,
}: {
  item: ButtonItem;
  showArrow: boolean;
  /** grid tiles are narrow — drop the empty centering slots so the title fits. */
  compact?: boolean;
}) {
  // Mirror the mobile getters: a style only applies when its use_* flag is on.
  const fill =
    item.use_background_color ? argbToCss(item.background_color) : undefined;
  const border = item.use_border ? argbToCss(item.border_color) : undefined;
  // Null text color → foreground @85% (the page text token at 0.85 alpha).
  const text = item.use_text_color
    ? argbToCss(item.text_color)
    : "color-mix(in srgb, var(--foreground) 85%, transparent)";
  const radius = item.corner_radius ?? 12;
  const title = item.title ?? "";

  return (
    <a
      href={item.url || undefined}
      onClick={(e) => e.preventDefault()}
      className="flex h-14 items-center overflow-hidden"
      style={{
        backgroundColor: fill,
        borderRadius: radius,
        border: border ? `1.5px solid ${border}` : undefined,
        color: text,
      }}
    >
      {/* Leading icon slot. In list, also reserve an empty slot opposite the
          arrow so the title stays centered; in grid (narrow) we never reserve
          empty slots so the title isn't squeezed. */}
      {item.icon ? (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cdnUrl(item.icon)}
            alt=""
            className="size-full rounded-[10px] object-cover p-2"
          />
        </span>
      ) : !compact && showArrow ? (
        <span className="h-14 w-14 shrink-0" />
      ) : (
        <span className="w-3 shrink-0" />
      )}

      {/* Centered, single-line title filling the remaining width. */}
      <span
        dir={dirOf(title)}
        className="min-w-0 flex-1 truncate text-center text-base font-semibold"
      >
        {title}
      </span>

      {/* Trailing slot — chevron when show_arrow; an empty centering slot in
          list when there's a leading icon; otherwise just padding. */}
      <span
        className={
          showArrow || (!compact && !!item.icon)
            ? "flex h-14 w-14 shrink-0 items-center justify-center"
            : "w-3 shrink-0"
        }
      >
        {showArrow ? (
          <Chevron
            size={13}
            // textColor.withValues(alpha: 0.7) — derive from the resolved text.
            color={
              text
                ? `color-mix(in srgb, ${text} 70%, transparent)`
                : "color-mix(in srgb, var(--foreground) 60%, transparent)"
            }
          />
        ) : null}
      </span>
    </a>
  );
}

export function ButtonBlockView({ block }: { block: ButtonBlock }) {
  const items = (block.buttons ?? []).filter((b) => !b.hidden);
  const title = block.title?.trim() ?? "";
  const showArrow = !!block.show_arrow;
  const isGrid = block.layout_type === "grid";

  return (
    <div className="py-2">
      <Foldable
        foldable={block.foldable}
        header={
          title ? (
            <>
              {/* Mobile headlineMedium = 20px (text-xl). */}
              <h2 dir={dirOf(title)} className="px-6 text-xl font-bold text-foreground">
                {title}
              </h2>
              <div className="h-[5px]" />
            </>
          ) : null
        }
      >
        {items.length === 0 ? (
          <p className="px-6 py-4 text-center text-xs text-muted-foreground/60">
            No buttons yet
          </p>
        ) : isGrid ? (
          // 2 columns, gap 10 (crossAxis + mainAxis spacing), 16px horizontal pad.
          <div className="grid grid-cols-2 gap-2.5 px-4">
            {items.map((item, i) => (
              <ButtonTile key={item.id ?? i} item={item} showArrow={showArrow} compact />
            ))}
          </div>
        ) : (
          // List: each tile vertical padding 5, 16px horizontal pad.
          <div className="flex flex-col gap-2.5 px-4">
            {items.map((item, i) => (
              <ButtonTile key={item.id ?? i} item={item} showArrow={showArrow} />
            ))}
          </div>
        )}
      </Foldable>
    </div>
  );
}
