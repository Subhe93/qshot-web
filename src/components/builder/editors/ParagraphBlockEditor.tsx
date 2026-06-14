"use client";

import { useTranslations } from "next-intl";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import type { ParagraphBlock } from "@/lib/types/blocks";
import { GroupedCard, ColorRow } from "./sheet-kit";

/**
 * Paragraph block editor, mirroring the mobile ParagraphEditorSheet: a text
 * editing area plus a background-color option.
 *
 * `block.content` is a JSON-encoded Quill Delta string. The mobile sheet uses a
 * full rich Quill editor; the web builder doesn't ship a rich editor here, so we
 * surface the plain text (read from the Delta `insert` ops) in a textarea and
 * write it back as a minimal valid Delta string. This mirrors the existing
 * delta<->text helpers in SettingsPanel.tsx so the JSON contract is identical.
 */
export function ParagraphBlockEditor({ block }: { block: ParagraphBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<ParagraphBlock>) => updateBlock(block.id, patch);

  return (
    <div className="space-y-4">
      <textarea
        value={deltaToText(block.content)}
        onChange={(e) => setBlock({ content: textToDelta(e.target.value) })}
        rows={5}
        placeholder={t("fields.text")}
        className="min-h-[120px] w-full resize-y rounded-2xl bg-surface p-4 text-sm leading-relaxed text-foreground outline-none ring-1 ring-foreground/[0.08] transition-shadow placeholder:text-foreground/40 focus:ring-2 focus:ring-primary"
      />

      <GroupedCard>
        <ColorRow
          label={t("fields.background")}
          color={block.background_color ?? hexToArgbA("#ffffff")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
      </GroupedCard>
    </div>
  );
}

// ---- Quill Delta <-> plain text helpers (mirrors SettingsPanel.tsx) ----

/** Read display text from a JSON-encoded Quill Delta string (fallback: raw). */
function deltaToText(content: string): string {
  try {
    const ops = JSON.parse(content);
    if (Array.isArray(ops)) {
      return ops
        .map((op) => (typeof op?.insert === "string" ? op.insert : ""))
        .join("")
        .replace(/\n$/, "");
    }
  } catch {
    // not valid Delta JSON — treat as plain text
  }
  return content;
}

/** Encode plain text back into a minimal Quill Delta JSON string. */
function textToDelta(text: string): string {
  return JSON.stringify([{ insert: text + "\n" }]);
}
