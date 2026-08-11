"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, Image as ImageIcon, Type, Baseline, Palette } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { ColorValueField, ColorPickerField } from "@/components/ui/color-picker";
import { solid, primaryArgb, type ColorValue } from "@/lib/builder/color-value";
import { DEFAULT_FONT, ensureGoogleFonts, fontStack } from "@/lib/builder/google-fonts";
import { websiteTemplateOf } from "@/lib/builder/website-templates";
import { FontSelectorSheet } from "./FontSelectorSheet";

const WHITE = 0xffffffff;
const APP_BLACK = 0xff1f1f26;

/** Relative luminance of an ARGB int (mobile Color.computeLuminance() > 0.5). */
function isBright(argb: number): boolean {
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
}

/**
 * Per-website Style page — mirrors the mobile WebsiteStyleLayout: a "Theme"
 * group (Templates row → opens the ThemeSheet) above a "General" grouped list
 * editing the page background (solid/gradient), the website font, and the
 * font color, with the same auto-contrast (flip the font color when it would
 * clash with the new background).
 */
export function WebsiteStylePanel({
  onOpenTemplates,
}: {
  /** Opens the ThemeSheet (the host first returns to the website view, as the
   *  mobile style page pops with `ThemeSheet.openSignal` — two live-previewing
   *  surfaces can't stack). */
  onOpenTemplates?: () => void;
}) {
  const tt = useTranslations("builder.templates");
  const settings = useEditorStore((s) => s.settings);
  const update = useEditorStore((s) => s.updateSettings);
  const [fontOpen, setFontOpen] = useState(false);
  const currentTemplate = websiteTemplateOf(settings.template?.id);

  const fontFamily = settings.font_family ?? DEFAULT_FONT;
  const fontColor = settings.font_color ?? WHITE;
  const background: ColorValue =
    (settings.background?.color_value as ColorValue | undefined) ?? solid(WHITE);

  useEffect(() => {
    ensureGoogleFonts([fontFamily]);
  }, [fontFamily]);

  function setBackground(cv: ColorValue) {
    const bgBright = isBright(primaryArgb(cv));
    const fgBright = isBright(fontColor);
    const patch: Parameters<typeof update>[0] = {
      background: { ...settings.background, color_value: cv },
    };
    if (bgBright === fgBright) patch.font_color = fgBright ? APP_BLACK : WHITE;
    update(patch);
  }

  return (
    <div className="mx-auto max-w-md p-4">
      {/* Theme group — mobile website_style_layout.dart puts it above General
          (its `_showTemplates` gate). Rendered only when the host provides an
          opener: BuilderShell passes `undefined` if TEMPLATES_ENABLED is ever
          turned off again, which removes the whole group as if it didn't
          exist. The panel itself is opener-agnostic — other hosts may embed it
          without a Theme row. */}
      {onOpenTemplates && (
        <>
          <p className="mb-2 px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {tt("theme")}
          </p>
          <div className="mb-6 overflow-hidden rounded-2xl bg-card">
            <Row
              icon={<IconBox color="#FF9500"><Palette className="size-[17px]" /></IconBox>}
              label={tt("title")}
              onClick={onOpenTemplates}
              trailing={
                <div className="flex items-center gap-1">
                  <span className="max-w-[130px] truncate text-[13px] text-muted-foreground">
                    {currentTemplate ? tt(`names.${currentTemplate.id}`) : tt("theme")}
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground/60 rtl:rotate-180" />
                </div>
              }
            />
          </div>
        </>
      )}

      <p className="mb-2 px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        General
      </p>
      <div className="overflow-hidden rounded-2xl bg-card">
        {/* Background */}
        <Row
          icon={<IconBox color="#34C759"><ImageIcon className="size-[17px]" /></IconBox>}
          label="Background"
          trailing={
            <ColorValueField
              value={background}
              showAlpha={false}
              onChange={setBackground}
            />
          }
        />
        <Divider />
        {/* Website font */}
        <Row
          icon={<IconBox color="#5856D6"><Type className="size-[17px]" /></IconBox>}
          label="Website font"
          onClick={() => setFontOpen(true)}
          trailing={
            <div className="flex items-center gap-1">
              <span
                className="max-w-[130px] truncate text-[13px] text-muted-foreground"
                style={{ fontFamily: fontStack(fontFamily) }}
              >
                {fontFamily}
              </span>
              <ChevronRight className="size-5 text-muted-foreground/60 rtl:rotate-180" />
            </div>
          }
        />
        <Divider />
        {/* Font color */}
        <Row
          icon={<IconBox color="#007AFF"><Baseline className="size-[17px]" /></IconBox>}
          label="Website font color"
          trailing={
            <ColorPickerField
              value={fontColor}
              showAlpha={false}
              onChange={(c) => update({ font_color: c })}
            />
          }
        />
      </div>

      {fontOpen && (
        <FontSelectorSheet
          value={fontFamily}
          onSelect={(f) => update({ font_family: f })}
          onClose={() => setFontOpen(false)}
        />
      )}
    </div>
  );
}

function IconBox({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

function Row({
  icon,
  label,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon}
      <span className="flex-1 text-[15px] font-medium text-foreground">{label}</span>
      {trailing}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3.5 px-4 py-3 text-start transition-colors hover:bg-surface"
      >
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3.5 px-4 py-3">{content}</div>;
}

function Divider() {
  return <div className="ms-[62px] h-px bg-border/60" />;
}
