"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, X, ImagePlus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { postFeedback } from "@/lib/api/feedback";
import { cn } from "@/lib/utils";

export function FeedbackButton({ className }: { className?: string }) {
  const t = useTranslations("feedback");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-full bg-foreground/[0.07] px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:bg-foreground/10",
          className,
        )}
      >
        <MessageSquare className="size-3.5" />
        {t("title")}
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
}

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("feedback");
  const [message, setMessage] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function submit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      await postFeedback(message, image);
      setSent(true);
      setTimeout(onClose, 1200);
    } catch {
      // keep open on error
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full overflow-hidden rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl">
        {/* Soft green gradient glow at the top */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{
            background:
              "linear-gradient(180deg, rgba(125,216,213,0.35) 0%, rgba(125,216,213,0) 100%)",
          }}
          aria-hidden
        />
        {/* Header */}
        <div className="relative flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-[#7dd8d5]/20 text-[#14a89f]">
            <MessageSquare className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{t("title")}</h2>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#14a89f]">
              {t("subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-border"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Image upload */}
        <p className="mt-5 text-sm text-muted-foreground">{t("image")}</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-border bg-muted/40 py-7"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              className="max-h-28 rounded-lg object-contain"
            />
          ) : (
            <>
              <ImagePlus className="size-7 text-muted-foreground" />
              <span className="text-sm font-medium text-primary">
                {t("upload")}
              </span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickImage}
        />

        {/* Thoughts */}
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("placeholder")}
          className="mt-4 min-h-28 rounded-2xl"
        />

        <button
          type="button"
          onClick={submit}
          disabled={sending || sent || !message.trim()}
          className="brand-gradient mt-4 h-12 w-full rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {sent ? t("sent") : t("send")}
        </button>
      </div>
    </div>
  );
}
