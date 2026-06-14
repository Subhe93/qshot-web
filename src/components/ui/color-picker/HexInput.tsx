"use client";

import { useState } from "react";
import { argbToHexA, hexToArgbA, argbToCss } from "@/lib/builder/color";

/**
 * Hex text field with a live preview swatch, matching the mobile ColorPickerInput.
 * Accepts #rgb / #rrggbb / #rrggbbaa; commits a valid value on change/blur.
 */
export function HexInput({
  argb,
  showAlpha,
  onChange,
}: {
  argb: number;
  showAlpha?: boolean;
  onChange: (argb: number) => void;
}) {
  const [text, setText] = useState(() => argbToHexA(argb));
  const [prevArgb, setPrevArgb] = useState(argb);

  // Reflect external changes (area/sliders/swatches) into the field during
  // render — the recommended alternative to syncing state in an effect.
  if (argb !== prevArgb) {
    setPrevArgb(argb);
    setText(argbToHexA(argb));
  }

  function commit(raw: string) {
    const parsed = hexToArgbA(raw);
    if (parsed == null) {
      setText(argbToHexA(argb)); // revert invalid input
      return;
    }
    const next = showAlpha ? parsed : (parsed | 0xff000000) >>> 0;
    onChange(next);
  }

  return (
    <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-2">
      <input
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value.toUpperCase())}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        }}
        className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
      />
      <span
        className="size-6 shrink-0 rounded border border-border"
        style={{ backgroundColor: argbToCss(argb) }}
      />
    </div>
  );
}
