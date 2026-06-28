"use client";

import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";

/**
 * Rich text editor for the Paragraph block, matching the mobile ParagraphEditor
 * Quill toolbar: lists (check / bullet / ordered), strike / underline / italic /
 * bold, alignment, text direction (LTR/RTL) and links. Reads & writes
 * `block.content` as a Quill Delta JSON string (the app-wide contract), so the
 * output renders identically via QuillView and on the mobile app.
 *
 * Loaded via `next/dynamic({ ssr: false })` (Quill touches `document`).
 */

// Mirrors the mobile toolbar rows in the screenshot.
const TOOLBAR = [
  [{ list: "check" }, { list: "bullet" }, { list: "ordered" }],
  ["strike", "underline", "italic", "bold"],
  [{ align: "" }, { align: "center" }, { align: "right" }, { align: "justify" }],
  [{ direction: "rtl" }],
  ["link"],
];

export function QuillEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (deltaJson: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // Keep the latest onChange without re-initialising Quill.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    // Quill owns this element's DOM; React only manages the wrapper, so we can
    // safely clear it on cleanup (also avoids duplicate toolbars in StrictMode).
    const editorEl = document.createElement("div");
    wrap.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: "snow",
      modules: { toolbar: TOOLBAR },
    });

    // Seed the existing Delta (silent → doesn't fire onChange).
    try {
      const ops = JSON.parse(value);
      if (Array.isArray(ops)) {
        const DeltaCtor = Quill.import("delta") as new (ops: unknown[]) => unknown;
        quill.setContents(
          new DeltaCtor(ops) as Parameters<typeof quill.setContents>[0],
          "silent",
        );
      } else if (value) {
        quill.setText(value, "silent");
      }
    } catch {
      if (value) quill.setText(value, "silent");
    }

    const handler = () =>
      onChangeRef.current(JSON.stringify(quill.getContents().ops));
    quill.on("text-change", handler);

    return () => {
      quill.off("text-change", handler);
      wrap.innerHTML = "";
    };
    // Mount once. The parent remounts this (via `key={block.id}`) when switching
    // blocks, so `value` is intentionally not a dependency (Quill owns state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={wrapRef} className="builder-quill" />;
}
