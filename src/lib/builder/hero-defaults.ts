/**
 * Per-style default SETTINGS for a new website — ported verbatim from the mobile
 * `hero_template.dart` `_styleNDefaults()` factories. When a site is created the
 * mobile app sends `SettingsEntity.fillDefaults(...)` = the chosen style's full
 * defaults merged with the user's name/logo. The web builder MUST do the same so
 * a new site arrives pre-populated (cover, title, text, buttons, header,
 * background) and looks like the mobile, instead of an empty hero.
 *
 * Colors are ARGB ints. Constants:
 *   kDefaultColor = white (utils.dart:59), AppColors.black = 0xFF1F1F26,
 *   AppColors.primary = 0xFF4488FF, AppColors.secondary = 0xFFC389FF,
 *   Colors.orange = 0xFFFF9800, Colors.white = 0xFFFFFFFF, Colors.black = 0xFF000000,
 *   Colors.grey = 0xFF9E9E9E, Links.websiteUrl = "https://speaknet.app".
 */

import type { HeroStyle, WebsiteSettings } from "@/lib/types/profile";

const WHITE = 0xffffffff;
const BLACK = 0xff000000;
const GREY = 0xff9e9e9e;
const ORANGE = 0xffff9800;
const APP_BLACK = 0xff1f1f26;
const PRIMARY = 0xff4488ff;
const SECONDARY = 0xffc389ff;
const K_DEFAULT = WHITE; // kDefaultColor = Colors.white
const URL = "https://speaknet.app";
const COVER_PNG = "images/profiles66e82ba1d80321e93e437972__xhl5id66tos.png";
const COVER_JPG = "images/profiles66e82ba1d80321e93e437972__wiaweay2ubr.jpg";

const FLOATING = { hide: false, values: {}, type: null } as const;

function solidBg(color: number): WebsiteSettings["background"] {
  return { color_value: { type: "solid", color } };
}

const FACTORIES: Record<HeroStyle, () => WebsiteSettings> = {
  style1: () => ({
    style: "style1",
    background: solidBg(APP_BLACK),
    font_color: WHITE,
    floating_button: { ...FLOATING },
    profile_picture: {
      hide: false,
      alignment: "center",
      shape: "circle",
      border_color: K_DEFAULT,
      border_width: 0,
    },
    cover_photo: { hide: false, size: "horizontal", fade: false, transparency: 0 },
    header: {
      hide: false,
      title: { hide: false, text: "" },
      leading_alignment: "start",
      position: "onCover",
      background_opacity: 1,
      fillSides: false,
    },
    logo: { hide: false },
    name: { hide: false, text: "", alignment: "center" },
    bio: { hide: false, text: "", alignment: "center" },
  }),

  style2: () => ({
    style: "style2",
    background: solidBg(0xfff0f4f8),
    font_color: APP_BLACK,
    floating_button: { ...FLOATING },
    cover_photo: { image_url: COVER_PNG, hide: false, fade: false, size: "poster", transparency: 0 },
    header: {
      hide: false,
      title: { hide: false, text: "Website Name" },
      leading_alignment: "start",
      position: "aboveCover",
      background_opacity: 1,
      fillSides: true,
    },
    logo: { hide: false },
    title: { hide: false, text: "Write Your Main Title or Heading Text Here", color: K_DEFAULT },
    text: { hide: false, text: "Write Your Main Description or Small Tagline Text Here", color: K_DEFAULT },
    button1: { hide: false, text: "Book Now", background_color: 0xffaec7db, foreground_color: 0xff241c0f, url: URL },
    button2: { hide: false, text: "Call us", background_color: 0xff345d80, foreground_color: WHITE, url: URL },
    name: { hide: false, text: "", alignment: "center" },
    bio: { hide: false, text: "", alignment: "center" },
  }),

  style3: () => ({
    style: "style3",
    background: solidBg(0xfff2f2f2),
    font_color: APP_BLACK,
    floating_button: { ...FLOATING },
    cover_photo: { image_url: COVER_JPG, hide: false, fade: false, size: "vertical", transparency: 0.3, color: BLACK },
    header: {
      hide: false,
      title: { hide: false, text: "Website Name" },
      leading_alignment: "start",
      position: "onCover",
      background_opacity: 1,
      fillSides: false,
    },
    logo: { hide: false },
    title: { hide: false, text: "Write Your Main Title or Heading Text Here", color: K_DEFAULT },
    text: { hide: false, text: "Write Your Main Description or Small Tagline Text Here", color: K_DEFAULT },
    name: { hide: false, text: "", alignment: "center" },
    bio: { hide: false, text: "", alignment: "center" },
  }),

  style4: () => ({
    style: "style4",
    background: solidBg(0xfff3f8fe),
    font_color: APP_BLACK,
    floating_button: { ...FLOATING },
    cover_photo: { image_url: COVER_JPG, hide: false, fade: false, size: "vertical", transparency: 0.2, color: PRIMARY },
    header: {
      hide: false,
      title: { hide: false, text: "Website Name" },
      leading_alignment: "start",
      position: "aboveCover",
      background_opacity: 1,
      fillSides: true,
    },
    logo: { hide: false },
    title: { hide: false, text: "Write Your Main Title or Heading Text Here", color: K_DEFAULT },
    text: { hide: false, text: "Write Your Main Description or Small Tagline Text Here", color: K_DEFAULT },
    button1: { hide: false, text: "Book Now", background_color: ORANGE, foreground_color: BLACK, url: URL },
    button2: { hide: false, text: "Call us", background_color: WHITE, foreground_color: BLACK, url: URL },
    name: { hide: false, text: "", alignment: "center" },
    bio: { hide: false, text: "", alignment: "center" },
  }),

  style5: () => ({
    style: "style5",
    background: solidBg(0xfff4f0fa),
    font_color: APP_BLACK,
    floating_button: { ...FLOATING },
    cover_photo: { image_url: COVER_JPG, hide: false, fade: false, size: "poster", transparency: 0.2, color: SECONDARY },
    header: {
      hide: false,
      title: { hide: false, text: "Website Name" },
      leading_alignment: "start",
      position: "aboveCover",
      background_opacity: 1,
      fillSides: true,
      background_color: SECONDARY,
      foreground_color: K_DEFAULT,
    },
    logo: { hide: false },
    title: { hide: false, text: "Write Your Main Title or Heading Text Here", color: K_DEFAULT },
    text: { hide: false, text: "Write Your Main Description or Small Tagline Text Here", color: K_DEFAULT },
    button1: { hide: false, text: "Book Now", background_color: ORANGE, foreground_color: WHITE, url: URL },
    button2: { hide: false, text: "Call us", background_color: ORANGE, foreground_color: WHITE, url: URL },
    name: { hide: false, text: "", alignment: "center" },
    bio: { hide: false, text: "", alignment: "center" },
  }),

  style6: () => ({
    style: "style6",
    background: solidBg(0xfff4faff),
    font_color: APP_BLACK,
    floating_button: { ...FLOATING },
    cover_photo: { hide: false, fade: false, size: "poster", transparency: 1, color: 0xfff4faff },
    header: {
      hide: false,
      title: { hide: false, text: "" },
      leading_alignment: "start",
      position: "aboveCover",
      fillSides: true,
      background_color: WHITE,
      background_opacity: 1,
      foreground_color: BLACK,
    },
    logo: { hide: false },
    title: { hide: false, text: "Write Your Main Title or Heading Text Here", color: BLACK },
    text: { hide: false, text: "Write Your Main Description or Small Tagline Text Here", color: GREY },
    button1: { hide: false, text: "Book Now", background_color: PRIMARY, foreground_color: WHITE, url: URL },
    button2: { hide: false, text: "Call us", background_color: 0xfff4faff, foreground_color: BLACK, url: URL },
    name: { hide: false, text: "", alignment: "center" },
    bio: { hide: false, text: "", alignment: "center" },
  }),

  style7: () => ({
    style: "style7",
    background: solidBg(0xfffff8f0),
    font_color: APP_BLACK,
    card_style: { color: WHITE },
    floating_button: { ...FLOATING },
    cover_photo: { image_url: COVER_JPG, hide: false, size: "square", fade: false, transparency: 0 },
    header: {
      hide: false,
      title: { hide: false, text: "" },
      leading_alignment: "start",
      position: "aboveCover",
      fillSides: true,
      background_color: 0xfffffaf3,
      background_opacity: 1,
      foreground_color: BLACK,
    },
    logo: { hide: false },
    title: { hide: false, text: "Your Business Name", color: BLACK },
    text: { hide: false, text: "Write your tagline or short description here", color: 0xffe88b2e },
    button1: { hide: false, text: "Contact Us", background_color: 0xffe88b2e, foreground_color: WHITE, url: URL },
    button2: { hide: false, text: "Learn More", background_color: 0x00000000, foreground_color: BLACK, url: URL },
    name: { hide: false, text: "", alignment: "start" },
    bio: { hide: false, text: "", alignment: "start" },
  }),
};

/** Per-style structural flags (hero_template.dart) — which hero elements a style uses. */
export interface HeroStyleFlags {
  hasProfileImage: boolean;
  hasHeaderTitle: boolean;
  hasTitle: boolean;
  hasText: boolean;
  hasButton1: boolean;
  hasButton2: boolean;
  hasCard: boolean;
}

export const HERO_STYLE_FLAGS: Record<HeroStyle, HeroStyleFlags> = {
  style1: { hasProfileImage: true, hasHeaderTitle: true, hasTitle: false, hasText: false, hasButton1: false, hasButton2: false, hasCard: false },
  style2: { hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false },
  style3: { hasProfileImage: false, hasHeaderTitle: false, hasTitle: true, hasText: true, hasButton1: false, hasButton2: false, hasCard: false },
  style4: { hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false },
  style5: { hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false },
  style6: { hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false },
  style7: { hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: true },
};

export function heroStyleFlags(style: HeroStyle): HeroStyleFlags {
  return HERO_STYLE_FLAGS[style] ?? HERO_STYLE_FLAGS.style2;
}

/** Fresh full default settings for a style. */
export function heroDefaults(style: HeroStyle): WebsiteSettings {
  return (FACTORIES[style] ?? FACTORIES.style2)();
}

/**
 * SettingsEntity.fillDefaults — the chosen style's full defaults with the user's
 * name/logo overlaid. Used on website creation.
 */
export function fillDefaults(
  style: HeroStyle,
  overrides: { websiteName?: string; websiteLogo?: string | null } = {},
): WebsiteSettings {
  const base = heroDefaults(style);
  return {
    ...base,
    website_name: overrides.websiteName ?? base.website_name,
    website_logo: overrides.websiteLogo ?? base.website_logo ?? null,
  };
}
