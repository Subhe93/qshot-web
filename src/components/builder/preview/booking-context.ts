"use client";

import { createContext, useContext } from "react";

/**
 * The REAL profile id whose public services tree the booking block should
 * fetch, or `null` when there is nothing to fetch from — the web twin of the
 * mobile `editor.previewOnly` rule (booking_widget.dart): a template preview
 * card or a dashboard tile renders a site that is not a real profile, so the
 * block draws the old call-to-action placeholder instead of hitting the API.
 *
 * Provided by BuilderCanvas (and only there) with the site's id.
 */
export const BookingProfileContext = createContext<string | null>(null);

export function useBookingProfileId(): string | null {
  return useContext(BookingProfileContext);
}
