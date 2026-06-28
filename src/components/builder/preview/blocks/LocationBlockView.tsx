"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Copy, Check, Star } from "lucide-react";
import type { LocationBlock } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";

/**
 * Read-only renderer for a LocationModule, mirroring the mobile `LocationPreview`
 * widget (location_widget.dart).
 *
 * The mobile lays the block out as:
 *  - optional bold title (headlineMedium) above
 *  - a "BlurredBox" card (8/12 padding, min-height 50) holding:
 *      • a row with the place name (bold bodyMedium) + two square action
 *        buttons (open-in-maps location-dot, copy address)
 *      • the formatted address (bodySmall, max 2 lines)
 *      • optionally (when !hide_reviews && rating != null) a rating row:
 *        rating value (bold) + 5 golden stars + "N reviews" underlined
 *  - 12px gap
 *  - a 1:1 (square) rounded (radius 12) Google Map of the place
 *
 * LocationModule has no `layout_type` variants — this is the single layout.
 * On the web we cannot embed a live GoogleMap, so the square map area is
 * rendered as a Google Maps static-map image (lat/lng) when coordinates exist,
 * otherwise a placeholder. The `value` map is opaque and read verbatim.
 */
export function LocationBlockView({ block }: { block: LocationBlock }) {
  const t = useTranslations("builder.location");
  const value = (block.value ?? {}) as Record<string, unknown>;
  const place = readPlace(value);

  const name = place.name;
  const address = place.address;
  const rating = place.rating;
  const reviewsTotal = place.userRatingsTotal;
  const showReviews = !block.hide_reviews && rating != null;
  const url = mapsUrl(place);

  const dir = dirOf(name || address || block.title);

  return (
    <div dir={dir} className="flex flex-col items-stretch px-5 py-3">
      {block.title ? (
        <p
          dir={dirOf(block.title)}
          className="mb-[5px] text-xl font-bold leading-snug text-foreground"
        >
          {block.title}
        </p>
      ) : null}

      {/* Info card ("BlurredBox": padding 8/12, min-height 50) */}
      <div className="rounded-xl bg-foreground/[0.04] px-3 py-2">
        <div className="flex min-h-[50px] flex-col justify-center">
          {name || address || place.lat != null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="flex-1 truncate text-sm font-bold text-foreground">
                  {name || address}
                </span>
                <OpenInMapsButton url={url} label={t("openInMaps")} />
                <CopyAddressButton text={address || name} label={t("copyAddress")} />
              </div>
              {address ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {address}
                </p>
              ) : null}
              {showReviews ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {rating}
                  </span>
                  <span className="flex gap-px">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star
                        key={i}
                        className="size-[18px]"
                        style={{ color: "#F5A623" }}
                        fill={(rating ?? 0) >= i + 1 ? "#F5A623" : "transparent"}
                        strokeWidth={1.5}
                      />
                    ))}
                  </span>
                  <span className="text-xs text-muted-foreground underline">
                    {`${reviewsTotal ?? 0} ${t("reviews")}`}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("infoUnavailable")}</p>
          )}
        </div>
      </div>

      {/* Square map (AspectRatio 1, radius 12) */}
      {block.hide !== true ? (
        <div className="mt-3 aspect-square w-full overflow-hidden rounded-xl bg-foreground/5">
          {place.lat != null && place.lng != null ? (
            <StaticMap lat={place.lat} lng={place.lng} />
          ) : (
            <div className="flex size-full items-center justify-center">
              <MapPin className="size-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const ACTION_CLASS =
  "flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.12] text-foreground transition-colors hover:bg-foreground/20";

/** Open-in-maps — a real link (works in preview/published; inert in the editor,
 * where the block is wrapped pointer-events-none). Mirrors mobile `_ActionButton`. */
function OpenInMapsButton({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <span aria-label={label} title={label} className={`${ACTION_CLASS} opacity-50`}>
        <MapPin className="size-4" />
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" aria-label={label} title={label} className={ACTION_CLASS}>
      <MapPin className="size-4" />
    </a>
  );
}

/** Copy the address to the clipboard, briefly showing a check (mobile "copied"). */
function CopyAddressButton({ text, label }: { text?: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!text}
      onClick={() => {
        if (!text) return;
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className={`${ACTION_CLASS} disabled:opacity-50`}
    >
      {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
    </button>
  );
}

/** Google Maps static-map image for the given coordinates (zoom 16, with marker)
 * — the closest web equivalent of the mobile square GoogleMap (camera zoom 16). */
function StaticMap({ lat, lng }: { lat: number; lng: number }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (apiKey) {
    const src = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=600x600&scale=2&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt="Map"
        className="size-full object-cover"
        loading="lazy"
      />
    );
  }
  // No key configured: fall back to a key-less embeddable map iframe.
  const src = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  return (
    <iframe
      title="Map"
      src={src}
      className="size-full border-0"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}

/** Read the opaque Google `Place` JSON map into the few display fields the
 * preview needs. Tolerant of both Places-API (snake_case) and the
 * place_picker_google (camelCase) serialisations. */
function readPlace(value: Record<string, unknown>): {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  userRatingsTotal?: number;
  placeId?: string;
} {
  const name = str(value.name);
  const placeId = str(value.place_id) ?? str(value.placeId);
  // The stored Place (place_picker_google) often only carries `vicinity`, not a
  // formatted address — fall back to it so the address line isn't blank on web.
  const address =
    str(value.formatted_address) ??
    str(value.formattedAddress) ??
    str(value.vicinity);
  const rating = num(value.rating);
  const userRatingsTotal =
    num(value.user_ratings_total) ?? num(value.userRatingsTotal);

  const geometry = value.geometry as Record<string, unknown> | undefined;
  const location = geometry?.location as Record<string, unknown> | undefined;
  const lat = num(location?.lat) ?? num(value.lat) ?? num(value.latitude);
  const lng = num(location?.lng) ?? num(value.lng) ?? num(value.longitude);

  return { name, address, lat, lng, rating, userRatingsTotal, placeId };
}

/** Google Maps "search" deep link for the place (place_id > name/address > coords). */
function mapsUrl(p: {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
}): string | null {
  const q =
    [p.name, p.address].filter(Boolean).join(", ") ||
    (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : "");
  if (!q) return null;
  const base = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  return p.placeId ? `${base}&query_place_id=${encodeURIComponent(p.placeId)}` : base;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  return undefined;
}
