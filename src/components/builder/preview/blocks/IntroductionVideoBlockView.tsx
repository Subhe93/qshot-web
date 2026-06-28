"use client";

import { useState } from "react";
import type { IntroductionVideoBlock } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";

/**
 * Read-only preview of an IntroductionVideoModule. The mobile `UploadVideoWidget`
 * is upload-only and plays a DIRECT video file via Chewie
 * (`VideoPlayerController.networkUrl`). The web editor exposes a free URL field,
 * so we support both: a direct video file (HTML5 `<video>`, matching the app)
 * and a YouTube link (iframe embed — the mobile block has no YouTube support,
 * but the web URL field invites it, so we make it work). The card shows the
 * thumbnail + play button; clicking it plays inline.
 */

// Matches the mobile VideoUtils YouTube regex.
const YT_REGEX =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/|watch\?list=|c\/[^/]+\/v\/|user\/[^/]+\/v\/)?([A-Za-z0-9_-]{11})(?:.+)?$/;

function youtubeId(url?: string): string | null {
  if (!url) return null;
  return YT_REGEX.exec(url)?.[1] ?? null;
}

export function IntroductionVideoBlockView({
  block,
}: {
  block: IntroductionVideoBlock;
}) {
  const [playing, setPlaying] = useState(false);
  const url = block.url?.trim() || "";
  const ytId = youtubeId(url);
  // Direct file vs YouTube. cdnUrl passes absolute URLs through.
  const videoSrc = url && !ytId ? cdnUrl(url) : "";
  const ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/0.jpg` : null;
  // Uploaded thumbnail wins; otherwise fall back to the YouTube thumbnail.
  const thumb = block.thumbnail_url ? cdnUrl(block.thumbnail_url) : ytThumb;
  const canPlay = !!ytId || !!videoSrc;

  return (
    <div className="my-[5px]">
      <div
        className="relative mx-5 flex aspect-video items-center justify-center overflow-hidden rounded-lg"
        style={{
          // Border.all(color: Colors.black38) drawn outside + white 0.2 fill
          border: "1px solid rgba(0,0,0,0.38)",
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      >
        {playing && ytId ? (
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
            title=""
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : playing && videoSrc ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            src={videoSrc}
            controls
            autoPlay
            className="absolute inset-0 size-full bg-black object-contain"
          />
        ) : (
          <>
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              // Mobile shows the Qshot logo when there's no/failed thumbnail.
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/brand/logo.svg" alt="" className="absolute size-12 opacity-50" />
            )}

            {/* Centered 60x60 translucent-white circular play button */}
            <button
              type="button"
              disabled={!canPlay}
              onClick={(e) => {
                e.stopPropagation();
                if (canPlay) setPlaying(true);
              }}
              aria-label="Play"
              className="relative flex size-[60px] items-center justify-center rounded-full disabled:cursor-default"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            >
              <svg width={30} height={30} viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Faint divider under the card (mobile draws one: foreground @ 0.2). */}
      <div className="px-5 pt-2">
        <div
          className="mx-2 h-px"
          style={{ backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
        />
      </div>
    </div>
  );
}
