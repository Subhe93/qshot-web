import { Fragment, type CSSProperties, type ReactNode } from "react";
import { dirOf } from "@/lib/builder/text-direction";
import { useDesktopPreview } from "./desktop-preview";

/**
 * Read-only renderer for a Quill Delta (mirrors the mobile `QuillViewer`).
 *
 * `ParagraphBlock.content` is a JSON-encoded Delta ops array. The mobile app
 * renders it with full rich formatting; this renders the common subset —
 * bold/italic/underline/strike/link/color, header levels, ordered/bullet lists,
 * blockquote and per-line alignment — so a paragraph authored on mobile looks
 * the same on the web. Falls back to plain text if the content isn't a Delta.
 *
 * Desktop pane (`useDesktopPreview`): mirrors the Nuxt renderer instead —
 * BaseRichText.vue + quill-delta-to-html (`inlineStyles: true`). Element
 * styling then comes from the `.quill-desktop` rules in globals.css; inline
 * sizes use the converter's defaults (small .75em / large 1.5em / huge 2.5em);
 * checklists, code blocks and inline code are rendered like the public site.
 * When not desktop, output is exactly the phone-canvas markup.
 */

type Attrs = Record<string, unknown>;
interface Seg {
  text: string;
  attrs: Attrs;
}
interface Line {
  segs: Seg[];
  block: Attrs;
}

function parseDelta(content: string): Line[] | null {
  let ops: unknown;
  try {
    ops = JSON.parse(content);
  } catch {
    return null;
  }
  if (!Array.isArray(ops)) return null;

  const lines: Line[] = [];
  let cur: Seg[] = [];
  for (const raw of ops as Array<{ insert?: unknown; attributes?: Attrs }>) {
    const insert = raw?.insert;
    if (typeof insert !== "string") continue; // skip embeds (images/video)
    const parts = insert.split("\n");
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        // The newline op carries the block-level attributes for the line ended.
        lines.push({ segs: cur, block: raw.attributes ?? {} });
        cur = [];
      }
      const text = parts[i];
      if (text) cur.push({ text, attrs: raw.attributes ?? {} });
    }
  }
  if (cur.length) lines.push({ segs: cur, block: {} });
  return lines;
}

function inlineStyle(a: Attrs, desktop: boolean): CSSProperties {
  const style: CSSProperties = {};
  if (typeof a.color === "string") style.color = a.color;
  if (typeof a.background === "string") style.backgroundColor = a.background;
  if (a.bold) style.fontWeight = 700;
  if (a.italic) style.fontStyle = "italic";
  const deco: string[] = [];
  if (a.underline) deco.push("underline");
  if (a.strike) deco.push("line-through");
  if (deco.length) style.textDecoration = deco.join(" ");
  // Desktop = quill-delta-to-html defaults (OpToHtmlConverter.js:21-24).
  if (a.size === "large") style.fontSize = desktop ? "1.5em" : "1.25em";
  else if (a.size === "huge") style.fontSize = desktop ? "2.5em" : "1.5em";
  else if (a.size === "small") style.fontSize = desktop ? "0.75em" : "0.85em";
  return style;
}

function renderSeg(seg: Seg, key: number, desktop: boolean): ReactNode {
  const a = seg.attrs;
  const style = inlineStyle(a, desktop);
  if (typeof a.link === "string") {
    return (
      <a
        key={key}
        href={a.link}
        target="_blank"
        rel="noreferrer noopener"
        // Desktop link colour/underline comes from `.quill-desktop a` (#4a9eff).
        className={desktop ? undefined : "text-primary underline"}
        style={style}
      >
        {seg.text}
      </a>
    );
  }
  // Desktop: inline code renders as monospace <code> (BaseRichText.vue:136-142).
  if (desktop && a.code) {
    return (
      <code key={key} style={style}>
        {seg.text}
      </code>
    );
  }
  return (
    <span key={key} style={style}>
      {seg.text}
    </span>
  );
}

function lineNodes(line: Line, desktop: boolean): ReactNode {
  if (!line.segs.length) return <br />;
  return line.segs.map((s, i) => renderSeg(s, i, desktop));
}

function alignStyle(block: Attrs): CSSProperties | undefined {
  const a = block.align;
  return a === "center" || a === "right" || a === "justify"
    ? { textAlign: a as CSSProperties["textAlign"] }
    : undefined;
}

/** Explicit block-level text direction stored in the Delta (mobile sets it via
 *  the Quill LTR/RTL toggle); null = none, so the caller auto-detects. */
function explicitDir(lines: Line[]): "ltr" | "rtl" | null {
  for (const l of lines) {
    const d = l.block.direction;
    if (d === "rtl" || d === "ltr") return d;
  }
  return null;
}

export function QuillView({ content }: { content: string }) {
  const desktop = useDesktopPreview();
  const lines = parseDelta(content);

  // Fallback: not a Delta — render as plain text.
  if (!lines) {
    return (
      <p dir={dirOf(content)} className="whitespace-pre-wrap leading-relaxed">
        {content}
      </p>
    );
  }

  const plain = lines
    .map((l) => l.segs.map((s) => s.text).join(""))
    .join("\n");

  const out: ReactNode[] = [];
  let listBuf: {
    type: "bullet" | "ordered" | "check";
    items: { line: Line; checked?: boolean }[];
  } | null = null;
  // Desktop only: consecutive `code-block` lines merge into one <pre>, like
  // the quill-delta-to-html output the public site renders.
  let codeBuf: Line[] | null = null;

  const flushList = () => {
    if (!listBuf) return;
    const items = listBuf.items.map(({ line: l, checked }, i) => (
      <li
        key={i}
        style={alignStyle(l.block)}
        data-checked={checked === undefined ? undefined : String(checked)}
      >
        {lineNodes(l, desktop)}
      </li>
    ));
    out.push(
      listBuf.type === "ordered" ? (
        <ol key={out.length} className={desktop ? undefined : "ms-5 list-decimal space-y-1"}>
          {items}
        </ol>
      ) : (
        <ul key={out.length} className={desktop ? undefined : "ms-5 list-disc space-y-1"}>
          {items}
        </ul>
      ),
    );
    listBuf = null;
  };

  const flushCode = () => {
    if (!codeBuf) return;
    const body: ReactNode[] = [];
    codeBuf.forEach((l, i) => {
      if (i > 0) body.push("\n");
      body.push(<Fragment key={i}>{l.segs.map((s, j) => renderSeg(s, j, desktop))}</Fragment>);
    });
    out.push(<pre key={out.length}>{body}</pre>);
    codeBuf = null;
  };

  for (const line of lines) {
    const list = line.block.list;
    if (list === "bullet" || list === "ordered") {
      flushCode();
      if (listBuf && listBuf.type !== list) flushList();
      if (!listBuf) listBuf = { type: list, items: [] };
      listBuf.items.push({ line });
      continue;
    }
    // Desktop: checklist lines render as a checkbox list (BaseRichText.vue:76-109);
    // the phone canvas keeps its existing behaviour (plain paragraph fall-through).
    if (desktop && (list === "checked" || list === "unchecked")) {
      flushCode();
      if (listBuf && listBuf.type !== "check") flushList();
      if (!listBuf) listBuf = { type: "check", items: [] };
      listBuf.items.push({ line, checked: list === "checked" });
      continue;
    }
    flushList();

    if (desktop && line.block["code-block"]) {
      if (!codeBuf) codeBuf = [];
      codeBuf.push(line);
      continue;
    }
    flushCode();

    const key = out.length;
    const style = alignStyle(line.block);
    const content2 = lineNodes(line, desktop);
    const header = line.block.header;

    // Desktop header/blockquote markup matches the Nuxt converter output
    // (h1/h2/h3, bare blockquote); styling lives in `.quill-desktop` CSS.
    if (header === 1) {
      out.push(
        desktop
          ? <h1 key={key} style={style}>{content2}</h1>
          : <h2 key={key} className="text-2xl font-bold" style={style}>{content2}</h2>,
      );
    } else if (header === 2) {
      out.push(
        desktop
          ? <h2 key={key} style={style}>{content2}</h2>
          : <h3 key={key} className="text-xl font-bold" style={style}>{content2}</h3>,
      );
    } else if (header === 3) {
      out.push(
        desktop
          ? <h3 key={key} style={style}>{content2}</h3>
          : <h4 key={key} className="text-lg font-semibold" style={style}>{content2}</h4>,
      );
    } else if (line.block.blockquote) {
      out.push(
        <blockquote
          key={key}
          className={desktop ? undefined : "border-s-2 border-border ps-3 italic text-muted-foreground"}
          style={style}
        >
          {content2}
        </blockquote>,
      );
    } else {
      out.push(<p key={key} style={style}>{content2}</p>);
    }
  }
  flushList();
  flushCode();

  return (
    // Honor an explicit stored direction; otherwise auto-detect from the text.
    <div
      dir={explicitDir(lines) ?? dirOf(plain)}
      className={desktop ? "quill-desktop" : "space-y-1.5 leading-relaxed"}
    >
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </div>
  );
}
