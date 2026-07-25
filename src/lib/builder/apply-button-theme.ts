/**
 * ButtonThemeType.applyTo — exact port of the mobile enum method in
 * `layout_types.dart` (origin/dev). Stamps a theme's style properties onto a
 * ButtonItem, keeping the item's content (title / url / icon / hidden / id)
 * untouched. Shared by the Button block editor (no palette → app-brand
 * defaults) and the website-template apply engine (palette colors).
 *
 * copyWith semantics: fields a theme doesn't set keep their prior values
 * (e.g. `outline` keeps the old `background_color` int while
 * `use_background_color` goes false; `minimal` keeps the old `text_color`).
 *
 * ⚠ `soft` and `minimal` bake TRANSLUCENT ARGB ints:
 *   soft    → fill @ alpha 0.14 → alpha byte round(0.14*255) = 36 = 0x24
 *   minimal → Colors.grey (0xFF9E9E9E) @ alpha 0.3 → 0x4D9E9E9E
 */

import type { ButtonItem, ButtonThemeType } from "@/lib/types/blocks";
import { withAlphaFloat } from "./flutter-color";

/** Mobile `AppColors.primary` — the default fill when no palette is passed. */
export const DEFAULT_BUTTON_PRIMARY = 0xff4488ff;

const WHITE = 0xffffffff;
/** Flutter `Colors.grey` (shade 500). */
const GREY = 0xff9e9e9e;

export interface ButtonThemeColors {
  /** Palette `primary`; defaults to AppColors.primary (0xFF4488FF). */
  primary?: number;
  /** Palette `onPrimary`; defaults to white. */
  onPrimary?: number;
  /** Palette `onPrimarySoft`; defaults to the fill color. */
  onSoft?: number;
}

/** Exact port of `ButtonThemeType.applyTo(item, {primary, onPrimary, onSoft})`. */
export function applyButtonTheme(
  theme: ButtonThemeType,
  item: ButtonItem,
  colors: ButtonThemeColors = {},
): ButtonItem {
  const fill = colors.primary ?? DEFAULT_BUTTON_PRIMARY;
  const onFill = colors.onPrimary ?? WHITE;
  const onTint = colors.onSoft ?? fill;

  switch (theme) {
    case "solid":
      return {
        ...item,
        background_color: fill,
        use_background_color: true,
        use_border: false,
        text_color: onFill,
        use_text_color: true,
        corner_radius: 12,
      };
    case "soft":
      return {
        ...item,
        background_color: withAlphaFloat(fill, 0.14),
        use_background_color: true,
        use_border: false,
        text_color: onTint,
        use_text_color: true,
        corner_radius: 12,
      };
    case "outline":
      return {
        ...item,
        use_background_color: false,
        border_color: fill,
        use_border: true,
        text_color: onTint,
        use_text_color: true,
        corner_radius: 12,
      };
    case "pill":
      return {
        ...item,
        background_color: fill,
        use_background_color: true,
        use_border: false,
        text_color: onFill,
        use_text_color: true,
        corner_radius: 100,
      };
    case "minimal":
      return {
        ...item,
        use_background_color: true,
        background_color: withAlphaFloat(GREY, 0.3),
        use_border: false,
        use_text_color: false,
        corner_radius: 8,
      };
  }
}
