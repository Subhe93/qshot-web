"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cdnUrl, type QrInstructions } from "@/lib/api/qrcodes";

/** Modal that shows an attribute's help content (title, steps, images, video). */
export function InstructionsDialog({
  instructions,
  title,
  onClose,
}: {
  instructions: QrInstructions;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{instructions.title || title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {instructions.explanation && instructions.explanation.length > 0 && (
          <ol className="mt-4 list-decimal space-y-2 ps-5 text-sm text-muted-foreground">
            {instructions.explanation.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}

        {instructions.images && instructions.images.length > 0 && (
          <div className="mt-4 space-y-3">
            {instructions.images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={cdnUrl(img)}
                alt=""
                className="w-full rounded-lg border border-border"
              />
            ))}
          </div>
        )}

        {instructions.video_url && (
          <a
            href={instructions.video_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            {instructions.video_url}
          </a>
        )}
      </div>
    </div>
  );
}
