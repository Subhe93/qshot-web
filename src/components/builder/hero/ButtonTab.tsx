"use client";

import { useState } from "react";
import { EyeOff, Link2, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  GroupedCard,
  GroupedRow,
  ToggleSwitch,
  SectionLabel,
} from "@/components/builder/editors/sheet-kit";
import { ColorPickerField } from "@/components/ui/color-picker";
import type { WebsiteSettings, HeroButton } from "@/lib/types/profile";
import { cn } from "@/lib/utils";

/**
 * Hero "Button 1" / "Button 2" tab body, mirroring the mobile hero button
 * settings: text, url, foreground/background colors, and a hide toggle. Rendered
 * inside HeroSettingsSheet (no outer BottomSheet). Every change applies live.
 */
export function ButtonTab({
  settings,
  update,
  which,
}: {
  settings: WebsiteSettings;
  update: (patch: Partial<WebsiteSettings>) => void;
  which: "button1" | "button2";
}) {
  const value: HeroButton = settings[which] ?? {};

  return (
    <div className="space-y-5">
      {/* Content */}
      <div>
        <SectionLabel>Content</SectionLabel>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Text</label>
            <Input
              value={value.text ?? ""}
              placeholder="Text"
              onChange={(e) =>
                update({ [which]: { ...value, text: e.target.value } })
              }
            />
          </div>
          {/* URL ↔ Phone (mobile _HeroButtonLinkField): a phone stores tel:<num>. */}
          <LinkOrPhoneField
            key={which}
            url={value.url ?? undefined}
            onChange={(url) => update({ [which]: { ...value, url } })}
          />
        </div>
      </div>

      {/* Style */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <GroupedCard>
          <div className="flex h-[55px] w-full items-center gap-3 px-3">
            <ColorPickerField
              value={value.foreground_color ?? 0xff000000}
              onChange={(c) =>
                update({ [which]: { ...value, foreground_color: c } })
              }
              compact
            />
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              Text color
            </span>
          </div>
          <div className="ms-14 h-px bg-foreground/[0.08]" />
          <div className="flex h-[55px] w-full items-center gap-3 px-3">
            <ColorPickerField
              value={value.background_color ?? 0xff000000}
              onChange={(c) =>
                update({ [which]: { ...value, background_color: c } })
              }
              compact
            />
            <span className="flex-1 truncate text-sm font-medium text-foreground">
              Background color
            </span>
          </div>
          <GroupedRow
            Icon={EyeOff}
            title="Hide"
            color="#8e8e93"
            trailing={
              <ToggleSwitch
                checked={!!value.hide}
                onChange={(v) => update({ [which]: { ...value, hide: v } })}
              />
            }
          />
        </GroupedCard>
      </div>
    </div>
  );
}

/** A link is valid when empty or parses to a host with a dot (mobile UriValidator). */
function looksLikeUrl(s: string): boolean {
  const v = s.trim();
  if (!v) return true;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * The hero button destination — a URL or a phone number, mirroring the mobile
 * `_HeroButtonLinkField`. A phone is stored as `tel:<number>`; a URL is validated
 * (invalid-link message). The stored value is the single `url` field.
 */
function LinkOrPhoneField({
  url,
  onChange,
}: {
  url?: string;
  onChange: (url: string) => void;
}) {
  const startedAsPhone = (url ?? "").startsWith("tel:");
  const [mode, setMode] = useState<"url" | "phone">(startedAsPhone ? "phone" : "url");
  const [urlText, setUrlText] = useState(startedAsPhone ? "" : (url ?? ""));
  const [phoneText, setPhoneText] = useState(startedAsPhone ? (url ?? "").slice(4) : "");

  const urlInvalid = mode === "url" && !looksLikeUrl(urlText);

  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">Link</label>
      {/* URL | Phone toggle */}
      <div className="mb-2 flex rounded-xl border border-input p-0.5">
        {(
          [
            ["url", "URL", Link2],
            ["phone", "Phone number", Phone],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              onChange(m === "phone" ? (phoneText ? `tel:${phoneText}` : "") : urlText);
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
              mode === m ? "brand-tint text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {mode === "url" ? (
        <>
          <Input
            dir="ltr"
            value={urlText}
            placeholder="https://…"
            onChange={(e) => {
              setUrlText(e.target.value);
              onChange(e.target.value);
            }}
          />
          {urlInvalid && <p className="mt-1 text-xs text-error">Invalid link</p>}
        </>
      ) : (
        <Input
          dir="ltr"
          inputMode="tel"
          value={phoneText}
          placeholder="+1234567890"
          onChange={(e) => {
            const v = e.target.value;
            setPhoneText(v);
            onChange(v ? `tel:${v}` : "");
          }}
        />
      )}
    </div>
  );
}
