"use client";

import { useEffect, useState } from "react";
import { Music } from "lucide-react";
import { musicPlatformMonoSrc, musicPlatformTileSrc } from "@/lib/music-links/platforms";
import { safeHttpsUrl } from "@/lib/music-links/render";
import { cn } from "@/lib/utils";

/**
 * A music platform's icon (docs/api-contract.en.md §5: "ship one icon per id").
 *
 *  - `tile` — the full-colour brand tile, `public/music-platforms/<id>.svg`;
 *  - `mono` — the one-colour glyph, `public/music-platforms/<id>-mono.svg`,
 *    painted in `currentColor` through a CSS mask so it follows the page font
 *    colour.
 *
 * Either one falls back to a generic music note when the file is missing (an
 * id whose artwork is not vendored yet) — never a broken image.
 */

/** src → loaded? (shared so a list of buttons probes each file once). */
const probed = new Map<string, boolean>();

function useImageOk(src: string): boolean | null {
  const [ok, setOk] = useState<boolean | null>(() => probed.get(src) ?? null);
  useEffect(() => {
    if (probed.has(src)) return;
    let alive = true;
    const img = new Image();
    img.onload = () => {
      probed.set(src, true);
      if (alive) setOk(true);
    };
    img.onerror = () => {
      probed.set(src, false);
      if (alive) setOk(false);
    };
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return probed.get(src) ?? ok;
}

export function MusicPlatformIcon({
  id,
  variant = "tile",
  size = 20,
  className,
}: {
  id: string;
  variant?: "tile" | "mono";
  size?: number;
  className?: string;
}) {
  const src = variant === "tile" ? musicPlatformTileSrc(id) : musicPlatformMonoSrc(id);
  const ok = useImageOk(src);

  if (ok === false) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          variant === "tile" && "rounded-[22%] bg-current/15",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Music style={{ width: size * 0.62, height: size * 0.62 }} />
      </span>
    );
  }

  if (variant === "tile") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden
        width={size}
        height={size}
        draggable={false}
        className={cn("shrink-0 select-none", ok == null && "opacity-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  const mask = `url("${src}")`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0", ok == null && "opacity-0", className)}
      style={{
        width: size,
        height: size,
        backgroundColor: "currentColor",
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}

/** Generic music cover — for a null or failed `cover_url` (§8). */
export function MusicCoverPlaceholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("flex items-center justify-center", className)}
      style={{
        background: "color-mix(in srgb, currentColor 12%, transparent)",
        color: "color-mix(in srgb, currentColor 55%, transparent)",
      }}
    >
      <Music className="size-[38%]" />
    </span>
  );
}

/** A cover image that degrades to the placeholder on a null URL or load error. */
export function MusicCover({ url: raw, className }: { url?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  // https only, as on the published page (§4.3).
  const url = safeHttpsUrl(raw);
  if (!url || failed === url) return <MusicCoverPlaceholder className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(url)}
      className={cn("object-cover", className)}
    />
  );
}
