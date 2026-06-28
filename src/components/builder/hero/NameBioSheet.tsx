"use client";

import { EyeOff, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import {
  GroupedCard,
  GroupedRow,
  ToggleSwitch,
  SectionLabel,
} from "@/components/builder/editors/sheet-kit";
import { ColorPickerField } from "@/components/ui/color-picker";
import { useEditorStore } from "@/stores/editor-store";
import { cn } from "@/lib/utils";
import type { NameField, BioField } from "@/lib/types/profile";

/**
 * Full sheet for the hero "Name" / "Bio" fields, mirroring the separate mobile
 * name/bio settings sheets: text, alignment, color (name only), and a hide
 * toggle. Reads/writes the editor store directly. Changes apply live.
 */
/** Inner content — shared by the mobile sheet and the desktop left panel. */
export function NameBioContent({ which }: { which: "name" | "bio" }) {
  const settings = useEditorStore((s) => s.settings);
  const update = useEditorStore((s) => s.updateSettings);

  const value: NameField | BioField = settings[which] ?? {};
  const isName = which === "name";

  return (
    <div className="space-y-5">
        {/* Text */}
        <div>
          <SectionLabel>{isName ? "Name" : "Bio"}</SectionLabel>
          {isName ? (
            <Input
              value={value.text ?? ""}
              placeholder="Name"
              onChange={(e) =>
                update({ [which]: { ...value, text: e.target.value } })
              }
            />
          ) : (
            <textarea
              value={value.text ?? ""}
              rows={4}
              placeholder="Bio"
              onChange={(e) =>
                update({ [which]: { ...value, text: e.target.value } })
              }
              className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )}
        </div>

        {/* Alignment */}
        <div>
          <SectionLabel>Alignment</SectionLabel>
          <div className="flex gap-1 rounded-xl bg-surface p-1">
            <AlignTab
              Icon={AlignLeft}
              active={(value.alignment ?? "start") === "start"}
              onClick={() => update({ [which]: { ...value, alignment: "start" } })}
            />
            <AlignTab
              Icon={AlignCenter}
              active={value.alignment === "center"}
              onClick={() =>
                update({ [which]: { ...value, alignment: "center" } })
              }
            />
            <AlignTab
              Icon={AlignRight}
              active={value.alignment === "end"}
              onClick={() => update({ [which]: { ...value, alignment: "end" } })}
            />
          </div>
        </div>

        {/* Style */}
        <div>
          <SectionLabel>Style</SectionLabel>
          <GroupedCard>
            {isName && (
              <div className="flex h-[55px] w-full items-center gap-3 px-3">
                <ColorPickerField
                  value={(value as NameField).color ?? 0xff000000}
                  onChange={(c) =>
                    update({ [which]: { ...value, color: c } })
                  }
                  compact
                />
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  Color
                </span>
              </div>
            )}
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

export function NameBioSheet({
  which,
  onClose,
}: {
  which: "name" | "bio";
  onClose: () => void;
}) {
  return (
    <BottomSheet
      title={which === "name" ? "Name" : "Bio"}
      subtitle="Settings"
      onClose={onClose}
    >
      <NameBioContent which={which} />
    </BottomSheet>
  );
}

function AlignTab({
  Icon,
  active,
  onClick,
}: {
  Icon: typeof AlignLeft;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center rounded-[10px] py-2 transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
      )}
    >
      <Icon
        className="size-[18px]"
        style={active ? { color: "var(--primary)" } : undefined}
      />
    </button>
  );
}
