import { Fragment, type CSSProperties, type ReactNode } from "react";
import { dirOf } from "@/lib/builder/text-direction";

/**
 * Read-only renderer for a Quill Delta (mirrors the mobile `QuillViewer`).
 *
 * `ParagraphBlock.content` is a JSON-encoded Delta ops array. The mobile app
 * renders it with full rich formatting; this renders the common subset —
 * bold/italic/underline/strike/link/color, header levels, ordered/bullet lists,
 * blockquote and per-line alignment — so a paragraph authored on mobile looks
 * the same on the web. Falls back to plain text if the content isn't a Delta.
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

function inlineStyle(a: Attrs): CSSProperties {
  const style: CSSProperties = {};
  if (typeof a.color === "string") style.color = a.color;
  if (typeof a.background === "string") style.backgroundColor = a.background;
  if (a.bold) style.fontWeight = 700;
  if (a.italic) style.fontStyle = "italic";
  const deco: string[] = [];
  if (a.underline) deco.push("underline");
  if (a.strike) deco.push("line-through");
  if (deco.length) style.textDecoration = deco.join(" ");
  if (a.size === "large") style.fontSize = "1.25em";
  else if (a.size === "huge") style.fontSize = "1.5em";
  else if (a.size === "small") style.fontSize = "0.85em";
  return style;
}

function renderSeg(seg: Seg, key: number): ReactNode {
  const a = seg.attrs;
  const style = inlineStyle(a);
  if (typeof a.link === "string") {
    return (
      <a
        key={key}
        href={a.link}
        target="_blank"
        rel="noreferrer noopener"
        className="text-primary underline"
        style={style}
      >
        {seg.text}
      </a>
    );
  }
  return (
    <span key={key} style={style}>
      {seg.text}
    </span>
  );
}

function lineNodes(line: Line): ReactNode {
  if (!line.segs.length) return <br />;
  return line.segs.map(renderSeg);
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
  let listBuf: { type: "bullet" | "ordered"; items: Line[] } | null = null;

  const flushList = () => {
    if (!listBuf) return;
    const items = listBuf.items.map((l, i) => (
      <li key={i} style={alignStyle(l.block)}>
        {lineNodes(l)}
      </li>
    ));
    out.push(
      listBuf.type === "ordered" ? (
        <ol key={out.length} className="ms-5 list-decimal space-y-1">
          {items}
        </ol>
      ) : (
        <ul key={out.length} className="ms-5 list-disc space-y-1">
          {items}
        </ul>
      ),
    );
    listBuf = null;
  };

  for (const line of lines) {
    const list = line.block.list;
    if (list === "bullet" || list === "ordered") {
      if (listBuf && listBuf.type !== list) flushList();
      if (!listBuf) listBuf = { type: list, items: [] };
      listBuf.items.push(line);
      continue;
    }
    flushList();

    const key = out.length;
    const style = alignStyle(line.block);
    const content2 = lineNodes(line);
    const header = line.block.header;

    if (header === 1) {
      out.push(<h2 key={key} className="text-2xl font-bold" style={style}>{content2}</h2>);
    } else if (header === 2) {
      out.push(<h3 key={key} className="text-xl font-bold" style={style}>{content2}</h3>);
    } else if (header === 3) {
      out.push(<h4 key={key} className="text-lg font-semibold" style={style}>{content2}</h4>);
    } else if (line.block.blockquote) {
      out.push(
        <blockquote key={key} className="border-s-2 border-border ps-3 italic text-muted-foreground" style={style}>
          {content2}
        </blockquote>,
      );
    } else {
      out.push(<p key={key} style={style}>{content2}</p>);
    }
  }
  flushList();

  return (
    // Honor an explicit stored direction; otherwise auto-detect from the text.
    <div dir={explicitDir(lines) ?? dirOf(plain)} className="space-y-1.5 leading-relaxed">
      {out.map((node, i) => (
        <Fragment key={i}>{node}</Fragment>
      ))}
    </div>
  );
}
