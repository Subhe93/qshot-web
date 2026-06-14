import type { BookingBlock } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";
import { Foldable } from "../Foldable";

/**
 * Read-only preview of a BookingModule, mirroring the mobile `BookingWidget`
 * (lib/features/website/widget/editor/booking_widget.dart).
 *
 * The BookingModule has no `layout_type` variants — there is a single layout:
 *
 *  - Outer block: vertical 8px padding.
 *  - Header (only when the title is non-empty): title in `headlineMedium`
 *    bold, horizontal padding 24.
 *  - Body: horizontal 20 / vertical 8 padding, wrapping an inner Container with
 *    padding 20, rounded-14, fill = page foreground @ 4% opacity, hairline
 *    border = page foreground @ 10% opacity.
 *  - Inside, a centered Column:
 *      • calendar icon, size 36, color #4CAF50 @ 70% opacity
 *      • 10px gap
 *      • description text (bodySmall, centered, foreground @ 50%):
 *        "Booking widget will appear here on your website"
 *      • 14px gap
 *      • a button pill: horizontal 24 / vertical 10 padding, rounded-10, fill =
 *        brand primary @ 10% opacity, label in primary, weight 600.
 *
 * Foreground = page text color (currentColor); primary = brand color (--primary).
 */
export function BookingBlockView({ block }: { block: BookingBlock }) {
  const title = block.title ?? "";
  const buttonLabel = block.button_label ?? "Book Now";

  return (
    <div className="py-2">
      <Foldable
        foldable={block.foldable}
        header={
          title ? (
            <div className="px-6">
              <h2
                dir={dirOf(title)}
                className="text-2xl font-bold text-foreground"
              >
                {title}
              </h2>
            </div>
          ) : null
        }
      >
      <div className="px-5 py-2">
        <div
          className="flex flex-col items-center rounded-[14px] p-5"
          style={{
            backgroundColor: "color-mix(in srgb, currentColor 4%, transparent)",
            border: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
          }}
        >
          {/* Cupertino calendar icon, size 36, #4CAF50 @ 70% */}
          <svg
            width={36}
            height={36}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4CAF50"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          </svg>

          <div className="h-2.5" />

          <p
            className="text-center text-xs"
            style={{ color: "color-mix(in srgb, currentColor 50%, transparent)" }}
          >
            Booking widget will appear here on your website
          </p>

          <div className="h-3.5" />

          <span
            dir={dirOf(buttonLabel)}
            className="rounded-[10px] px-6 py-2.5 text-sm font-semibold text-primary"
            style={{
              backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
            }}
          >
            {buttonLabel}
          </span>
        </div>
      </div>
      </Foldable>
    </div>
  );
}
