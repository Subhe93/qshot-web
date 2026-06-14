"use client";

import { useRef } from "react";

const HUE_GRADIENT =
  "linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)";

/** Vertical hue slider (0..360), sitting beside the ColorArea like the mobile picker. */
export function HueSlider({
  h,
  onChange,
}: {
  h: number;
  onChange: (h: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function emit(clientY: number) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onChange(y * 360);
  }

  return (
    <div
      ref={ref}
      className="relative h-full w-3 cursor-pointer touch-none rounded-full"
      style={{ background: HUE_GRADIENT }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        emit(e.clientY);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) emit(e.clientY);
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ top: `${(h / 360) * 100}%`, backgroundColor: `hsl(${h}, 100%, 50%)` }}
      />
    </div>
  );
}
