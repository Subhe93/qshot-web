"use client";

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon,
  Loader2,
  Plus,
  Pencil,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  checkUserName,
  createProfile,
  listProfiles,
  uploadProfileImage,
} from "@/lib/api/profiles";
import {
  generateWebsite,
  fileToBase64,
  AiGenerateError,
} from "@/lib/ai/client";
import { setAiDraft } from "@/lib/ai/draft-handoff";
import { ColorPickerField } from "@/components/ui/color-picker";
import { argbToHex } from "@/lib/builder/color";
import type { HeroStyle } from "@/lib/types/profile";

const DEFAULT_PRIMARY = 0xff4488ff; // brand blue
const DEFAULT_SECONDARY = 0xffc389ff; // brand purple

type Busy = null | "uploading" | "generating" | "creating";

function slugify(v: string) {
  return (
    v
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "site"
  );
}

async function uniqueDomain(base: string): Promise<string> {
  let candidate = base.length >= 3 ? base : `${base}-site`;
  try {
    await checkUserName(candidate);
    return candidate; // available
  } catch {
    candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30);
    return candidate;
  }
}

export function AiWebsiteWizard({
  onClose,
  onUseManual,
}: {
  onClose: () => void;
  onUseManual?: () => void;
}) {
  const t = useTranslations("aiWizard");
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [primary, setPrimary] = useState(DEFAULT_PRIMARY);
  const [secondary, setSecondary] = useState(DEFAULT_SECONDARY);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  function pick(
    e: React.ChangeEvent<HTMLInputElement>,
    setFile: (f: File | null) => void,
    setPreview: (s: string | null) => void,
  ) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  const canGenerate =
    businessName.trim().length >= 2 &&
    description.trim().length >= 10 &&
    busy === null;

  async function run() {
    setError(null);
    try {
      // 1) Upload images (reuse existing endpoint) + read base64 for the model.
      setBusy("uploading");
      const [logoName, coverName] = await Promise.all([
        logoFile ? uploadProfileImage(logoFile).catch(() => null) : Promise.resolve(null),
        coverFile ? uploadProfileImage(coverFile).catch(() => null) : Promise.resolve(null),
      ]);
      const logoB64 = logoFile ? await fileToBase64(logoFile) : undefined;
      const coverB64 = coverFile ? await fileToBase64(coverFile) : undefined;

      // 2) Generate the website JSON.
      setBusy("generating");
      const result = await generateWebsite({
        description: description.trim(),
        language: locale,
        businessName: businessName.trim(),
        brandPrimary: argbToHex(primary),
        brandSecondary: argbToHex(secondary),
        contact: { phone, email, address, website, instagram, whatsapp },
        logoB64: logoB64?.data,
        logoMime: logoB64?.mime,
        coverB64: coverB64?.data,
        coverMime: coverB64?.mime,
        logoFileName: logoName,
        coverFileName: coverName,
      });

      // 3) Create the site (to get a real id), hand the generated content to the
      //    builder via an in-memory draft, then open it. The builder loads the
      //    draft directly (no refetch race) and auto-saves it via the proven path.
      setBusy("creating");
      // Slug comes from the user-entered business name.
      const domain = await uniqueDomain(slugify(businessName));
      const style = (result.style ?? result.settings.style ?? "style2") as HeroStyle;
      const created = await createProfile({
        domain,
        websiteName: result.businessName,
        websiteLogo: logoName,
        style,
      });

      // Resolve the canonical profile from the backend (mirrors what the manual
      // builder fetch uses) so the auto-save sends the REAL id + user_name — a
      // mismatched id/name is what makes q-profile/user/edit return 400.
      const createdId = created?._id ?? created?.id ?? null;
      let profile = created ?? null;
      try {
        const all = await listProfiles();
        const found = all.find(
          (p) =>
            (createdId && (p._id === createdId || p.id === createdId)) ||
            p.user_name === domain ||
            p.name === domain,
        );
        if (found) profile = found;
      } catch {
        /* fall back to the create response below */
      }

      const id = profile?._id ?? profile?.id ?? createdId;
      if (!id) {
        setError("create_failed");
        setBusy(null);
        return;
      }
      const realName =
        (profile as { user_name?: string })?.user_name ?? profile?.name ?? domain;

      setAiDraft(id, {
        name: realName,
        settings: result.settings,
        blocks: result.modules,
      });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      router.push(`/builder/${id}`);
    } catch (e) {
      const code = e instanceof AiGenerateError ? e.code : "unknown";
      setError(code);
      setBusy(null);
    }
  }

  const busyLabel =
    busy === "uploading"
      ? t("uploading")
      : busy === "generating"
        ? t("generating")
        : busy === "creating"
          ? t("creating")
          : "";

  return (
    <BottomSheet
      title={t("title")}
      subtitle={t("subtitle")}
      onClose={onClose}
      footer={
        <div className="space-y-2 p-4">
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-error/10 p-3 text-sm text-error">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="flex-1">
                <p>{t("errorBody")}</p>
                {onUseManual && (
                  <button
                    type="button"
                    onClick={onUseManual}
                    className="mt-1 font-semibold underline"
                  >
                    {t("useManual")}
                  </button>
                )}
              </div>
            </div>
          )}
          <Button
            variant="gradient"
            className="w-full"
            disabled={!canGenerate}
            onClick={run}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {busyLabel}
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                {t("generate")}
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Beta intro */}
        <div className="flex items-center gap-2 rounded-xl bg-primary/5 p-3 text-sm text-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="flex-1">{t("note")}</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
            {t("beta")}
          </span>
        </div>

        {/* Business name */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/70">
            {t("businessName")}
          </label>
          <input
            value={businessName}
            maxLength={60}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder={t("businessNamePlaceholder")}
            className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Logo + cover */}
        <div className="flex items-stretch gap-3">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="relative size-[82px] shrink-0 overflow-hidden rounded-2xl border border-input bg-muted"
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="absolute inset-0 m-auto size-7 text-muted-foreground" />
            )}
            <span className="absolute bottom-0.5 end-0.5 flex size-6 items-center justify-center rounded-full border border-input bg-white text-primary">
              {logoPreview ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            </span>
            <span className="absolute inset-x-0 top-0 bg-black/35 py-0.5 text-center text-[9px] font-semibold text-white">
              {t("logo")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            className="relative h-[82px] flex-1 overflow-hidden rounded-2xl border border-input bg-muted"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="size-full object-cover" />
            ) : (
              <ImageIcon className="absolute inset-0 m-auto size-7 text-muted-foreground" />
            )}
            <span className="absolute bottom-0.5 end-0.5 flex size-6 items-center justify-center rounded-full border border-input bg-white text-primary">
              {coverPreview ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
            </span>
            <span className="absolute inset-x-0 top-0 bg-black/35 py-0.5 text-center text-[9px] font-semibold text-white">
              {t("cover")}
            </span>
          </button>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e, setLogoFile, setLogoPreview)} />
          <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e, setCoverFile, setCoverPreview)} />
        </div>

        {/* Brand colors */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/70">
            {t("brandColors")}
          </label>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("primaryColor")}
              </span>
              <div className="ms-auto">
                <ColorPickerField value={primary} showAlpha={false} onChange={setPrimary} compact />
              </div>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-input bg-card px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("secondaryColor")}
              </span>
              <div className="ms-auto">
                <ColorPickerField value={secondary} showAlpha={false} onChange={setSecondary} compact />
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/70">
            {t("description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={800}
            placeholder={t("descriptionPlaceholder")}
            className="w-full resize-none rounded-xl border border-input bg-card p-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* Contact */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-foreground/70">
            {t("contactInfo")}
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field value={phone} onChange={setPhone} placeholder={t("phone")} />
            <Field value={email} onChange={setEmail} placeholder={t("email")} />
            <Field value={website} onChange={setWebsite} placeholder={t("website")} />
            <Field value={whatsapp} onChange={setWhatsapp} placeholder={t("whatsapp")} />
            <Field value={instagram} onChange={setInstagram} placeholder={t("instagram")} />
            <Field value={address} onChange={setAddress} placeholder={t("address")} />
          </div>
        </div>

      </div>
    </BottomSheet>
  );
}

function Field({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:border-primary"
    />
  );
}
