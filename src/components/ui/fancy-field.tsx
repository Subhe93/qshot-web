import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Text field matching the mobile app's FancyTextField:
 * label above, white filled input (h-44, radius 10, grey.200 border),
 * a gradient-tinted square icon box on the leading side, optional suffix.
 */
interface FancyFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  iconSrc: string;
  error?: string;
  suffix?: React.ReactNode;
}

export const FancyField = React.forwardRef<HTMLInputElement, FancyFieldProps>(
  ({ label, iconSrc, error, suffix, className, id, ...props }, ref) => {
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1.5 block text-xs font-normal text-muted-foreground"
        >
          {label}
        </label>
        <div
          className={cn(
            "flex h-11 items-center rounded-[10px] border bg-white pe-3 ps-1",
            error ? "border-error" : "border-input",
          )}
        >
          <span
            className="me-3 flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundImage:
                "linear-gradient(135deg, rgba(195,137,255,0.1), rgba(68,136,255,0.1))",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} alt="" width={16} height={16} aria-hidden />
          </span>
          <input
            ref={ref}
            id={id}
            className={cn(
              "h-full w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-[#bbbdc3]",
              className,
            )}
            {...props}
          />
          {suffix && <span className="ms-2 shrink-0">{suffix}</span>}
        </div>
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  },
);
FancyField.displayName = "FancyField";
