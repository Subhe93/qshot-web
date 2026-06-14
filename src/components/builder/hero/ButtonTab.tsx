"use client";

import { EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  GroupedCard,
  GroupedRow,
  ToggleSwitch,
  SectionLabel,
} from "@/components/builder/editors/sheet-kit";
import { ColorPickerField } from "@/components/ui/color-picker";
import type { WebsiteSettings, HeroButton } from "@/lib/types/profile";

/**
 * Hero "Button 1" / "Button 2" tab body, mirroring the mobile hero button
 * settings: text, url, foreground/background colors, and a hide toggle. Rendered
 * inside HeroSettingsSheet (no outer BottomSheet). Every change applies live.
 */
export function ButtonTab({
  settings,
  update,
  which,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
  which: "button1" | "button2";
}) {
  const value: HeroButton = settings[which] ?? {};

  return (
    <div className="space-y-5">
      {/* Content */}
      <div>
        <SectionLabel>Content</SectionLabel>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Text</label>
            <Input
              value={value.text ?? ""}
              placeholder="Text"
              onChange={(e) =>
                update({ [which]: { ...value, text: e.target.value } })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">URL</label>
            <Input
              dir="ltr"
              value={value.url ?? ""}
              placeholder="https://…"
              onChange={(e) =>
                update({ [which]: { ...value, url: e.target.value } })
              }
            />
          </div>
        </div>
      </div>

      {/* Style */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <GroupedCard>
          <div className="flex h-[55px] w-full items-center gap-3 px-3">
            <ColorPickerField
              value={value.foreground_color ?? 0xff000000}
              onChange={(c) =>
                update({ [which]: { ...value, foreground_color: c } })
              }
              compact
            />
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              Text color
            </span>
          </div>
          <div className="ms-14 h-px bg-foreground/[0.08]" />
          <div className="flex h-[55px] w-full items-center gap-3 px-3">
            <ColorPickerField
              value={value.background_color ?? 0xff000000}
              onChange={(c) =>
                update({ [which]: { ...value, background_color: c } })
              }
              compact
            />
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              Background color
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
