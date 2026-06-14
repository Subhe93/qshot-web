"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, RefreshCw, CameraOff, ImageUp } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

/**
 * QR scanner mirroring the mobile scanner: a live camera viewfinder with a
 * corner-bracket frame plus "scan from image" upload, then a result panel with
 * Open / Copy / Scan-again. Uses @zxing/browser (dynamically imported, SSR-safe).
 */
export function QrScanner() {
  const t = useTranslations("scan");
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [session, setSession] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stopped = false;

    (async () => {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const reader = new BrowserQRCodeReader();
        const video = videoRef.current;
        if (video) video.muted = true; // React doesn't reliably set the muted prop
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video ?? undefined,
          (res, _err, ctrls) => {
            if (res && !stopped) {
              stopped = true;
              setResult(res.getText());
              ctrls.stop();
            }
          },
        );
        controlsRef.current = controls;
        if (stopped) controls.stop();
      } catch {
        if (!stopped) setError(true);
      }
    })();

    return () => {
      stopped = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [session]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImgError(false);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const res = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      controlsRef.current?.stop();
      setResult(res.getText());
    } catch {
      setImgError(true);
      setTimeout(() => setImgError(false), 2500);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function scanAgain() {
    setResult(null);
    setError(false);
    setImgError(false);
    setCopied(false);
    setSession((s) => s + 1);
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const isUrl = result ? /^https?:\/\//i.test(result) : false;

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="size-full object-cover"
        />

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 p-6 text-center text-white">
            <CameraOff className="size-10 opacity-70" />
            <p className="text-sm">{t("cameraError")}</p>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative size-56">
              <span className="absolute left-0 top-0 size-9 rounded-tl-xl border-l-4 border-t-4 border-white" />
              <span className="absolute right-0 top-0 size-9 rounded-tr-xl border-r-4 border-t-4 border-white" />
              <span className="absolute bottom-0 left-0 size-9 rounded-bl-xl border-b-4 border-l-4 border-white" />
              <span className="absolute bottom-0 right-0 size-9 rounded-br-xl border-b-4 border-r-4 border-white" />
              {!result && (
                <span className="qr-scanline absolute inset-x-2 h-0.5 rounded bg-primary shadow-[0_0_12px_2px] shadow-primary" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Upload-to-scan */}
      {!result && (
        <div className="mx-auto mt-4 flex max-w-md flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
          >
            <ImageUp className="size-4" />
            {t("fromImage")}
          </button>
          {imgError ? (
            <p className="text-xs text-error">{t("noQrFound")}</p>
          ) : (
            !error && (
              <p className="text-center text-sm text-muted-foreground">
                {t("instruction")}
              </p>
            )
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
        </div>
      )}

      {result && (
        <div className="mx-auto mt-5 max-w-md rounded-2xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("detected")}
          </p>
          <p className="mt-1 break-all text-sm font-medium text-foreground">
            {result}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isUrl && (
              <a
                href={result}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-gradient inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white hover:opacity-90"
              >
                <ExternalLink className="size-4" />
                {t("open")}
              </a>
            )}
            <button
              type="button"
              onClick={copy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Copy className="size-4" />
              {copied ? t("copied") : t("copy")}
            </button>
            <button
              type="button"
              onClick={scanAgain}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <RefreshCw className="size-4" />
              {t("scanAgain")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
