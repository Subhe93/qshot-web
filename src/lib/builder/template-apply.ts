/**
 * Website-template apply engine — exact port of the mobile
 * `website_template.dart` (create / restyle / restyleBlock / _styledSettings)
 * and `hero_template.dart` `HeroTemplateRegistry.mergeUserContent`
 * (origin/dev).
 *
 * Applying a template is a ONE-SHOT stamp: palette colors are baked into the
 * document as literal ARGB ints, content is never touched, and afterwards the
 * site is fully editable with the regular editors. The only persisted trace is
 * `settings.template` ({id, brand_color: raw user pick}).
 */

import type {
  Block,
  ButtonBlock,
  DividerBlock,
  ExternalLinksBlock,
  ImagesBlock,
  ProductsBlock,
  ReviewsBlock,
  SocialFeedBlock,
  SocialLinksBlock,
  VideoLinksBlock,
} from "@/lib/types/blocks";
import type {
  CoverPhoto,
  Header,
  HeroButton,
  HeroText,
  Logo,
  ProfilePicture,
  WebsiteSettings,
} from "@/lib/types/profile";
import { applyButtonTheme } from "./apply-button-theme";
import {
  heroDefaults,
  PLACEHOLDER_IMAGES,
  PLACEHOLDER_TEXTS,
  PLACEHOLDER_URL,
} from "./hero-defaults";
import { paletteFromBrand, type TemplatePalette } from "./template-palette";
import type {
  TemplateBlockStyles,
  TemplateTranslator,
  WebsiteTemplate,
} from "./website-templates";

export interface TemplateApplyResult {
  blocks: Block[];
  settings: WebsiteSettings;
}

// ---- "User content" detection (mobile HeroTemplateRegistry) ----------------

/** `_isUserText`: non-blank and not demo copy (contains-check on the UNtrimmed value). */
function isUserText(value: string | null | undefined): value is string {
  if (value == null) return false;
  return value.trim().length > 0 && !PLACEHOLDER_TEXTS.has(value);
}

function isUserImage(value: string | null | undefined): value is string {
  return value != null && value.length > 0 && !PLACEHOLDER_IMAGES.has(value);
}

function isUserUrl(value: string | null | undefined): value is string {
  return value != null && value.trim().length > 0 && value !== PLACEHOLDER_URL;
}

/**
 * Carries user-entered content from `current` into `defaults`, so applying a
 * hero style (or a website template) restyles the hero without wiping the
 * user's copy. Visual fields (colors, positions, sizes, alignment) always come
 * from `defaults`; texts, urls and uploaded images survive. Exact port of
 * `HeroTemplateRegistry.mergeUserContent`.
 */
export function mergeUserContent(
  current: WebsiteSettings,
  defaults: WebsiteSettings,
): WebsiteSettings {
  function heroText(
    cur: HeroText | null | undefined,
    def: HeroText | null | undefined,
  ): HeroText | null | undefined {
    if (def == null || !isUserText(cur?.text)) return def;
    return { ...def, text: cur!.text };
  }

  function button(
    cur: HeroButton | null | undefined,
    def: HeroButton | null | undefined,
  ): HeroButton | null | undefined {
    if (def == null || cur == null) return def;
    let out = def;
    if (isUserText(cur.text)) out = { ...out, text: cur.text };
    if (isUserUrl(cur.url)) out = { ...out, url: cur.url };
    return out;
  }

  function cover(
    cur: CoverPhoto | null | undefined,
    def: CoverPhoto | null | undefined,
  ): CoverPhoto | null | undefined {
    if (def == null || !isUserImage(cur?.image_url)) return def;
    // copyWith null-coalesces: a null user image_rect keeps the default's.
    return {
      ...def,
      image_url: cur!.image_url,
      image_rect: cur!.image_rect ?? def.image_rect,
    };
  }

  function picture(
    cur: ProfilePicture | null | undefined,
    def: ProfilePicture | null | undefined,
  ): ProfilePicture | null | undefined {
    if (def == null || !isUserImage(cur?.image_url)) return def;
    return {
      ...def,
      image_url: cur!.image_url,
      image_rect: cur!.image_rect ?? def.image_rect,
    };
  }

  function logo(
    cur: Logo | null | undefined,
    def: Logo | null | undefined,
  ): Logo | null | undefined {
    if (def == null || cur?.image_url == null) return def;
    return { ...def, image_url: cur.image_url };
  }

  function header(
    cur: Header | null | undefined,
    def: Header | null | undefined,
  ): Header | null | undefined {
    if (def == null || !isUserText(cur?.title?.text)) return def;
    const title = def.title == null ? null : { ...def.title, text: cur!.title!.text };
    return title == null ? def : { ...def, title };
  }

  return {
    ...defaults,
    title: heroText(current.title, defaults.title),
    text: heroText(current.text, defaults.text),
    button1: button(current.button1, defaults.button1),
    button2: button(current.button2, defaults.button2),
    cover_photo: cover(current.cover_photo, defaults.cover_photo),
    profile_picture: picture(current.profile_picture, defaults.profile_picture),
    logo: logo(current.logo, defaults.logo),
    header: header(current.header, defaults.header),
  };
}

// ---- Settings restyle (mobile WebsiteTemplate._styledSettings) -------------

/** The template's hero-style defaults recolored with the palette. */
export function styledSettings(
  tpl: WebsiteTemplate,
  palette: TemplatePalette,
): WebsiteSettings {
  const base = heroDefaults(tpl.heroStyle);
  const coverPhoto = base.cover_photo;
  const out: WebsiteSettings = {
    ...base,
    background: { color_value: { type: "solid", color: palette.surface } },
    font_color: palette.onSurface,
    header:
      base.header == null
        ? base.header
        : {
            ...base.header,
            background_color: palette.surface,
            foreground_color: palette.onSurface,
          },
    // Cover tint recolored to primary ONLY when the base default has a tint.
    cover_photo:
      coverPhoto?.color == null ? coverPhoto : { ...coverPhoto, color: palette.primary },
    title: base.title == null ? base.title : { ...base.title, color: palette.onSurface },
    text: base.text == null ? base.text : { ...base.text, color: palette.onSurface },
    button1:
      base.button1 == null
        ? base.button1
        : {
            ...base.button1,
            background_color: palette.primary,
            foreground_color: palette.onPrimary,
          },
    button2:
      base.button2 == null
        ? base.button2
        : {
            ...base.button2,
            background_color: palette.primarySoft,
            foreground_color: palette.onPrimarySoft,
          },
    font_family: tpl.fontFamily,
  };
  // White card only for heroes that ship a cardStyle (style7); copyWith(null)
  // keeps the base's absent value for the others.
  if (base.card_style != null) out.card_style = { color: palette.card };
  return out;
}

// ---- Block restyle (mobile WebsiteTemplate.restyleBlock) -------------------

/**
 * Stamps the template's style onto one block, leaving content untouched.
 * Blocks the template has no opinion about (Booking, Form, Paragraph, Header,
 * Spacer, Location, Embed, IntroductionVideo) pass through unchanged.
 * Note: only `use_background_color` is forced false — the block-level
 * `background_color` int itself stays in the JSON.
 */
export function restyleBlock(
  block: Block,
  palette: TemplatePalette,
  styles: TemplateBlockStyles,
): Block {
  switch (block.type) {
    case "social_links": {
      const b: SocialLinksBlock = {
        ...block,
        layout_type: styles.socialLinks,
        icon_type: styles.socialIconType,
        adaptive_icon_color: true,
        custom_icon_color: null, // clearCustomIconColor
        use_background_color: false,
      };
      return b;
    }
    case "ExternalLinksModule": {
      const b: ExternalLinksBlock = {
        ...block,
        layout_type: styles.externalLinks,
        use_background_color: false,
      };
      return b;
    }
    case "VideoLinksModule": {
      const b: VideoLinksBlock = {
        ...block,
        layout_type: styles.videoLinks,
        use_background_color: false,
      };
      return b;
    }
    case "ProductsModule": {
      const b: ProductsBlock = {
        ...block,
        layout_type: styles.products,
        use_background_color: false,
      };
      return b;
    }
    case "ImageModule": {
      const b: ImagesBlock = {
        ...block,
        layout_type: styles.images,
        use_background_color: false,
      };
      return b;
    }
    case "ButtonModule": {
      const b: ButtonBlock = {
        ...block,
        layout_type: styles.buttons,
        theme: styles.buttonTheme,
        use_background_color: false,
        buttons: (block.buttons ?? []).map((item) =>
          applyButtonTheme(styles.buttonTheme, item, {
            primary: palette.primary,
            onPrimary: palette.onPrimary,
            onSoft: palette.onPrimarySoft,
          }),
        ),
      };
      return b;
    }
    case "ReviewsModule": {
      const b: ReviewsBlock = {
        ...block,
        layout_type: styles.reviews,
        use_background_color: false,
      };
      return b;
    }
    case "SocialFeedModule": {
      const b: SocialFeedBlock = {
        ...block,
        layout_type: styles.socialFeed,
        use_background_color: false,
      };
      return b;
    }
    case "DividerModule": {
      const b: DividerBlock = {
        ...block,
        color: palette.outline,
        use_background_color: false,
      };
      return b;
    }
    default:
      return block;
  }
}

// ---- create / restyle (mobile WebsiteTemplate.create / .restyle) -----------

/**
 * Builds a fresh site from a template: starter composition + styled hero
 * settings, all colors baked from `brandArgb`; TemplateRef stamped.
 *
 * NOTE (mobile parity): `create()` replaces settings WHOLESALE — the fresh
 * styled defaults carry no `website_name`/`website_logo`, exactly like the
 * mobile `SettingsEntity` returned by `WebsiteTemplate.create` (the theme
 * sheet commits it via `putSettings` without re-injecting them).
 */
export function createFromTemplate(
  tpl: WebsiteTemplate,
  brandArgb: number,
  t: TemplateTranslator,
): TemplateApplyResult {
  const palette = paletteFromBrand(brandArgb);
  const blocks = tpl
    .buildBlocks(t)
    .map((block) => restyleBlock(block, palette, tpl.blockStyles));
  return {
    blocks,
    settings: {
      ...styledSettings(tpl, palette),
      template: { id: tpl.id, brand_color: brandArgb >>> 0 },
    },
  };
}

/**
 * Re-stamps an existing site: every block keeps its content and gets the
 * template's styles; hero settings are restyled with user content preserved.
 * No blocks are added or removed.
 *
 * copyWith semantics: ONLY the listed settings keys are overwritten, and only
 * when the styled value is non-null (a hero style without e.g. buttons keeps
 * the CURRENT button1/button2 values, it does not clear them). Everything
 * else — website_name, website_logo, name, bio, floating_button,
 * can_save_contact, index_in_google, unknown keys — survives untouched.
 */
export function restyleWithTemplate(
  tpl: WebsiteTemplate,
  blocks: Block[],
  settings: WebsiteSettings,
  brandArgb: number,
): TemplateApplyResult {
  const palette = paletteFromBrand(brandArgb);
  const styled = mergeUserContent(settings, styledSettings(tpl, palette));
  const nextBlocks = blocks.map((block) => restyleBlock(block, palette, tpl.blockStyles));

  const next: WebsiteSettings = { ...settings };
  if (styled.style != null) next.style = styled.style;
  if (styled.background != null) next.background = styled.background;
  if (styled.header != null) next.header = styled.header;
  if (styled.cover_photo != null) next.cover_photo = styled.cover_photo;
  if (styled.profile_picture != null) next.profile_picture = styled.profile_picture;
  if (styled.logo != null) next.logo = styled.logo;
  if (styled.title != null) next.title = styled.title;
  if (styled.text != null) next.text = styled.text;
  if (styled.button1 != null) next.button1 = styled.button1;
  if (styled.button2 != null) next.button2 = styled.button2;
  if (styled.font_color != null) next.font_color = styled.font_color;
  if (styled.card_style != null) next.card_style = styled.card_style;
  next.font_family = tpl.fontFamily;
  next.template = { id: tpl.id, brand_color: brandArgb >>> 0 };

  return { blocks: nextBlocks, settings: next };
}
