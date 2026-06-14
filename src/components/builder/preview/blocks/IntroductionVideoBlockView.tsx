import type { IntroductionVideoBlock } from "@/lib/types/blocks";
import { cdnUrl } from "@/lib/api/qrcodes";

/**
 * Read-only preview of an IntroductionVideoModule, mirroring the mobile
 * `UploadVideoWidget.buildContent`: a bordered, rounded-8 card showing the
 * thumbnail (BoxFit.cover) with a centered 60x60 translucent-white circular
 * play button (30x30 play glyph). The mobile widget has no layout_type
 * variants — there is a single video card layout.
 */
export function IntroductionVideoBlockView({
  block,
}: {
  block: IntroductionVideoBlock;
}) {
  const thumb = block.thumbnail_url;

  return (
    <div className="my-[5px]">
      <div
        className="relative mx-2 flex aspect-video items-center justify-center overflow-hidden rounded-lg"
        style={{
          // Border.all(color: Colors.black38) drawn outside + white 0.2 fill
          border: "1px solid rgba(0,0,0,0.38)",
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cdnUrl(thumb)}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          // Mobile shows the Qshot logo when there's no/failed thumbnail.
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/brand/logo.svg" alt="" className="absolute size-12 opacity-50" />
        )}

        {/* Centered 60x60 translucent-white circular play button */}
        <span
          className="relative flex size-[60px] items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
        >
          <svg width={30} height={30} viewBox="0 0 24 24" fill="#ffffff" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>

      {/* Faint divider under the card (mobile draws one: foreground @ 0.2). */}
      <div className="px-5 pt-2">
        <div
          className="mx-2 h-px"
          style={{ backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)" }}
        />
      </div>
    </div>
  );
}
