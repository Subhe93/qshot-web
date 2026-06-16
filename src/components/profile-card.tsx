"use client";

import { useRef, useState } from "react";
import {
  Globe,
  PieChart,
  QrCode,
  Share2,
  Mail,
  Trash2,
  Loader2,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { cdnUrl } from "@/lib/api/qrcodes";
import { deleteProfile } from "@/lib/api/profiles";
import { Hero } from "@/components/builder/preview/Hero";
import { BlockView } from "@/components/builder/preview/BlockView";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import type { Profile, ProfileSummary } from "@/lib/types/profile";
import type { Block } from "@/lib/types/blocks";

/**
 * Website tile — mirrors the mobile home website card: a live preview at top,
 * an info row (logo + name + domain + unread badge), and an action toolbar.
 */
export function ProfileCard({ profile }: { profile: ProfileSummary }) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const id = profile._id ?? profile.id ?? "";

  const del = useMutation({
    mutationFn: () => deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      setConfirm(false);
    },
  });
  const p = profile as Profile & {
    user_name?: string;
    websiteName?: string;
    unreadContactFormMessages?: number;
  };
  const settings = p.settings;
  // Settings may use the create-time keys (websiteName/websiteLogo) or the
  // render-time keys (name.text / logo.image_url).
  const s = (settings ?? {}) as {
    websiteName?: string;
    websiteLogo?: string;
  };

  const name =
    s.websiteName ||
    (typeof settings?.name === "object" ? settings?.name?.text : "") ||
    profile.name;
  const logo =
    s.websiteLogo || (settings?.logo as { image_url?: string })?.image_url;
  const slug = p.user_name || profile.name || "me";
  const domain = `${slug}.qshot.com`;
  const unread = p.unreadContactFormMessages ?? 0;
  // Blocks live under info.modules (mobile WebpageEntity); fall back to legacy.
  const modules =
    p.info?.modules ?? (settings?.modules as Block[] | undefined) ?? [];

  const open = () => router.push(`/builder/${id}`);

  const url = `https://${domain}`;
  const [qrOpen, setQrOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const qrWrap = useRef<HTMLDivElement>(null);

  function copyLink() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  function downloadQr() {
    const canvas = qrWrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${slug}-qr.png`;
    a.click();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[22px] bg-white shadow-soft">
      {/* Live preview — a div (not a button) because the rendered website blocks
          contain their own <button>/<a> elements; nesting a button in a button is
          invalid HTML and breaks hydration. The inner content is pointer-events-
          none, so the whole tile opens the builder. */}
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="block min-h-0 w-full flex-1 cursor-pointer overflow-hidden border-b border-border/60 text-start"
      >
        <div className="pointer-events-none w-full origin-top">
          {settings ? (
            <>
              <Hero settings={settings} />
              <div className="flex flex-col gap-2 px-4 pb-4 pt-2">
                {modules.slice(0, 4).map((b) => (
                  <BlockView key={b.id} block={b} />
                ))}
              </div>
            </>
          ) : (
            <div className="brand-gradient flex h-full min-h-50 items-center justify-center">
              <span className="text-3xl font-bold text-white/90">
                {name?.slice(0, 1)?.toUpperCase() ?? "Q"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3">
        {/* Info row */}
        <div className="flex items-center gap-2">
          <span className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-black/[0.08]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cdnUrl(logo)}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Globe className="size-3.5 text-black/50" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{name}</p>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] text-black/50">{domain}</span>
              {unread > 0 && (
                <span className="flex shrink-0 items-center gap-0.5">
                  <span className="size-1.5 rounded-full bg-[#d73c3c]" />
                  <span className="text-[10px] font-semibold text-[#d73c3c]">
                    {unread}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action toolbar — larger, colorful tiles to draw attention. */}
        <div className="mt-3 flex items-center justify-between gap-1.5">
          <ToolbarIcon
            Icon={PieChart}
            label="Analytics"
            color="#4488ff"
            onClick={() => router.push(`/sites/${id}/analytics`)}
          />
          <ToolbarIcon Icon={QrCode} label="QR" color="#5856d6" onClick={() => setQrOpen(true)} />
          <ToolbarIcon
            Icon={Share2}
            label="Share"
            color="#34c759"
            onClick={() => setShareOpen(true)}
          />
          <span className="relative">
            <ToolbarIcon
              Icon={Mail}
              label="Messages"
              color="#ff9500"
              onClick={() => router.push(`/sites/${id}/messages`)}
            />
            {unread > 0 && (
              <span className="absolute -end-1 -top-1 flex min-w-4.5 items-center justify-center rounded-full bg-[#d73c3c] px-1 text-[10px] font-bold text-white">
                {unread}
              </span>
            )}
          </span>
          <ToolbarIcon
            Icon={Trash2}
            label={t("deleteTitle")}
            color="#f35054"
            onClick={() => setConfirm(true)}
          />
        </div>
      </div>

      {confirm && (
        <BottomSheet title={t("deleteTitle")} onClose={() => setConfirm(false)}>
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-error/10 text-error">
              <Trash2 className="size-7" />
            </span>
            <p className="text-sm text-muted-foreground">{t("deleteDesc")}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirm(false)}
              disabled={del.isPending}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => del.mutate()}
              disabled={del.isPending}
            >
              {del.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {tc("delete")}
            </Button>
          </div>
        </BottomSheet>
      )}

      {qrOpen && (
        <BottomSheet title="QR" onClose={() => setQrOpen(false)}>
          <div className="flex flex-col items-center gap-4">
            <div ref={qrWrap} className="rounded-2xl border border-border bg-white p-5">
              <QRCodeCanvas value={url} size={200} level="M" fgColor="#1f1f26" />
            </div>
            <Button variant="gradient" className="w-full" onClick={downloadQr}>
              <Download className="size-4" />
              {tc("save")}
            </Button>
          </div>
        </BottomSheet>
      )}

      {shareOpen && (
        <BottomSheet title={tc("share")} onClose={() => setShareOpen(false)}>
          <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm">{url}</span>
            <button
              type="button"
              onClick={copyLink}
              className="flex items-center gap-1 text-sm font-medium text-primary"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button
              variant="gradient"
              className="mt-4 w-full"
              onClick={() => navigator.share?.({ url }).catch(() => {})}
            >
              <Share2 className="size-4" />
              {tc("share")}
            </Button>
          )}
        </BottomSheet>
      )}
    </div>
  );
}

function ToolbarIcon({
  Icon,
  label,
  color,
  onClick,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-soft active:scale-95"
      style={{ backgroundColor: `${color}1f`, color }}
    >
      <Icon className="size-5.5" />
    </button>
  );
}
