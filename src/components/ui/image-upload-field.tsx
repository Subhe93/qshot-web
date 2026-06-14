"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus, ImageIcon } from "lucide-react";
import { uploadImage } from "@/lib/api/media";
import { cdnUrl } from "@/lib/api/qrcodes";
import { ImageCropper } from "./image-cropper";

/**
 * Square image picker that crops 1:1 (like the mobile ImageCropper) then uploads
 * to the backend (q-profile/image/create) and stores the returned CDN file_name.
 * `value` is a stored file_name (or full URL); resolved for display via cdnUrl.
 */
export function ImageUploadField({
  value,
  onChange,
  size = 60,
}: {
  value?: string | null;
  onChange: (fileName: string | undefined) => void;
  size?: number;
}) {
  const t = useTranslations("builder");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFailed(false);
    setCropSrc(URL.createObjectURL(file));
  }

  async function onCropped(blob: Blob) {
    setBusy(true);
    try {
      const file = new File([blob], "icon.jpg", { type: "image/jpeg" });
      onChange(await uploadImage(file));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
      closeCropper();
    }
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  const src = value ? cdnUrl(value) : undefined;
  const pick = () => inputRef.current?.click();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={pick}
        className="flex size-full items-center justify-center overflow-hidden rounded-xl border border-border bg-surface"
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        ) : src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-5 text-muted-foreground" />
        )}
      </button>
      <button
        type="button"
        onClick={pick}
        aria-label="Change image"
        className="absolute -bottom-1.5 -end-1.5 flex size-7 items-center justify-center rounded-full border border-border bg-card text-primary shadow-sm"
      >
        {value ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      {failed && (
        <span className="absolute -bottom-5 start-0 text-[10px] text-error">
          {t("uploadFailed")}
        </span>
      )}

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          title={t("cropTitle")}
          cancelLabel={t("colorPicker.cancel")}
          confirmLabel={t("cropConfirm")}
          onCancel={closeCropper}
          onCropped={onCropped}
        />
      )}
    </div>
  );
}
