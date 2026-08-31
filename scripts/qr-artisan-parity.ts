/**
 * QR Artisan v1 — live payload parity check (the web twin of mobile's
 * `test/qrcode/qr_style_payload_test.dart`). Posts every preset, every module
 * shape, every eye shape (perCorner presets included), every brush kind,
 * every frame kind with its declared slots, and an overlay to the LIVE v1
 * preview and asserts: HTTP 200, an SVG comes back, and no error severity
 * (presets must be verdict-clean; marginal shapes may warn but never error
 * out of vocabulary).
 *
 * Run:  node --experimental-strip-types scripts/qr-artisan-parity.ts
 * Base: api.speaknet.app (the only host with /v1 deployed as of 2026-08-31).
 */
import {
  acceptPreview,
  QR_FRAME_KINDS,
  FRAME_BRUSH_SLOTS,
  MODULE_SHAPE_KINDS,
  FLAT_EYE_SHAPE_KINDS,
  QR_EYE_PRESETS,
  QR_PRESETS,
  QR_GRADIENTS,
  defaultQrStyle,
  defaultFrame,
  defaultFrameText,
  defaultOverlay,
  moduleShapeFromWire,
  eyeShapeFromWire,
  perFinderAll,
  styleToWire,
  parseQrPreview,
  type QrBrush,
  type QrStyle,
} from "../src/lib/qr/artisan-style.ts";

const BASE = process.env.QR_PARITY_BASE ?? "https://api.speaknet.app";
const URL_ = `${BASE}/v1/qr-code/user/preview`;

let pass = 0;
let warn = 0;
const failures: string[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(body: unknown): Promise<Response> {
  // Two failure modes to ride out: the server throttle (ThrottlerException,
  // discovered live 2026-08-31) and this machine's bursty network (whole
  // categories died with "fetch failed" in two separate runs). Back off and
  // retry both — only a NON-throttle HTTP error returns immediately.
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(URL_, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      const text = await res.clone().text();
      if (!text.includes("ThrottlerException")) return res;
      await sleep(5000 * (attempt + 1));
    } catch (e) {
      lastError = e;
      await sleep(4000 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("network retries exhausted");
}

async function check(label: string, style: QrStyle, allowWarning = true) {
  const body = {
    type: "text",
    data: { text: "https://qshot.com" },
    customizes: styleToWire(style),
  };
  await sleep(700); // stay under the server throttle
  try {
    const res = await post(body);
    if (!res.ok) {
      failures.push(`${label}: HTTP ${res.status} — ${(await res.text()).slice(0, 180)}`);
      return;
    }
    const json = (await res.json()) as { data?: unknown };
    // Same acceptance as the client: a frame supplies its own quiet zone, so
    // smallQuietZone (that code only) is suppressed when a frame is present.
    const preview = acceptPreview(style, parseQrPreview(json.data));
    if (!preview.svg && !preview.dataUri) {
      failures.push(`${label}: 200 but no image in the response`);
      return;
    }
    if (preview.severity === "error") {
      failures.push(
        `${label}: severity=error — ${preview.warnings.map((w) => w.code).join(",")}`,
      );
      return;
    }
    if (preview.severity === "warning") {
      if (!allowWarning) {
        failures.push(
          `${label}: unexpected warning — ${preview.warnings.map((w) => w.code).join(",")}`,
        );
        return;
      }
      warn++;
      console.log(
        `  ~ ${label}: warning (${preview.warnings.map((w) => w.code).join(",")})`,
      );
    }
    pass++;
  } catch (e) {
    failures.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const ink: QrBrush = { kind: "solid", color: "#111827" };

async function main() {
  console.log(`target: ${URL_}`);

  // 1. Presets — the curated catalog must be verdict-clean (no warnings).
  for (const preset of QR_PRESETS) {
    await check(`preset:${preset.id}`, preset.build(), false);
  }

  // 2. Every module shape at its own defaults (high ECC is auto for non-square).
  for (const kind of MODULE_SHAPE_KINDS) {
    await check(
      `module:${kind}`,
      defaultQrStyle({ moduleShape: moduleShapeFromWire({ kind }) }),
    );
  }

  // 3. Every flat eye shape + every perCorner preset.
  for (const kind of FLAT_EYE_SHAPE_KINDS) {
    const eye = eyeShapeFromWire({ kind });
    await check(
      `eye:${kind}`,
      defaultQrStyle({
        eyeBorderShape: perFinderAll(eye),
        eyeCenterShape: perFinderAll(eye),
      }),
    );
  }
  for (const preset of QR_EYE_PRESETS) {
    const eye = eyeShapeFromWire({ kind: "perCorner", preset });
    await check(
      `eye:perCorner:${preset}`,
      defaultQrStyle({
        eyeBorderShape: perFinderAll(eye),
        eyeCenterShape: perFinderAll(eye),
      }),
    );
  }

  // 4. Every brush kind (gradient swatches cover linear + radial; add sweep).
  for (const gradient of QR_GRADIENTS) {
    await check(`brush:${gradient.id}`, defaultQrStyle({ moduleBrush: gradient.brush }));
  }
  await check(
    "brush:sweep",
    defaultQrStyle({
      moduleBrush: { kind: "sweep", colors: ["#0f2a5f", "#6d28d9", "#0f2a5f"] },
    }),
  );

  // 5. Every frame kind, with every one of ITS declared brush slots filled.
  for (const kind of QR_FRAME_KINDS) {
    const options: Record<string, QrBrush> = {};
    for (const slot of FRAME_BRUSH_SLOTS[kind]) {
      options[slot] =
        slot === "qrBackgroundBrush" ? { kind: "solid", color: "#ffffff" } : ink;
    }
    await check(
      `frame:${kind}`,
      defaultQrStyle({
        frame: {
          ...defaultFrame(kind),
          text: defaultFrameText({ color: "#111827" }),
          options,
        },
      }),
    );
  }

  // 6. Overlay — plate + circle clip; ECC auto-resolves to high.
  await check(
    "overlay:logo",
    defaultQrStyle({
      overlay: {
        ...defaultOverlay("https://cdn.qshot.com/png-logos/instagram.png"),
        clip: "circle",
        plate: { color: "#ffffff", paddingFraction: 0.06, radiusFraction: 0.25 },
      },
    }),
  );

  const total = pass + failures.length;
  console.log(`\n${pass}/${total} passed (${warn} with warnings)`);
  if (failures.length > 0) {
    console.log("FAILURES:");
    for (const f of failures) console.log("  ✗ " + f);
    process.exit(1);
  }
  console.log("ALL GREEN");
}

void main();
