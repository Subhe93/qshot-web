"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { QRCodeCanvas } from "qrcode.react";
import {
  Share2,
  QrCode,
  BarChart3,
  Mail,
  Pencil,
  Link2,
  User,
  Search,
  CreditCard,
  CalendarDays,
  ArrowLeftRight,
  ChevronRight,
  Copy,
  Check,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { checkUserName, deleteProfile } from "@/lib/api/profiles";
import { cdnUrl } from "@/lib/api/qrcodes";
import {
  getQrNumber,
  createQrNumber,
  getTransferUserName,
  transferSite,
} from "@/lib/api/site-actions";
import { Trash2 } from "lucide-react";

type Sheet =
  | "name"
  | "url"
  | "share"
  | "qr"
  | "soon"
  | "delete"
  | "card"
  | "transfer"
  | null;

export function WebsiteSettingsPanel() {
  const t = useTranslations("builder.websiteSettings");
  const tc = useTranslations("common");
  const router = useRouter();
  const name = useEditorStore((s) => s.name);
  const settings = useEditorStore((s) => s.settings);
  const setName = useEditorStore((s) => s.setName);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const profileId = useEditorStore((s) => s.profileId);
  // Per-site sub-pages need a saved profile; a brand-new draft has no real id yet.
  const realId = profileId && profileId !== "new" ? profileId : null;

  const [sheet, setSheet] = useState<Sheet>(null);
  const [soonLabel, setSoonLabel] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Bound to the real settings (persisted via the builder's auto-save).
  const saveContact = settings.can_save_contact ?? false;
  const indexGoogle = settings.index_in_google ?? true;

  // Website name (display) lives in settings.website_name; the URL is the slug `name`.
  const displayName =
    (settings.website_name && settings.website_name.trim()) ||
    (settings.name && typeof settings.name === "object" ? settings.name.text : "") ||
    name ||
    "";
  const slug =
    (name || displayName)
      ?.toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "me";
  const url = `https://${slug}.qshot.com`;
  const logo = settings.logo?.image_url || settings.website_logo || undefined;

  async function onDelete() {
    if (!realId) return;
    setDeleting(true);
    try {
      await deleteProfile(realId);
      router.push("/dashboard");
    } finally {
      setDeleting(false);
    }
  }

  function openSoon(label: string) {
    setSoonLabel(label);
    setSheet("soon");
  }

  const tiles = [
    { label: t("share"), Icon: Share2, onClick: () => setSheet("share") },
    { label: t("qrCode"), Icon: QrCode, onClick: () => setSheet("qr") },
    {
      label: t("analytics"),
      Icon: BarChart3,
      onClick: () =>
        realId
          ? router.push(`/sites/${realId}/analytics`)
          : openSoon(t("analytics")),
    },
    {
      label: t("messages"),
      Icon: Mail,
      onClick: () =>
        realId
          ? router.push(`/sites/${realId}/messages`)
          : openSoon(t("messages")),
    },
  ];

  return (
    <div className="mx-auto max-w-md space-y-6 pb-6">
      <h1 className="text-center text-lg font-bold">{t("title")}</h1>

      {/* Hero card */}
      <div className="brand-gradient flex items-center gap-4 rounded-3xl p-5 text-white shadow-soft">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo ? cdnUrl(logo) : "/brand/logo.svg"}
            alt=""
            className={logo ? "size-full object-cover" : "size-12"}
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-bold">{displayName}</p>
          <span className="mt-1 inline-block max-w-full truncate rounded-full bg-white/20 px-3 py-1 text-sm text-white/90">
            {url}
          </span>
        </div>
      </div>

      {/* Action tiles */}
      <div className="grid grid-cols-4 gap-3">
        {tiles.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex flex-col items-center gap-2 rounded-2xl bg-card p-3 shadow-soft transition-transform active:scale-95"
          >
            <Icon className="size-6 text-primary" />
            <span className="text-[11px] font-medium text-foreground">
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* GENERAL */}
      <Group title={t("general")}>
        <Row
          icon={<Pencil className="size-5" />}
          color="#4488ff"
          title={t("websiteName")}
          onClick={() => setSheet("name")}
        />
        <Row
          icon={<Link2 className="size-5" />}
          color="#5856d6"
          title={t("websiteUrl")}
          onClick={() => setSheet("url")}
        />
        <Row
          icon={<User className="size-5" />}
          color="#34c759"
          title={t("saveAsContact")}
          right={
            <Toggle
              on={saveContact}
              onToggle={() => updateSettings({ can_save_contact: !saveContact })}
            />
          }
        />
        <Row
          icon={<Search className="size-5" />}
          color="#4488ff"
          title={t("indexGoogle")}
          right={
            <Toggle
              on={indexGoogle}
              onToggle={() => updateSettings({ index_in_google: !indexGoogle })}
            />
          }
        />
        <Row
          icon={<CreditCard className="size-5" />}
          color="#ff9500"
          title={t("activateCard")}
          onClick={() => (realId ? setSheet("card") : openSoon(t("activateCard")))}
        />
      </Group>

      {/* ACTIONS */}
      <Group title={t("actions")}>
        <Row
          icon={<CalendarDays className="size-5" />}
          color="#34c759"
          title={t("manageBooking")}
          onClick={() =>
            realId
              ? router.push(`/sites/${realId}/booking`)
              : openSoon(t("manageBooking"))
          }
        />
        <Row
          icon={<ArrowLeftRight className="size-5" />}
          color="#ff9500"
          title={t("transfer")}
          onClick={() => (realId ? setSheet("transfer") : openSoon(t("transfer")))}
        />
        {realId && (
          <Row
            icon={<Trash2 className="size-5" />}
            color="#f35054"
            title={tc("delete")}
            onClick={() => setSheet("delete")}
          />
        )}
      </Group>

      {/* ── Popups ───────────────────────────────────────────── */}
      {sheet === "name" && (
        <NameSheet
          initial={displayName}
          onSave={(v) => {
            updateSettings({ website_name: v });
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
          title={t("websiteName")}
          placeholder={t("namePlaceholder")}
          save={tc("save")}
        />
      )}

      {sheet === "url" && (
        <UrlSheet
          initial={slug}
          onSave={(v) => {
            setName(v);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
          t={t}
          save={tc("save")}
        />
      )}

      {sheet === "share" && (
        <ShareSheet url={url} onClose={() => setSheet(null)} t={t} />
      )}

      {sheet === "qr" && (
        <QrSheet url={url} onClose={() => setSheet(null)} t={t} />
      )}

      {sheet === "soon" && (
        <BottomSheet title={soonLabel} onClose={() => setSheet(null)}>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="brand-tint flex size-16 items-center justify-center rounded-2xl">
              <Sparkles className="size-7 text-primary" />
            </span>
            <p className="font-semibold text-foreground">{t("comingSoon")}</p>
            <p className="text-sm text-muted-foreground">{t("comingSoonDesc")}</p>
          </div>
        </BottomSheet>
      )}

      {sheet === "delete" && (
        <BottomSheet
          title={tc("delete")}
          onClose={() => setSheet(null)}
          footer={
            <div className="flex gap-2 p-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSheet(null)}
                disabled={deleting}
              >
                {tc("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="size-4 animate-spin" /> : tc("delete")}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-error/10 text-error">
              <Trash2 className="size-7" />
            </span>
            <p className="text-sm text-muted-foreground">{t("deleteConfirm")}</p>
          </div>
        </BottomSheet>
      )}

      {sheet === "card" && realId && (
        <ActivateCardSheet
          profileId={realId}
          onClose={() => setSheet(null)}
          t={t}
          save={tc("save")}
        />
      )}

      {sheet === "transfer" && realId && (
        <TransferSheet
          profileId={realId}
          onClose={() => setSheet(null)}
          t={t}
        />
      )}
    </div>
  );
}

// ── Activate card (link a QR/card number) ──────────────────────
function ActivateCardSheet({
  profileId,
  onClose,
  t,
  save,
}: {
  profileId: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  save: string;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    getQrNumber(profileId)
      .then((n) => active && setValue(n))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [profileId]);

  async function submit() {
    if (!value.trim() || saving) return;
    setSaving(true);
    try {
      await createQrNumber(profileId, value.trim());
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      title={t("activateCard")}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={loading || saving || done || !value.trim()}
            onClick={submit}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : done ? (
              <Check className="size-4" />
            ) : (
              save
            )}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">{t("activateCardDesc")}</p>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3">
        <CreditCard className="size-5 text-muted-foreground" />
        <input
          autoFocus
          value={value}
          placeholder={t("cardNumberPlaceholder")}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-full bg-transparent text-sm outline-none"
        />
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
    </BottomSheet>
  );
}

// ── Transfer site to another user ──────────────────────────────
function TransferSheet({
  profileId,
  onClose,
  t,
}: {
  profileId: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "found" | "missing">(
    "idle",
  );
  const [foundName, setFoundName] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const handle = setTimeout(async () => {
      const name = await getTransferUserName(v);
      if (name) {
        setFoundName(name);
        setStatus("found");
      } else {
        setStatus("missing");
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [value]);

  async function submit() {
    if (status !== "found" || transferring) return;
    setTransferring(true);
    try {
      await transferSite(value.trim(), profileId);
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setTransferring(false);
    }
  }

  return (
    <BottomSheet
      title={t("transfer")}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={status !== "found" || transferring || done}
            onClick={submit}
          >
            {transferring ? (
              <Loader2 className="size-4 animate-spin" />
            ) : done ? (
              <Check className="size-4" />
            ) : (
              t("transfer")
            )}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">{t("transferDesc")}</p>
      <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3">
        <User className="size-5 text-muted-foreground" />
        <input
          autoFocus
          value={value}
          placeholder={t("transferUserPlaceholder")}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 w-full bg-transparent text-sm outline-none"
        />
      </div>
      <div className="mt-2 h-5 text-xs">
        {status === "checking" && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t("checking")}
          </span>
        )}
        {status === "found" && (
          <span className="flex items-center gap-1 text-success">
            <Check className="size-3" />
            {foundName}
          </span>
        )}
        {status === "missing" && (
          <span className="text-error">{t("userNotFound")}</span>
        )}
      </div>
    </BottomSheet>
  );
}

// ── Name editor ────────────────────────────────────────────────
function NameSheet({
  initial,
  onSave,
  onClose,
  title,
  placeholder,
  save,
}: {
  initial: string;
  onSave: (v: string) => void;
  onClose: () => void;
  title: string;
  placeholder: string;
  save: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={!value.trim()}
            onClick={() => onSave(value.trim())}
          >
            {save}
          </Button>
        </div>
      }
    >
      <Input
        autoFocus
        value={value}
        maxLength={40}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
      />
    </BottomSheet>
  );
}

// ── URL editor with availability check ─────────────────────────
function UrlSheet({
  initial,
  onSave,
  onClose,
  t,
  save,
}: {
  initial: string;
  onSave: (v: string) => void;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  save: string;
}) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "taken">(
    "idle",
  );

  useEffect(() => {
    const clean = value.trim().toLowerCase();
    if (!clean || clean === initial) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    const handle = setTimeout(async () => {
      try {
        await checkUserName(clean);
        setStatus("ok");
      } catch {
        setStatus("taken");
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [value, initial]);

  return (
    <BottomSheet
      title={t("websiteUrl")}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={status === "checking" || status === "taken" || !value.trim()}
            onClick={() => onSave(value.trim())}
          >
            {save}
          </Button>
        </div>
      }
    >
      <div className="flex items-center overflow-hidden rounded-lg border border-input bg-card">
        <span className="ps-3 text-sm text-muted-foreground">qshot.com/</span>
        <input
          autoFocus
          value={value}
          onChange={(e) =>
            setValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
          }
          className="h-11 w-full bg-transparent px-1 text-sm outline-none"
        />
      </div>
      <div className="mt-2 h-5 text-xs">
        {status === "checking" && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {t("checking")}
          </span>
        )}
        {status === "ok" && (
          <span className="flex items-center gap-1 text-success">
            <Check className="size-3" />
            {t("available")}
          </span>
        )}
        {status === "taken" && <span className="text-error">{t("taken")}</span>}
      </div>
    </BottomSheet>
  );
}

// ── Share ──────────────────────────────────────────────────────
function ShareSheet({
  url,
  onClose,
  t,
}: {
  url: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <BottomSheet title={t("share")} onClose={onClose}>
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-sm">{url}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-sm font-medium text-primary"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? t("copied") : t("copyLink")}
        </button>
      </div>
      {typeof navigator !== "undefined" && "share" in navigator && (
        <Button
          variant="gradient"
          className="mt-4 w-full"
          onClick={() => navigator.share?.({ url }).catch(() => {})}
        >
          <Share2 className="size-4" />
          {t("share")}
        </Button>
      )}
    </BottomSheet>
  );
}

// ── QR ─────────────────────────────────────────────────────────
function QrSheet({
  url,
  onClose,
  t,
}: {
  url: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  function download() {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "qrcode.png";
    a.click();
  }
  return (
    <BottomSheet title={t("qrCode")} onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div
          ref={wrap}
          className="rounded-2xl border border-border bg-white p-5"
        >
          <QRCodeCanvas value={url} size={200} level="M" fgColor="#1f1f26" />
        </div>
        <Button variant="gradient" className="w-full" onClick={download}>
          <Download className="size-4" />
          {t("download")}
        </Button>
      </div>
    </BottomSheet>
  );
}

// ── Shared rows ────────────────────────────────────────────────
function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card shadow-soft">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  color,
  title,
  onClick,
  right,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  onClick?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3.5 ${onClick ? "cursor-pointer hover:bg-muted/50" : ""}`}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-medium text-foreground">
        {title}
      </span>
      {right ?? (
        <ChevronRight className="size-4 text-muted-foreground rtl:rotate-180" />
      )}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "brand-gradient" : "bg-input"}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? "start-[1.375rem]" : "start-0.5"}`}
      />
    </button>
  );
}
