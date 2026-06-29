"use client";

import { useRef, useState } from "react";
import {
  Film,
  Image as ImageIcon,
  Upload,
  Loader2,
  Trash2,
  Play,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/stores/editor-store";
import { dirOf } from "@/lib/builder/text-direction";
import { uploadVideo, uploadImage } from "@/lib/api/media";
import { cdnUrl } from "@/lib/api/qrcodes";
import type { IntroductionVideoBlock } from "@/lib/types/blocks";
import { GroupedCard, GroupedRow, SectionLabel } from "./sheet-kit";
import { ImageUploader } from "../hero/CoverTab";

/**
 * Editor for an IntroductionVideoModule, mirroring the mobile VideoUploadCubit:
 * the user uploads a video file (a poster thumbnail is auto-captured from a
 * frame and uploaded too). A direct/YouTube URL field is kept as an alternative,
 * plus a manual thumbnail override.
 */
export function IntroductionVideoBlockEditor({
  block,
}: {
  block: IntroductionVideoBlock;
}) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const setBlock = (patch: Partial<IntroductionVideoBlock>) =>
    updateBlock(block.id, patch);

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // A direct uploaded file is a CDN key (no scheme); a pasted link is absolute.
  const isUploadedFile = !!block.url && !/^https?:\/\//i.test(block.url.trim());
  const videoSrc = block.url ? cdnUrl(block.url) : "";

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      // Auto-capture a poster from a frame (mobile getByteThumbnail), best-effort:
      // a failure just leaves the thumbnail unset.
      const thumbFile = await captureThumbnail(file).catch(() => null);
      const [videoPath, thumbPath] = await Promise.all([
        uploadVideo(file),
        thumbFile ? uploadImage(thumbFile) : Promise.resolve(undefined),
      ]);
      if (!videoPath) {
        setError(true);
        return;
      }
      setBlock({
        url: videoPath,
        ...(thumbPath ? { thumbnail_url: thumbPath } : {}),
      });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload video (primary, mirrors the app) */}
      <div className="space-y-2">
        <SectionLabel>{t("introVideo.uploadVideo")}</SectionLabel>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onPick}
        />
        {isUploadedFile ? (
          <div className="overflow-hidden rounded-xl border border-input bg-card">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={videoSrc}
              poster={block.thumbnail_url ? cdnUrl(block.thumbnail_url) : undefined}
              controls
              preload="metadata"
              className="aspect-video w-full bg-black"
            />
            <div className="flex items-center gap-2 p-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-border disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                {busy ? t("introVideo.uploading") : t("introVideo.replaceVideo")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setBlock({ url: "" })}
                aria-label={t("introVideo.removeVideo")}
                className="flex size-9 items-center justify-center rounded-lg text-error hover:bg-error/10 disabled:opacity-60"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-card px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="size-6 animate-spin" />
                {t("introVideo.uploading")}
              </>
            ) : (
              <>
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Play className="size-5" />
                </span>
                <span className="font-semibold text-foreground">
                  {t("introVideo.uploadVideo")}
                </span>
              </>
            )}
          </button>
        )}
        {error && <p className="text-xs text-error">{t("introVideo.uploadFailed")}</p>}
      </div>

      {/* Or paste a direct/YouTube link */}
      <div className="space-y-2">
        <SectionLabel>{t("introVideo.orPasteUrl")}</SectionLabel>
        <GroupedCard>
          <GroupedRow Icon={Film} title={t("introVideo.videoUrl")} />
          <div className="px-3 pb-3">
            <input
              type="url"
              inputMode="url"
              dir={dirOf(block.url ?? "")}
              value={block.url ?? ""}
              onChange={(e) => setBlock({ url: e.target.value })}
              placeholder={t("introVideo.videoHint")}
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </GroupedCard>
      </div>

      {/* Thumbnail (auto-filled on upload; editable here) */}
      <div className="space-y-2">
        <SectionLabel>{t("introVideo.thumbnail")}</SectionLabel>
        <GroupedCard>
          <GroupedRow Icon={ImageIcon} color="#7c3aed" title={t("introVideo.thumbnailImage")} />
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

/** Capture a JPEG poster from a frame of the video file (client-side, mirrors
 * the mobile auto-thumbnail). Resolves null on any failure. */
function captureThumbnail(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "metadata";
    video.src = url;
    const done = (result: File | null) => {
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.onloadeddata = () => {
      try {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      } catch {
        done(null);
      }
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) return done(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) =>
            done(blob ? new File([blob], "thumbnail.jpg", { type: "image/jpeg" }) : null),
          "image/jpeg",
          0.8,
        );
      } catch {
        done(null);
      }
    };
    video.onerror = () => done(null);
  });
}
