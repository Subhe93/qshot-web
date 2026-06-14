"use client";

import { useRef } from "react";

/**
 * 2D saturation/value square (the HSV area), matching the mobile ColorPickerArea.
 * Background is the pure hue; white→transparent horizontally (saturation) and
 * transparent→black vertically (value).
 */
export function ColorArea({
  h,
  s,
  v,
  onChange,
}: {
  h: number;
  s: number;
  v: number;
  onChange: (s: number, v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function emit(clientX: number, clientY: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top) / rect.height);
    onChange(x * 100, (1 - y) * 100);
  }

  return (
    <div
      ref={ref}
      className="relative h-full w-full cursor-crosshair touch-none rounded-lg"
      style={{ backgroundColor: `hsl(${h}, 100%, 50%)` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        emit(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) emit(e.clientX, e.clientY);
      }}
    >
      <div
        className="absolute inset-0 rounded-lg"
        style={{ background: "linear-gradient(to right, #fff, transparent)" }}
      />
      <div
        className="absolute inset-0 rounded-lg"
        style={{ background: "linear-gradient(to top, #000, transparent)" }}
      />
      <div
        className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ left: `${s}%`, top: `${100 - v}%` }}
      />
    </div>
  );
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
