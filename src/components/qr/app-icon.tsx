import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders one of the app's SVG icons recolored to the current text color via a
 * CSS mask — mirrors the mobile `ColorFilter(srcIn)` tinting. Pass sizing/color
 * through `className` (e.g. "size-5 text-muted-foreground").
 */
export function AppIcon({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("app-icon", className)}
      style={{ "--icon": `url(${src})` } as CSSProperties}
    />
  );
}
