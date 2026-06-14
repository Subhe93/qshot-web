"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook (defaults to false until mounted). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    setMatches(m.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

/** Booking wide breakpoint — mirrors the mobile kBookingWideBreakpoint (900px). */
export function useIsBookingWide() {
  return useMediaQuery("(min-width: 900px)");
}
