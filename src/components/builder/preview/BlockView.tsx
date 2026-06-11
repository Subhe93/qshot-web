import { Globe } from "lucide-react";
import type {
  Block,
  ButtonBlock,
  DividerBlock,
  HeaderBlock,
  ParagraphBlock,
  SocialLinksBlock,
  SpacerBlock,
} from "@/lib/types/blocks";
import { argbToCss } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";

/** Read-only renderer for a single block — mirrors the Nuxt renderer. */
export function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "HeaderBlock": {
      const b = block as HeaderBlock;
      return (
        <p
          dir={dirOf(b.value)}
          className="font-semibold text-foreground"
          style={{ fontSize: b.size, textAlign: b.align }}
        >
          {b.value}
        </p>
      );
    }
    case "ParagraphBlock": {
      const b = block as ParagraphBlock;
      return (
        <p
          dir={dirOf(b.content)}
          className="whitespace-pre-wrap text-sm text-muted-foreground"
        >
          {b.content}
        </p>
      );
    }
    case "ButtonBlock": {
      const b = block as ButtonBlock;
      const buttons = b.buttons ?? [];
      return (
        <div
          className={
            b.layout_type === "grid"
              ? "grid grid-cols-2 gap-2"
              : "flex flex-col gap-2"
          }
        >
          {buttons
            .filter((x) => !x.hidden)
            .map((btn) => (
              <a
                key={btn.id}
                href={btn.url || undefined}
                onClick={(e) => e.preventDefault()}
                className="flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
                style={{
                  backgroundColor:
                    (btn.useBackgroundColor &&
                      argbToCss(btn.backgroundColor)) ||
                    "var(--dark)",
                  color:
                    (btn.useTextColor && argbToCss(btn.textColor)) || "#fff",
                  borderRadius: btn.cornerRadius ?? 12,
                }}
              >
                {btn.title}
              </a>
            ))}
        </div>
      );
    }
    case "SocialLinksBlock": {
      const b = block as SocialLinksBlock;
      const links = b.links ?? [];
      const grid = b.layout_type?.toLowerCase().includes("grid");
      if (links.length === 0) {
        return (
          <p className="text-center text-xs text-muted-foreground/60">
            No social links yet
          </p>
        );
      }
      return (
        <div
          className={
            grid ? "flex flex-wrap justify-center gap-3" : "flex flex-col gap-2"
          }
        >
          {links.map((l, i) => (
            <a
              key={l.id ?? i}
              href={l.url || undefined}
              onClick={(e) => e.preventDefault()}
              className="flex items-center gap-2 text-sm capitalize text-foreground"
            >
              <Globe className="size-5" />
              {!grid && <span>{l.name || l.type}</span>}
            </a>
          ))}
        </div>
      );
    }
    case "DividerBlock": {
      const b = block as DividerBlock;
      return (
        <hr
          style={{
            borderColor:
              typeof b.color === "number"
                ? argbToCss(b.color)
                : (b.color ?? "#E4E7ED"),
            borderTopWidth: b.space || 1,
          }}
        />
      );
    }
    case "SpacerBlock": {
      const b = block as SpacerBlock;
      return <div style={{ height: b.space ?? 16 }} />;
    }
    default:
      return (
        <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
          {block.type}
        </div>
      );
  }
}
