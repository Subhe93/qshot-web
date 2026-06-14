"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  type LucideIcon,
} from "lucide-react";
import { heroStyleFlags } from "@/lib/builder/hero-defaults";
import { ColorPickerField } from "@/components/ui/color-picker";
import type { ImageAlignment } from "@/lib/types/blocks";
import type {
  HeaderPosition,
  HeroText,
  WebsiteSettings,
} from "@/lib/types/profile";
import {
  GroupedCard,
  GroupedRow,
  SectionLabel,
  ToggleSwitch,
} from "../editors/sheet-kit";
import { ImageUploader, Segmented, Slider } from "./CoverTab";

const ALIGNMENTS: { value: ImageAlignment; Icon: LucideIcon }[] = [
  { value: "start", Icon: AlignLeft },
  { value: "center", Icon: AlignCenter },
  { value: "end", Icon: AlignRight },
];

const POSITIONS: { value: HeaderPosition; label: string }[] = [
  { value: "aboveCover", label: "Above cover" },
  { value: "onCover", label: "On cover" },
];

export function HeaderTab({
  settings,
  update,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
}) {
  const header = settings.header ?? {};
  const setHeader = (patch: Partial<typeof header>) =>
    update({ header: { ...header, ...patch } });

  const logo = settings.logo ?? {};
  const setLogo = (patch: Partial<typeof logo>) =>
    update({ logo: { ...logo, ...patch } });

  const flags = heroStyleFlags(settings.style ?? "style2");
  const title: HeroText = header.title ?? {};
  const onCover = (header.position ?? "aboveCover") === "onCover";

  return (
    <div className="space-y-5">
      {/* Logo */}
      <div className="space-y-2">
        <SectionLabel>Logo</SectionLabel>
        <ImageUploader
          path={logo.image_url}
          onUploaded={(p) => setLogo({ image_url: p })}
          onDelete={() => setLogo({ image_url: undefined })}
        />
        <GroupedCard>
          <GroupedRow
            title="Hide logo"
            trailing={
              <ToggleSwitch
                checked={!!logo.hide}
                onChange={(v) => setLogo({ hide: v })}
              />
            }
          />
        </GroupedCard>
      </div>

      {/* Title */}
      {flags.hasHeaderTitle && (
        <div className="space-y-2">
          <SectionLabel>Title</SectionLabel>
          <input
            value={title.text ?? ""}
            onChange={(e) =>
              setHeader({ title: { ...title, text: e.target.value } })
            }
            placeholder="Header title"
            className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none focus:border-primary"
          />
        </div>
      )}

      {/* Alignment */}
      <div className="space-y-2">
        <SectionLabel>Leading alignment</SectionLabel>
        <AlignmentButtons
          value={header.leading_alignment ?? "start"}
          onChange={(v) => setHeader({ leading_alignment: v })}
        />
      </div>

      {/* Colors */}
      <div className="space-y-2">
        <SectionLabel>Colors</SectionLabel>
        <GroupedCard>
          <GroupedRow
            customIcon={
              <ColorPickerField
                value={header.foreground_color ?? 0xff000000}
                onChange={(c) => setHeader({ foreground_color: c })}
                compact
              />
            }
            title="Text color"
          />
          <GroupedRow
            customIcon={
              <ColorPickerField
                value={header.background_color ?? 0xffffffff}
                onChange={(c) => setHeader({ background_color: c })}
                compact
              />
            }
            title="Background color"
          />
        </GroupedCard>
      </div>

      {/* Position */}
      <div className="space-y-2">
        <SectionLabel>Position</SectionLabel>
        <Segmented
          options={POSITIONS}
          value={header.position ?? "aboveCover"}
          onChange={(v) => setHeader({ position: v })}
        />
      </div>

      {onCover && (
        <div className="space-y-2">
          <SectionLabel>Background opacity</SectionLabel>
          <Slider
            value={header.background_opacity ?? 1}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => setHeader({ background_opacity: v })}
          />
        </div>
      )}

      {/* Toggles */}
      <GroupedCard>
        {onCover && (
          <GroupedRow
            title="Fill sides"
            trailing={
              <ToggleSwitch
                checked={!!header.fillSides}
                onChange={(v) => setHeader({ fillSides: v })}
              />
            }
          />
        )}
        <GroupedRow
          title="Hide menu"
          trailing={
            <ToggleSwitch
              checked={!!header.hide}
              onChange={(v) => setHeader({ hide: v })}
            />
          }
        />
      </GroupedCard>
    </div>
  );
}

/** Three-button icon segmented alignment selector. */
export function AlignmentButtons({
  value,
  onChange,
}: {
  value: ImageAlignment;
  onChange: (value: ImageAlignment) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface p-1">
      {ALIGNMENTS.map(({ value: v, Icon }) => {
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-label={v}
            className={
              "flex flex-1 items-center justify-center rounded-[10px] py-2 transition-colors " +
              (active
                ? "bg-card text-foreground shadow-sm"
                : "text-foreground/45")
            }
          >
            <Icon className="size-[18px]" />
          </button>
        );
      })}
    </div>
  );
}
