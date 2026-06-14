"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link as LinkIcon, Phone, Sticker } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { hexToArgbA } from "@/lib/builder/color";
import { GroupedCard, ColorRow } from "./sheet-kit";
import { SelectIconSheet } from "./SelectIconSheet";
import type { ButtonItem } from "@/lib/types/blocks";
import { cn } from "@/lib/utils";

/**
 * Single button-item editor, mirroring the mobile ButtonItemEditorSheet: icon,
 * link-type toggle (URL / phone), title, and a grouped color card (fill / border
 * / text). Edits apply live.
 */
export function ButtonItemEditor({
  item,
  onChange,
  onClose,
}: {
  item: ButtonItem;
  onChange: (patch: Partial<ButtonItem>) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const [iconsOpen, setIconsOpen] = useState(false);
  const isPhone = item.url?.startsWith("tel:") ?? false;
  const phoneValue = isPhone ? item.url!.slice(4) : "";

  return (
    <>
    <BottomSheet title={t("blocks.button")} subtitle={t("edit")} onClose={onClose}>
      <div className="space-y-4">
        {/* Icon image upload */}
        <div className="flex items-center gap-3">
          <ImageUploadField
            value={item.icon}
            onChange={(fileName) => onChange({ icon: fileName })}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t("fields.icon")}</p>
            <button
              type="button"
              onClick={() => setIconsOpen(true)}
              className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/[0.06] px-2.5 py-1.5 text-xs font-semibold text-primary"
            >
              <Sticker className="size-4" />
              {t("famousIcons")}
            </button>
          </div>
        </div>

        {/* Link type toggle */}
        <div className="flex gap-1 rounded-xl bg-surface p-1">
          <LinkTypeTab
            Icon={LinkIcon}
            label={t("fields.url")}
            active={!isPhone}
            onClick={() => {
              if (isPhone) onChange({ url: phoneValue });
            }}
          />
          <LinkTypeTab
            Icon={Phone}
            label={t("fields.phone")}
            active={isPhone}
            onClick={() => {
              if (!isPhone) onChange({ url: `tel:${item.url ?? ""}` });
            }}
          />
        </div>

        {/* URL / phone field */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {isPhone ? t("fields.phone") : t("fields.url")}
          </label>
          <Input
            dir="ltr"
            value={isPhone ? phoneValue : (item.url ?? "")}
            placeholder={isPhone ? "+1234567890" : "https://…"}
            onChange={(e) =>
              onChange({ url: isPhone ? `tel:${e.target.value}` : e.target.value })
            }
          />
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {t("fields.title")}
          </label>
          <Input
            value={item.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>

        {/* Colors */}
        <GroupedCard>
          <ColorRow
            label={t("fields.fill")}
            color={item.background_color ?? hexToArgbA("#111111")!}
            enabled={!!item.use_background_color}
            onColor={(c) => onChange({ background_color: c })}
            onToggle={(v) => onChange({ use_background_color: v })}
          />
          <ColorRow
            label={t("fields.border")}
            color={item.border_color ?? hexToArgbA("#111111")!}
            enabled={!!item.use_border}
            onColor={(c) => onChange({ border_color: c })}
            onToggle={(v) => onChange({ use_border: v })}
          />
          <ColorRow
            label={t("fields.textColor")}
            color={item.text_color ?? hexToArgbA("#ffffff")!}
            enabled={!!item.use_text_color}
            onColor={(c) => onChange({ text_color: c })}
            onToggle={(v) => onChange({ use_text_color: v })}
          />
        </GroupedCard>

        {/* Corner radius */}
        <div className="px-1">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("fields.cornerRadius")}</span>
            <span className="font-bold text-foreground">
              {item.corner_radius ?? 12}px
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            value={item.corner_radius ?? 12}
            onChange={(e) => onChange({ corner_radius: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </div>
      </div>
    </BottomSheet>
    {iconsOpen && (
      <SelectIconSheet
        onPicked={(fileName) => onChange({ icon: fileName })}
        onClose={() => setIconsOpen(false)}
      />
    )}
    </>
  );
}

function LinkTypeTab({
  Icon,
  label,
  active,
  onClick,
}: {
  Icon: typeof LinkIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
      )}
    >
      <Icon className="size-3.5" style={active ? { color: "var(--primary)" } : undefined} />
      {label}
    </button>
  );
}
