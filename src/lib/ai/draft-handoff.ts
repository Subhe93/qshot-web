/**
 * In-memory hand-off for an AI-generated website draft.
 *
 * The AI wizard creates the profile (to get a real id), stashes the generated
 * { settings, blocks } here, then navigates to /builder/{id}. The builder reads
 * (and clears) the draft on mount and loads it directly into the editor — so the
 * generated content shows instantly without waiting on a backend round-trip
 * (which races the just-created profile). The builder's normal auto-save then
 * persists it via the proven edit path.
 */

import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";

export interface AiDraft {
  name: string;
  settings: WebsiteSettings;
  blocks: Block[];
}

const drafts = new Map<string, AiDraft>();

export function setAiDraft(id: string, draft: AiDraft): void {
  drafts.set(id, draft);
}

/** Return and remove the draft for `id` (one-shot). */
export function takeAiDraft(id: string): AiDraft | null {
  const d = drafts.get(id) ?? null;
  if (d) drafts.delete(id);
  return d;
}
