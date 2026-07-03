/**
 * Internal Next.js API route for the "Try with AI" website generator.
 * Runs server-side on the same Next server (VPS) so the OpenAI key never reaches
 * the browser. Calls the OpenAI Chat Completions API via REST (no SDK), with
 * vision (logo/cover images) + JSON output, validates with Zod, and returns the
 * strict wire payload { settings, modules } for the builder.
 */

import { NextResponse } from "next/server";
import { aiWebsiteSchema, type AiImageSpec, type AiWebsite } from "@/lib/ai/schema";
import { transformWebsite } from "@/lib/ai/transform";
import { resolveImageSpecs } from "@/lib/ai/images";
import { buildPrompt, type PromptInput } from "@/lib/ai/prompt";

export const runtime = "nodejs";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.qshot.com";

/**
 * Geocode an address → a Google place object for LocationModule.value, using
 * the END USER's bearer token (the backend google-map endpoints require auth,
 * and the shared `api` client's token store doesn't exist server-side). Returns
 * undefined on any failure (best-effort).
 */
async function geocodeAddress(
  address: string,
  auth?: string,
): Promise<Record<string, unknown> | undefined> {
  if (!auth) return undefined;
  const headers = { Authorization: auth, Accept: "application/json" };
  try {
    const acRes = await fetch(
      `${API_BASE}/q-profile/google-map/autocomplete?input=${encodeURIComponent(address)}`,
      { headers },
    );
    if (!acRes.ok) return undefined;
    const ac = (await acRes.json()) as {
      data?: { result?: { predictions?: { place_id?: string }[] } | { place_id?: string }[] };
    };
    const r = ac?.data?.result;
    const preds = Array.isArray(r) ? r : (r?.predictions ?? []);
    const placeId = preds.find((p) => p?.place_id)?.place_id;
    if (!placeId) return undefined;

    const fields =
      "formatted_address,geometry,place_id,name,vicinity,rating,url,user_ratings_total";
    const dRes = await fetch(
      `${API_BASE}/q-profile/google-map/details?place_id=${encodeURIComponent(placeId)}&fields=${fields}`,
      { headers },
    );
    if (!dRes.ok) return undefined;
    const d = (await dRes.json()) as {
      data?: { result?: { result?: Record<string, unknown> } | Record<string, unknown> };
    };
    const dr = d?.data?.result as Record<string, unknown> | undefined;
    const place = (dr && "result" in dr ? dr.result : dr) as
      | Record<string, unknown>
      | undefined;
    const geometry = place?.geometry as { location?: unknown } | undefined;
    if (!place?.place_id || !geometry?.location) return undefined;
    return place;
  } catch {
    return undefined;
  }
}

// Strong vision model — it reliably follows the rich schema (image-backed cards,
// gallery, location). gpt-4o-mini under-uses those. Override with OPENAI_MODEL.
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const ENDPOINT = "https://api.openai.com/v1/chat/completions";

// Hard cap on generated images per site (orchestrated here; transform stays pure).
// Kept low so total generation time stays reasonable (each image is the slow part).
const MAX_IMAGES = 4;

type ImageSpecHost = { image?: AiImageSpec };
type LocationLike = { kind?: unknown; address?: unknown; place?: unknown };

/**
 * Walk the validated AI website and collect every ImageSpec the model asked for
 * (hero.cover, gallery.images[], products.items[].image, external_links
 * .items[].image), in a stable order. Returns the live spec objects so the
 * caller can set `fileName` in place. Blocks are `unknown[]` (lenient), so we
 * probe shapes defensively — a malformed block contributes nothing.
 */
function collectImageSpecs(ai: AiWebsite): AiImageSpec[] {
  const specs: AiImageSpec[] = [];

  // Hero cover — only meaningful when the user uploaded none (the route decides
  // whether to keep it; collecting it here is harmless/best-effort).
  if (ai.hero?.cover) specs.push(ai.hero.cover);

  for (const raw of ai.blocks) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as { kind?: unknown; images?: unknown; items?: unknown };
    switch (b.kind) {
      case "gallery":
        if (Array.isArray(b.images)) {
          for (const img of b.images) if (img && typeof img === "object") specs.push(img as AiImageSpec);
        }
        break;
      case "products":
      case "external_links":
        if (Array.isArray(b.items)) {
          for (const it of b.items) {
            const host = it as ImageSpecHost | null;
            if (host?.image && typeof host.image === "object") specs.push(host.image);
          }
        }
        break;
    }
  }
  return specs;
}

/**
 * Resolve `place` for every location block by geocoding its `address` (token-
 * aware). Best-effort: a failed lookup leaves `place` undefined and the
 * transform skips that block. Mutates the live block objects in place.
 */
async function resolveLocationBlocks(ai: AiWebsite, auth?: string): Promise<void> {
  if (!auth) return;
  const blocks = ai.blocks.filter((raw): raw is LocationLike => {
    if (!raw || typeof raw !== "object") return false;
    const b = raw as LocationLike;
    return b.kind === "location" && typeof b.address === "string" && !!b.address.trim();
  });

  await Promise.all(
    blocks.map(async (b) => {
      b.place = await geocodeAddress(b.address as string, auth);
    }),
  );
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function callOpenAI(key: string, content: ContentPart[]): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
      // JSON mode — the prompt already instructs "Return ONLY a JSON object".
      response_format: { type: "json_object" },
      temperature: 0.8,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`openai_${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Strip optional ```json fences and parse; returns null on failure. */
function tryParse(text: string): unknown {
  if (!text) return null;
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  try {
    return JSON.parse(t);
  } catch {
    /* fall through — try to extract an embedded object */
  }
  // Claude (no JSON mode) can wrap the object in prose; grab the outermost {...}.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(t.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "ai_unconfigured" }, { status: 503 });
  }

  // The user's bearer token (forwarded by the wizard) authenticates the server-
  // side CDN uploads + geocoding — the shared api client's token is browser-only.
  const auth = req.headers.get("authorization") ?? undefined;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description : "";
  if (description.trim().length < 3) {
    return NextResponse.json({ error: "description_required" }, { status: 400 });
  }

  const businessName =
    typeof body.businessName === "string" && body.businessName.trim()
      ? body.businessName.trim()
      : undefined;
  const brandPrimary =
    typeof body.brandPrimary === "string" ? body.brandPrimary : undefined;
  const brandSecondary =
    typeof body.brandSecondary === "string" ? body.brandSecondary : undefined;

  const promptInput: PromptInput = {
    description,
    language: typeof body.language === "string" ? body.language : "en",
    businessName,
    brandPrimary,
    brandSecondary,
    contact: (body.contact as PromptInput["contact"]) ?? undefined,
  };
  const prompt = buildPrompt(promptInput);

  const imageParts: ContentPart[] = [];
  if (typeof body.logoB64 === "string" && body.logoB64) {
    const mime = typeof body.logoMime === "string" ? body.logoMime : "image/png";
    imageParts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${body.logoB64}` },
    });
  }
  if (typeof body.coverB64 === "string" && body.coverB64) {
    const mime = typeof body.coverMime === "string" ? body.coverMime : "image/jpeg";
    imageParts.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${body.coverB64}` },
    });
  }

  const assets = {
    logoFileName: typeof body.logoFileName === "string" ? body.logoFileName : null,
    coverFileName: typeof body.coverFileName === "string" ? body.coverFileName : null,
  };

  try {
    // First attempt.
    let text = await callOpenAI(key, [{ type: "text", text: prompt }, ...imageParts]);
    let parsed = aiWebsiteSchema.safeParse(tryParse(text));

    // One repair attempt on invalid/non-conforming output.
    if (!parsed.success) {
      const repairPrompt = `${prompt}\n\nIMPORTANT: your previous answer was invalid or did not match the schema. Return ONLY a valid JSON object that matches the schema exactly.`;
      text = await callOpenAI(key, [{ type: "text", text: repairPrompt }, ...imageParts]);
      parsed = aiWebsiteSchema.safeParse(tryParse(text));
    }

    if (!parsed.success) {
      return NextResponse.json({ error: "ai_invalid_output" }, { status: 422 });
    }

    // User-provided values are authoritative — override the model's guesses.
    if (businessName) parsed.data.businessName = businessName;
    if (brandPrimary || brandSecondary) {
      parsed.data.brand = {
        ...parsed.data.brand,
        ...(brandPrimary ? { primary: brandPrimary } : {}),
        ...(brandSecondary ? { secondary: brandSecondary } : {}),
      };
    }

    // Cover policy:
    //  - uploaded cover wins → drop the model's hero.cover (don't generate one).
    //  - no uploaded cover → GUARANTEE a generated cover: if the model omitted
    //    hero.cover (it often does, assuming the visual is "implied"), synthesize
    //    a brand cover prompt so every site gets a real hero image instead of the
    //    template placeholder.
    if (assets.coverFileName) {
      if (parsed.data.hero?.cover) parsed.data.hero.cover = undefined;
    } else {
      parsed.data.hero = parsed.data.hero ?? {};
      if (!parsed.data.hero.cover) {
        // Keep the cover prompt SHORT + focused — a long, unfocused prompt (the
        // whole description) makes gpt-image-1 fail, leaving no cover.
        const essence = description.trim().replace(/\s+/g, " ").slice(0, 140);
        parsed.data.hero.cover = {
          prompt: `Cinematic hero cover photograph for "${parsed.data.businessName}": ${essence}. Wide editorial banner, premium, atmospheric, on-brand.`,
          alt: parsed.data.businessName,
        };
      }
    }

    // Server orchestration (best-effort): generate+upload images and geocode
    // location blocks, mutating the validated object in place BEFORE transform.
    // Failures are graceful — they never block the whole request.
    const specs = collectImageSpecs(parsed.data);
    await Promise.all([
      resolveImageSpecs(specs, MAX_IMAGES, auth),
      resolveLocationBlocks(parsed.data, auth),
    ]);

    const { settings, blocks } = transformWebsite(parsed.data, assets);
    if (blocks.length === 0) {
      return NextResponse.json({ error: "ai_empty_output" }, { status: 422 });
    }

    return NextResponse.json({
      businessName: parsed.data.businessName,
      style: settings.style,
      settings,
      modules: blocks,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith("openai_429") ? 429 : 502;
    return NextResponse.json({ error: "ai_failed", detail: msg.slice(0, 200) }, { status });
  }
}
