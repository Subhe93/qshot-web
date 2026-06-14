/**
 * Internal Next.js API route for the "Try with AI" website generator.
 * Runs server-side on the same Next server (VPS) so the Gemini key never reaches
 * the browser. Calls Gemini via REST (no SDK), validates with Zod, and returns
 * the strict wire payload { settings, modules } for the builder.
 */

import { NextResponse } from "next/server";
import { aiWebsiteSchema } from "@/lib/ai/schema";
import { transformWebsite } from "@/lib/ai/transform";
import { buildPrompt, type PromptInput } from "@/lib/ai/prompt";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash-lite";
const endpoint = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

async function callGemini(key: string, parts: Part[]): Promise<string> {
  const res = await fetch(endpoint(key), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`gemini_${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const parts2 = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts2)
    ? parts2.map((p: { text?: string }) => p?.text ?? "").join("")
    : "";
  return text;
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
    return null;
  }
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "ai_unconfigured" }, { status: 503 });
  }

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

  const imageParts: Part[] = [];
  if (typeof body.logoB64 === "string" && body.logoB64) {
    imageParts.push({
      inline_data: {
        mime_type: typeof body.logoMime === "string" ? body.logoMime : "image/png",
        data: body.logoB64,
      },
    });
  }
  if (typeof body.coverB64 === "string" && body.coverB64) {
    imageParts.push({
      inline_data: {
        mime_type: typeof body.coverMime === "string" ? body.coverMime : "image/jpeg",
        data: body.coverB64,
      },
    });
  }

  const assets = {
    logoFileName: typeof body.logoFileName === "string" ? body.logoFileName : null,
    coverFileName: typeof body.coverFileName === "string" ? body.coverFileName : null,
  };

  try {
    // First attempt.
    let text = await callGemini(key, [{ text: prompt }, ...imageParts]);
    let parsed = aiWebsiteSchema.safeParse(tryParse(text));

    // One repair attempt on invalid/non-conforming output.
    if (!parsed.success) {
      const repairPrompt = `${prompt}\n\nIMPORTANT: your previous answer was invalid or did not match the schema. Return ONLY a valid JSON object that matches the schema exactly.`;
      text = await callGemini(key, [{ text: repairPrompt }, ...imageParts]);
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
    const status = msg.startsWith("gemini_429") ? 429 : 502;
    return NextResponse.json({ error: "ai_failed", detail: msg.slice(0, 200) }, { status });
  }
}
