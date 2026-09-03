"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook (defaults to false until mounted). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    // Deferred: state updates must not run synchronously in an effect body.
    const handle = setTimeout(() => setMatches(m.matches), 0);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => {
      clearTimeout(handle);
      m.removeEventListener("change", handler);
    };
  }, [query]);
  return matches;
}

/** Booking wide breakpoint — mirrors the mobile kBookingWideBreakpoint (900px). */
export function useIsBookingWide() {
  return useMediaQuery("(min-width: 900px)");
}
