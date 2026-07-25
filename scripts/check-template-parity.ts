/**
 * Parity self-check for the website-templates lib layer against the mobile
 * (Flutter) implementation — the serialization source of truth:
 *   - template-palette.ts vs `template_palette.dart` (origin/dev)
 *   - apply-button-theme.ts vs `layout_types.dart` ButtonThemeType.applyTo
 *   - template-apply.ts TemplateRef stamp vs `settings_entity.dart` toJson
 *
 * GOLDEN PROVENANCE: the Dart/Flutter SDK is not installed on this machine,
 * so the palette ints below could NOT be produced by executing the real Dart
 * code. They are the test vectors from
 * docs/web-app-study/sync-2026-07-19/SPEC-templates.md §1.3 (stated there as
 * "computed with the exact algorithm"), independently re-verified BY HAND for:
 *   - restaurant: surface/primarySoft/outline channel math and the
 *     onPrimary white-vs-dark contrast decision,
 *   - salon: the onPrimary dark-text decision (contrast 3.80 vs 4.58),
 *   - shop: onPrimarySoft = 0xFF1453DD via one darkening iteration of the
 *     HSL loop (L 0.5333 → 0.4733), including Flutter's 8-bit quantization
 *     in HSLColor.toColor().
 * If a Dart SDK becomes available, re-derive with a scratch script importing
 * template_palette.dart and `print(color.toARGB32())` for each role.
 *
 * Run: npx tsx scripts/check-template-parity.ts   (Node 22)
 * Exits 1 on any failure.
 */

import { paletteFromBrand, type TemplatePalette } from "../src/lib/builder/template-palette";
import { applyButtonTheme } from "../src/lib/builder/apply-button-theme";
import {
  createFromTemplate,
  mergeUserContent,
  restyleWithTemplate,
} from "../src/lib/builder/template-apply";
import { websiteTemplateOf } from "../src/lib/builder/website-templates";
import { heroDefaults, PLACEHOLDER_TEXTS, PLACEHOLDER_URL } from "../src/lib/builder/hero-defaults";
import type { TemplateContentKey } from "../src/lib/builder/website-templates";

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

// ── Palettes for the 5 default brand colors (mobile TemplatePalette.fromBrand) ──

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

for (const [id, golden] of Object.entries(GOLDEN_PALETTES)) {
  const actual = paletteFromBrand(golden.brand);
  for (const role of Object.keys(golden) as (keyof TemplatePalette)[]) {
    check(`palette ${id}.${role}`, actual[role], golden[role]);
  }
  const tpl = websiteTemplateOf(id);
  check(`registry ${id}.defaultBrandColor`, tpl?.defaultBrandColor, golden.brand);
}

// Pale brand (HSL lightness > 0.85) darkens to lightness 0.55 (hand-computed:
// 0xFFF5F5F5 → L=245/255≈0.961, S=0 → grey round(0.55*255)=140 = 0xFF8C8C8C).
check("pale brand darkened primary", paletteFromBrand(0xfff5f5f5).primary, 0xff8c8c8c);
check("pale brand keeps raw pick", paletteFromBrand(0xfff5f5f5).brand, 0xfff5f5f5);

// ── ButtonThemeType.applyTo bakes (layout_types.dart) ──────────────────────

const blank = { title: "Btn", url: "https://x.example" };

// soft: alpha byte round(0.14*255) = 36 = 0x24, RGB of the fill.
check(
  "soft default fill 0x244488FF",
  applyButtonTheme("soft", blank).background_color,
  0x244488ff,
);
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
check("outline border = fill", applyButtonTheme("outline", blank, { primary: 0xff2563eb }).border_color, 0xff2563eb);
check("outline keeps bg off", applyButtonTheme("outline", blank).use_background_color, false);
// copyWith semantics: outline keeps a prior background_color int.
check(
  "outline keeps old background int",
  applyButtonTheme("outline", { ...blank, background_color: 0xff112233 }).background_color,
  0xff112233,
);
// content untouched
check("applyTo keeps url", applyButtonTheme("soft", blank).url, "https://x.example");

// ── TemplateRef toJson shape (settings_entity.dart) ────────────────────────

const t = (key: TemplateContentKey): string =>
  ({
    menu: "Menu", reviews: "Reviews", booking: "Booking", videos: "Videos",
    links: "Links", products: "Products", about: "About", contact: "Contact",
    name: "Name", email: "Email", message: "Message",
  })[key];

const shop = websiteTemplateOf("shop")!;
const created = createFromTemplate(shop, 0xff2563eb, t);
check(
  "TemplateRef JSON shape",
  JSON.stringify(created.settings.template),
  '{"id":"shop","brand_color":4280640491}',
);
check("create stamps font_family", created.settings.font_family, "Inter");
check("create block count (shop)", created.blocks.length, 3);
check(
  "restyle stamps raw pick, not palette primary",
  JSON.stringify(
    restyleWithTemplate(shop, [], heroDefaults("style2"), 0xfff5f5f5).settings.template,
  ),
  '{"id":"shop","brand_color":4294309365}', // 0xFFF5F5F5 raw, though primary was darkened
);

// ── mergeUserContent placeholder nuances (hero_template.dart) ──────────────

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
  mergeUserContent(
    { title: { hide: false, text: " Book Now " } },
    heroDefaults("style2"),
  ).title?.text,
  " Book Now ",
);

// ── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
