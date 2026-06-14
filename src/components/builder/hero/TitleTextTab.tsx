"use client";

import { EyeOff } from "lucide-react";
import { GroupedCard, GroupedRow, ToggleSwitch, SectionLabel } from "@/components/builder/editors/sheet-kit";
import { ColorPickerField } from "@/components/ui/color-picker";
import type { WebsiteSettings, HeroText } from "@/lib/types/profile";

/**
 * Hero "Title" / "Text" tab body, mirroring the mobile hero title/text settings:
 * a multiline text input, a text color, and a hide toggle. Rendered inside
 * HeroSettingsSheet (no outer BottomSheet). Every change applies live.
 */
export function TitleTextTab({
  settings,
  update,
  which,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
  which: "title" | "text";
}) {
  const value: HeroText = settings[which] ?? {};
  const label = which === "title" ? "Title" : "Text";
  const maxLength = which === "title" ? 100 : 200;

  return (
    <div className="space-y-5">
      {/* Text */}
      <div>
        <SectionLabel>{label}</SectionLabel>
        <textarea
          value={value.text ?? ""}
          maxLength={maxLength}
          rows={which === "title" ? 2 : 4}
          placeholder={label}
          onChange={(e) =>
            update({ [which]: { ...value, text: e.target.value } })
          }
          className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Style */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <GroupedCard>
          <div className="flex h-[55px] w-full items-center gap-3 px-3">
            <ColorPickerField
              value={value.color ?? 0xff000000}
              onChange={(c) => update({ [which]: { ...value, color: c } })}
              compact
            />
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              Color
            </span>
          </div>
          <GroupedRow
            Icon={EyeOff}
            title="Hide"
            color="#8e8e93"
            trailing={
              <ToggleSwitch
                checked={!!value.hide}
                onChange={(v) => update({ [which]: { ...value, hide: v } })}
              />
            }
          />
        </GroupedCard>
      </div>
    </div>
  );
}
