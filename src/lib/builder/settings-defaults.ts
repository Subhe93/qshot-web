/**
 * `SettingsEntity.merge` / `SettingsEntity.fillDefaults` — exact port of
 * `settings_entity.dart` (+ the per-entity `merge()` in profile_entity.dart,
 * header_entity.dart, cover_entity.dart, button_entity.dart,
 * card_style_entity.dart), branch `origin/feature/template-sites`.
 *
 * The mobile app runs `fillDefaults` on EVERY website it loads
 * (`WebsiteModel.fromJson`) and — since templates v2 (commit c254c921) — on
 * every template snapshot too: whatever the stored JSON omits (or stores as an
 * explicit `null`) falls back to the hero style's own defaults, so downstream
 * widgets can rely on `floating_button`, `background`, `header`, `cover_photo`
 * being present.
 *
 * ⚠ Not to be confused with `hero-defaults.ts` `fillDefaults(style, {name,logo})`,
 * which is the WEB's site-CREATION helper (a fresh style default with the
 * user's name/logo overlaid). This module is the mobile `fillDefaults(settings)`
 * — a deep merge of a WHOLE settings object over its style's defaults.
 *
 * Merge semantics, transcribed field by field from the Dart:
 *   scalar    `other.x ?? x`              — an explicit null falls back
 *   object    `x?.merge(other.x) ?? other.x` — when the DEFAULT has the object,
 *             merge into it (so the stored object's own null/absent keys fall
 *             back per key); when it doesn't, take the stored one as-is
 *   `style`   always the stored one (it is what selected the defaults)
 *   `can_save_contact` / `index_in_google` always the stored one, with the
 *             mobile `fromJson` fallbacks (false / true)
 *
 * Keys the mobile model does not know ride along from the stored value —
 * the web preserves unmodelled data (see serialization.ts), Dart drops it.
 */

import type {
  FloatingButton,
  Header,
  HeroStyle,
  WebsiteSettings,
} from "@/lib/types/profile";
import { heroDefaults } from "./hero-defaults";

type Obj = Record<string, unknown>;

/**
 * A flat entity `merge`: `other`'s non-null fields win, the defaults fill the
 * gaps — `Logo`, `Picture`, `CoverPhoto`, `HeroText`, `Button`, `Name`, `Bio`,
 * `CardStyle` and `Background` all have exactly this shape in Dart.
 * (`Background.merge` replaces `color` — our `color_value` — WHOLESALE, which
 * is what a flat merge does.)
 */
function mergeFlat<T>(a: T | null | undefined, b: T | null | undefined): T | null | undefined {
  if (a == null) return b;
  if (b == null) return a;
  const out: Obj = { ...(a as Obj) };
  for (const [k, v] of Object.entries(b as Obj)) if (v != null) out[k] = v;
  return out as T;
}

/** `Header.merge` — flat, except `title` which merges as a nested HeroText. */
function mergeHeader(
  a: Header | null | undefined,
  b: Header | null | undefined,
): Header | null | undefined {
  if (a == null) return b;
  if (b == null) return a;
  const out = mergeFlat(a, b) as Header;
  // Dart: `title: title == null ? other.title : title!.merge(other.title)`.
  out.title = a.title == null ? b.title : mergeFlat(a.title, b.title);
  return out;
}

/**
 * `FloatingButton.merge` — `hide`/`type` null-coalesce, and `values` is merged
 * per variant key with a SHALLOW object spread (`{...?merged[key], ...entry}`),
 * so `other`'s entries win even when their value is null.
 */
function mergeFloatingButton(
  a: FloatingButton | null | undefined,
  b: FloatingButton | null | undefined,
): FloatingButton | null | undefined {
  if (a == null) return b;
  if (b == null) return a;
  const values: FloatingButton["values"] = { ...(a.values ?? {}) };
  for (const [key, entry] of Object.entries(b.values ?? {})) {
    values[key] = { ...(values[key] ?? {}), ...entry };
  }
  return {
    hide: b.hide ?? a.hide,
    type: b.type ?? a.type,
    values,
  };
}

/** Keys handled explicitly below; everything else passes through from `value`. */
const MODELLED = new Set([
  "website_logo",
  "website_name",
  "style",
  "logo",
  "header",
  "profile_picture",
  "cover_photo",
  "title",
  "text",
  "button1",
  "button2",
  "background",
  "name",
  "bio",
  "floating_button",
  "font_family",
  "font_color",
  "card_style",
  "template",
  "can_save_contact",
  "index_in_google",
]);

/** Mobile `SettingsEntity.merge` — `defaults.merge(value)`. */
export function mergeSettings(
  defaults: WebsiteSettings,
  value: WebsiteSettings,
): WebsiteSettings {
  const out: WebsiteSettings = { ...defaults };

  // Unmodelled keys (`header_text`, anything a newer backend adds) survive.
  for (const [k, v] of Object.entries(value)) {
    if (!MODELLED.has(k)) (out as Obj)[k] = v;
  }

  out.website_logo = value.website_logo ?? defaults.website_logo;
  out.website_name = value.website_name ?? defaults.website_name;
  out.style = value.style ?? defaults.style;
  out.logo = mergeFlat(defaults.logo, value.logo);
  out.header = mergeHeader(defaults.header, value.header);
  out.profile_picture = mergeFlat(defaults.profile_picture, value.profile_picture);
  out.cover_photo = mergeFlat(defaults.cover_photo, value.cover_photo);
  out.title = mergeFlat(defaults.title, value.title);
  out.text = mergeFlat(defaults.text, value.text);
  out.button1 = mergeFlat(defaults.button1, value.button1);
  out.button2 = mergeFlat(defaults.button2, value.button2);
  out.background = mergeFlat(defaults.background, value.background);
  out.name = mergeFlat(defaults.name, value.name) ?? undefined;
  out.bio = mergeFlat(defaults.bio, value.bio) ?? undefined;
  out.floating_button =
    mergeFloatingButton(defaults.floating_button, value.floating_button) ?? undefined;
  out.font_family = value.font_family ?? defaults.font_family;
  out.font_color = value.font_color ?? defaults.font_color;
  out.card_style = mergeFlat(defaults.card_style, value.card_style);
  out.template = value.template ?? defaults.template;
  // Dart `SettingsEntity.fromJson`: `json[...] ?? defaultCanSaveContact|
  // defaultIndexInGoogle`, then `merge` takes the stored one unconditionally.
  out.can_save_contact = value.can_save_contact ?? false;
  out.index_in_google = value.index_in_google ?? true;

  return out;
}

/**
 * Mobile `SettingsEntity.fillDefaults(value)` =
 * `value.style.getSettingsDefaults().merge(value)`.
 */
export function fillSettingsDefaults(value: WebsiteSettings): WebsiteSettings {
  // Dart `fromJson` resolves an absent `style` to style1 before picking defaults.
  const style = (value.style ?? "style1") as HeroStyle;
  return mergeSettings(heroDefaults(style), value);
}
