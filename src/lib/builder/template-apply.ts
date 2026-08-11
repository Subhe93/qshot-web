/**
 * `HeroTemplateRegistry.mergeUserContent` — exact port of the mobile
 * `hero_template.dart` (branch `origin/feature/template-sites`).
 *
 * Carries user-entered content from `current` into `defaults` so that applying
 * a hero STYLE (hero/StyleTab) or a whole-site TEMPLATE
 * (`restyleWithTemplateSite`) restyles the hero without wiping the user's copy.
 *
 * ── History ────────────────────────────────────────────────────────────────
 * This file used to also hold the templates v1 apply engine (`styledSettings`,
 * `restyleBlock`, `createFromTemplate`, `restyleWithTemplate`) — the 5
 * hand-coded style presets stamped with a `TemplatePalette` derived from a
 * user-picked brand color. Templates v2 (mobile ef5c94ed) deleted that whole
 * model: templates are now real curated profiles applied as DATA + STYLE, and
 * the apply engine lives in `website-templates.ts`. Only the hero merge —
 * which v2 still calls, and which the hero Style tab has always called
 * independently of templates — survives here.
 */

import type {
  CoverPhoto,
  Header,
  HeroButton,
  HeroText,
  Logo,
  ProfilePicture,
  WebsiteSettings,
} from "@/lib/types/profile";
import {
  PLACEHOLDER_IMAGES,
  PLACEHOLDER_TEXTS,
  PLACEHOLDER_URL,
} from "./hero-defaults";

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
 * Visual fields (colors, positions, sizes, alignment) always come from
 * `defaults`; texts, urls and uploaded images survive from `current`. Exact
 * port of `HeroTemplateRegistry.mergeUserContent`.
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
