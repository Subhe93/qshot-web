"use client";

import { argbToCss, argbToHexA } from "@/lib/builder/color";
import { primaryArgb, solid } from "@/lib/builder/color-value";
import { ColorPopover } from "./ColorPopover";

/**
 * Solid-color field (ARGB in/out) — drop-in replacement for `<input type="color">`.
 * Used for block backgrounds and divider colors, which do not support gradients.
 */
export function ColorPickerField({
  value,
  showAlpha = true,
  onChange,
  className,
  compact,
}: {
  value: number;
  showAlpha?: boolean;
  onChange: (argb: number) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <ColorPopover
      value={solid(value)}
      showAlpha={showAlpha}
      onChange={(v) => onChange(primaryArgb(v))}
      previewCss={argbToCss(value)}
      label={argbToHexA(value)}
      className={className}
      compact={compact}
    />
  );
}
