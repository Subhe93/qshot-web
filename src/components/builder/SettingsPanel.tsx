"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Eye, EyeOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEditorStore } from "@/stores/editor-store";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { hexToArgbA } from "@/lib/builder/color";
import { solid } from "@/lib/builder/color-value";
import { ColorPickerField, ColorValueField } from "@/components/ui/color-picker";
import type {
  Block,
  ButtonBlock,
  DividerBlock,
  HeaderBlock,
  ParagraphBlock,
  SocialLinksBlock,
  SpacerBlock,
  ImagesBlock,
  ProductsBlock,
  ExternalLinksBlock,
  VideoLinksBlock,
  ReviewsBlock,
  SocialFeedBlock,
  FormBlock,
  LocationBlock,
  EmbedBlock,
  IntroductionVideoBlock,
  BookingBlock,
} from "@/lib/types/blocks";
import { HeaderBlockEditor } from "./editors/HeaderBlockEditor";
import { ParagraphBlockEditor } from "./editors/ParagraphBlockEditor";
import { DividerBlockEditor } from "./editors/DividerBlockEditor";
import { SpacerBlockEditor } from "./editors/SpacerBlockEditor";
import { ButtonBlockEditor } from "./editors/ButtonBlockEditor";
import { SocialBlockEditor } from "./editors/SocialBlockEditor";
import { ImagesBlockEditor } from "./editors/ImagesBlockEditor";
import { ProductsBlockEditor } from "./editors/ProductsBlockEditor";
import { ExternalLinksBlockEditor } from "./editors/ExternalLinksBlockEditor";
import { VideoLinksBlockEditor } from "./editors/VideoLinksBlockEditor";
import { ReviewsBlockEditor } from "./editors/ReviewsBlockEditor";
import { SocialFeedBlockEditor } from "./editors/SocialFeedBlockEditor";
import { FormBlockEditor } from "./editors/FormBlockEditor";
import { LocationBlockEditor } from "./editors/LocationBlockEditor";
import { EmbedBlockEditor } from "./editors/EmbedBlockEditor";
import { IntroductionVideoBlockEditor } from "./editors/IntroductionVideoBlockEditor";
import { BookingBlockEditor } from "./editors/BookingBlockEditor";

export function SettingsPanel() {
  const selectedId = useEditorStore((s) => s.selectedId);
  const block = useEditorStore((s) =>
    s.blocks.find((b) => b.id === s.selectedId),
  );

  if (!selectedId || !block) {
    return <HeroSettings />;
  }
  return <BlockSettings block={block} key={block.id} />;
}

function HeroSettings() {
  const t = useTranslations("builder");
  const settings = useEditorStore((s) => s.settings);
  const update = useEditorStore((s) => s.updateSettings);
  const name = settings.name?.text;
  const bio = settings.bio?.text;

  return (
    <Section title={t("heroSettings")}>
      <Field label={t("fields.name")}>
        <Input
          value={name ?? ""}
          onChange={(e) => update({ name: { ...settings.name, text: e.target.value } })}
        />
      </Field>
      <Field label={t("fields.nameColor")}>
        <ColorPickerField
          value={settings.name?.color ?? hexToArgbA("#111111")!}
          onChange={(c) => update({ name: { ...settings.name, color: c } })}
        />
      </Field>
      <Field label={t("fields.bio")}>
        <Textarea
          value={bio ?? ""}
          onChange={(e) => update({ bio: { ...settings.bio, text: e.target.value } })}
        />
      </Field>
      <Field label={t("fields.avatarUrl")}>
        <Input
          value={settings.profile_picture?.image_url ?? ""}
          placeholder="https://…"
          onChange={(e) =>
            update({
              profile_picture: {
                ...settings.profile_picture,
                image_url: e.target.value,
              },
            })
          }
        />
      </Field>
      <Field label={t("fields.coverUrl")}>
        <Input
          value={settings.cover_photo?.image_url ?? ""}
          placeholder="https://…"
          onChange={(e) =>
            update({
              cover_photo: { ...settings.cover_photo, image_url: e.target.value },
            })
          }
        />
      </Field>
      <Field label={t("fields.pageBackground")}>
        <ColorValueField
          value={settings.background?.color_value ?? solid(hexToArgbA("#ffffff")!)}
          onChange={(cv) =>
            update({
              background: { ...settings.background, color_value: cv },
            })
          }
        />
      </Field>
    </Section>
  );
}

function BlockSettings({ block }: { block: Block }) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const blocks = useEditorStore((s) => s.blocks);
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const moveBlock = useEditorStore((s) => s.moveBlock);
  const removeBlock = useEditorStore((s) => s.removeBlock);
  const select = useEditorStore((s) => s.select);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hidden = block.hide === true;
  const index = blocks.findIndex((b) => b.id === block.id);
  const isFirst = index <= 0;
  const isLast = index === blocks.length - 1;

  // Mirrors the mobile block settings-sheet: a light brand-gradient strip on top,
  // a header toolbar (move up/down · hide · delete), the editor, then Save.
  return (
    <div className="space-y-4">
      {/* Light blue gradient at the top of the block popup */}
      <div className="-mx-4 -mt-4 h-2 bg-linear-to-r from-primary/40 via-primary/20 to-transparent" />

      {/* Header toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {t(`blocks.${labelKeyOf(block.type)}`)}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("nav.settings")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <ToolBtn
            icon={ChevronUp}
            label="Move up"
            disabled={isFirst}
            onClick={() => !isFirst && moveBlock(index, index - 1)}
          />
          <ToolBtn
            icon={ChevronDown}
            label="Move down"
            disabled={isLast}
            onClick={() => !isLast && moveBlock(index, index + 1)}
          />
          <ToolBtn
            icon={hidden ? EyeOff : Eye}
            label="Hide"
            active={hidden}
            onClick={() => updateBlock(block.id, { hide: !hidden })}
          />
          <ToolBtn
            icon={Trash2}
            label="Delete"
            danger
            onClick={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      {blockEditor(block)}

      {/* Save — edits apply live; this confirms & closes the sheet. */}
      <button
        type="button"
        onClick={() => select(null)}
        className="brand-gradient w-full rounded-xl py-3 text-sm font-semibold text-white hover:opacity-90"
      >
        {t("save")}
      </button>

      {/* Delete needs a confirmation (mobile showDeleteBlockDialog). */}
      <ConfirmDialog
        open={confirmDelete}
        type="danger"
        title={tc("delete")}
        message={t("deleteBlockConfirm")}
        confirmText={tc("delete")}
        cancelText={tc("cancel")}
        onConfirm={() => removeBlock(block.id)}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "text-error" : active ? "text-primary" : "text-foreground/60"
      }`}
    >
      <Icon className="size-4" />
    </button>
  );
}

function blockEditor(block: Block) {
  // Each block routes to its dedicated mobile-style editor.
  if (block.type === "HeaderModule") {
    return <HeaderBlockEditor block={block as HeaderBlock} />;
  }
  if (block.type === "ParagraphModule") {
    return <ParagraphBlockEditor block={block as ParagraphBlock} />;
  }
  if (block.type === "DividerModule") {
    return <DividerBlockEditor block={block as DividerBlock} />;
  }
  if (block.type === "SpacerModule") {
    return <SpacerBlockEditor block={block as SpacerBlock} />;
  }
  if (block.type === "ButtonModule") {
    return <ButtonBlockEditor block={block as ButtonBlock} />;
  }
  if (block.type === "social_links") {
    return <SocialBlockEditor block={block as SocialLinksBlock} />;
  }
  if (block.type === "ImageModule") {
    return <ImagesBlockEditor block={block as ImagesBlock} />;
  }
  if (block.type === "ProductsModule") {
    return <ProductsBlockEditor block={block as ProductsBlock} />;
  }
  if (block.type === "ExternalLinksModule") {
    return <ExternalLinksBlockEditor block={block as ExternalLinksBlock} />;
  }
  if (block.type === "VideoLinksModule") {
    return <VideoLinksBlockEditor block={block as VideoLinksBlock} />;
  }
  if (block.type === "ReviewsModule") {
    return <ReviewsBlockEditor block={block as ReviewsBlock} />;
  }
  if (block.type === "SocialFeedModule") {
    return <SocialFeedBlockEditor block={block as SocialFeedBlock} />;
  }
  if (block.type === "FormModule") {
    return <FormBlockEditor block={block as FormBlock} />;
  }
  if (block.type === "LocationModule") {
    return <LocationBlockEditor block={block as LocationBlock} />;
  }
  if (block.type === "EmbedModule") {
    return <EmbedBlockEditor block={block as EmbedBlock} />;
  }
  if (block.type === "IntroductionVideoModule") {
    return <IntroductionVideoBlockEditor block={block as IntroductionVideoBlock} />;
  }
  if (block.type === "BookingModule") {
    return <BookingBlockEditor block={block as BookingBlock} />;
  }

  // Every block type is handled by a dedicated editor above (unreachable).
  return (
    <Section title={(block as Block).type}>
      <p className="text-sm text-muted-foreground">—</p>
    </Section>
  );
}

// ---- small helpers ----
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function labelKeyOf(type: string): string {
  const map: Record<string, string> = {
    HeaderModule: "header",
    ParagraphModule: "paragraph",
    ButtonModule: "button",
    social_links: "social",
    DividerModule: "divider",
    SpacerModule: "spacer",
    ImageModule: "images",
    ProductsModule: "products",
    ExternalLinksModule: "externalLinks",
    VideoLinksModule: "videoLinks",
    ReviewsModule: "reviews",
    SocialFeedModule: "socialFeed",
    FormModule: "form",
    LocationModule: "location",
    EmbedModule: "embed",
    IntroductionVideoModule: "introVideo",
    BookingModule: "booking",
  };
  return map[type] ?? "block";
}
