"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Plus,
  QrCode,
  LayoutGrid,
  List,
  ScanLine,
  ChevronDown,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { listQrCodes, type UserQr } from "@/lib/api/qrcodes";
import { SavedQrCard, type QrView } from "@/components/qr/saved-qr-card";
import { cn } from "@/lib/utils";

type SortOrder = "newest" | "oldest";

/** Most-recent edit OR creation time, in ms (mirrors the list version key). */
function qrTime(q: UserQr): number {
  const ts = Date.parse(q.updatedAt || q.createdAt || "");
  return Number.isNaN(ts) ? 0 : ts;
}

export default function QrCodesPage() {
  const t = useTranslations("qr");
  const tn = useTranslations("nav");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["qr-codes"],
    queryFn: listQrCodes,
  });

  const [view, setView] = useState<QrView>("gallery");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  // Always sort by most-recent edit/creation; default newest-first.
  const items = [...(data ?? [])].sort((a, b) =>
    sort === "newest" ? qrTime(b) - qrTime(a) : qrTime(a) - qrTime(b),
  );
  const empty = !isLoading && (isError || items.length === 0);

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {/* Scan QR moved here from the sidebar. */}
          <Link
            href="/scan"
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            <ScanLine className="size-4 shrink-0" />
            {tn("scanQr")}
          </Link>
          <Link
            href="/qr-codes/new"
            className="brand-gradient flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-white hover:opacity-90 sm:px-5"
          >
            <Plus className="size-4 shrink-0" />
            {t("generate")}
          </Link>
        </div>
      </div>

      {/* Sort + view toolbar (only when there are saved codes). */}
      {items.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-2">
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOrder)}
              aria-label={t("sortNewest")}
              className="h-10 appearance-none rounded-lg border border-border bg-card pe-9 ps-3 text-sm font-medium text-foreground outline-none hover:bg-muted focus:border-primary"
            >
              <option value="newest">{t("sortNewest")}</option>
              <option value="oldest">{t("sortOldest")}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            {(
              [
                ["gallery", LayoutGrid],
                ["list", List],
              ] as const
            ).map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                aria-label={t(mode === "gallery" ? "viewGallery" : "viewList")}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md transition-colors",
                  view === mode
                    ? "brand-tint text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        {isLoading && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl border border-border bg-muted"
              />
            ))}
          </div>
        )}

        {empty && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <QrCode className="size-12 text-muted-foreground/50" />
            <p className="mt-4 font-semibold text-foreground">{t("empty")}</p>
            <p className="mt-1 max-w-sm whitespace-pre-line text-sm text-muted-foreground">
              {t("emptyDesc")}
            </p>
            <Link
              href="/qr-codes/new"
              className="brand-gradient mt-5 inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-white hover:opacity-90"
            >
              <Plus className="size-4" />
              {t("generate")}
            </Link>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          view === "gallery" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((q, i) => (
                <SavedQrCard key={q._id ?? i} item={q} notify={setToast} view="gallery" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((q, i) => (
                <SavedQrCard key={q._id ?? i} item={q} notify={setToast} view="list" />
              ))}
            </div>
          )
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-dark px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
