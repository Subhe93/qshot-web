"use client";

import { useState } from "react";
import { cdnUrl } from "@/lib/api/qrcodes";
import { cn } from "@/lib/utils";

/** Bundled fallback — the URL/link QR icon (mobile's iconQrLink default). */
const FALLBACK_ICON = "/icon-qr-link.svg";

/**
 * QR type icon loaded from the CDN, falling back to the URL icon when the
 * remote asset is missing — mirrors the mobile SvgHybridLoader (network loader
 * with a bundled default).
 */
export function QrTypeIcon({
  icon,
  className,
}: {
  icon?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = !icon || failed ? FALLBACK_ICON : cdnUrl(icon);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn("object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
