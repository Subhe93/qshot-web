"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { markBookingDashboardOpened } from "./use-booking-tree";

/**
 * "Manage booking" from inside the builder (the block sheet and the owner
 * notice). Mobile PUSHES the dashboard over the sheet so the block's unsaved
 * edits are still there on the way back. The web builder is a route that
 * remounts from the server, so an in-place push would drop the open sheet and
 * any edit younger than the 1.5s auto-save debounce: the dashboard opens in a
 * NEW tab instead, which keeps this tab exactly as it is. The tree is dropped
 * when this window regains focus (useBookingFocusInvalidation).
 */
export function useOpenBookingDashboard(): (profileId: string) => void {
  const locale = useLocale();
  return useCallback(
    (profileId: string) => {
      const path = getPathname({ href: `/sites/${profileId}/booking`, locale });
      markBookingDashboardOpened(profileId);
      window.open(path, "_blank", "noopener");
    },
    [locale],
  );
}
