"use client";

import { useCallback, useRef } from "react";

/** Nearest horizontally-scrollable ancestor of `start`, bounded by `root`. */
function scrollableXAncestor(
  start: EventTarget | null,
  root: HTMLElement,
): HTMLElement | null {
  let el = start instanceof Element ? start : null;
  while (el && el !== root) {
    if (el instanceof HTMLElement) {
      const s = getComputedStyle(el);
      if (
        (s.overflowX === "auto" || s.overflowX === "scroll") &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        return el;
      }
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Mouse drag-to-scroll, delegated from a single container. Block previews use
 * `overflow-x-auto` sliders with a hidden scrollbar — fine for touch/trackpad,
 * but a mouse can't drag them on desktop. Attaching this to the preview scroller
 * lets a left-button drag pan whichever nested horizontal slider it started on.
 * Touch/pen are left to native scrolling. A drag that moved suppresses the
 * trailing click so it doesn't open a link.
 *
 * Returns `{ ref, bind }` — put `ref` on the scroll container and spread `bind`
 * onto it. When `enabled` is false, `bind` is empty (no behavior change).
 */
export function useDragScroll(enabled: boolean) {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRef = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const state = useRef({
    el: null as HTMLElement | null,
    startX: 0,
    startLeft: 0,
    moved: false,
  });

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const root = rootRef.current;
    if (!root) return;
    const target = scrollableXAncestor(e.target, root);
    if (!target) return;
    state.current = {
      el: target,
      startX: e.clientX,
      startLeft: target.scrollLeft,
      moved: false,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const st = state.current;
    if (!st.el) return;
    const dx = e.clientX - st.startX;
    if (!st.moved && Math.abs(dx) > 4) st.moved = true;
    if (st.moved) {
      st.el.scrollLeft = st.startLeft - dx;
      e.preventDefault();
    }
  }, []);

  const end = useCallback(() => {
    state.current.el = null;
  }, []);

  // Capture phase: cancel the click that follows a real drag (before the link).
  const onClickCapture = useCallback((e: React.MouseEvent) => {
    if (state.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      state.current.moved = false;
    }
  }, []);

  // Kill the native image/link ghost-drag while panning.
  const onDragStart = useCallback((e: React.DragEvent) => {
    if (state.current.el) e.preventDefault();
  }, []);

  return {
    ref: setRef,
    bind: enabled
      ? {
          onPointerDown,
          onPointerMove,
          onPointerUp: end,
          onPointerLeave: end,
          onClickCapture,
          onDragStart,
        }
      : {},
  };
}
