"use client";

import { useRef } from "react";

const CHECKERBOARD =
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px";

/**
 * Horizontal labeled slider with a percentage readout — used for Saturation,
 * Brightness and Alpha, mirroring the mobile AdvancedColorPickerSlider rows.
 * `value` is 0..1; `track` is the css background drawn across the bar.
 */
export function LabeledSlider({
  label,
  value,
  track,
  checkerboard,
  onChange,
}: {
  label: string;
  value: number;
  track: string;
  checkerboard?: boolean;
  onChange: (value: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function emit(clientX: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onChange(x);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-bold text-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div
        ref={ref}
        className="relative h-3 cursor-pointer touch-none rounded-full"
        style={checkerboard ? { background: CHECKERBOARD } : undefined}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          emit(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) emit(e.clientX);
        }}
      >
        <div className="absolute inset-0 rounded-full" style={{ background: track }} />
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
