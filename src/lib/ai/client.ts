/**
 * Thin browser client for the AI website generator. Just POSTs to the internal
 * Next route (src/app/api/ai/generate-website) — the Gemini call + key live
 * server-side.
 */

import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";

export interface GenerateWebsiteInput {
  description: string;
  language?: string;
  /** User-provided business name (authoritative — overrides AI inference). */
  businessName?: string;
  /** User-chosen brand colors as #rrggbb hex (override AI inference). */
  brandPrimary?: string;
  brandSecondary?: string;
  contact?: Record<string, string | undefined>;
  /** base64 (no data: prefix) + mime for the uploaded logo/cover. */
  logoB64?: string;
  logoMime?: string;
  coverB64?: string;
  coverMime?: string;
  /** CDN file_names from q-profile/image/create (injected into settings). */
  logoFileName?: string | null;
  coverFileName?: string | null;
}

export interface GenerateWebsiteResult {
  businessName: string;
  style?: string;
  settings: WebsiteSettings;
  modules: Block[];
}

/** Friendly error with a machine-readable `code` for the wizard's messaging. */
export class AiGenerateError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export async function generateWebsite(
  input: GenerateWebsiteInput,
): Promise<GenerateWebsiteResult> {
  let res: Response;
  try {
    res = await fetch("/api/ai/generate-website", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new AiGenerateError("network");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AiGenerateError(data.error || `http_${res.status}`);
  }
  return (await res.json()) as GenerateWebsiteResult;
}

/** Read a File into base64 (without the data: URL prefix) + its mime type. */
export function fileToBase64(
  file: File,
): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve({
        data: comma >= 0 ? result.slice(comma + 1) : result,
        mime: file.type || "image/png",
      });
    };
    reader.readAsDataURL(file);
  });
}
