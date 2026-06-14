"use client";

import { useTranslations } from "next-intl";
import { argbToHexA } from "@/lib/builder/color";
import { colorValueToCss, solidArgb, type ColorValue } from "@/lib/builder/color-value";
import { ColorPopover } from "./ColorPopover";

/**
 * Solid-or-gradient field (ColorValue in/out) — used for the page background,
 * the only place gradients actually render.
 */
export function ColorValueField({
  value,
  showAlpha = true,
  onChange,
  className,
}: {
  value: ColorValue;
  showAlpha?: boolean;
  onChange: (value: ColorValue) => void;
  className?: string;
}) {
  const t = useTranslations("builder.colorPicker");
  return (
    <ColorPopover
      value={value}
      showAlpha={showAlpha}
      showGradient
      onChange={onChange}
      previewCss={colorValueToCss(value)}
      label={value.type === "gradient" ? t("linearGradient") : argbToHexA(solidArgb(value.color))}
      className={className}
    />
  );
}
