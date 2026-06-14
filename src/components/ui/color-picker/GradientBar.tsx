"use client";

import { useRef } from "react";
import { argbToCss } from "@/lib/builder/color";
import { colorAtStop } from "@/lib/builder/color-value";

export interface GStop {
  color: number;
  stop: number; // 0..1
}

const MAX_STOPS = 5;

/**
 * Multi-stop linear gradient editor, mirroring the mobile GradientColorSlider:
 * tap a thumb to select it, drag to move its stop, click the bar to insert a new
 * stop (interpolated color, up to 5).
 */
export function GradientBar({
  stops,
  active,
  onSelect,
  onMove,
  onInsert,
}: {
  stops: GStop[];
  active: number;
  onSelect: (i: number) => void;
  onMove: (i: number, stop: number) => void;
  onInsert: (color: number, stop: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function posOf(clientX: number) {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  const sorted = [...stops].sort((a, b) => a.stop - b.stop);
  const css = `linear-gradient(90deg, ${sorted
    .map((s) => `${argbToCss(s.color)} ${s.stop * 100}%`)
    .join(", ")})`;

  return (
    <div
      ref={ref}
      className="relative h-6 cursor-copy touch-none rounded-md border border-border"
      style={{ background: css }}
      onPointerDown={(e) => {
        if (stops.length >= MAX_STOPS) return;
        const stop = posOf(e.clientX);
        onInsert(
          colorAtStop(stops.map((s) => s.color), stops.map((s) => s.stop), stop),
          stop,
        );
      }}
    >
      {stops.map((s, i) => (
        <button
          key={i}
          type="button"
          className={
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.3)] " +
            (i === active ? "border-primary" : "border-white")
          }
          style={{ left: `${s.stop * 100}%`, backgroundColor: argbToCss(s.color) }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onSelect(i);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) {
              e.stopPropagation();
              onMove(i, posOf(e.clientX));
            }
          }}
        />
      ))}
    </div>
  );
}
