/**
 * QR Artisan v1 — the design model. Faithful TypeScript port of the mobile
 * entities (`lib/features/qrcode/domain/entities/artisan/*` + `qr_preview.dart`
 * + `qr_preset.dart`, origin/main @ 10c6f051) and of
 * `docs/web-app-study/CONTRACT-qr-artisan.md`.
 *
 * THE cardinal rule (platform validator): every `kind` has a CLOSED key
 * allow-list at every nesting level — one unknown key anywhere is a 400 on
 * every render. So serialization here emits exactly the keys each kind
 * declares, and nothing is ever spread from UI state into the wire.
 *
 * Other contract points encoded here, in one place:
 *  - Colours are `#rrggbb` / `#rrggbbaa` — alpha LAST (not Flutter ARGB, not
 *    the legacy alpha-stripped scheme).
 *  - `null` errorCorrection/quietZone mean AUTO; the wire always carries the
 *    resolved value, and parsing restores a stored value back to auto when it
 *    equals what auto would produce — otherwise adding a logo or a frame later
 *    would stop moving them (mobile 025b5b38 / ec3c266c / cef59ec6).
 *  - `perCorner` eyes: `preset` XOR explicit radii, never both (400).
 *  - `perFinder` has NO bottomRight (a QR has 3 finders).
 *  - `star.points` ∈ {4,5,6}; `leaf.scale` defaults to 0.88 — never 1.
 *  - Frame options are filtered against the kind's own brush slots on both
 *    parse and serialize, so a kind switch can never leak a rejected option.
 *  - `readable:false` with no warnings means "unverified", never "failed" —
 *    gating is on `severity` alone.
 *  - Legacy (pre-v1) `customizes` blobs are detected and mapped, never thrown.
 */

// ─── Colours ────────────────────────────────────────────────────────────────

/** Canonical wire colour: `#rrggbb` when opaque, `#rrggbbaa` otherwise. */
export type QrHexColor = string;

const HEX_RE = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Normalise any accepted colour spelling (#rgb, #rgba, #rrggbb, #rrggbbaa,
 * leading # optional) to the canonical lowercase wire form. Null when invalid.
 */
export function normalizeQrHex(input: unknown): QrHexColor | null {
  if (typeof input !== "string") return null;
  const m = HEX_RE.exec(input.trim());
  if (!m) return null;
  let h = m[1].toLowerCase();
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length === 8 && h.endsWith("ff")) h = h.slice(0, 6);
  return `#${h}`;
}

/** The rgb part (#rrggbb) of a wire colour — for contrast math and pickers. */
export function qrHexRgb(color: QrHexColor): string {
  const n = normalizeQrHex(color) ?? "#000000";
  return n.slice(0, 7);
}

// ─── Alignment / enums ──────────────────────────────────────────────────────

export const QR_ALIGNMENTS = [
  "topLeft",
  "topCenter",
  "topRight",
  "centerLeft",
  "center",
  "centerRight",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
] as const;
export type QrAlignment = (typeof QR_ALIGNMENTS)[number];

function alignmentFrom(v: unknown, fallback: QrAlignment): QrAlignment {
  return QR_ALIGNMENTS.includes(v as QrAlignment) ? (v as QrAlignment) : fallback;
}

export const QR_ERROR_CORRECTIONS = ["low", "medium", "quartile", "high"] as const;
export type QrErrorCorrection = (typeof QR_ERROR_CORRECTIONS)[number];

function errorCorrectionFrom(v: unknown): QrErrorCorrection {
  return QR_ERROR_CORRECTIONS.includes(v as QrErrorCorrection)
    ? (v as QrErrorCorrection)
    : "medium";
}

// ─── Brushes ────────────────────────────────────────────────────────────────

export type QrBrush =
  | { kind: "solid"; color: QrHexColor }
  | {
      kind: "linear";
      colors: QrHexColor[];
      stops?: number[];
      begin?: QrAlignment;
      end?: QrAlignment;
    }
  | {
      kind: "radial";
      colors: QrHexColor[];
      stops?: number[];
      center?: QrAlignment;
      radius?: number;
    }
  | {
      kind: "sweep";
      colors: QrHexColor[];
      stops?: number[];
      center?: QrAlignment;
      startAngle?: number;
      endAngle?: number;
    };

export const QR_BLACK: QrBrush = { kind: "solid", color: "#000000" };
export const QR_WHITE: QrBrush = { kind: "solid", color: "#ffffff" };

export function brushColors(brush: QrBrush): QrHexColor[] {
  return brush.kind === "solid" ? [brush.color] : brush.colors;
}

export function brushToWire(brush: QrBrush): Record<string, unknown> {
  // stops must match colors 1:1 or the platform rejects — drop a mismatch.
  const stops = (b: { colors: string[]; stops?: number[] }) =>
    b.stops && b.stops.length === b.colors.length ? { stops: b.stops } : {};
  switch (brush.kind) {
    case "solid":
      return { kind: "solid", color: brush.color };
    case "linear":
      return {
        kind: "linear",
        colors: brush.colors,
        ...stops(brush),
        begin: brush.begin ?? "topLeft",
        end: brush.end ?? "bottomRight",
      };
    case "radial":
      return {
        kind: "radial",
        colors: brush.colors,
        ...stops(brush),
        center: brush.center ?? "center",
        radius: brush.radius ?? 0.5,
      };
    case "sweep":
      return {
        kind: "sweep",
        colors: brush.colors,
        ...stops(brush),
        center: brush.center ?? "center",
        startAngle: brush.startAngle ?? 0,
        endAngle: brush.endAngle ?? 2 * Math.PI,
      };
  }
}

export function brushFromWire(json: unknown): QrBrush | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const color = normalizeQrHex(o.color) ?? "#000000";
  const colors = Array.isArray(o.colors)
    ? (o.colors
        .map((c) => normalizeQrHex(c))
        .filter((c): c is string => c != null) as QrHexColor[])
    : [];
  const stops =
    Array.isArray(o.stops) && o.stops.every((s) => typeof s === "number")
      ? (o.stops as number[])
      : undefined;
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  switch (o.kind) {
    case "linear":
      if (colors.length === 0) return null;
      return {
        kind: "linear",
        colors,
        stops,
        begin: alignmentFrom(o.begin, "topLeft"),
        end: alignmentFrom(o.end, "bottomRight"),
      };
    case "radial":
      if (colors.length === 0) return null;
      return {
        kind: "radial",
        colors,
        stops,
        center: alignmentFrom(o.center, "center"),
        radius: num(o.radius, 0.5),
      };
    case "sweep":
      if (colors.length === 0) return null;
      return {
        kind: "sweep",
        colors,
        stops,
        center: alignmentFrom(o.center, "center"),
        startAngle: num(o.startAngle, 0),
        endAngle: num(o.endAngle, 2 * Math.PI),
      };
    case "solid":
    default:
      // Unknown kinds degrade to a solid of their colour (never throw).
      return { kind: "solid", color };
  }
}

export function sameBrush(a: QrBrush | null, b: QrBrush | null): boolean {
  if (a == null || b == null) return a === b;
  return JSON.stringify(brushToWire(a)) === JSON.stringify(brushToWire(b));
}

// ─── PerFinder ──────────────────────────────────────────────────────────────

/**
 * A QR has exactly THREE finders — topLeft, topRight, bottomLeft. There is no
 * bottomRight and sending one is a 400. A uniform value serialises bare.
 */
export type PerFinder<T> =
  | { uniform: T }
  | { perFinder: { topLeft: T; topRight: T; bottomLeft: T } };

export function perFinderAll<T>(value: T): PerFinder<T> {
  return { uniform: value };
}

export function isUniform<T>(p: PerFinder<T>): p is { uniform: T } {
  return "uniform" in p;
}

export function perFinderValues<T>(p: PerFinder<T>): T[] {
  return isUniform(p)
    ? [p.uniform]
    : [p.perFinder.topLeft, p.perFinder.topRight, p.perFinder.bottomLeft];
}

function perFinderToWire<T>(p: PerFinder<T>, encode: (v: T) => unknown): unknown {
  if (isUniform(p)) return encode(p.uniform);
  return {
    perFinder: {
      topLeft: encode(p.perFinder.topLeft),
      topRight: encode(p.perFinder.topRight),
      bottomLeft: encode(p.perFinder.bottomLeft),
    },
  };
}

function perFinderFromWire<T>(
  json: unknown,
  decode: (v: unknown) => T | null,
): PerFinder<T> | null {
  if (json == null) return null;
  const o = json as Record<string, unknown>;
  if (o && typeof o === "object" && o.perFinder && typeof o.perFinder === "object") {
    const pf = o.perFinder as Record<string, unknown>;
    const tl = decode(pf.topLeft);
    const tr = decode(pf.topRight);
    const bl = decode(pf.bottomLeft);
    if (tl == null || tr == null || bl == null) return null;
    return { perFinder: { topLeft: tl, topRight: tr, bottomLeft: bl } };
  }
  const uniform = decode(json);
  return uniform == null ? null : { uniform };
}

// ─── Module shapes (21) ─────────────────────────────────────────────────────

export type QrModuleShape =
  | { kind: "square"; scale?: number }
  | { kind: "circle"; scale?: number }
  | { kind: "diamond" } // NO scale — sending one is a 400
  | { kind: "rounded"; scale?: number; radiusFraction?: number }
  | { kind: "smooth"; radiusFraction?: number }
  | { kind: "classy"; radiusFraction?: number }
  | { kind: "barHorizontal"; thicknessFraction?: number }
  | { kind: "barVertical"; thicknessFraction?: number }
  | { kind: "connectedDiamond"; bridgeFraction?: number }
  | { kind: "tile"; gapFraction?: number; radiusFraction?: number }
  | { kind: "hexagon"; scale?: number }
  | { kind: "octagon"; scale?: number; cornerFraction?: number }
  | { kind: "triangle"; scale?: number; direction?: "up" | "down" | "left" | "right" }
  | { kind: "pillHorizontal"; scale?: number; thicknessFraction?: number }
  | { kind: "pillVertical"; scale?: number; thicknessFraction?: number }
  | { kind: "star"; scale?: number; points?: 4 | 5 | 6; innerRadiusFraction?: number }
  | { kind: "sparkle"; scale?: number; waistFraction?: number }
  | {
      kind: "petal";
      scale?: number;
      waistFraction?: number;
      bulge?: number;
      notch?: number;
    }
  | { kind: "heart"; scale?: number }
  | {
      kind: "teardrop";
      scale?: number;
      direction?: "topLeft" | "topRight" | "bottomRight" | "bottomLeft";
    }
  | { kind: "leaf"; scale?: number; radiusFraction?: number };

export type QrModuleShapeKind = QrModuleShape["kind"];

/** `1 − 1/√2` — the platform's trimmed-octagon corner. */
export const OCTAGON_CORNER = 0.2928932188134525;
/** The platform ships leaves inset so neighbours stay separate — NEVER 1. */
export const LEAF_INSET_SCALE = 0.88;

/** Picker order: the 10 reliable kinds first (mobile `QrModuleShape.kinds`). */
export const MODULE_SHAPE_KINDS: QrModuleShapeKind[] = [
  "square",
  "circle",
  "rounded",
  "smooth",
  "barHorizontal",
  "barVertical",
  "classy",
  "tile",
  "octagon",
  "teardrop",
  "diamond",
  "connectedDiamond",
  "hexagon",
  "triangle",
  "pillHorizontal",
  "pillVertical",
  "star",
  "sparkle",
  "petal",
  "heart",
  "leaf",
];

/** 8/8 on the platform's decoder sweep — the only kinds OFFERED as new picks.
 *  Marginal kinds still parse, render and round-trip from stored designs. */
export const RELIABLE_MODULE_SHAPE_KINDS: QrModuleShapeKind[] =
  MODULE_SHAPE_KINDS.slice(0, 10);

export function moduleShapeToWire(s: QrModuleShape): Record<string, unknown> {
  switch (s.kind) {
    case "square":
    case "circle":
    case "hexagon":
    case "heart":
      return { kind: s.kind, scale: s.scale ?? 1 };
    case "diamond":
      return { kind: "diamond" };
    case "rounded":
      return { kind: "rounded", scale: s.scale ?? 1, radiusFraction: s.radiusFraction ?? 0.3 };
    case "smooth":
    case "classy":
      return { kind: s.kind, radiusFraction: s.radiusFraction ?? 0.5 };
    case "barHorizontal":
    case "barVertical":
      return { kind: s.kind, thicknessFraction: s.thicknessFraction ?? 0.8 };
    case "connectedDiamond":
      return { kind: "connectedDiamond", bridgeFraction: s.bridgeFraction ?? 0.4 };
    case "tile":
      return {
        kind: "tile",
        gapFraction: s.gapFraction ?? 0.12,
        radiusFraction: s.radiusFraction ?? 0,
      };
    case "octagon":
      return {
        kind: "octagon",
        scale: s.scale ?? 1,
        cornerFraction: s.cornerFraction ?? OCTAGON_CORNER,
      };
    case "triangle":
      return { kind: "triangle", scale: s.scale ?? 1, direction: s.direction ?? "up" };
    case "pillHorizontal":
    case "pillVertical":
      return {
        kind: s.kind,
        scale: s.scale ?? 1,
        thicknessFraction: s.thicknessFraction ?? 0.6,
      };
    case "star": {
      // The platform accepts exactly 4, 5 or 6 points — anything else 400s.
      const points = s.points != null && [4, 5, 6].includes(s.points) ? s.points : 5;
      return {
        kind: "star",
        scale: s.scale ?? 1,
        points,
        innerRadiusFraction: s.innerRadiusFraction ?? 0.5,
      };
    }
    case "sparkle":
      return { kind: "sparkle", scale: s.scale ?? 1, waistFraction: s.waistFraction ?? 0.25 };
    case "petal":
      return {
        kind: "petal",
        scale: s.scale ?? 1,
        waistFraction: s.waistFraction ?? 0.45,
        bulge: s.bulge ?? 0.55,
        notch: s.notch ?? 0.25,
      };
    case "teardrop":
      return { kind: "teardrop", scale: s.scale ?? 1, direction: s.direction ?? "topLeft" };
    case "leaf":
      return {
        kind: "leaf",
        scale: s.scale ?? LEAF_INSET_SCALE,
        radiusFraction: s.radiusFraction ?? 0.75,
      };
  }
}

export function moduleShapeFromWire(json: unknown): QrModuleShape {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const kind = MODULE_SHAPE_KINDS.includes(o.kind as QrModuleShapeKind)
    ? (o.kind as QrModuleShapeKind)
    : "square";
  const num = (k: string) => (typeof o[k] === "number" ? (o[k] as number) : undefined);
  const shape = { kind, ...o } as Record<string, unknown>;
  // Rebuild through the typed constructor path so junk keys never survive.
  switch (kind) {
    case "diamond":
      return { kind: "diamond" };
    case "star": {
      const raw = num("points");
      return {
        kind: "star",
        scale: num("scale"),
        points: raw != null && [4, 5, 6].includes(raw) ? (raw as 4 | 5 | 6) : 5,
        innerRadiusFraction: num("innerRadiusFraction"),
      };
    }
    case "triangle":
      return {
        kind: "triangle",
        scale: num("scale"),
        direction: (["up", "down", "left", "right"] as const).includes(
          shape.direction as never,
        )
          ? (shape.direction as "up")
          : "up",
      };
    case "teardrop":
      return {
        kind: "teardrop",
        scale: num("scale"),
        direction: (["topLeft", "topRight", "bottomRight", "bottomLeft"] as const).includes(
          shape.direction as never,
        )
          ? (shape.direction as "topLeft")
          : "topLeft",
      };
    default:
      return {
        kind,
        scale: num("scale"),
        radiusFraction: num("radiusFraction"),
        thicknessFraction: num("thicknessFraction"),
        gapFraction: num("gapFraction"),
        bridgeFraction: num("bridgeFraction"),
        cornerFraction: num("cornerFraction"),
        waistFraction: num("waistFraction"),
        bulge: num("bulge"),
        notch: num("notch"),
        innerRadiusFraction: num("innerRadiusFraction"),
      } as QrModuleShape;
  }
}

export function sameModuleShape(a: QrModuleShape, b: QrModuleShape): boolean {
  return JSON.stringify(moduleShapeToWire(a)) === JSON.stringify(moduleShapeToWire(b));
}

// ─── Eye shapes (7) ─────────────────────────────────────────────────────────

export const QR_EYE_PRESETS = [
  "leaf",
  "inverseLeaf",
  "topRounded",
  "bottomRounded",
  "leftRounded",
  "rightRounded",
] as const;
export type QrEyePreset = (typeof QR_EYE_PRESETS)[number];

export type QrEyeShape =
  | { kind: "square" }
  | { kind: "circle" }
  | { kind: "diamond" }
  | { kind: "rounded"; borderRadiusFraction?: number; centerRadiusFraction?: number }
  | { kind: "squircle"; borderRadiusFraction?: number; centerRadiusFraction?: number }
  | { kind: "octagon"; cornerFraction?: number; ringWidthFraction?: number }
  // preset XOR explicit radii — both at once is a 400. A stored preset wins
  // and round-trips as the name (mobile cef59ec6 makes the combo unrepresentable).
  | {
      kind: "perCorner";
      preset?: QrEyePreset;
      topLeft?: number;
      topRight?: number;
      bottomRight?: number;
      bottomLeft?: number;
    };

export type QrEyeShapeKind = QrEyeShape["kind"];

/** The 6 non-perCorner silhouettes the picker offers. */
export const FLAT_EYE_SHAPE_KINDS: QrEyeShapeKind[] = [
  "square",
  "circle",
  "diamond",
  "rounded",
  "squircle",
  "octagon",
];

export function eyeShapeToWire(s: QrEyeShape): Record<string, unknown> {
  switch (s.kind) {
    case "square":
    case "circle":
    case "diamond":
      return { kind: s.kind };
    case "rounded":
      return {
        kind: "rounded",
        borderRadiusFraction: s.borderRadiusFraction ?? 0.25,
        centerRadiusFraction: s.centerRadiusFraction ?? 0.25,
      };
    case "squircle":
      return {
        kind: "squircle",
        borderRadiusFraction: s.borderRadiusFraction ?? 0.5,
        centerRadiusFraction: s.centerRadiusFraction ?? 0.5,
      };
    case "octagon":
      return {
        kind: "octagon",
        cornerFraction: s.cornerFraction ?? OCTAGON_CORNER,
        ringWidthFraction: s.ringWidthFraction ?? 1 / 7,
      };
    case "perCorner":
      if (s.preset) return { kind: "perCorner", preset: s.preset };
      return {
        kind: "perCorner",
        topLeft: s.topLeft ?? 0,
        topRight: s.topRight ?? 0,
        bottomRight: s.bottomRight ?? 0,
        bottomLeft: s.bottomLeft ?? 0,
      };
  }
}

export function eyeShapeFromWire(json: unknown): QrEyeShape {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const num = (k: string) => (typeof o[k] === "number" ? (o[k] as number) : undefined);
  switch (o.kind) {
    case "circle":
      return { kind: "circle" };
    case "diamond":
      return { kind: "diamond" };
    case "rounded":
      return {
        kind: "rounded",
        borderRadiusFraction: num("borderRadiusFraction"),
        centerRadiusFraction: num("centerRadiusFraction"),
      };
    case "squircle":
      return {
        kind: "squircle",
        borderRadiusFraction: num("borderRadiusFraction"),
        centerRadiusFraction: num("centerRadiusFraction"),
      };
    case "octagon":
      return {
        kind: "octagon",
        cornerFraction: num("cornerFraction"),
        ringWidthFraction: num("ringWidthFraction"),
      };
    case "perCorner": {
      // A stored preset wins outright over any stray radii.
      if (QR_EYE_PRESETS.includes(o.preset as QrEyePreset)) {
        return { kind: "perCorner", preset: o.preset as QrEyePreset };
      }
      return {
        kind: "perCorner",
        topLeft: num("topLeft"),
        topRight: num("topRight"),
        bottomRight: num("bottomRight"),
        bottomLeft: num("bottomLeft"),
      };
    }
    case "square":
    default:
      return { kind: "square" };
  }
}

export function sameEyeShape(a: QrEyeShape, b: QrEyeShape): boolean {
  return JSON.stringify(eyeShapeToWire(a)) === JSON.stringify(eyeShapeToWire(b));
}

// ─── Quiet zone ─────────────────────────────────────────────────────────────

export type QrQuietZone =
  | { kind: "modules"; value: number } // 0–32, default 4; wire value is rounded
  | { kind: "proportion"; value: number }; // 0–0.5, default 0.05

export function quietZoneToWire(q: QrQuietZone): Record<string, unknown> {
  return {
    kind: q.kind,
    value: q.kind === "modules" ? Math.round(q.value) : q.value,
  };
}

function quietZoneFromWire(json: unknown): QrQuietZone | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const value = typeof o.value === "number" ? o.value : null;
  if (o.kind === "proportion") return { kind: "proportion", value: value ?? 0.05 };
  if (o.kind === "modules") return { kind: "modules", value: value ?? 4 };
  return null;
}

export function sameQuietZone(a: QrQuietZone | null, b: QrQuietZone | null): boolean {
  if (a == null || b == null) return a === b;
  return JSON.stringify(quietZoneToWire(a)) === JSON.stringify(quietZoneToWire(b));
}

// ─── Frame ──────────────────────────────────────────────────────────────────

export const QR_FRAME_KINDS = [
  "arrow",
  "badge",
  "bag",
  "banner",
  "callout",
  "can",
  "clipboard",
  "cloud",
  "coupon",
  "easel",
  "envelope",
  "gift",
  "label",
  "map",
  "mug",
  "notebook",
  "ornate",
  "phone",
  "ribbon",
  "scanner",
  "script",
  "split",
  "stamp",
  "tag",
  "ticket",
  "truck",
  "tv",
] as const;
export type QrFrameKind = (typeof QR_FRAME_KINDS)[number];

/** The brush option slots each frame kind declares — anything else is a 400. */
export const FRAME_BRUSH_SLOTS: Record<QrFrameKind, string[]> = {
  arrow: ["cardBrush", "qrBackgroundBrush", "bannerBrush"],
  badge: ["cardBrush", "qrBackgroundBrush", "tagFillBrush"],
  bag: ["cardBrush", "qrBackgroundBrush"],
  banner: ["cardBrush", "qrBackgroundBrush", "bannerBrush"],
  callout: ["cardBrush", "qrBackgroundBrush", "bannerBrush"],
  can: ["cardBrush", "qrBackgroundBrush"],
  clipboard: ["cardBrush", "qrBackgroundBrush"],
  cloud: ["cardBrush", "qrBackgroundBrush"],
  coupon: ["cardBrush"],
  easel: ["cardBrush", "qrBackgroundBrush"],
  envelope: ["cardBrush", "qrBackgroundBrush"],
  gift: ["cardBrush", "qrBackgroundBrush"],
  label: ["cardBrush", "qrBackgroundBrush"],
  map: ["bodyBrush", "qrBackgroundBrush"],
  mug: ["cardBrush", "qrBackgroundBrush"],
  notebook: ["cardBrush", "qrBackgroundBrush"],
  ornate: ["cardBrush", "ornamentBrush", "qrBackgroundBrush"],
  phone: ["bodyBrush", "qrBackgroundBrush"],
  ribbon: ["cardBrush", "qrBackgroundBrush"],
  scanner: ["bodyBrush", "qrBackgroundBrush"],
  script: ["cardBrush", "qrBackgroundBrush"],
  split: ["cardBrush", "qrBackgroundBrush", "bannerBrush"],
  stamp: ["cardBrush", "qrBackgroundBrush"],
  tag: ["qrBackgroundBrush"],
  ticket: ["cardBrush", "qrBackgroundBrush"],
  truck: ["bodyBrush", "qrBackgroundBrush"],
  tv: ["bodyBrush", "qrBackgroundBrush"],
};

export const FRAME_TEXT_MAX_LENGTH = 120; // platform allows 200; app caps 120

/**
 * Frames whose caption sits on a LIGHT card — dark ink is readable there.
 * Everywhere else the caption area is dark and the default must be white,
 * or the text renders black-on-black (agent issue #8; the set mirrors the
 * measurement behind mobile's thumbnail generator, 602fc362).
 */
export const FRAME_LIGHT_CARD_KINDS: ReadonlySet<string> = new Set([
  "coupon",
  "easel",
  "envelope",
  "label",
  "mug",
  "ornate",
  "phone",
  "script",
  "ticket",
]);

/** The readable default caption colour for a frame kind. */
export function frameCaptionDefaultColor(kind: QrFrameKind): QrHexColor {
  return FRAME_LIGHT_CARD_KINDS.has(kind) ? "#111827" : "#ffffff";
}

export type QrTextPosition = "above" | "below" | "insideBottom";

export interface QrFrameText {
  text: string; // default "SCAN ME"
  position: QrTextPosition; // default below
  fontFamily: string | null;
  fontSize: number; // default 14
  fontWeight: number; // default 600
  color: QrHexColor; // default #000000
  textDirection: string | null;
}

export function defaultFrameText(overrides: Partial<QrFrameText> = {}): QrFrameText {
  return {
    text: "SCAN ME",
    position: "below",
    fontFamily: null,
    fontSize: 14,
    fontWeight: 600,
    color: "#000000",
    textDirection: null,
    ...overrides,
  };
}

export interface QrFrameSpec {
  kind: QrFrameKind; // default ticket
  mode: "boundingBox" | "conformToSilhouette"; // only boundingBox is sent by UI
  borderBrush: QrBrush | null; // modeled; the app never sends it
  text: QrFrameText;
  /** Brush slots (per kind) plus optional numeric fraction knobs. */
  options: Record<string, QrBrush | number>;
}

export function defaultFrame(kind: QrFrameKind = "ticket"): QrFrameSpec {
  return {
    kind,
    mode: "boundingBox",
    borderBrush: null,
    text: defaultFrameText({ color: frameCaptionDefaultColor(kind) }),
    options: {},
  };
}

/** Keep only options the given kind declares (brush slots) or numeric knobs. */
function filterFrameOptions(
  kind: QrFrameKind,
  options: Record<string, QrBrush | number>,
): Record<string, QrBrush | number> {
  const slots = FRAME_BRUSH_SLOTS[kind];
  const out: Record<string, QrBrush | number> = {};
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === "number") out[key] = value;
    else if (slots.includes(key)) out[key] = value;
  }
  return out;
}

/** Switch the kind, stripping any option the new kind rejects (mobile
 *  withKind). A caption colour the user never touched (it still equals the
 *  OLD kind's default) follows the new kind's readable default, so switching
 *  from a light card to a dark one can't leave black-on-black text. */
export function frameWithKind(frame: QrFrameSpec, kind: QrFrameKind): QrFrameSpec {
  const untouched = frame.text.color === frameCaptionDefaultColor(frame.kind);
  return {
    ...frame,
    kind,
    text: untouched
      ? { ...frame.text, color: frameCaptionDefaultColor(kind) }
      : frame.text,
    options: filterFrameOptions(kind, frame.options),
  };
}

export function frameToWire(frame: QrFrameSpec): Record<string, unknown> {
  const options: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filterFrameOptions(frame.kind, frame.options))) {
    options[key] = typeof value === "number" ? value : brushToWire(value);
  }
  const t = frame.text;
  return {
    kind: frame.kind,
    ...(frame.borderBrush ? { borderBrush: brushToWire(frame.borderBrush) } : {}),
    mode: frame.mode,
    text: {
      text: t.text,
      position: t.position,
      ...(t.fontFamily ? { fontFamily: t.fontFamily } : {}),
      fontSize: t.fontSize,
      fontWeight: t.fontWeight,
      color: t.color,
      ...(t.textDirection ? { textDirection: t.textDirection } : {}),
    },
    ...(Object.keys(options).length > 0 ? { options } : {}),
  };
}

function frameFromWire(json: unknown): QrFrameSpec | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const kind = QR_FRAME_KINDS.includes(o.kind as QrFrameKind)
    ? (o.kind as QrFrameKind)
    : "ticket";
  const rawText = (o.text && typeof o.text === "object" ? o.text : {}) as Record<
    string,
    unknown
  >;
  const options: Record<string, QrBrush | number> = {};
  if (o.options && typeof o.options === "object") {
    for (const [key, value] of Object.entries(o.options as Record<string, unknown>)) {
      if (typeof value === "number") options[key] = value;
      else {
        const brush = brushFromWire(value);
        if (brush) options[key] = brush;
      }
    }
  }
  return {
    kind,
    mode: o.mode === "conformToSilhouette" ? "conformToSilhouette" : "boundingBox",
    borderBrush: brushFromWire(o.borderBrush),
    text: defaultFrameText({
      text: typeof rawText.text === "string" ? rawText.text : "SCAN ME",
      position: (["above", "below", "insideBottom"] as const).includes(
        rawText.position as QrTextPosition,
      )
        ? (rawText.position as QrTextPosition)
        : "below",
      fontFamily: typeof rawText.fontFamily === "string" ? rawText.fontFamily : null,
      fontSize: typeof rawText.fontSize === "number" ? rawText.fontSize : 14,
      fontWeight: typeof rawText.fontWeight === "number" ? rawText.fontWeight : 600,
      color: normalizeQrHex(rawText.color) ?? "#000000",
      textDirection:
        typeof rawText.textDirection === "string" ? rawText.textDirection : null,
    }),
    options: filterFrameOptions(kind, options),
  };
}

// ─── Overlay (logo) ─────────────────────────────────────────────────────────

export interface QrOverlayPlate {
  color: QrHexColor;
  paddingFraction: number;
  radiusFraction: number;
}

export interface QrOverlay {
  imageUrl: string;
  sizeFraction: number; // 0.05–0.4, default 0.2
  clip: "none" | "square" | "rounded" | "circle";
  clipRadiusFraction: number; // only emitted when clip === "rounded"
  plate: QrOverlayPlate | null;
  eccPolicy: "throwIfBelowH" | "warnIfBelowH" | "silent";
}

export function defaultOverlay(imageUrl: string): QrOverlay {
  return {
    imageUrl,
    sizeFraction: 0.2,
    clip: "none",
    clipRadiusFraction: 0.2,
    plate: null,
    eccPolicy: "warnIfBelowH",
  };
}

export function overlayToWire(o: QrOverlay): Record<string, unknown> {
  return {
    imageUrl: o.imageUrl,
    sizeFraction: o.sizeFraction,
    clip: o.clip,
    ...(o.clip === "rounded" ? { clipRadiusFraction: o.clipRadiusFraction } : {}),
    ...(o.plate
      ? {
          plate: {
            color: o.plate.color,
            paddingFraction: o.plate.paddingFraction,
            radiusFraction: o.plate.radiusFraction,
          },
        }
      : {}),
    eccPolicy: o.eccPolicy,
  };
}

function overlayFromWire(json: unknown): QrOverlay | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  // Legacy alias: `image`. Empty/non-string → no overlay.
  const imageUrl =
    typeof o.imageUrl === "string" && o.imageUrl
      ? o.imageUrl
      : typeof o.image === "string" && o.image
        ? o.image
        : null;
  if (!imageUrl) return null;
  const plate = (o.plate && typeof o.plate === "object" ? o.plate : null) as Record<
    string,
    unknown
  > | null;
  return {
    imageUrl,
    sizeFraction: typeof o.sizeFraction === "number" ? o.sizeFraction : 0.2,
    clip: (["none", "square", "rounded", "circle"] as const).includes(o.clip as never)
      ? (o.clip as QrOverlay["clip"])
      : "none",
    clipRadiusFraction:
      typeof o.clipRadiusFraction === "number" ? o.clipRadiusFraction : 0.2,
    plate: plate
      ? {
          color: normalizeQrHex(plate.color) ?? "#ffffff",
          paddingFraction:
            typeof plate.paddingFraction === "number" ? plate.paddingFraction : 0.06,
          radiusFraction:
            typeof plate.radiusFraction === "number" ? plate.radiusFraction : 0.25,
        }
      : null,
    eccPolicy: (["throwIfBelowH", "warnIfBelowH", "silent"] as const).includes(
      o.eccPolicy as never,
    )
      ? (o.eccPolicy as QrOverlay["eccPolicy"])
      : "warnIfBelowH",
  };
}

// ─── The style root ─────────────────────────────────────────────────────────

export const QR_DEFAULT_SIZE = 512; // platform default is 320; app sends 512

export interface QrStyle {
  /** null = AUTO: high when a logo is present OR the module isn't square. */
  errorCorrection: QrErrorCorrection | null;
  size: number;
  background: QrBrush | null; // null = transparent; default white
  /** null = AUTO: 0 modules with a frame (it brings its own padding), else 4. */
  quietZone: QrQuietZone | null;
  moduleShape: QrModuleShape;
  moduleBrush: QrBrush;
  /** null = follow the modules (square shape, module brush). */
  eyeBorderShape: PerFinder<QrEyeShape> | null;
  eyeBorderBrush: PerFinder<QrBrush> | null;
  eyeCenterShape: PerFinder<QrEyeShape> | null;
  eyeCenterBrush: PerFinder<QrBrush> | null;
  frame: QrFrameSpec | null;
  overlay: QrOverlay | null;
  filename: string | null;
}

export function defaultQrStyle(overrides: Partial<QrStyle> = {}): QrStyle {
  return {
    errorCorrection: null,
    size: QR_DEFAULT_SIZE,
    background: QR_WHITE,
    quietZone: null,
    moduleShape: { kind: "square" },
    moduleBrush: QR_BLACK,
    eyeBorderShape: null,
    eyeBorderBrush: null,
    eyeCenterShape: null,
    eyeCenterBrush: null,
    frame: null,
    overlay: null,
    filename: null,
    ...overrides,
  };
}

/** medium normally; high with a logo OR any non-square module (cef59ec6). */
export function effectiveErrorCorrection(style: QrStyle): QrErrorCorrection {
  if (style.errorCorrection) return style.errorCorrection;
  return style.overlay != null || style.moduleShape.kind !== "square"
    ? "high"
    : "medium";
}

/** A frame supplies its own padding → auto quiet zone drops to 0 (else 4). */
export function effectiveQuietZone(style: QrStyle): QrQuietZone {
  return (
    style.quietZone ?? { kind: "modules", value: style.frame != null ? 0 : 4 }
  );
}

export function effectiveEyeBorderShape(style: QrStyle): PerFinder<QrEyeShape> {
  return style.eyeBorderShape ?? perFinderAll<QrEyeShape>({ kind: "square" });
}

export function effectiveEyeCenterShape(style: QrStyle): PerFinder<QrEyeShape> {
  return style.eyeCenterShape ?? perFinderAll<QrEyeShape>({ kind: "square" });
}

/** All colours behind the code — for the local contrast check. */
export function styleBackgroundColors(style: QrStyle): QrHexColor[] {
  return style.background ? brushColors(style.background) : ["#ffffff"];
}

/** All colours drawn over the background — modules + any explicit eye brushes. */
export function styleForegroundColors(style: QrStyle): QrHexColor[] {
  const out = [...brushColors(style.moduleBrush)];
  for (const p of [style.eyeBorderBrush, style.eyeCenterBrush]) {
    if (p) for (const brush of perFinderValues(p)) out.push(...brushColors(brush));
  }
  return out;
}

/** The `customizes` wire payload. NEVER includes `content` — the server
 *  derives it from `type`+`data`+`qrcode` (and always overwrites for dynamic). */
export function styleToWire(style: QrStyle): Record<string, unknown> {
  const eyeSet =
    style.eyeBorderShape != null ||
    style.eyeBorderBrush != null ||
    style.eyeCenterShape != null ||
    style.eyeCenterBrush != null;
  const eyeHalf = (
    shape: PerFinder<QrEyeShape> | null,
    brush: PerFinder<QrBrush> | null,
  ) => ({
    ...(shape ? { shape: perFinderToWire(shape, eyeShapeToWire) } : {}),
    ...(brush ? { brush: perFinderToWire(brush, brushToWire) } : {}),
  });
  return {
    encoding: { errorCorrection: effectiveErrorCorrection(style) },
    size: style.size,
    style: {
      ...(style.background ? { background: brushToWire(style.background) } : {}),
      quietZone: quietZoneToWire(effectiveQuietZone(style)),
      module: {
        shape: moduleShapeToWire(style.moduleShape),
        brush: brushToWire(style.moduleBrush),
      },
      ...(eyeSet
        ? {
            eye: {
              ...(style.eyeBorderShape || style.eyeBorderBrush
                ? { border: eyeHalf(style.eyeBorderShape, style.eyeBorderBrush) }
                : {}),
              ...(style.eyeCenterShape || style.eyeCenterBrush
                ? { center: eyeHalf(style.eyeCenterShape, style.eyeCenterBrush) }
                : {}),
            },
          }
        : {}),
    },
    ...(style.frame ? { frame: frameToWire(style.frame) } : {}),
    ...(style.overlay ? { overlay: overlayToWire(style.overlay) } : {}),
    output: {
      format: "svg",
      ...(style.filename ? { filename: style.filename } : {}),
    },
  };
}

/**
 * Tolerant parse of a stored `customizes` — v1 payloads, LEGACY flat payloads
 * (detected and mapped), and junk all come back as a usable QrStyle; this
 * function never throws (a malformed blob must not brick the editor).
 */
export function styleFromWire(json: unknown): QrStyle {
  if (!json || typeof json !== "object") return defaultQrStyle();
  const o = json as Record<string, unknown>;
  // Legacy detection — the old flat model (mobile a1a8d302).
  if (typeof o.foregroundColor === "string" && typeof o.style !== "object") {
    return legacyToStyle(o);
  }

  const enc = (o.encoding && typeof o.encoding === "object" ? o.encoding : {}) as Record<
    string,
    unknown
  >;
  const st = (o.style && typeof o.style === "object" ? o.style : {}) as Record<
    string,
    unknown
  >;
  const mod = (st.module && typeof st.module === "object" ? st.module : {}) as Record<
    string,
    unknown
  >;
  const eye = (st.eye && typeof st.eye === "object" ? st.eye : {}) as Record<
    string,
    unknown
  >;
  const border = (eye.border && typeof eye.border === "object" ? eye.border : {}) as Record<
    string,
    unknown
  >;
  const center = (eye.center && typeof eye.center === "object" ? eye.center : {}) as Record<
    string,
    unknown
  >;
  const output = (o.output && typeof o.output === "object" ? o.output : {}) as Record<
    string,
    unknown
  >;

  const overlay = overlayFromWire(o.overlay);
  const frame = frameFromWire(o.frame);
  const moduleShape = moduleShapeFromWire(mod.shape);
  const storedCorrection =
    enc.errorCorrection != null ? errorCorrectionFrom(enc.errorCorrection) : null;
  const storedQuietZone = quietZoneFromWire(st.quietZone);

  // Auto-restore (mobile 025b5b38 + ec3c266c + cef59ec6): a stored value that
  // equals what auto would produce goes back to null, so a later logo/frame/
  // shape change still moves it; only a hand-picked value stays an override.
  const autoCorrection: QrErrorCorrection =
    overlay != null || moduleShape.kind !== "square" ? "high" : "medium";
  const autoQuietZone: QrQuietZone = {
    kind: "modules",
    value: frame != null ? 0 : 4,
  };

  return {
    errorCorrection:
      storedCorrection == null || storedCorrection === autoCorrection
        ? null
        : storedCorrection,
    size: typeof o.size === "number" ? o.size : QR_DEFAULT_SIZE,
    background: st.background !== undefined ? brushFromWire(st.background) : QR_WHITE,
    quietZone:
      storedQuietZone == null || sameQuietZone(storedQuietZone, autoQuietZone)
        ? null
        : storedQuietZone,
    moduleShape,
    moduleBrush: brushFromWire(mod.brush) ?? QR_BLACK,
    eyeBorderShape: perFinderFromWire(border.shape, (v) =>
      v == null ? null : eyeShapeFromWire(v),
    ),
    eyeBorderBrush: perFinderFromWire(border.brush, brushFromWire),
    eyeCenterShape: perFinderFromWire(center.shape, (v) =>
      v == null ? null : eyeShapeFromWire(v),
    ),
    eyeCenterBrush: perFinderFromWire(center.brush, brushFromWire),
    frame,
    overlay,
    filename: typeof output.filename === "string" ? output.filename : null,
  };
}

/** True when a stored `customizes` is the pre-v1 flat shape. */
export function isLegacyCustomizes(json: unknown): boolean {
  return (
    json != null &&
    typeof json === "object" &&
    typeof (json as Record<string, unknown>).foregroundColor === "string" &&
    typeof (json as Record<string, unknown>).style !== "object"
  );
}

/**
 * The legacy → v1 carry-over (mobile `QrStyle._fromLegacy`, a1a8d302):
 * colours, logo, frame-presence + caption survive; the old shape vocabularies
 * (`module`/`finder`/`finderDot`), silhouettes, logo position/rotation and
 * text sizing have no successor and are dropped. Eye colours carry over ONLY
 * when they actually differed from the module colour — otherwise they keep
 * following the modules.
 */
function legacyToStyle(o: Record<string, unknown>): QrStyle {
  const solid = (v: unknown, fallback: QrHexColor): QrBrush => ({
    kind: "solid",
    color: normalizeQrHex(v) ?? fallback,
  });
  const foreground = normalizeQrHex(o.foregroundColor) ?? "#000000";
  const moduleBrush: QrBrush = { kind: "solid", color: foreground };
  const eyeBrush = (v: unknown): PerFinder<QrBrush> | null => {
    const hex = normalizeQrHex(v);
    if (hex == null || hex === foreground) return null;
    return perFinderAll<QrBrush>({ kind: "solid", color: hex });
  };
  const advancedShape = typeof o.advancedShape === "string" ? o.advancedShape : "";
  const hasFrame = advancedShape !== "" && advancedShape !== "none";
  const captionText =
    typeof o.text === "string" && o.text.trim() !== "" ? o.text : "SCAN ME";
  const frameColor = normalizeQrHex(o.frameColor);
  return defaultQrStyle({
    background: solid(o.backgroundColor, "#ffffff"),
    moduleBrush,
    eyeBorderBrush: eyeBrush(o.eyeExternalColor),
    eyeCenterBrush: eyeBrush(o.eyeInternalColor),
    overlay:
      typeof o.logoUrl === "string" && o.logoUrl ? defaultOverlay(o.logoUrl) : null,
    frame: hasFrame
      ? {
          ...defaultFrame("ticket"),
          text: defaultFrameText({
            text: captionText,
            color: normalizeQrHex(o.textColor) ?? "#000000",
            fontFamily:
              typeof o.fontFamily === "string" && o.fontFamily ? o.fontFamily : null,
          }),
          options: frameColor
            ? { cardBrush: { kind: "solid", color: frameColor } }
            : {},
        }
      : null,
  });
}

// ─── Preview verdict ────────────────────────────────────────────────────────

export type QrSeverity = "none" | "warning" | "error";

export interface QrWarning {
  severity: QrSeverity;
  code: string;
  message: string;
}

export interface QrPreviewResult {
  format: string;
  svg: string | null;
  dataUri: string | null;
  bytes: number | null;
  /** ⚠️ trap: false with zero warnings = "unverified", NOT "failed". */
  readable: boolean | null;
  severity: QrSeverity;
  warnings: QrWarning[];
  meta: { version?: number; modules?: number; size?: number; filename?: string };
}

function severityFrom(v: unknown): QrSeverity | null {
  return v === "error" || v === "warning" ? v : v === "none" ? "none" : null;
}

/** Declared severity first, else the worst of the warnings, else none. */
function computeSeverity(declared: unknown, warnings: QrWarning[]): QrSeverity {
  const d = severityFrom(declared);
  if (d) return d;
  if (warnings.some((w) => w.severity === "error")) return "error";
  if (warnings.some((w) => w.severity === "warning")) return "warning";
  return "none";
}

export function parseQrPreview(json: unknown): QrPreviewResult {
  const o = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const warnings: QrWarning[] = Array.isArray(o.warnings)
    ? o.warnings
        .filter((w): w is Record<string, unknown> => w != null && typeof w === "object")
        .map((w) => ({
          severity: severityFrom(w.severity) ?? "warning",
          code: typeof w.code === "string" ? w.code : "",
          message: typeof w.message === "string" ? w.message : "",
        }))
    : [];
  const meta = (o.meta && typeof o.meta === "object" ? o.meta : {}) as Record<
    string,
    unknown
  >;
  return {
    format: typeof o.format === "string" ? o.format : "svg",
    svg: typeof o.svg === "string" ? o.svg : null,
    dataUri: typeof o.dataUri === "string" ? o.dataUri : null,
    bytes: typeof o.bytes === "number" ? o.bytes : null,
    readable: typeof o.readable === "boolean" ? o.readable : null,
    severity: computeSeverity(o.severity, warnings),
    warnings,
    meta: {
      version: typeof meta.version === "number" ? meta.version : undefined,
      modules: typeof meta.modules === "number" ? meta.modules : undefined,
      size: typeof meta.size === "number" ? meta.size : undefined,
      filename: typeof meta.filename === "string" ? meta.filename : undefined,
    },
  };
}

/** Drop the given warning codes and RECOMPUTE severity from what's left. */
export function previewWithoutWarnings(
  preview: QrPreviewResult,
  codes: string[],
): QrPreviewResult {
  const warnings = preview.warnings.filter((w) => !codes.includes(w.code));
  return { ...preview, warnings, severity: computeSeverity(null, warnings) };
}

/**
 * Mobile `QrStyleEditorCubit._accept` (51e96ae0): a frame supplies its own
 * padding, so `smallQuietZone` — that one code only, and only with a frame —
 * is noise. Everything else surfaces untouched.
 */
export function acceptPreview(style: QrStyle, preview: QrPreviewResult): QrPreviewResult {
  return style.frame == null
    ? preview
    : previewWithoutWarnings(preview, ["smallQuietZone"]);
}

// ─── Local advisory contrast check (min ratio 4.0) ──────────────────────────

function relativeLuminance(hex: string): number {
  const rgb = qrHexRgb(hex).slice(1);
  const channel = (i: number) => {
    const c = parseInt(rgb.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Every foreground colour vs every background colour must clear 4.0. */
export function styleContrastOk(style: QrStyle): boolean {
  const bgs = styleBackgroundColors(style);
  const fgs = styleForegroundColors(style);
  return bgs.every((bg) => fgs.every((fg) => contrastRatio(bg, fg) >= 4.0));
}

// ─── Presets (client-side curation, not a wire concept) ─────────────────────

export interface QrPresetDef {
  id: string;
  /** Proper names, NOT i18n keys — they read the same in every locale. */
  label: string;
  build: () => QrStyle;
}

const INK = "#111827";
const WHITE = "#ffffff";

function flat(opts: {
  background: QrHexColor;
  foreground: QrHexColor;
  moduleShape?: QrModuleShape;
  eyeShape?: QrEyeShape;
  eyeColor?: QrHexColor;
}): QrStyle {
  const eyeShape = opts.eyeShape ?? { kind: "square" };
  const eyeBrush: QrBrush = { kind: "solid", color: opts.eyeColor ?? opts.foreground };
  return defaultQrStyle({
    background: { kind: "solid", color: opts.background },
    moduleShape: opts.moduleShape ?? { kind: "square" },
    moduleBrush: { kind: "solid", color: opts.foreground },
    eyeBorderShape: perFinderAll(eyeShape),
    eyeCenterShape: perFinderAll(eyeShape),
    eyeBorderBrush: perFinderAll(eyeBrush),
    eyeCenterBrush: perFinderAll(eyeBrush),
  });
}

const rounded = (f: number): QrEyeShape => ({
  kind: "rounded",
  borderRadiusFraction: f,
  centerRadiusFraction: f,
});

export const QR_PRESETS: QrPresetDef[] = [
  {
    id: "classic",
    label: "Classic",
    build: () => flat({ background: WHITE, foreground: "#000000" }),
  },
  {
    id: "blob",
    label: "Blob",
    build: () =>
      flat({
        background: WHITE,
        foreground: INK,
        moduleShape: { kind: "smooth", radiusFraction: 0.5 },
        eyeShape: rounded(0.45),
      }),
  },
  {
    id: "tricolor",
    label: "Tricolor",
    build: () => {
      const eyes: PerFinder<QrBrush> = {
        perFinder: {
          topLeft: { kind: "solid", color: "#b91c1c" },
          topRight: { kind: "solid", color: "#1d4ed8" },
          bottomLeft: { kind: "solid", color: "#b45309" },
        },
      };
      return defaultQrStyle({
        background: { kind: "solid", color: WHITE },
        moduleShape: { kind: "rounded", radiusFraction: 0.3 },
        moduleBrush: { kind: "solid", color: INK },
        eyeBorderShape: perFinderAll(rounded(0.35)),
        eyeCenterShape: perFinderAll(rounded(0.35)),
        eyeBorderBrush: eyes,
        eyeCenterBrush: eyes,
      });
    },
  },
  {
    id: "candy",
    label: "Candy",
    build: () =>
      defaultQrStyle({
        background: { kind: "solid", color: "#fff1f5" },
        moduleShape: { kind: "circle", scale: 0.88 },
        moduleBrush: {
          kind: "linear",
          colors: ["#be185d", "#7e22ce"],
          begin: "topLeft",
          end: "bottomRight",
        },
        eyeBorderShape: perFinderAll<QrEyeShape>({ kind: "circle" }),
        eyeCenterShape: perFinderAll<QrEyeShape>({ kind: "circle" }),
        eyeBorderBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#7e22ce" }),
        eyeCenterBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#be185d" }),
      }),
  },
  {
    id: "sunset",
    label: "Sunset",
    build: () =>
      defaultQrStyle({
        background: { kind: "solid", color: "#fff8f0" },
        moduleShape: { kind: "smooth", radiusFraction: 0.45 },
        moduleBrush: {
          kind: "linear",
          colors: ["#581c87", "#b3261e", "#c2410c"],
          begin: "topCenter",
          end: "bottomCenter",
        },
        eyeBorderShape: perFinderAll(rounded(0.35)),
        eyeCenterShape: perFinderAll(rounded(0.35)),
        eyeBorderBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#581c87" }),
        eyeCenterBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#c2410c" }),
      }),
  },
  {
    id: "ocean",
    label: "Ocean",
    build: () =>
      defaultQrStyle({
        background: { kind: "solid", color: "#f0f9ff" },
        moduleShape: { kind: "rounded", radiusFraction: 0.35 },
        moduleBrush: {
          kind: "linear",
          colors: ["#0f2a5f", "#0e7490"],
          begin: "topLeft",
          end: "bottomRight",
        },
        eyeBorderShape: perFinderAll(rounded(0.3)),
        eyeCenterShape: perFinderAll<QrEyeShape>({ kind: "circle" }),
        eyeBorderBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#0f2a5f" }),
        eyeCenterBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#0e7490" }),
      }),
  },
  {
    id: "forest",
    label: "Forest",
    build: () =>
      flat({
        background: "#f0fdf4",
        foreground: "#14532d",
        // Octagon, not diamond: diamond MODULES measured 1/8 on a real
        // decoder; a diamond EYE is fine (every eye shape scores 8/8).
        moduleShape: { kind: "octagon" },
        eyeShape: { kind: "diamond" },
      }),
  },
  {
    id: "neon",
    label: "Neon",
    build: () =>
      defaultQrStyle({
        background: { kind: "solid", color: "#0b1020" },
        moduleShape: { kind: "rounded", radiusFraction: 0.4 },
        moduleBrush: { kind: "sweep", colors: ["#22d3ee", "#a78bfa", "#22d3ee"] },
        eyeBorderShape: perFinderAll<QrEyeShape>({ kind: "circle" }),
        eyeCenterShape: perFinderAll<QrEyeShape>({ kind: "circle" }),
        eyeBorderBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#67e8f9" }),
        eyeCenterBrush: perFinderAll<QrBrush>({ kind: "solid", color: "#a78bfa" }),
      }),
  },
  {
    id: "midnight",
    label: "Midnight",
    build: () =>
      flat({
        background: "#0f1720",
        foreground: "#f8fafc",
        moduleShape: { kind: "rounded", radiusFraction: 0.35 },
        eyeShape: rounded(0.3),
      }),
  },
  {
    id: "gold",
    label: "Gold",
    build: () =>
      flat({
        background: "#1f2937",
        foreground: "#fbbf24",
        moduleShape: { kind: "circle", scale: 0.86 },
        eyeShape: { kind: "circle" },
      }),
  },
  {
    id: "ticket",
    label: "Ticket",
    build: () => ({
      ...flat({
        background: WHITE,
        foreground: INK,
        moduleShape: { kind: "rounded", radiusFraction: 0.3 },
        eyeShape: rounded(0.25),
      }),
      frame: {
        ...defaultFrame("ticket"),
        text: defaultFrameText({ color: INK }),
        options: {
          cardBrush: { kind: "solid", color: WHITE },
          qrBackgroundBrush: { kind: "solid", color: WHITE },
        },
      },
    }),
  },
  {
    id: "badge",
    label: "Badge",
    build: () => ({
      ...flat({
        background: WHITE,
        foreground: "#0f2a5f",
        moduleShape: { kind: "rounded", radiusFraction: 0.3 },
        eyeShape: rounded(0.3),
      }),
      frame: {
        ...defaultFrame("badge"),
        text: defaultFrameText({ color: WHITE }),
        options: {
          cardBrush: { kind: "solid", color: "#0f2a5f" },
          qrBackgroundBrush: { kind: "solid", color: WHITE },
          tagFillBrush: { kind: "solid", color: "#0f2a5f" },
        },
      },
    }),
  },
  {
    id: "label",
    label: "Label",
    build: () => ({
      ...flat({
        background: WHITE,
        foreground: "#134e4a",
        moduleShape: { kind: "square" },
        eyeShape: { kind: "square" },
      }),
      frame: {
        ...defaultFrame("label"),
        text: defaultFrameText({ color: WHITE }),
        options: {
          cardBrush: { kind: "solid", color: "#134e4a" },
          qrBackgroundBrush: { kind: "solid", color: WHITE },
        },
      },
    }),
  },
  {
    id: "scanner",
    label: "Scanner",
    build: () => ({
      ...flat({
        background: WHITE,
        foreground: "#000000",
        moduleShape: { kind: "rounded", radiusFraction: 0.3 },
        eyeShape: rounded(0.25),
      }),
      frame: {
        ...defaultFrame("scanner"),
        text: defaultFrameText({ color: WHITE }),
        options: {
          bodyBrush: { kind: "solid", color: INK },
          qrBackgroundBrush: { kind: "solid", color: WHITE },
        },
      },
    }),
  },
];

export function presetById(id: string | null | undefined): QrPresetDef | null {
  if (!id) return null;
  return QR_PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Apply a preset over the current design, preserving what belongs to the USER
 * rather than the look: the logo, the caption text/font they typed (when both
 * designs have a frame), the render size and the filename.
 */
export function applyPreset(preset: QrPresetDef, current: QrStyle): QrStyle {
  const next = preset.build();
  const caption = current.frame?.text ?? null;
  return {
    ...next,
    size: current.size,
    filename: current.filename,
    overlay: current.overlay,
    frame:
      next.frame == null || caption == null
        ? next.frame
        : {
            ...next.frame,
            text: {
              ...next.frame.text,
              text: caption.text,
              fontFamily: caption.fontFamily,
            },
          },
  };
}

function eyeShapeWireOf(p: PerFinder<QrEyeShape>): string {
  return JSON.stringify(perFinderToWire(p, eyeShapeToWire));
}

/** An unset eye brush means "follow the modules" — null and an explicit copy
 *  of the module brush are the same look; per-finder sets compare structurally. */
function sameEyeBrush(
  a: PerFinder<QrBrush> | null,
  aFallback: QrBrush,
  b: PerFinder<QrBrush> | null,
  bFallback: QrBrush,
): boolean {
  const left = a ?? perFinderAll(aFallback);
  const right = b ?? perFinderAll(bFallback);
  return (
    JSON.stringify(perFinderToWire(left, brushToWire)) ===
    JSON.stringify(perFinderToWire(right, brushToWire))
  );
}

/** Whether `style` already looks like the preset — compares only what the
 *  preset decides, so picking a logo or retyping a caption keeps the tile lit. */
export function presetMatches(preset: QrPresetDef, style: QrStyle): boolean {
  const mine = preset.build();
  return (
    sameBrush(mine.background, style.background) &&
    sameModuleShape(mine.moduleShape, style.moduleShape) &&
    sameBrush(mine.moduleBrush, style.moduleBrush) &&
    eyeShapeWireOf(effectiveEyeBorderShape(mine)) ===
      eyeShapeWireOf(effectiveEyeBorderShape(style)) &&
    eyeShapeWireOf(effectiveEyeCenterShape(mine)) ===
      eyeShapeWireOf(effectiveEyeCenterShape(style)) &&
    sameEyeBrush(mine.eyeBorderBrush, mine.moduleBrush, style.eyeBorderBrush, style.moduleBrush) &&
    sameEyeBrush(mine.eyeCenterBrush, mine.moduleBrush, style.eyeCenterBrush, style.moduleBrush) &&
    (mine.frame?.kind ?? null) === (style.frame?.kind ?? null)
  );
}

export function matchingPreset(style: QrStyle): QrPresetDef | null {
  return QR_PRESETS.find((p) => presetMatches(p, style)) ?? null;
}

// ─── Gradient swatches (8) ──────────────────────────────────────────────────

export interface QrGradientPresetDef {
  id: string;
  brush: QrBrush;
}

export const QR_GRADIENTS: QrGradientPresetDef[] = [
  { id: "ocean", brush: { kind: "linear", colors: ["#0f2a5f", "#1565c0"] } },
  { id: "royal", brush: { kind: "linear", colors: ["#3b1f8f", "#6d28d9"] } },
  { id: "ember", brush: { kind: "linear", colors: ["#7a1e3c", "#b3261e"] } },
  { id: "forest", brush: { kind: "linear", colors: ["#0b3d2e", "#166534"] } },
  { id: "slate", brush: { kind: "linear", colors: ["#111827", "#475569"] } },
  { id: "plum", brush: { kind: "radial", colors: ["#86198f", "#4a1d54"], radius: 0.75 } },
  {
    id: "teal",
    brush: {
      kind: "linear",
      colors: ["#0b3d40", "#0f766e"],
      begin: "topCenter",
      end: "bottomCenter",
    },
  },
  { id: "copper", brush: { kind: "radial", colors: ["#9a3412", "#5c2c06"], radius: 0.8 } },
];
