import type { EmbedBlock } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";

/**
 * Read-only preview of an EmbedModule, mirroring the mobile `EmbedWidget` +
 * `EmbedBuilder` (lib/features/website/widget/editor/embed_widget.dart):
 *
 *   - Outer EditorArea: margin vertical 5, optional background color.
 *   - Inner Padding: EdgeInsets.symmetric(horizontal: 20, vertical: 16).
 *   - EmbedBuilder renders `embedData.html` inside a webview (SocialEmbed):
 *       • When `aspectRatio` is set → Center + AspectRatio(aspectRatio).
 *       • Otherwise → ConstrainedBox(maxHeight: 1000) with dynamic height.
 *
 * The Embed block has no `layout_type` variants in the mobile app; the only
 * rendering branch is aspect-ratio-present vs. dynamic-size, plus the html
 * source (oembed provider html or raw custom HTML). We render the html in a
 * sandboxed iframe via `srcDoc`; if there is no html we fall back to an
 * iframe of `data.url`.
 */
export function EmbedBlockView({ block }: { block: EmbedBlock }) {
  const data = block.data ?? {};
  const html = data.html?.trim();
  const url = data.url?.trim();
  const aspectRatio = data.aspectRatio ?? null;

  // NOTE: block background is applied by the canvas wrapper (SortableBlock /
  // PreviewBlock) for every block — don't re-apply it here (avoids double-fill).
  return (
    <div className="my-[5px]">
      <div className="px-5 py-4">
        <EmbedFrame html={html} url={url} aspectRatio={aspectRatio} />
      </div>
    </div>
  );
}

function EmbedFrame({
  html,
  url,
  aspectRatio,
}: {
  html?: string;
  url?: string;
  aspectRatio: number | null;
}) {
  // Nothing to render yet — show a neutral placeholder so the block stays
  // visible/selectable in the builder (mobile shows an empty webview here).
  if (!html && !url) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-black/20 bg-black/[0.03] text-sm text-black/40"
        style={{ aspectRatio: aspectRatio ?? 16 / 9 }}
        dir={dirOf("Embed")}
      >
        Embed
      </div>
    );
  }

  // The iframe content. Custom HTML / oembed html is wrapped so it fills the
  // frame width (mirrors mobile SocialEmbed sizing the html to 100%).
  const srcDoc = html
    ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>html,body{margin:0;padding:0;overflow:hidden;width:100%;}*{max-width:100%;}iframe,img,video{max-width:100%;border:0;}</style></head><body>${html}</body></html>`
    : undefined;

  const common = {
    title: "embed",
    // Sandbox the embed: allow scripts (oembed widgets need them) + same-origin
    // for srcDoc, popups, and presentation for video fullscreen.
    sandbox:
      "allow-scripts allow-same-origin allow-popups allow-presentation allow-forms",
    allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
    referrerPolicy: "no-referrer" as const,
    loading: "lazy" as const,
    className: "block size-full border-0",
  };

  // With aspect ratio → Center + AspectRatio(aspectRatio).
  if (aspectRatio != null) {
    return (
      <div className="flex w-full justify-center">
        <div className="w-full" style={{ aspectRatio }}>
          {srcDoc ? (
            <iframe {...common} srcDoc={srcDoc} />
          ) : (
            <iframe {...common} src={url} />
          )}
        </div>
      </div>
    );
  }

  // Without aspect ratio → ConstrainedBox(maxHeight: 1000), dynamic height.
  // We approximate dynamic sizing with a sensible default height capped at the
  // mobile 1000px ceiling.
  return (
    <div className="w-full" style={{ maxHeight: 1000 }}>
      {srcDoc ? (
        <iframe {...common} srcDoc={srcDoc} className="block w-full border-0" style={{ height: 600, maxHeight: 1000 }} />
      ) : (
        <iframe {...common} src={url} className="block w-full border-0" style={{ height: 600, maxHeight: 1000 }} />
      )}
    </div>
  );
}
