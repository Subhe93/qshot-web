"use client";

import { Film, Image as ImageIcon } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { dirOf } from "@/lib/builder/text-direction";
import type { IntroductionVideoBlock } from "@/lib/types/blocks";
import { GroupedCard, GroupedRow, SectionLabel } from "./sheet-kit";
import { ImageUploader } from "../hero/CoverTab";

/**
 * Editor for an IntroductionVideoModule, mirroring the mobile VideoUploadSheet /
 * GeneralSettingsSheet: a video URL field and a thumbnail upload. The mobile
 * thumbnail preview uses a 16:9 aspect ratio, matched here via the uploader.
 */
export function IntroductionVideoBlockEditor({
  block,
}: {
  block: IntroductionVideoBlock;
}) {
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<IntroductionVideoBlock>) =>
    updateBlock(block.id, patch);

  return (
    <div className="space-y-5">
      {/* Video URL */}
      <div className="space-y-2">
        <SectionLabel>Video</SectionLabel>
        <GroupedCard>
          <GroupedRow Icon={Film} title="Video URL" />
          <div className="px-3 pb-3">
            <input
              type="url"
              inputMode="url"
              dir={dirOf(block.url ?? "")}
              value={block.url ?? ""}
              onChange={(e) => setBlock({ url: e.target.value })}
              placeholder="https://example.com/video.mp4"
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </GroupedCard>
      </div>

      {/* Thumbnail */}
      <div className="space-y-2">
        <SectionLabel>Thumbnail</SectionLabel>
        <GroupedCard>
          <GroupedRow Icon={ImageIcon} color="#7c3aed" title="Thumbnail image" />
          <div className="px-3 pb-3">
            <ImageUploader
              path={block.thumbnail_url}
              onUploaded={(p) => setBlock({ thumbnail_url: p })}
              onDelete={() => setBlock({ thumbnail_url: "" })}
              aspect={16 / 9}
              rounded="rounded-xl"
            />
          </div>
        </GroupedCard>
      </div>
    </div>
  );
}
