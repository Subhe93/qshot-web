import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { cn } from "@/lib/utils";

/**
 * FontAwesome icon filled with the brand purple→blue gradient, mirroring the
 * mobile app's ShaderMask icons. Pass `gradient={false}` for a plain currentColor
 * icon. Requires <BrandIconDefs /> mounted once in the tree.
 */
export function BrandIcon({
  icon,
  size = 18,
  gradient = true,
  className,
}: {
  icon: IconDefinition;
  size?: number;
  gradient?: boolean;
  className?: string;
}) {
  return (
    <FontAwesomeIcon
      icon={icon}
      className={cn(gradient && "brand-icon", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Hidden SVG holding the #brandGrad gradient used by .brand-icon. Mount once. */
export function BrandIconDefs() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C389FF" />
          <stop offset="100%" stopColor="#4488FF" />
        </linearGradient>
      </defs>
    </svg>
  );
}
