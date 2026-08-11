/**
 * Parity self-check for the website-TEMPLATES lib layer against the mobile
 * (Flutter) implementation on branch `origin/feature/template-sites` — the
 * serialization + behaviour source of truth.
 *
 * ── What this file is now ──────────────────────────────────────────────────
 * Templates v2 (mobile ef5c94ed, c254c921, 2dcf9a64, 1cd35b2e) deleted the 5
 * hand-coded style presets (restaurant / salon / creator / shop / professional)
 * and the `createFromTemplate` / `restyleWithTemplate` engine this script used
 * to exercise. A template is now a REAL curated profile shipped as a JSON
 * snapshot, applied either as `create` (fresh site: data + style verbatim) or
 * `restyle` (existing site: keep the user's blocks, take the template's styles).
 *
 * SECTION A therefore mirrors, assertion for assertion, the 6 Dart tests in
 * `test/website/template_site_test.dart` (3 tests × template-1 / template-2) —
 * the real acceptance criteria for `create`/`restyle` — and adds the v2
 * invariants the Dart suite gets for free from the type system or leaves
 * implicit (style-source = FIRST block of each type, id freshness on appended
 * blocks, the TemplateRef stamp, the registry's order/caching contract).
 *
 * SECTIONS B–D keep the checks for modules that survived v2 and are still
 * compiled into the app:
 *   B  template-palette.ts vs `template_palette.dart`. The palette no longer
 *      drives template application (the brand-color selector is deferred to
 *      mobile's phase 2) but the module is kept for it, so it must stay
 *      bit-exact. GOLDEN PROVENANCE: the Dart/Flutter SDK is not installed on
 *      this machine, so these ints could NOT be produced by executing the real
 *      Dart. They are the test vectors from
 *      docs/web-app-study/sync-2026-07-19/SPEC-templates.md §1.3, independently
 *      re-verified BY HAND for restaurant (channel math + the onPrimary
 *      white-vs-dark decision), salon (contrast 3.80 vs 4.58) and shop
 *      (onPrimarySoft via one HSL darkening iteration, incl. Flutter's 8-bit
 *      quantization). If a Dart SDK appears, re-derive with a scratch script
 *      that prints `color.toARGB32()` per role.
 *   C  apply-button-theme.ts vs `layout_types.dart` ButtonThemeType.applyTo
 *      (live: the Button block editor's theme picker).
 *   D  template-apply.ts `mergeUserContent` vs `hero_template.dart` (live: the
 *      hero Style tab AND `restyleWithTemplateSite`).
 *
 * Run: npx tsx scripts/check-template-parity.ts   (Node 22)
 * Exits 1 on any failure.
 */

import type { Block, ButtonBlock, HeaderBlock, ImagesBlock } from "../src/lib/types/blocks";
import type { WebsiteSettings } from "../src/lib/types/profile";
import { catalogByType } from "../src/lib/builder/catalog";
import { genId, parseSettings, serializeSettings } from "../src/lib/builder/serialization";
import { applyButtonTheme } from "../src/lib/builder/apply-button-theme";
import { mergeUserContent } from "../src/lib/builder/template-apply";
import { paletteFromBrand, type TemplatePalette } from "../src/lib/builder/template-palette";
import {
  heroDefaults,
  PLACEHOLDER_TEXTS,
  PLACEHOLDER_URL,
} from "../src/lib/builder/hero-defaults";
import {
  createFromTemplateSite,
  loadTemplateSites,
  loadedTemplateSites,
  restyleWithTemplateSite,
  storedTemplateSite,
  templateAccentColor,
  templateSiteLabel,
  templateSiteOf,
  websiteTemplateOf,
  TEMPLATE_SITE_IDS,
  TEMPLATE_SITE_LABELS,
  type TemplateSite,
} from "../src/lib/builder/website-templates";
import rawTemplate2 from "../src/lib/builder/template-sites/template-2.json";

let passed = 0;
let failed = 0;

function hex(n: unknown): string {
  return typeof n === "number" ? `0x${(n >>> 0).toString(16).padStart(8, "0")}` : String(n);
}

function check(name: string, actual: unknown, expected: unknown): void {
  const ok =
    typeof actual === "number" && typeof expected === "number"
      ? (actual >>> 0) === (expected >>> 0)
      : actual === expected;
  if (ok) {
    passed++;
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  console.error(`  expected: ${hex(expected)} (${JSON.stringify(expected)})`);
  console.error(`  actual  : ${hex(actual)} (${JSON.stringify(actual)})`);
}

/** `expect(x, isTrue)` — for the Dart assertions that are plain predicates. */
function checkTrue(name: string, actual: boolean): void {
  check(name, actual, true);
}

/** Order-insensitive set comparison (`expect(setA, setB)` on Dart Sets). */
function checkSet(name: string, actual: Iterable<string>, expected: Iterable<string>): void {
  check(name, [...actual].sort().join("|"), [...expected].sort().join("|"));
}

/** The web analogue of Dart's `XBlock.init(...)` — the real "Add block" factory. */
function make<T extends Block>(type: string): T {
  return catalogByType[type].make() as T;
}

let sectionMark: number | null = null;

function closeSection(): void {
  if (sectionMark !== null) console.log(`   ${passed + failed - sectionMark} checks`);
}

function section(title: string): void {
  closeSection();
  sectionMark = passed + failed;
  console.log(`\n${title}\n${"─".repeat(title.length)}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// A. TemplateSite — mirror of test/website/template_site_test.dart
// ═══════════════════════════════════════════════════════════════════════════

async function templateSiteTests(): Promise<void> {
  section("A0. registry — WebsiteTemplateRegistry");
  // ── registry contract (WebsiteTemplateRegistry) ──────────────────────────
  check("registry: loaded() is null before load()", loadedTemplateSites(), null);

  const sites = await loadTemplateSites();

  check("registry: ids order == labels order", TEMPLATE_SITE_IDS.join(","), Object.keys(TEMPLATE_SITE_LABELS).join(","));
  check("registry: loads every id", sites.map((s) => s.id).join(","), TEMPLATE_SITE_IDS.join(","));
  // `loaded` is the cache mobile's sync `of()` reads; a second load is a no-op.
  checkTrue("registry: load() is cached (same instance)", (await loadTemplateSites()) === sites);
  checkTrue("registry: loaded() populated after load()", loadedTemplateSites() === sites);
  checkTrue("registry: of(id) resolves after load", templateSiteOf(TEMPLATE_SITE_IDS[0]) === sites[0]);
  check("registry: of(unknown) is null", templateSiteOf("nope"), null);
  check("registry: of(null) is null", templateSiteOf(null), null);
  // The picker's DEFAULT selection for a brand-new site is the first entry.
  check("registry: first id is the default", TEMPLATE_SITE_IDS[0], "template-1");

  // Sync id→label resolver used by the Style panel's Templates row: v1 ids no
  // longer name anything, and must not be dressed up as if they did.
  check("websiteTemplateOf('template-1').label", websiteTemplateOf("template-1")?.label, "Business Website");
  check("websiteTemplateOf('restaurant') is null (v1 id)", websiteTemplateOf("restaurant"), null);
  check("websiteTemplateOf(null) is null", websiteTemplateOf(null), null);

  // c254c921 "fill style defaults on snapshots": template-2's stored JSON has
  // NO floating_button, and fromJson must restore it from the hero style.
  const rawSettings = (rawTemplate2 as unknown as { settings: Record<string, unknown> }).settings;
  checkTrue("template-2 snapshot really omits floating_button", !("floating_button" in rawSettings));

  for (const site of sites) {
    const id = site.id;
    section(`A. ${id} — template_site_test.dart (parses / create / restyle)`);

    // ── test 1: "parses with blocks and settings" ─────────────────────────
    check(`${id}: id`, site.id, id);
    checkTrue(`${id}: webpage.blocks isNotEmpty`, site.blocks.length > 0);
    checkTrue(`${id}: label isNotEmpty`, templateSiteLabel(site).length > 0);
    check(`${id}: label from TEMPLATE_SITE_LABELS`, templateSiteLabel(site), TEMPLATE_SITE_LABELS[id]);

    // ── test 2: "create fills data + style and preserves site identity" ───
    const current = { website_name: "My Shop" } as WebsiteSettings;
    const created = createFromTemplateSite(site, current);

    check(`${id}: create block count`, created.blocks.length, site.blocks.length);
    const templateIds = new Set(site.blocks.map((b) => b.id));
    checkTrue(
      `${id}: create gives fresh ids (none shared with the asset)`,
      created.blocks.every((b) => !templateIds.has(b.id)),
    );
    checkTrue(
      `${id}: create keeps the template's block types/order`,
      created.blocks.map((b) => b.type).join(",") === site.blocks.map((b) => b.type).join(","),
    );
    check(`${id}: create keeps websiteName`, created.settings.website_name, "My Shop");
    check(`${id}: create stamps template.id`, created.settings.template?.id, id);
    check(`${id}: create keeps the template's style`, created.settings.style, site.settings.style);
    // fillDefaults invariant — the same one WebsiteModel.fromJson guarantees.
    checkTrue(`${id}: create floating_button isNotNull`, created.settings.floating_button != null);
    checkTrue(`${id}: create background isNotNull`, created.settings.background != null);
    checkTrue(`${id}: create header isNotNull`, created.settings.header != null);
    checkTrue(`${id}: create cover_photo isNotNull`, created.settings.cover_photo != null);

    // `templateAccentColor` survived the contract change as a PRESENTATION
    // helper (the dot on each picker card): the template's AUTHORED accent is
    // button1's fill, falling back to the page background.
    check(`${id}: accentColor == button1.background_color`, templateAccentColor(site), site.settings.button1?.background_color);
    // CONTRACT: the stamp is `{id}` ALONE. Comparing the serialized object (not
    // just `.id`) is what makes a re-introduced `brand_color` — or any other
    // extra key, which `additionalProperties:false` would 422 — fail here.
    check(
      `${id}: TemplateRef JSON shape is {id} alone`,
      JSON.stringify(created.settings.template),
      JSON.stringify({ id }),
    );
    checkTrue(
      `${id}: create stamps no brand_color`,
      !("brand_color" in (created.settings.template as object)),
    );

    // ── test 3 (b7047bdf): "restyle keeps content, overrides style, follows
    //    TEMPLATE order" — the ordering flipped: template order is primary,
    //    each type's first slot takes all the user's blocks of it, later slots
    //    of a supplied type are dropped, alien types park at the bottom. ──
    const header = { ...make<HeaderBlock>("HeaderModule"), value: "My real header" };
    const buttons: ButtonBlock = {
      ...make<ButtonBlock>("ButtonModule"),
      title: "Actions",
      buttons: [{ id: genId(), title: "Call me", url: "tel:1" }],
    };
    // a type no template ships — must survive, parked at the bottom
    const booking = { ...make<Block>("BookingModule"), title: "Book me" } as Block & {
      title: string;
    };
    const userBlocks: Block[] = [header, buttons, booking];
    const settings = { website_name: "Kept" } as WebsiteSettings;

    const out = restyleWithTemplateSite(site, userBlocks, settings);

    // every user block survives with its content
    const outHeader = out.blocks.find((b) => b.type === "HeaderModule") as HeaderBlock;
    check(`${id}: restyle keeps header content`, outHeader?.value, "My real header");
    check(`${id}: restyle keeps user block ids`, outHeader?.id, header.id);
    const outButtons = out.blocks.find((b) => b.type === "ButtonModule") as ButtonBlock;
    check(`${id}: restyle keeps button title`, outButtons?.buttons[0]?.title, "Call me");
    check(`${id}: restyle keeps button url`, outButtons?.buttons[0]?.url, "tel:1");
    const outBooking = out.blocks.filter((b) => b.type === "BookingModule");
    check(`${id}: restyle keeps the booking block`, outBooking.length, 1);
    check(
      `${id}: a type the template lacks is parked at the end`,
      out.blocks[out.blocks.length - 1].type,
      "BookingModule",
    );

    // styles overridden from the template's FIRST slot of the same type
    const templateHeader = site.blocks.find((b) => b.type === "HeaderModule") as
      | HeaderBlock
      | undefined;
    if (templateHeader != null) {
      check(`${id}: restyle takes header align`, outHeader.align, templateHeader.align);
      check(`${id}: restyle takes header size`, outHeader.size, templateHeader.size);
    }

    // ordering follows the template, not the user (Dart: dedup type orders,
    // then the intersection must agree)
    const dedup = (types: string[]) => [...new Set(types)];
    const templateOrder = dedup(site.blocks.map((b) => b.type));
    const outOrder = dedup(out.blocks.map((b) => b.type));
    check(
      `${id}: types the template knows appear in template order`,
      outOrder.filter((t) => templateOrder.includes(t)).join(","),
      templateOrder.filter((t) => outOrder.includes(t)).join(","),
    );
    checkTrue(
      `${id}: every template type is represented`,
      templateOrder.every((t) => outOrder.includes(t)),
    );

    // no duplicated stubs: a type the user supplied is never also seeded
    check(
      `${id}: one HeaderModule (later template slots dropped)`,
      out.blocks.filter((b) => b.type === "HeaderModule").length,
      1,
    );
    check(
      `${id}: one ButtonModule (templated or parked)`,
      out.blocks.filter((b) => b.type === "ButtonModule").length,
      1,
    );

    // types the user lacks arrive as the template's stubs — EVERY slot of
    // them, with fresh ids
    const userTypes = new Set<string>(userBlocks.map((b) => b.type));
    for (const type of templateOrder) {
      if (userTypes.has(type)) continue;
      check(
        `${id}: ${type} stubs keep the template's slot count`,
        out.blocks.filter((b) => b.type === type).length,
        site.blocks.filter((b) => b.type === type).length,
      );
    }
    checkTrue(
      `${id}: seeded stubs get fresh ids`,
      out.blocks
        .filter((b) => !userTypes.has(b.type))
        .every((b) => !templateIds.has(b.id)),
    );
    check(`${id}: restyle keeps websiteName`, out.settings.website_name, "Kept");
    check(`${id}: restyle stamps template.id`, out.settings.template?.id, id);
    check(
      `${id}: restyle TemplateRef JSON shape is {id} alone`,
      JSON.stringify(out.settings.template),
      JSON.stringify({ id }),
    );
    // A site that previously carried the legacy key must not keep it after a
    // restyle: the stamp REPLACES the object, it does not merge into it.
    const legacy = restyleWithTemplateSite(site, userBlocks, {
      ...settings,
      template: { id: "template-9", brand_color: 0xff112233 } as never,
    });
    check(
      `${id}: restyle over a legacy TemplateRef drops brand_color`,
      JSON.stringify(legacy.settings.template),
      JSON.stringify({ id }),
    );
    check(`${id}: restyle takes the template's style`, out.settings.style, site.settings.style);
    check(`${id}: restyle takes the template's font_family`, out.settings.font_family, site.settings.font_family);

    // ── style source is the FIRST slot of the type ───────────────────────
    // The first slot is where the user's blocks land, so its style is what
    // they inherit. Snapshots shipping two ImageModules with DIFFERENT
    // layouts make this observable (a regression here would be silent).
    const templateImages = site.blocks.filter((b) => b.type === "ImageModule") as ImagesBlock[];
    if (templateImages.length > 1) {
      checkTrue(
        `${id}: the two ImageModules really differ (test is meaningful)`,
        templateImages[0].layout_type !== templateImages[templateImages.length - 1].layout_type,
      );
      const userImage = make<ImagesBlock>("ImageModule");
      const restyled = restyleWithTemplateSite(site, [userImage], settings)
        .blocks.find((b) => b.id === userImage.id) as ImagesBlock;
      check(
        `${id}: style source is the FIRST slot of its type`,
        restyled?.layout_type,
        templateImages[0].layout_type,
      );
    }

    // ── test 4 (b7047bdf): "restyle groups repeats of one type together, in
    //    user order" ───────────────────────────────────────────────────────
    const b1 = { ...make<ButtonBlock>("ButtonModule"), title: "B1" };
    const h = { ...make<HeaderBlock>("HeaderModule"), value: "H" };
    const b2 = { ...make<ButtonBlock>("ButtonModule"), title: "B2" };
    const b3 = { ...make<ButtonBlock>("ButtonModule"), title: "B3" };
    const grouped = restyleWithTemplateSite(site, [b1, h, b2, b3], settings);

    const outB = grouped.blocks.filter((b) => b.type === "ButtonModule") as ButtonBlock[];
    // relative order always survives, whether templated or parked
    check(`${id}: repeats keep user order`, outB.map((b) => b.title).join(","), "B1,B2,B3");
    if (site.blocks.some((b) => b.type === "ButtonModule")) {
      // the template has a slot for this type: repeats are pulled together
      const firstIndex = grouped.blocks.indexOf(outB[0]);
      checkTrue(
        `${id}: repeats are contiguous at the first slot`,
        outB.every((b, i) => grouped.blocks[firstIndex + i] === b),
      );
    }
    // whatever the template has no slot for keeps the user's own layout:
    // same relative order, as a contiguous tail
    const templateTypes = new Set(site.blocks.map((b) => b.type));
    const expectedTail = [b1, h, b2, b3].filter((b) => !templateTypes.has(b.type));
    if (expectedTail.length > 0) {
      const tail = grouped.blocks.slice(grouped.blocks.length - expectedTail.length);
      check(
        `${id}: parked tail keeps the user's own order`,
        tail.map((b) => b.type).join(","),
        expectedTail.map((b) => b.type).join(","),
      );
    }
  }

  templateRefContractTests(sites);
}

// ═══════════════════════════════════════════════════════════════════════════
// A9. TemplateRef contract — `{id: string | null}` (brand_color REMOVED)
// ═══════════════════════════════════════════════════════════════════════════
// The WRITE side is asserted per-template above (the stamp is `{id}` alone).
// This covers the READ side: a null id must mean "no template selected", and a
// legacy `brand_color` must never survive a load — the deployed validator is
// `additionalProperties:false`, so echoing it back once the backend drops it
// from the schema fails the entire save with 422 (the ExternalLinkItem `icon`
// failure, exactly).

function templateRefContractTests(sites: TemplateSite[]): void {
  section("A9. TemplateRef — {id: string | null}, no brand_color");

  // ── read path: null id selects nothing (mobile: the picker shows no pick) ──
  // Guard against a vacuous null test: if a template site could itself carry a
  // null/empty id, "null resolves to nothing" would be true for the wrong
  // reason.
  checkTrue(
    "every template site has a real string id (null test is meaningful)",
    sites.every((s) => typeof s.id === "string" && s.id.length > 0),
  );
  check("storedTemplateSite(null) — nothing selected", storedTemplateSite(sites, null), null);
  check("storedTemplateSite(undefined) — nothing selected", storedTemplateSite(sites, undefined), null);
  check("storedTemplateSite('restaurant') — retired v1 id", storedTemplateSite(sites, "restaurant"), null);
  checkTrue(
    "storedTemplateSite('template-1') restores the stored pick",
    storedTemplateSite(sites, "template-1") === sites[0],
  );

  // ── parse: legacy documents ───────────────────────────────────────────────
  const legacy = parseSettings({
    template: { id: "template-1", brand_color: 0xff123456 },
  });
  check(
    "parse strips legacy brand_color",
    JSON.stringify(legacy.template),
    JSON.stringify({ id: "template-1" }),
  );
  check(
    "parse of {brand_color} alone yields {id:null}",
    JSON.stringify(parseSettings({ template: { brand_color: 1 } }).template),
    JSON.stringify({ id: null }),
  );
  // `{id: null}` is the NEW normal value (a user with a custom design who holds
  // no template) — it must round-trip untouched, not be dropped or defaulted.
  check(
    "parse keeps an explicit null id",
    JSON.stringify(parseSettings({ template: { id: null } }).template),
    JSON.stringify({ id: null }),
  );
  // Passthrough policy: only the key the contract owners removed is removed.
  check(
    "parse preserves other unknown keys inside template",
    JSON.stringify(parseSettings({ template: { id: "template-2", future: 1 } }).template),
    JSON.stringify({ id: "template-2", future: 1 }),
  );
  check("parse keeps an explicit template:null", parseSettings({ template: null }).template, null);
  checkTrue(
    "parse never invents a template key",
    !("template" in parseSettings({ style: "style1" })),
  );

  // ── serialize: second line of defence (settings that skipped the parser) ──
  const serialized = serializeSettings({
    template: { id: "template-1", brand_color: 0xff123456 },
  } as never);
  check(
    "serialize strips brand_color it never parsed",
    JSON.stringify(serialized.template),
    JSON.stringify({ id: "template-1" }),
  );
  check(
    "serialize keeps a null id on the wire",
    JSON.stringify(serializeSettings({ template: { id: null } }).template),
    JSON.stringify({ id: null }),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// B. TemplatePalette (kept for mobile's phase-2 brand-color selector)
// ═══════════════════════════════════════════════════════════════════════════

const GOLDEN_PALETTES: Record<string, TemplatePalette> = {
  restaurant: {
    brand: 0xff6f4e37,
    primary: 0xff6f4e37,
    onPrimary: 0xffffffff,
    primarySoft: 0xffebe6e3,
    onPrimarySoft: 0xff6f4e37,
    surface: 0xfff6f4f3,
    onSurface: 0xff1a1a1a,
    card: 0xffffffff,
    outline: 0xffdbd3cd,
  },
  salon: {
    brand: 0xffb76e79,
    primary: 0xffb76e79,
    onPrimary: 0xff1a1a1a,
    primarySoft: 0xfff5ebec,
    onPrimarySoft: 0xff9b4d59,
    surface: 0xfffbf6f7,
    onSurface: 0xff1a1a1a,
    card: 0xffffffff,
    outline: 0xffeddbde,
  },
  creator: {
    brand: 0xff7c3aed,
    primary: 0xff7c3aed,
    onPrimary: 0xffffffff,
    primarySoft: 0xffede3fc,
    onPrimarySoft: 0xff7c3aed,
    surface: 0xfff7f3fe,
    onSurface: 0xff1a1a1a,
    card: 0xffffffff,
    outline: 0xffdecefb,
  },
  shop: {
    brand: 0xff2563eb,
    primary: 0xff2563eb,
    onPrimary: 0xffffffff,
    primarySoft: 0xffe0e9fc,
    onPrimarySoft: 0xff1453dd,
    surface: 0xfff2f6fe,
    onSurface: 0xff1a1a1a,
    card: 0xffffffff,
    // ⚠ SPEC-templates.md §1.3 says 0xFFC8D8FA, but the red channel is
    // EXACTLY 200.5 (0.25*(37/255) + 0.75 = 0.78627…, ×255 = 200.5) and Dart
    // `.round()` rounds half AWAY FROM ZERO → 201 = 0xC9. Mobile source
    // semantics win over the spec table.
    outline: 0xffc9d8fa,
  },
  professional: {
    brand: 0xff1e3a5f,
    primary: 0xff1e3a5f,
    onPrimary: 0xffffffff,
    primarySoft: 0xffe0e3e9,
    onPrimarySoft: 0xff1e3a5f,
    surface: 0xfff2f3f5,
    onSurface: 0xff1a1a1a,
    card: 0xffffffff,
    outline: 0xffc7ced7,
  },
};

function paletteTests(): void {
  section("B. TemplatePalette — template_palette.dart (phase-2 module)");
  for (const [id, golden] of Object.entries(GOLDEN_PALETTES)) {
    const actual = paletteFromBrand(golden.brand);
    for (const role of Object.keys(golden) as (keyof TemplatePalette)[]) {
      check(`palette ${id}.${role}`, actual[role], golden[role]);
    }
  }

  // Pale brand (HSL lightness > 0.85) darkens to lightness 0.55 (hand-computed:
  // 0xFFF5F5F5 → L=245/255≈0.961, S=0 → grey round(0.55*255)=140 = 0xFF8C8C8C).
  check("pale brand darkened primary", paletteFromBrand(0xfff5f5f5).primary, 0xff8c8c8c);
  check("pale brand keeps raw pick", paletteFromBrand(0xfff5f5f5).brand, 0xfff5f5f5);
}

// ═══════════════════════════════════════════════════════════════════════════
// C. ButtonThemeType.applyTo bakes (layout_types.dart)
// ═══════════════════════════════════════════════════════════════════════════

function buttonThemeTests(): void {
  section("C. ButtonThemeType.applyTo — layout_types.dart");
  const blank = { title: "Btn", url: "https://x.example" };

  // soft: alpha byte round(0.14*255) = 36 = 0x24, RGB of the fill.
  check("soft default fill 0x244488FF", applyButtonTheme("soft", blank).background_color, 0x244488ff);
  check(
    "soft palette fill 0x247C3AED",
    applyButtonTheme("soft", blank, { primary: 0xff7c3aed }).background_color,
    0x247c3aed,
  );
  // minimal: Colors.grey (0xFF9E9E9E) @ alpha 0.3 → round(0.3*255)=77=0x4D —
  // palette-independent.
  check(
    "minimal fill 0x4D9E9E9E",
    applyButtonTheme("minimal", blank, { primary: 0xff123456 }).background_color,
    0x4d9e9e9e,
  );
  check("minimal use_text_color false", applyButtonTheme("minimal", blank).use_text_color, false);
  check("solid text = onPrimary default white", applyButtonTheme("solid", blank).text_color, 0xffffffff);
  check("solid radius", applyButtonTheme("solid", blank).corner_radius, 12);
  check("pill radius", applyButtonTheme("pill", blank).corner_radius, 100);
  check(
    "outline border = fill",
    applyButtonTheme("outline", blank, { primary: 0xff2563eb }).border_color,
    0xff2563eb,
  );
  check("outline keeps bg off", applyButtonTheme("outline", blank).use_background_color, false);
  // copyWith semantics: outline keeps a prior background_color int.
  check(
    "outline keeps old background int",
    applyButtonTheme("outline", { ...blank, background_color: 0xff112233 }).background_color,
    0xff112233,
  );
  // content untouched
  check("applyTo keeps url", applyButtonTheme("soft", blank).url, "https://x.example");
}

// ═══════════════════════════════════════════════════════════════════════════
// D. mergeUserContent placeholder nuances (hero_template.dart)
// ═══════════════════════════════════════════════════════════════════════════

function mergeTests(): void {
  section("D. mergeUserContent — hero_template.dart");
  check("placeholder set size", PLACEHOLDER_TEXTS.size, 9);
  check("placeholder url", PLACEHOLDER_URL, "https://speaknet.app");

  const merged = mergeUserContent(
    {
      title: { hide: false, text: "My Bakery" }, // user copy
      text: { hide: false, text: "Write Your Main Description or Small Tagline Text Here" }, // demo
      button1: { hide: false, text: "Book Now", url: "https://mybakery.example" }, // demo text, user url
    },
    heroDefaults("style7"),
  );
  check("merge keeps user title", merged.title?.text, "My Bakery");
  check("merge resets demo text", merged.text?.text, "Write your tagline or short description here");
  check("merge resets demo button text", merged.button1?.text, "Contact Us");
  check("merge keeps user button url", merged.button1?.url, "https://mybakery.example");
  // contains-check is on the UNtrimmed value: " Book Now " is user content.
  check(
    "merge untrimmed nuance",
    mergeUserContent({ title: { hide: false, text: " Book Now " } }, heroDefaults("style2")).title
      ?.text,
    " Book Now ",
  );
}

// ═══════════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  await templateSiteTests();
  paletteTests();
  buttonThemeTests();
  mergeTests();
  closeSection();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void main();
