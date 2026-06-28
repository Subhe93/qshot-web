"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Pencil,
  Trash2,
  Loader2,
  Download,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  listQrCodes,
  deleteQrCode,
  getLaunchUrl,
  cdnUrl,
  type UserQr,
} from "@/lib/api/qrcodes";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Fetch a CDN file as a blob, falling back to opening it in a new tab. */
async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

export default function QrDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const t = useTranslations("qr");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Reuse the list query cache (the cards were rendered from it), falling back
  // to a fetch when the page is opened directly.
  const { data, isLoading } = useQuery({
    queryKey: ["qr-codes"],
    queryFn: listQrCodes,
  });
  const item = (data ?? []).find((q) => q._id === id) as UserQr | undefined;

  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: () => deleteQrCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      router.replace("/qr-codes");
    },
    onError: () => setToast(t("actionFailed")),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("loadError")}</p>
        <Link
          href="/qr-codes"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("title")}
        </Link>
      </div>
    );
  }

  const launchUrl = getLaunchUrl(item);
  const ver = item.updatedAt ?? item.createdAt ?? "";
  const bust = ver ? `?v=${encodeURIComponent(ver)}` : "";
  const pngUrl = cdnUrl(item.pngImage) + bust;
  const svgUrl = cdnUrl(item.svgImage) + bust;
  const cfg = typeof item.qrCode === "object" ? item.qrCode : null;
  const dynamic = cfg?.qr_type === "dynamic";
  const typeName = cfg?.name;
  const typeIcon = cfg?.icon ? cdnUrl(cfg.icon) : null;
  const createdAt = (() => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
        new Date(item.createdAt),
      );
    } catch {
      return "";
    }
  })();

  function fire(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(launchUrl ?? pngUrl);
      setCopied(true);
      fire(t("copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      fire(t("actionFailed"));
    }
  }
  async function share() {
    const url = launchUrl ?? pngUrl;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: item!.name, url });
      } catch {
        /* cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/qr-codes"
          aria-label={tc("back")}
          className="flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          {typeIcon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeIcon} alt="" className="size-5 shrink-0" />
          )}
          <h1 className="truncate text-xl font-bold">{item.name || "—"}</h1>
          {dynamic && (
            <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
              {t("dynamic")}
            </span>
          )}
        </div>
      </div>

      {/* QR image */}
      <div className="mt-5 flex items-center justify-center rounded-2xl border border-border bg-white p-6">
        {item.pngImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pngUrl}
            alt={item.name}
            className="aspect-square w-full max-w-[280px] object-contain"
          />
        ) : (
          <div className="aspect-square w-full max-w-[280px]" />
        )}
      </div>

      {/* Meta */}
      {(typeName || createdAt) && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          {[typeName, createdAt].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* Launch URL */}
      {launchUrl && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {launchUrl}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label={t("copy")}
            className="shrink-0 text-primary hover:text-primary/80"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      )}

      {/* Primary actions */}
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <Button
          variant="gradient"
          className="w-full"
          onClick={() => router.push(`/qr-codes/new?edit=${item._id}`)}
        >
          <Pencil className="size-4" />
          {tc("edit")}
        </Button>
        {launchUrl ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(launchUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="size-4" />
            {t("open")}
          </Button>
        ) : (
          <Button variant="outline" className="w-full" onClick={share}>
            <Share2 className="size-4" />
            {t("share")}
          </Button>
        )}
      </div>

      {/* Download */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => downloadFile(pngUrl, `${item.name || "qrcode"}.png`)}
        >
          <Download className="size-4" />
          PNG
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => downloadFile(svgUrl, `${item.name || "qrcode"}.svg`)}
        >
          <Download className="size-4" />
          SVG
        </Button>
      </div>

      {/* Secondary actions */}
      <div className="mt-2.5 flex items-center justify-between gap-2.5">
        <Button variant="outline" className="flex-1" onClick={share}>
          <Share2 className="size-4" />
          {t("share")}
        </Button>
        <Button
          variant="outline"
          className="flex-1 text-error hover:bg-error/10"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
          {tc("delete")}
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={t("deleteTitle")}
        message={t("deleteMsg")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => del.mutate()}
        onCancel={() => setConfirmDelete(false)}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-dark px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
