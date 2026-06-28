"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Settings as SettingsIcon, StarOff, Search, Loader2 } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";
import {
  googlePlacesAutocomplete,
  googlePlaceDetails,
  type GooglePrediction,
} from "@/lib/api/google-places";
import type { LocationBlock } from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  SectionLabel,
  type SheetTab,
} from "./sheet-kit";

type Tab = "map" | "settings";

/**
 * LocationModule editor, mirroring the mobile `MapEditorSheet`:
 *  - "Edit" tab: the place picker (search/lat/lng). The web has no live Google
 *    place-picker, so we expose editable address + latitude/longitude fields
 *    that write into the opaque `value` map (kept verbatim otherwise).
 *  - "Settings" tab: accent title field, background color row, hide-reviews row.
 */
export function LocationBlockEditor({ block }: { block: LocationBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const [tab, setTab] = useState<Tab>("map");

  const value = (block.value ?? {}) as Record<string, unknown>;
  const setBlock = (patch: Partial<LocationBlock>) =>
    updateBlock(block.id, patch);

  /** Merge a patch into the opaque `value` map, preserving every other key. */
  const setValue = (patch: Record<string, unknown>) =>
    setBlock({ value: { ...value, ...patch } });

  const name = readStr(value.name);
  // The mobile Place stores the address under `vicinity`; read it too so a
  // place picked on mobile isn't shown blank here.
  const address =
    readStr(value.formatted_address) ??
    readStr(value.formattedAddress) ??
    readStr(value.vicinity) ??
    "";
  const geometry = value.geometry as Record<string, unknown> | undefined;
  const location = geometry?.location as Record<string, unknown> | undefined;
  const lat = readStr(location?.lat) ?? readStr(value.lat) ?? "";
  const lng = readStr(location?.lng) ?? readStr(value.lng) ?? "";

  const setLat = (v: string) => writeCoord(setValue, value, "lat", v);
  const setLng = (v: string) => writeCoord(setValue, value, "lng", v);

  // ── Place search (mirrors the mobile place_picker_google) ──────────────────
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<GooglePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function onSearchInput(q: string) {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setPredictions([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const id = ++reqId.current;
    debounce.current = setTimeout(async () => {
      try {
        const res = await googlePlacesAutocomplete(trimmed);
        if (id === reqId.current) setPredictions(res);
      } catch {
        if (id === reqId.current) setPredictions([]);
      } finally {
        if (id === reqId.current) {
          setSearching(false);
          setSearched(true);
        }
      }
    }, 350);
  }

  async function pickPlace(p: GooglePrediction) {
    setPicking(true);
    try {
      const details = await googlePlaceDetails(p.place_id);
      const loc = details?.geometry?.location;
      const addr = details?.formatted_address || details?.vicinity || p.description;
      setValue({
        place_id: details?.place_id || p.place_id,
        name: details?.name || p.description,
        formatted_address: addr,
        formattedAddress: addr,
        vicinity: details?.vicinity || addr,
        rating: details?.rating,
        user_ratings_total: details?.user_ratings_total,
        url: details?.url,
        ...(loc
          ? {
              lat: loc.lat,
              lng: loc.lng,
              geometry: { location: { lat: loc.lat, lng: loc.lng } },
            }
          : {}),
      });
      setQuery("");
      setPredictions([]);
      setSearched(false);
    } finally {
      setPicking(false);
    }
  }

  const tabs: SheetTab<Tab>[] = [
    { value: "map", label: t("tabs.edit"), Icon: MapPin },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "map" && (
        <div className="space-y-4">
          {/* Place search — pick a location and its name/address/coordinates
              are filled in automatically (mirrors the mobile place picker). */}
          <div className="space-y-2">
            <SectionLabel>{t("fields.searchLocation")}</SectionLabel>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-surface px-3 focus-within:border-primary">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => onSearchInput(e.target.value)}
                  placeholder={t("fields.searchLocation")}
                  className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none"
                />
                {(searching || picking) && (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                )}
              </div>
              {predictions.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card py-1 shadow-lg">
                  {predictions.map((p) => (
                    <li key={p.place_id}>
                      <button
                        type="button"
                        disabled={picking}
                        onClick={() => pickPlace(p)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-start text-sm hover:bg-muted disabled:opacity-60"
                      >
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">{p.description}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searched && !searching && predictions.length === 0 && query.trim().length >= 2 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("fields.locationNoResults")}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <SectionLabel>{t("fields.name")}</SectionLabel>
            <input
              dir={dirOf(name)}
              value={name}
              onChange={(e) => setValue({ name: e.target.value })}
              placeholder={t("fields.name")}
              className="w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <SectionLabel>{t("fields.address")}</SectionLabel>
            <textarea
              dir={dirOf(address)}
              value={address}
              onChange={(e) =>
                setValue({
                  vicinity: e.target.value,
                  formatted_address: e.target.value,
                  formattedAddress: e.target.value,
                })
              }
              rows={2}
              placeholder={t("fields.address")}
              className="w-full resize-none rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <SectionLabel>{t("fields.latitude")}</SectionLabel>
              <input
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <SectionLabel>{t("fields.longitude")}</SectionLabel>
              <input
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {t("fields.coordsHint")}
          </p>
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <SectionLabel>{t("fields.title")}</SectionLabel>
            <input
              dir={dirOf(block.title)}
              value={block.title ?? ""}
              onChange={(e) => setBlock({ title: e.target.value })}
              placeholder={t("fields.title")}
              className="w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <GroupedCard>
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#ffffff")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
            <GroupedRow
              Icon={StarOff}
              color="#f59e0b"
              title={t("fields.hideReviews")}
              trailing={
                <ToggleSwitch
                  checked={!!block.hide_reviews}
                  onChange={(v) => setBlock({ hide_reviews: v })}
                />
              }
            />
          </GroupedCard>
        </div>
      )}
    </div>
  );
}

function readStr(v: unknown): string | undefined {
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return undefined;
}

/** Write a coordinate into both the nested `geometry.location.{lat,lng}` shape
 * (Google Places) and the flat top-level key, keeping the rest of `value`. */
function writeCoord(
  setValue: (patch: Record<string, unknown>) => void,
  value: Record<string, unknown>,
  key: "lat" | "lng",
  raw: string,
) {
  const parsed = raw.trim() === "" ? undefined : Number(raw);
  const coord = parsed != null && Number.isFinite(parsed) ? parsed : raw;
  const geometry = (value.geometry as Record<string, unknown>) ?? {};
  const location = (geometry.location as Record<string, unknown>) ?? {};
  setValue({
    [key]: coord,
    geometry: { ...geometry, location: { ...location, [key]: coord } },
  });
}
