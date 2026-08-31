/**
 * QR Artisan v1 — OFFLINE contract-invariant checks (no network). Asserts the
 * serialization rules the platform's strict validator enforces and the
 * round-trip rules the mobile client guarantees. Run:
 *   node --experimental-strip-types scripts/qr-artisan-invariants.ts
 */
import {
  QR_PRESETS,
  applyPreset,
  defaultFrame,
  defaultOverlay,
  defaultQrStyle,
  effectiveErrorCorrection,
  effectiveQuietZone,
  eyeShapeToWire,
  frameToWire,
  frameWithKind,
  isLegacyCustomizes,
  matchingPreset,
  moduleShapeToWire,
  normalizeQrHex,
  parseQrPreview,
  perFinderAll,
  presetMatches,
  previewWithoutWarnings,
  styleContrastOk,
  styleFromWire,
  styleToWire,
  type QrStyle,
} from "../src/lib/qr/artisan-style.ts";

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log("  ✓", label);
  } else {
    failures++;
    console.log("  ✗", label, detail != null ? JSON.stringify(detail) : "");
  }
}

const get = (o: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined),
    o,
  );

// ── 1. Colours: RGBA alpha-LAST codec ──────────────────────────────────────
check("hex: #abc → #aabbcc", normalizeQrHex("#abc") === "#aabbcc");
check("hex: #abcd → #aabbccdd (alpha last)", normalizeQrHex("#abcd") === "#aabbccdd");
check("hex: rrggbbff collapses to rrggbb", normalizeQrHex("#11223344") === "#11223344" && normalizeQrHex("#112233ff") === "#112233");
check("hex: junk → null", normalizeQrHex("red") === null && normalizeQrHex("#12") === null);

// ── 2. Closed key sets per module-shape kind ───────────────────────────────
check(
  "diamond emits NO scale (400 trigger)",
  !("scale" in moduleShapeToWire({ kind: "diamond" })),
);
check(
  "smooth emits NO scale",
  !("scale" in moduleShapeToWire({ kind: "smooth" })),
);
check(
  "star points clamp to {4,5,6}",
  moduleShapeToWire({ kind: "star", points: 7 as never }).points === 5 &&
    moduleShapeToWire({ kind: "star", points: 6 }).points === 6,
);
check(
  "leaf default scale is 0.88, never 1",
  moduleShapeToWire({ kind: "leaf" }).scale === 0.88,
);
check(
  "octagon corner is 1-1/√2",
  moduleShapeToWire({ kind: "octagon" }).cornerFraction === 0.2928932188134525,
);

// ── 3. perCorner: preset XOR radii ─────────────────────────────────────────
const presetWire = eyeShapeToWire({ kind: "perCorner", preset: "leaf", topLeft: 0.4 });
check(
  "perCorner preset wins — radii never co-emitted",
  presetWire.preset === "leaf" && !("topLeft" in presetWire),
);

// ── 4. No `content`, resolved auto values on the wire ──────────────────────
const plain = styleToWire(defaultQrStyle());
check("wire never carries content", !("content" in plain));
check("plain style → errorCorrection medium", get(plain, "encoding.errorCorrection") === "medium");
check("plain style → quietZone modules 4", get(plain, "style.quietZone.value") === 4);
check("plain style → eye omitted entirely", get(plain, "style.eye") === undefined);
check("size 512", plain.size === 512);

const withLogo = styleToWire(
  defaultQrStyle({ overlay: defaultOverlay("https://cdn.qshot.com/png-logos/x.png") }),
);
check("logo → auto high", get(withLogo, "encoding.errorCorrection") === "high");
const withShape = styleToWire(defaultQrStyle({ moduleShape: { kind: "rounded" } }));
check("non-square module → auto high", get(withShape, "encoding.errorCorrection") === "high");
const withFrame = styleToWire(defaultQrStyle({ frame: defaultFrame("ticket") }));
check("frame → auto quiet zone 0", get(withFrame, "style.quietZone.value") === 0);

// clipRadiusFraction only for rounded clip
const clipNone = styleToWire(
  defaultQrStyle({ overlay: { ...defaultOverlay("https://x/y.png"), clip: "circle" } }),
);
check(
  "overlay clipRadiusFraction only when clip=rounded",
  get(clipNone, "overlay.clipRadiusFraction") === undefined,
);

// ── 5. Auto-restore on parse (round-trip) ──────────────────────────────────
const rt = styleFromWire(withLogo);
check("stored auto-high restores to null (auto)", rt.errorCorrection === null);
const rtFrame = styleFromWire(withFrame);
check("stored auto-0 quiet zone restores to null (auto)", rtFrame.quietZone === null);
const explicit = styleFromWire(
  styleToWire(defaultQrStyle({ errorCorrection: "quartile", quietZone: { kind: "modules", value: 8 } })),
);
check(
  "hand-picked values survive as overrides",
  explicit.errorCorrection === "quartile" && explicit.quietZone?.value === 8,
);
check(
  "effective getters agree",
  effectiveErrorCorrection(rt) === "high" && effectiveQuietZone(rtFrame).value === 0,
);

// ── 6. Frame option filtering per kind ─────────────────────────────────────
const framed: QrStyle = defaultQrStyle({
  frame: {
    ...defaultFrame("badge"),
    options: {
      cardBrush: { kind: "solid", color: "#111111" },
      tagFillBrush: { kind: "solid", color: "#222222" },
      qrBackgroundBrush: { kind: "solid", color: "#ffffff" },
    },
  },
});
const asCoupon = frameWithKind(framed.frame!, "coupon");
check(
  "kind switch strips rejected slots (coupon keeps cardBrush only)",
  Object.keys(asCoupon.options).join(",") === "cardBrush",
);
const couponWire = frameToWire(asCoupon);
check(
  "frame wire options match the kind's slots",
  Object.keys((couponWire.options as object) ?? {}).join(",") === "cardBrush",
);

// ── 7. Legacy detection + carry-over ───────────────────────────────────────
const legacyBlob = {
  foregroundColor: "#14532D",
  eyeInternalColor: "#B45309",
  eyeExternalColor: "#14532D", // SAME as foreground → must stay following
  backgroundColor: "#F0FDF4",
  module: "dots",
  shape: "apple",
  advancedShape: "coupon",
  text: "OLD",
  textColor: "#FFFFFF",
  fontFamily: "Roboto",
  frameColor: "#134E4A",
  logoUrl: "https://cdn.qshot.com/png-logos/instagram.png",
  logoPositionX: "0.1",
};
check("legacy shape detected", isLegacyCustomizes(legacyBlob) && !isLegacyCustomizes(plain));
const migrated = styleFromWire(legacyBlob);
check(
  "legacy colours carried",
  migrated.moduleBrush.kind === "solid" &&
    migrated.moduleBrush.color === "#14532d" &&
    migrated.background?.kind === "solid" &&
    migrated.background.color === "#f0fdf4",
);
check(
  "eye colour only when it DIFFERS from modules",
  migrated.eyeBorderBrush === null && migrated.eyeCenterBrush !== null,
);
check(
  "legacy frame → ticket kind + caption + cardBrush",
  migrated.frame?.kind === "ticket" &&
    migrated.frame.text.text === "OLD" &&
    (migrated.frame.options.cardBrush as { color?: string })?.color === "#134e4a",
);
check("legacy logo carried, position dropped", migrated.overlay?.imageUrl.includes("instagram"));
check(
  "legacy junk (module/shape) never reaches the wire",
  !JSON.stringify(styleToWire(migrated)).includes("apple") &&
    !JSON.stringify(styleToWire(migrated)).includes("dots"),
);

// ── 8. Preview verdict rules ───────────────────────────────────────────────
const pv = parseQrPreview({
  svg: "<svg/>",
  readable: false,
  warnings: [
    { severity: "warning", code: "smallQuietZone", message: "" },
    { severity: "warning", code: "lowContrast", message: "" },
  ],
});
check("severity computed from warnings", pv.severity === "warning");
check("readable is parsed but never drives severity", pv.readable === false);
const cleaned = previewWithoutWarnings(pv, ["smallQuietZone"]);
check(
  "withoutWarnings recomputes severity from what's left",
  cleaned.warnings.length === 1 && cleaned.severity === "warning",
);
const cleanedAll = previewWithoutWarnings(pv, ["smallQuietZone", "lowContrast"]);
check("all suppressed → none", cleanedAll.severity === "none");
const declaredErr = parseQrPreview({ svg: "<svg/>", severity: "error", warnings: [] });
check("declared severity wins", declaredErr.severity === "error");

// ── 9. Presets ─────────────────────────────────────────────────────────────
check("14 presets", QR_PRESETS.length === 14);
for (const preset of QR_PRESETS) {
  const built = preset.build();
  check(`preset ${preset.id} matches itself`, presetMatches(preset, built));
  check(`preset ${preset.id} clears the 4.0 contrast floor`, styleContrastOk(built));
}
const ocean = QR_PRESETS.find((p) => p.id === "ocean")!;
const withUserBits = applyPreset(ocean, {
  ...QR_PRESETS.find((p) => p.id === "ticket")!.build(),
  overlay: defaultOverlay("https://cdn.qshot.com/png-logos/me.png"),
  size: 1024,
  filename: "mine",
});
check(
  "applyPreset preserves the USER's logo/size/filename",
  withUserBits.overlay?.imageUrl.includes("me.png") &&
    withUserBits.size === 1024 &&
    withUserBits.filename === "mine",
);
check("matching finds the applied preset", matchingPreset(ocean.build())?.id === "ocean");
check(
  "a logo does not clear the preset match",
  presetMatches(ocean, { ...ocean.build(), overlay: defaultOverlay("https://x/l.png") }),
);

// ── 10. PerFinder wire shape ───────────────────────────────────────────────
const tricolor = QR_PRESETS.find((p) => p.id === "tricolor")!.build();
const triWire = styleToWire(tricolor);
const pf = get(triWire, "style.eye.border.brush.perFinder") as Record<string, unknown>;
check(
  "perFinder carries exactly topLeft/topRight/bottomLeft (no bottomRight)",
  pf != null && Object.keys(pf).sort().join(",") === "bottomLeft,topLeft,topRight",
);
check(
  "uniform PerFinder serialises bare",
  get(styleToWire(defaultQrStyle({ eyeBorderBrush: perFinderAll({ kind: "solid", color: "#123456" }) })), "style.eye.border.brush.kind") === "solid",
);

console.log(failures === 0 ? "\nALL INVARIANTS GREEN" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
