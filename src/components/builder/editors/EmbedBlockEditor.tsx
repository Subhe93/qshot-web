"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Code2,
  Link as LinkIcon,
  Settings as SettingsIcon,
  Check,
} from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { dirOf } from "@/lib/builder/text-direction";
import { cn } from "@/lib/utils";
import type {
  EmbedBlock,
  EmbedConfiguration,
  EmbedData,
} from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  ColorRow,
  SectionLabel,
  type SheetTab,
} from "./sheet-kit";

type Tab = "content" | "settings";

/**
 * EmbedModule editor, mirroring the mobile flow:
 *   - EmbedSelectorSheet → pick a provider (EmbedConfiguration.all: HTML,
 *     YouTube, TikTok, Twitter, Telegram, Vimeo, Pinterest, Behance).
 *   - EmbedFormLayout → a single URL field (labelled by provider title, with a
 *     per-provider hint) that fetches the oembed html. For the "custom"
 *     provider the field IS the raw HTML.
 *   - GeneralSettingsSheet → hide + background color.
 *
 * The web port has no oembed backend, so the Content tab exposes the URL and
 * the HTML directly (the fields the mobile fetch ultimately writes into
 * EmbedData), plus an aspect-ratio control, so the preview matches the mobile
 * `EmbedBuilder` exactly.
 */

const PROVIDERS: { name: EmbedConfiguration; title: string; hint?: string }[] = [
  { name: "custom", title: "HTML", hint: "<iframe …>" },
  { name: "youtube", title: "YouTube", hint: "https://youtu.be/…" },
  { name: "tiktok", title: "TikTok", hint: "https://www.tiktok.com/@…/video/…" },
  { name: "twitter", title: "Twitter", hint: "https://x.com/…/status/…" },
  { name: "telegram", title: "Telegram", hint: "https://t.me/…/…" },
  { name: "vimeo", title: "Vimeo", hint: "https://vimeo.com/…" },
  { name: "pinterest", title: "Pinterest", hint: "https://www.pinterest.com/…" },
  { name: "behance", title: "Behance", hint: "https://www.behance.net/gallery/…" },
];

const ASPECT_OPTIONS: { label: string; value: number | null }[] = [
  { label: "auto", value: null },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "9:16", value: 9 / 16 },
];

export function EmbedBlockEditor({ block }: { block: EmbedBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const [tab, setTab] = useState<Tab>("content");

  const config: EmbedConfiguration = block.configuration ?? "custom";
  const data = block.data ?? {};
  const provider =
    PROVIDERS.find((p) => p.name === config) ?? PROVIDERS[0];
  const isCustom = config === "custom";

  const setBlock = (patch: Partial<EmbedBlock>) => updateBlock(block.id, patch);
  const setData = (patch: Partial<EmbedData>) =>
    setBlock({ data: { ...data, ...patch } });

  const tabs: SheetTab<Tab>[] = [
    { value: "content", label: t("embed.embed"), Icon: Code2 },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "content" && (
        <div className="space-y-4">
          {/* Provider picker (mirrors EmbedSelectorSheet) */}
          <div>
            <SectionLabel>{t("embed.source")}</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {PROVIDERS.map((p) => {
                const selected = p.name === config;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setBlock({ configuration: p.name })}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl border bg-surface px-1 py-2.5 text-[11px] font-semibold transition-colors",
                      selected
                        ? "border-primary text-foreground"
                        : "border-transparent text-foreground/55 hover:border-border",
                    )}
                  >
                    {selected && (
                      <span className="absolute end-1 top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="size-2.5" />
                      </span>
                    )}
                    {p.name === "custom" ? (
                      <Code2 className="size-5 text-foreground/70" />
                    ) : (
                      <LinkIcon className="size-5 text-foreground/70" />
                    )}
                    <span className="truncate">{p.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* URL field — labelled by the provider title (mirrors EmbedFormLayout). */}
          {!isCustom && (
            <label className="block space-y-1.5">
              <span className="px-1 text-[13px] font-semibold text-foreground">
                {provider.title}
              </span>
              <input
                type="url"
                inputMode="url"
                value={data.url ?? ""}
                placeholder={provider.hint}
                onChange={(e) => setData({ url: e.target.value })}
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-foreground/35 focus:border-primary"
                dir={dirOf(data.url ?? "")}
              />
            </label>
          )}

          {/* HTML field — the raw embed markup. For "custom" this is the whole
              input; for oembed providers it is the fetched html (editable). */}
          <label className="block space-y-1.5">
            <span className="px-1 text-[13px] font-semibold text-foreground">
              {isCustom ? "HTML" : `${provider.title} HTML`}
            </span>
            <textarea
              value={data.html ?? ""}
              placeholder={isCustom ? provider.hint : t("embed.codePlaceholder")}
              onChange={(e) => setData({ html: e.target.value })}
              rows={6}
              spellCheck={false}
              className="w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-3 font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-foreground/35 focus:border-primary"
              dir="ltr"
            />
          </label>

          {/* Aspect ratio — drives the preview's Center+AspectRatio vs dynamic. */}
          <div>
            <SectionLabel>{t("embed.aspectRatio")}</SectionLabel>
            <div className="flex gap-1 rounded-xl bg-surface p-1">
              {ASPECT_OPTIONS.map((opt) => {
                const active =
                  (data.aspectRatio ?? null) === opt.value ||
                  (opt.value != null &&
                    data.aspectRatio != null &&
                    Math.abs(data.aspectRatio - opt.value) < 0.001);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() =>
                      setData({ aspectRatio: opt.value })
                    }
                    className={cn(
                      "flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-foreground/45",
                    )}
                  >
                    {opt.value === null ? t("embed.auto") : opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <GroupedCard>
          {/* Block-level hide now lives in the shared SettingsPanel toolbar. */}
          <ColorRow
            label={t("fields.background")}
            color={block.background_color ?? hexToArgbA("#ffffff")!}
            enabled={!!block.use_background_color}
            onColor={(c) => setBlock({ background_color: c })}
            onToggle={(v) => setBlock({ use_background_color: v })}
          />
        </GroupedCard>
      )}
    </div>
  );
}
