"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import type { ParagraphBlock } from "@/lib/types/blocks";
import { GroupedCard, ColorRow } from "./sheet-kit";

// Quill touches `document`, so load the editor client-side only.
const QuillEditor = dynamic(
  () => import("./QuillEditor").then((m) => m.QuillEditor),
  {
    ssr: false,
    loading: () => (
      <div className="h-44 w-full animate-pulse rounded-2xl bg-surface" />
    ),
  },
);

/**
 * Paragraph block editor, mirroring the mobile ParagraphEditorSheet: a rich
 * Quill editor (lists, bold/italic/underline/strike, alignment, LTR/RTL
 * direction, links) plus a background-color option. `block.content` is the
 * Quill Delta JSON string shared with the renderer and the mobile app.
 */
export function ParagraphBlockEditor({ block }: { block: ParagraphBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<ParagraphBlock>) => updateBlock(block.id, patch);

  return (
    <div className="space-y-4">
      <QuillEditor
        key={block.id}
        value={block.content ?? ""}
        onChange={(content) => setBlock({ content })}
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
