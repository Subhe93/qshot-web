/**
 * Templates v2 — whole-website templates backed by REAL curated profiles
 * (`template-N.qshot.com`), shipped as JSON snapshots. Exact port of
 * `website_template.dart` + `website_template_registry.dart` on the mobile
 * branch `origin/feature/template-sites` (commits ef5c94ed, c254c921,
 * 2dcf9a64, 1cd35b2e).
 *
 * This REPLACES the v1 registry (5 hand-coded style presets: restaurant /
 * salon / creator / shop / professional). A template is no longer a bag of
 * style knobs — it is a real site carrying DATA + STYLE, and applying one is
 * either `create` (fresh site: take the template's blocks and settings
 * verbatim) or `restyle` (existing site: keep the user's blocks, take the
 * template's styles).
 *
 * `settings.template` is now `{id}` ALONE — the brand-color selector is
 * deferred to phase 2, and the mobile/backend team has since REMOVED
 * `brand_color` from the contract (it carried the template's own authored
 * accent, which every surface can re-derive from the template via
 * `templateAccentColor`). `id` may also be null, meaning "no template
 * selected"; we never stamp a null — only a user's stored document can hold
 * one, and it must open with nothing selected rather than forcing a pick.
 * The id SPACE is `template-N`, and `template-palette.ts` is kept (mobile
 * keeps `template_palette.dart` for the same reason) but drives nothing.
 *
 * WHERE THE SNAPSHOTS LIVE: `./template-sites/template-N.json`, byte-identical
 * to `assets/json/templates/` in the Flutter repo, imported with a dynamic
 * `import()` (mirror of mobile's async `rootBundle.loadString`). Bundling
 * rather than serving them from `public/`:
 *   - they are versioned, code-reviewable static data that must stay in
 *     lockstep with this module — a `public/` fetch could 404 or serve a stale
 *     copy from a CDN edge,
 *   - the dynamic import keeps the ~36 KB out of the main builder chunk (it is
 *     only fetched when the Theme sheet opens), matching the mobile's lazy load,
 *   - Node/tsx can `import` them directly, so the parity script exercises the
 *     exact same bytes the browser gets.
 */

import type { Block, ButtonBlock } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";
import { lerpArgb, type ColorValue } from "./color-value";
import { genId, parseBlocks, parseSettings } from "./serialization";
import { fillSettingsDefaults } from "./settings-defaults";
import { mergeUserContent } from "./template-apply";

/** `Colors.black` — the last resort of `TemplateSite.accentColor`. */
const BLACK = 0xff000000;

/**
 * Display names, keyed by profile name — mobile `TemplateSite.labels`.
 *
 * Kept APP-SIDE (not read from the snapshot's `website_name`) so refreshing
 * the server snapshots never changes what users see, and resolved on READ so
 * no cached instance can hold a stale name. Insertion order is the order shown
 * in the picker; the FIRST entry is a new site's default selection.
 *
 * Web divergence: these are the English fallbacks. The picker prefers the
 * localized `builder.templates.names.<id>` message — mobile hardcodes English
 * here because its selector has no other source, the web builder is 9-locale.
 *
 * ⚠️ Ids are PERSISTED in `settings.template.id`, so they must stay stable —
 * and since mobile's `3c560d3d` they no longer match the source profile on the
 * server. When refreshing a snapshot, pull the profile named in the right-hand
 * column, NOT the one matching the id:
 *
 * | id         | server profile |
 * |------------|----------------|
 * | template-1 | template-1     |
 * | template-2 | template-2     |
 * | template-3 | template-4     |
 * | template-4 | template-5     |
 * | template-5 | template-6 (snapshot FROZEN — see below) |
 * | template-6 | template-6     |
 * | template-7 | template-7     |
 *
 * (template-1/2 shipped in mobile build 161 and keep their ids; 3/4/5 never
 * shipped under their old numbers, which is why renumbering them was safe.)
 *
 * **Do not refresh `template-5` (Star).** It was captured from
 * `template-6.qshot.com` BEFORE that profile was rebuilt into Signature
 * (mobile b7047bdf); re-fetching it would silently turn Star into a duplicate
 * of Signature. Star's snapshot is intentionally frozen and has no live source.
 */
export const TEMPLATE_SITE_LABELS: Record<string, string> = {
  "template-1": "Business Website",
  "template-2": "Personal Website",
  "template-3": "Marketing Website",
  "template-4": "Icons Website",
  "template-5": "Star Website",
  "template-6": "Signature Website",
  "template-7": "Service Website",
};

/** Ids in picker order — mobile `WebsiteTemplateRegistry._assetIds`. */
export const TEMPLATE_SITE_IDS: string[] = Object.keys(TEMPLATE_SITE_LABELS);

/**
 * A whole-website template: the profile name plus the blocks and settings of
 * the curated site. Mobile `TemplateSite` — its `webpage` is our `blocks`.
 */
export interface TemplateSite {
  /** Profile name, e.g. "template-1". */
  id: string;
  blocks: Block[];
  settings: WebsiteSettings;
}

/** The raw snapshot shape (a server profile document). */
interface TemplateSiteJson {
  name: string;
  info?: { modules?: unknown };
  settings?: unknown;
}

/**
 * Mobile `TemplateSite.fromJson`: `id = json['name']`, blocks from
 * `json['info']`, and settings through the SAME normalization the app applies
 * to any loaded website (`SettingsEntity.fillDefaults`) — template-2 ships no
 * `floating_button`, and the editor must not have to cope with that.
 */
/**
 * Server bookkeeping keys that live on blocks inside a profile EXPORT but are
 * not part of the block contract. The snapshots are exports of the real
 * template-N profiles, so they carry these; `template-2.json` has
 * `"version": 1|2` on three blocks.
 *
 * Mobile never models `version` on any block entity, so its typed `fromJson`
 * silently DROPS it and an applied template contains no such key. The web
 * deliberately preserves unmodelled keys (so real user data is never lost), and
 * that policy is right for user documents — but here it would copy a key the
 * server's validator rejects (`additionalProperties: false`) into the user's
 * own document, making the very next save 422. Stripping matches mobile exactly
 * and is scoped to template snapshots only; user data is untouched.
 */
const SNAPSHOT_ONLY_BLOCK_KEYS = ["version"] as const;

function stripSnapshotKeys(modules: unknown): unknown {
  if (!Array.isArray(modules)) return modules;
  return modules.map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const clean = { ...(raw as Record<string, unknown>) };
    for (const key of SNAPSHOT_ONLY_BLOCK_KEYS) delete clean[key];
    return clean;
  });
}

export function templateSiteFromJson(json: TemplateSiteJson): TemplateSite {
  return {
    id: json.name,
    blocks: parseBlocks(stripSnapshotKeys(json.info?.modules)),
    settings: fillSettingsDefaults(parseSettings(json.settings)),
  };
}

/** Mobile `TemplateSite.label` — resolved on read from the const map. */
export function templateSiteLabel(site: TemplateSite): string {
  return TEMPLATE_SITE_LABELS[site.id] ?? site.settings.website_name ?? site.id;
}

/** Mobile `Background.solidColor`: solid → the color, gradient → mid-lerp. */
function backgroundSolidArgb(value: ColorValue | null | undefined): number | null {
  if (value == null) return null;
  if (value.type === "solid") {
    return typeof value.color === "number"
      ? value.color >>> 0
      : (parseInt(String(value.color).replace(/^#/, ""), 16) >>> 0 || BLACK);
  }
  const colors = value.colors ?? [];
  if (!colors.length) return BLACK;
  return lerpArgb(colors[0], colors[colors.length - 1], 0.5);
}

/**
 * Mobile `TemplateSite.accentColor` — the color that REPRESENTS the template
 * in the UI: the dot next to each card's name in the Theme sheet, so the cards
 * stay distinguishable before their live previews paint. Until the phase-2
 * brand-color selector lands, templates keep their authored colors as-is.
 *
 * It used to also be stamped into `settings.template.brand_color`; that key is
 * gone from the contract, so this is now a PRESENTATION helper only — nothing
 * it returns is persisted.
 */
export function templateAccentColor(site: TemplateSite): number {
  const button = site.settings.button1?.background_color;
  if (button != null) return button >>> 0;
  const background = site.settings.background;
  if (background != null) {
    return backgroundSolidArgb(background.color_value as ColorValue | null | undefined) ?? BLACK;
  }
  return BLACK;
}

// ─── create ────────────────────────────────────────────────────────────────

/**
 * Fresh site — mobile `TemplateSite.create(current)`. The template's blocks
 * (stub data included) and settings, verbatim, with NEW block ids; the site's
 * own identity (`website_name`, `website_logo`) is preserved from `current`.
 *
 * Dart `copyWith` null-coalesces, so a `current` with no name/logo keeps the
 * TEMPLATE's — and `can_save_contact` / `index_in_google` stay the template's
 * too, exactly as on mobile.
 */
export function createFromTemplateSite(
  site: TemplateSite,
  current: WebsiteSettings,
): { blocks: Block[]; settings: WebsiteSettings } {
  const blocks = site.blocks.map((block) => ({ ...block, id: genId() }));
  return {
    blocks,
    settings: {
      ...site.settings,
      website_name: current.website_name ?? site.settings.website_name,
      website_logo: current.website_logo ?? site.settings.website_logo,
      template: { id: site.id },
    },
  };
}

// ─── restyle ───────────────────────────────────────────────────────────────

/**
 * Copies the STYLE fields of `source` (the template's block of the same type)
 * onto `block`, leaving the user's content untouched — mobile
 * `TemplateSite._restyleBlock`. Block types the template has no example of
 * (and the types absent from the switch: Paragraph, Form, Location, Embed,
 * IntroductionVideo, Booking) pass through unchanged.
 *
 * Every Dart `copyWith` null-coalesces, so a NULL style field on the template
 * block leaves the user's value in place. The one exception is
 * `custom_icon_color`, which mobile passes `clearCustomIconColor:
 * s.customIconColor == null` alongside — i.e. the source's value wins even
 * when it is null.
 */
export function restyleBlockFrom(block: Block, source: Block | undefined): Block {
  if (source == null || source.type !== block.type) return block;
  switch (block.type) {
    case "social_links": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        icon_type: s.icon_type ?? block.icon_type,
        adaptive_icon_color: s.adaptive_icon_color ?? block.adaptive_icon_color,
        // clearCustomIconColor: the source's value wins, null included.
        custom_icon_color: s.custom_icon_color ?? null,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "ExternalLinksModule": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        foldable: s.foldable ?? block.foldable,
        show_arrow: s.show_arrow ?? block.show_arrow,
        circle_image: s.circle_image ?? block.circle_image,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "VideoLinksModule": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        foldable: s.foldable ?? block.foldable,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "ProductsModule": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        foldable: s.foldable ?? block.foldable,
        show_arrow: s.show_arrow ?? block.show_arrow,
        circle_image: s.circle_image ?? block.circle_image,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "ImageModule": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "ButtonModule": {
      const s = source as ButtonBlock;
      const first = s.buttons?.[0];
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        theme: s.theme ?? block.theme,
        show_arrow: s.show_arrow ?? block.show_arrow,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
        // Dart: `s.items.isEmpty ? item : item.copyWith(<first item's styles>)`,
        // and ButtonItem.copyWith null-coalesces field by field.
        buttons: (block.buttons ?? []).map((item) =>
          first == null
            ? item
            : {
                ...item,
                background_color: first.background_color ?? item.background_color,
                use_background_color:
                  first.use_background_color ?? item.use_background_color,
                border_color: first.border_color ?? item.border_color,
                use_border: first.use_border ?? item.use_border,
                text_color: first.text_color ?? item.text_color,
                use_text_color: first.use_text_color ?? item.use_text_color,
                corner_radius: first.corner_radius ?? item.corner_radius,
              },
        ),
      };
    }
    case "ReviewsModule": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "SocialFeedModule": {
      const s = source as typeof block;
      return {
        ...block,
        layout_type: s.layout_type ?? block.layout_type,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "HeaderModule": {
      const s = source as typeof block;
      return {
        ...block,
        align: s.align ?? block.align,
        size: s.size ?? block.size,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "DividerModule": {
      const s = source as typeof block;
      return {
        ...block,
        color: s.color ?? block.color,
        // Dart field `thickness`; JSON key `space` (block_entity.dart).
        space: s.space ?? block.space,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    case "SpacerModule": {
      const s = source as typeof block;
      return {
        ...block,
        use_background_color: s.use_background_color ?? block.use_background_color,
        background_color: s.background_color ?? block.background_color,
      };
    }
    default:
      return block;
  }
}

/**
 * Existing site — mobile `TemplateSite.restyle` (b7047bdf ordering):
 *
 * - TEMPLATE order is primary. Each template slot is filled by the user's
 *   blocks of that type, restyled.
 * - All of the user's blocks of one type stay together, in the user's own
 *   order, at the template's FIRST slot for that type. Later template slots
 *   of an already-supplied type are dropped, so a user with one button
 *   doesn't inherit the template's five empty ones.
 * - Types the user doesn't have at all arrive as the template's stub — every
 *   slot of them, with fresh ids.
 * - Types the template has no slot for keep their content and their relative
 *   order, parked after the templated section.
 *
 * Hero settings: `mergeUserContent(current, template)` — template styles win,
 * user copy/urls/uploads survive — and only the listed keys are written back,
 * each with Dart `copyWith` null-coalescing (a null styled value keeps the
 * user's). `font_family` comes straight from the template.
 */
export function restyleWithTemplateSite(
  site: TemplateSite,
  blocks: Block[],
  settings: WebsiteSettings,
): { blocks: Block[]; settings: WebsiteSettings } {
  const userByType = new Map<string, Block[]>();
  for (const block of blocks) {
    const list = userByType.get(block.type);
    if (list) list.push(block);
    else userByType.set(block.type, [block]);
  }

  const nextBlocks: Block[] = [];
  const placed = new Set<string>();
  for (const source of site.blocks) {
    const mine = userByType.get(source.type);
    if (mine == null) {
      // The user has none of this type — seed the template's stub.
      nextBlocks.push({ ...source, id: genId() });
    } else if (!placed.has(source.type)) {
      // First slot of this type takes every block the user owns of it.
      placed.add(source.type);
      for (const block of mine) nextBlocks.push(restyleBlockFrom(block, source));
    }
  }
  // Anything the template has no slot for keeps its content and its relative
  // order, parked after the templated section.
  for (const block of blocks) {
    if (!placed.has(block.type)) nextBlocks.push(block);
  }

  const styled = mergeUserContent(settings, site.settings);
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
  if (site.settings.font_family != null) next.font_family = site.settings.font_family;
  if (styled.floating_button != null) next.floating_button = styled.floating_button;
  next.template = { id: site.id };

  return { blocks: nextBlocks, settings: next };
}

// ─── Registry ──────────────────────────────────────────────────────────────
// Mobile `WebsiteTemplateRegistry`: load the bundled snapshots once, cache
// them, and expose a sync lookup for code that runs after the load.

let cache: TemplateSite[] | null = null;
let inFlight: Promise<TemplateSite[]> | null = null;

const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  "template-1": () => import("./template-sites/template-1.json"),
  "template-2": () => import("./template-sites/template-2.json"),
  "template-3": () => import("./template-sites/template-3.json"),
  "template-4": () => import("./template-sites/template-4.json"),
  "template-5": () => import("./template-sites/template-5.json"),
  "template-6": () => import("./template-sites/template-6.json"),
  "template-7": () => import("./template-sites/template-7.json"),
};

/** Mobile `WebsiteTemplateRegistry.load()` — idempotent, cached. */
export function loadTemplateSites(): Promise<TemplateSite[]> {
  if (cache != null) return Promise.resolve(cache);
  if (inFlight != null) return inFlight;
  inFlight = Promise.all(
    TEMPLATE_SITE_IDS.map(async (id) => {
      const loaded = await LOADERS[id]();
      return templateSiteFromJson(loaded.default as TemplateSiteJson);
    }),
  )
    .then((sites) => {
      cache = sites;
      return sites;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Mobile `WebsiteTemplateRegistry.loaded` — null until `load` completes once. */
export function loadedTemplateSites(): TemplateSite[] | null {
  return cache;
}

/** Mobile `WebsiteTemplateRegistry.of(id)` — sync, null before `load` has run. */
export function templateSiteOf(id: string | null | undefined): TemplateSite | null {
  if (id == null) return null;
  return (cache ?? []).find((site) => site.id === id) ?? null;
}

/**
 * The Theme picker's STORED-SELECTION lookup: resolve `settings.template?.id`
 * against the list the sheet just loaded.
 *
 * Takes the list rather than reading the cache so the caller resolves against
 * the very list it is rendering (no ordering dependency on `load()`), and
 * takes `string | null | undefined` because all three now occur:
 *   - undefined — no `template` object at all (a site that never applied one),
 *   - null      — `{id: null}`: the user has a custom design and deliberately
 *                 holds NO template. Post-contract-change this is a normal,
 *                 expected value, and it must resolve to "nothing selected"
 *                 rather than being coerced into a lookup that could ever
 *                 match a template site,
 *   - string    — an id; unknown/retired ids (the v1 `restaurant` … names)
 *                 also resolve to null, which is the mobile behaviour.
 */
export function storedTemplateSite(
  sites: TemplateSite[],
  id: string | null | undefined,
): TemplateSite | null {
  if (id == null) return null;
  return sites.find((site) => site.id === id) ?? null;
}

/**
 * SYNCHRONOUS id resolver for surfaces that only need to name the current
 * template without paying for the snapshot load (the Style panel's Templates
 * row). Returns null for ids outside the v2 space — including every v1 id
 * (`restaurant`, `salon`, `creator`, `shop`, `professional`), which is correct:
 * those templates no longer exist, so a site still carrying one shows the
 * generic label rather than a name we can no longer honour.
 */
export function websiteTemplateOf(
  id: string | null | undefined,
): { id: string; label: string } | null {
  if (id == null) return null;
  const label = TEMPLATE_SITE_LABELS[id];
  return label == null ? null : { id, label };
}
