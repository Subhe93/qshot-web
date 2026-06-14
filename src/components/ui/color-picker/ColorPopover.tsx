"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ColorValue } from "@/lib/builder/color-value";
import { ColorPickerPanel } from "./ColorPickerPanel";

const CHECKERBOARD =
  "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 10px 10px";

/**
 * Trigger button showing the current color/gradient; opens the ColorPickerPanel
 * in a popover anchored to the trigger (clamped to the viewport).
 */
export function ColorPopover({
  value,
  showAlpha,
  showGradient,
  onChange,
  previewCss,
  label,
  className,
  compact,
}: {
  value: ColorValue;
  showAlpha?: boolean;
  showGradient?: boolean;
  onChange: (value: ColorValue) => void;
  previewCss?: string;
  label: string;
  className?: string;
  /** Render just a small swatch (for grouped color rows) instead of a full bar. */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
    dropUp: boolean;
  } | null>(null);

  // Position the portalled panel against the trigger, flipping above it when
  // there isn't room below (e.g. fields near the bottom of the page). The panel
  // is capped to the available space on its side and scrolls if it still
  // doesn't fit, so it never spills off the top or bottom of the viewport.
  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const width = 288 + 24; // panel w-72 + padding
    const estimated = 480; // approx panel height; only used to pick a side
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    // Prefer below, but flip up when below is too cramped and above has more room.
    const dropUp = spaceBelow < estimated && spaceAbove > spaceBelow;

    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - width - margin),
    );

    setPos({
      left,
      dropUp,
      maxHeight: Math.max(0, dropUp ? spaceAbove : spaceBelow),
      top: dropUp ? undefined : rect.bottom + margin,
      bottom: dropUp ? window.innerHeight - rect.top + margin : undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePos();
    window.addEventListener("resize", computePos);
    window.addEventListener("scroll", computePos, true);
    return () => {
      window.removeEventListener("resize", computePos);
      window.removeEventListener("scroll", computePos, true);
    };
  }, [open, computePos]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {compact ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          className={
            "size-[30px] shrink-0 rounded-lg border border-black/15 shadow-sm " +
            (className ?? "")
          }
          style={{ background: CHECKERBOARD }}
        >
          <span
            className="block size-full rounded-lg"
            style={{ background: previewCss }}
          />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={
            "flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-card px-2 " +
            (className ?? "")
          }
        >
          <span
            className="size-6 shrink-0 rounded border border-border"
            style={{ background: CHECKERBOARD }}
          >
            <span
              className="block size-full rounded"
              style={{ background: previewCss }}
            />
          </span>
          <span className="truncate text-sm uppercase text-foreground">{label}</span>
        </button>
      )}

      {open &&
        pos &&
        createPortal(
          <div className="fixed inset-0 z-[130]" onMouseDown={() => setOpen(false)}>
            <div
              className={
                "animate-popover-in fixed overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl " +
                (pos.dropUp ? "origin-bottom" : "origin-top")
              }
              style={{
                top: pos.top,
                bottom: pos.bottom,
                left: pos.left,
                maxHeight: pos.maxHeight,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <ColorPickerPanel
                value={value}
                showAlpha={showAlpha}
                showGradient={showGradient}
                onApply={(next) => {
                  onChange(next);
                  setOpen(false);
                }}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
