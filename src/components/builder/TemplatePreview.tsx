import type { TemplateConfig } from "@/lib/builder/templates";

/** Real mobile template mockup image, used in the create wizard. */
export function TemplatePreview({ config }: { config: TemplateConfig }) {
  return (
    <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.image}
        alt={config.style}
        className="size-full object-cover"
      />
    </div>
  );
}
