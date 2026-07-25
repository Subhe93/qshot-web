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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    maxHeight: number;
    above: boolean;
  } | null>(null);

  // Position the portalled panel so the WHOLE picker stays visible: prefer just
  // below the trigger; flip fully ABOVE it when it would overflow the bottom
  // (e.g. a field near the end of the page); and if it fits neither side exactly,
  // shift it up so it sits within the viewport. Only a panel taller than the
  // entire viewport scrolls (handled by the sticky action bar). Uses the panel's
  // REAL measured height once rendered (an estimate on the very first paint).
  const computePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const width = 288 + 24; // panel w-72 + padding
    const vh = window.innerHeight;
    const panelH = panelRef.current?.offsetHeight ?? 480;
    const maxHeight = vh - margin * 2;
    const fitH = Math.min(panelH, maxHeight);

    const left = Math.max(
      margin,
      Math.min(rect.left, window.innerWidth - width - margin),
    );

    let top = rect.bottom + margin; // prefer below the trigger
    let above = false;
    if (top + fitH > vh - margin) {
      const aboveTop = rect.top - margin - fitH; // fully above the trigger
      if (aboveTop >= margin) {
        top = aboveTop;
        above = true;
      } else {
        // Fits neither side fully → clamp into the viewport (shift up).
        top = Math.max(margin, vh - margin - fitH);
        above = rect.top > vh / 2;
      }
    }
    setPos({ top, left, maxHeight, above });
  }, []);

  // Callback ref: measure + observe the panel the moment it mounts (and on any
  // size change, e.g. toggling the gradient/alpha rows) so we always reposition
  // against its real height.
  const setPanelNode = useCallback(
    (node: HTMLDivElement | null) => {
      roRef.current?.disconnect();
      panelRef.current = node;
      if (node && typeof ResizeObserver !== "undefined") {
        roRef.current = new ResizeObserver(() => computePos());
        roRef.current.observe(node);
      }
      if (node) computePos();
    },
    [computePos],
  );

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
              ref={setPanelNode}
              className={
                "animate-popover-in fixed overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-xl " +
                (pos.above ? "origin-bottom" : "origin-top")
              }
              style={{
                top: pos.top,
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
