"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ImageIcon, Loader2, Pencil, Plus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DEFAULT_STYLE } from "@/lib/builder/templates";
import {
  checkUserName,
  createProfile,
  uploadProfileImage,
} from "@/lib/api/profiles";
import { fillDefaults } from "@/lib/builder/hero-defaults";
import { setAiDraft } from "@/lib/ai/draft-handoff";
import type { HeroStyle } from "@/lib/types/profile";

import { SITE_DOMAIN } from "@/lib/site-domain";
function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

// Mobile dropped its hero-style selector step: a site is created with the
// default style and the builder's auto-open ThemeSheet gate (empty blocks, no
// template) presents the whole-site Templates picker instead.
export function CreateWebsiteWizard({ onClose }: { onClose: () => void }) {
  const t = useTranslations("wizard");
  const tws = useTranslations("builder.websiteSettings");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [domainEdited, setDomainEdited] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "taken">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  const [creating, setCreating] = useState(false);

  // Auto-slug the domain from the name until the user edits it manually.
  // (Deferred a tick — react-hooks/set-state-in-effect.)
  useEffect(() => {
    if (domainEdited) return;
    const t = setTimeout(() => setDomain(slugify(name)), 0);
    return () => clearTimeout(t);
  }, [name, domainEdited]);

  // Live availability check. (Status flips inside timers so no set-state runs
  // synchronously in the effect body — react-hooks/set-state-in-effect.)
  useEffect(() => {
    if (domain.length < 3) {
      const t = setTimeout(() => setStatus("idle"), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStatus("checking"), 0);
    const h = setTimeout(async () => {
      try {
        await checkUserName(domain);
        setStatus("ok");
      } catch {
        setStatus("taken");
      }
    }, 600);
    return () => {
      clearTimeout(t);
      clearTimeout(h);
    };
  }, [domain]);

  function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setLogoFile(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
  }

  const canCreate = name.trim().length > 0 && domain.length >= 3 && status !== "taken";

  async function create() {
    setCreating(true);
    try {
      let logo: string | null = null;
      if (logoFile) {
        try {
          logo = await uploadProfileImage(logoFile);
        } catch {
          /* logo optional */
        }
      }
      const created = await createProfile({
        domain,
        websiteName: name.trim(),
        websiteLogo: logo,
        style: DEFAULT_STYLE,
      });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      const id = created?._id ?? created?.id;
      if (id) {
        // Hand the just-created site straight to the builder (id + chosen
        // template + slug) so it loads instantly with the right URL/template and
        // auto-saves under the real id — instead of racing a list refetch.
        setAiDraft(id, {
          name: domain,
          settings: fillDefaults(DEFAULT_STYLE as HeroStyle, {
            websiteName: name.trim(),
            websiteLogo: logo,
          }),
          blocks: [],
        });
        router.push(`/builder/${id}`);
      } else {
        // No id returned — fall back to a fresh draft so the flow still works.
        router.push("/builder/new");
      }
    } catch {
      // Backend rejected (or offline) — still open the builder so the flow works.
      router.push("/builder/new");
    } finally {
      setCreating(false);
    }
  }

  return (
    <BottomSheet
      title={t("title")}
      onClose={onClose}
      footer={
        <div className="flex gap-2 p-4">
          <Button
            variant="gradient"
            className="flex-1"
            disabled={!canCreate || creating}
            onClick={create}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("creating")}
              </>
            ) : (
              t("title")
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
          {/* Logo */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative size-[82px] overflow-hidden rounded-2xl border border-input bg-muted"
            >
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="absolute inset-0 m-auto size-7 text-muted-foreground" />
              )}
              <span className="absolute bottom-0.5 end-0.5 flex size-6 items-center justify-center rounded-full border border-input bg-white text-primary">
                {logoPreview ? (
                  <Pencil className="size-3.5" />
                ) : (
                  <Plus className="size-3.5" />
                )}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={pickLogo}
            />
          </div>

          {/* Website name */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-foreground/70">
              {t("websiteName")}
            </label>
            <input
              value={name}
              maxLength={45}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-card px-3.5 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Domain */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-foreground/70">
              {t("domain")}
            </label>
            <p className="mb-2 whitespace-pre-line text-xs text-muted-foreground">
              {t("domainHint")}
            </p>
            <div
              className={`flex items-center overflow-hidden rounded-xl border bg-card ${status === "taken" ? "border-error" : "border-input focus-within:border-primary"}`}
            >
              <span className="ps-3 text-sm text-muted-foreground">https://</span>
              <input
                value={domain}
                onChange={(e) => {
                  setDomainEdited(true);
                  setDomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30));
                }}
                className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm font-medium outline-none"
              />
              <span className="pe-3 text-sm text-muted-foreground">.{SITE_DOMAIN}/</span>
            </div>
            <div className="mt-1.5 h-4 text-xs">
              {status === "checking" && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                </span>
              )}
              {status === "ok" && (
                <span className="flex items-center gap-1 text-success">
                  <Check className="size-3" />
                </span>
              )}
              {status === "taken" && (
                <span className="text-error">{tws("taken")}</span>
              )}
            </div>
          </div>
        </div>
    </BottomSheet>
  );
}
