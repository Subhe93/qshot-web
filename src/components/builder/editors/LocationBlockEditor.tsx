"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Settings as SettingsIcon, StarOff } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";
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
  const address =
    readStr(value.formatted_address) ?? readStr(value.formattedAddress) ?? "";
  const geometry = value.geometry as Record<string, unknown> | undefined;
  const location = geometry?.location as Record<string, unknown> | undefined;
  const lat = readStr(location?.lat) ?? readStr(value.lat) ?? "";
  const lng = readStr(location?.lng) ?? readStr(value.lng) ?? "";

  const setLat = (v: string) => writeCoord(setValue, value, "lat", v);
  const setLng = (v: string) => writeCoord(setValue, value, "lng", v);

  const tabs: SheetTab<Tab>[] = [
    { value: "map", label: "Edit", Icon: MapPin },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "map" && (
        <div className="space-y-4">
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
            <SectionLabel>Address</SectionLabel>
            <textarea
              dir={dirOf(address)}
              value={address}
              onChange={(e) =>
                setValue({
                  formatted_address: e.target.value,
                  formattedAddress: e.target.value,
                })
              }
              rows={2}
              placeholder="Address"
              className="w-full resize-none rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <SectionLabel>Latitude</SectionLabel>
              <input
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <SectionLabel>Longitude</SectionLabel>
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
            Enter the place coordinates to position the map.
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
              title="Hide reviews"
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
