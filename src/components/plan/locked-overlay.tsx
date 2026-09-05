"use client";

import { Lock } from "lucide-react";
import { useUpgradeDialog } from "./upgrade-dialog";

/**
 * The web mirror of mobile `Utils.availabilityChecker`: content the plan no
 * longer covers (the server marked the row `status:false` after a downgrade)
 * stays visible but blurred and inert, with a lock in the middle; tapping
 * opens the upgrade dialog. When `available`, children render untouched.
 * Admin bypass happens upstream — the server never marks an admin's rows.
 */
export function PlanLockedOverlay({
  available,
  children,
  className,
}: {
  available: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const show = useUpgradeDialog((s) => s.show);
  if (available) return <>{children}</>;
  return (
    // Rounding comes from the caller (cards differ) — pass it via className.
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div className="pointer-events-none select-none blur-[3px]" aria-hidden>
        {children}
      </div>
      <button
        type="button"
        onClick={show}
        className="absolute inset-0 z-10 flex items-center justify-center bg-background/10"
      >
        <span className="brand-gradient flex size-10 items-center justify-center rounded-full text-white shadow-lg">
          <Lock className="size-5" />
        </span>
      </button>
    </div>
  );
}
