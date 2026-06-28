"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowUpDown,
  LayoutGrid,
  Settings as SettingsIcon,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { socialIconUrl, type SocialPlatform } from "@/lib/builder/social-platforms";
import { SOCIAL_LAYOUTS } from "@/lib/builder/social-layouts";
import { cn } from "@/lib/utils";
import type { SocialLinksBlock, SocialLinkItem } from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { ColorPickerField } from "@/components/ui/color-picker";
import { PlatformSelectorSheet } from "./PlatformSelectorSheet";
import { SocialItemEditor } from "./SocialItemEditor";
import { LayoutPicker } from "./LayoutPicker";

type Tab = "sort" | "layout" | "settings";

/**
 * Complete Social-links block editor, mirroring the mobile
 * SocialLinksSettingsSheet: Sort / Layout / Settings tabs, a platform selector
 * for adding links, and a per-link editor.
 */
export function SocialBlockEditor({ block }: { block: SocialLinksBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const links = block.links ?? [];
  const setBlock = (patch: Partial<SocialLinksBlock>) => updateBlock(block.id, patch);
  const setLinks = (next: SocialLinkItem[]) => setBlock({ links: next });
  const patchLink = (id: string, patch: Partial<SocialLinkItem>) =>
    setLinks(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const editing = links.find((l) => l.id === editingId) ?? null;
  const variant = block.icon_type === "darkFilled" ? "dark" : "colored";

  function addPlatform(p: SocialPlatform) {
    const item: SocialLinkItem = { id: nanoid(), type: p.name, link: "" };
    setLinks([...links, item]);
    setAdding(false);
    setEditingId(item.id!);
  }

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            <Plus className="size-4" />
            {t("fields.addLink")}
          </button>
          <SortList
            links={links}
            variant={variant}
            onReorder={setLinks}
            onEdit={(id) => setEditingId(id)}
            onToggleHide={(id, hidden) => patchLink(id, { hidden })}
            onDelete={(id) => setLinks(links.filter((l) => l.id !== id))}
          />
        </div>
      )}

      {tab === "layout" && (
        <LayoutPicker
          options={SOCIAL_LAYOUTS.map((l) => ({
            type: l.type,
            label: l.label,
            svg: l.preview.replace("/layouts/", ""),
          }))}
          value={block.layout_type ?? "list"}
          onChange={(v) => setBlock({ layout_type: v })}
        />
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <IconStyleToggle
            value={block.icon_type ?? "original"}
            onChange={(v) => setBlock({ icon_type: v })}
            coloredLabel={t("iconStyleColored")}
            darkLabel={t("iconStyleDark")}
          />

          {/* Adaptive icon color (mobile Theme tab) */}
          <div className="space-y-2">
            <GroupedCard>
              <GroupedRow
                title={t("adaptiveIconColor")}
                color="#5b5bd6"
                trailing={
                  <ToggleSwitch
                    checked={!!block.adaptive_icon_color}
                    onChange={(v) => setBlock({ adaptive_icon_color: v })}
                  />
                }
              />
              <div
                className={cn(
                  "transition-opacity",
                  block.adaptive_icon_color
                    ? "opacity-100"
                    : "pointer-events-none opacity-40",
                )}
              >
                <GroupedRow
                  title={t("iconColor")}
                  customIcon={
                    <ColorPickerField
                      value={block.custom_icon_color ?? hexToArgbA("#000000")!}
                      onChange={(c) => setBlock({ custom_icon_color: c })}
                      compact
                    />
                  }
                  trailing={
                    block.custom_icon_color != null ? (
                      <button
                        type="button"
                        onClick={() => setBlock({ custom_icon_color: null })}
                        className="text-sm font-semibold text-primary"
                      >
                        {t("reset")}
                      </button>
                    ) : undefined
                  }
                />
              </div>
            </GroupedCard>
            <p className="px-1 text-xs text-muted-foreground">
              {t("adaptiveIconColorHint")}
            </p>
          </div>

          <GroupedCard>
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#ffffff")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>
        </div>
      )}

      {adding && (
        <PlatformSelectorSheet onPick={addPlatform} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <SocialItemEditor
          item={editing}
          onChange={(patch) => patchLink(editing.id!, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ---- Sort list ----

function SortList({
  links,
  variant,
  onReorder,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  links: SocialLinkItem[];
  variant: "colored" | "dark";
  onReorder: (next: SocialLinkItem[]) => void;
  onEdit: (id: string) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = links.findIndex((l) => l.id === active.id);
    const to = links.findIndex((l) => l.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(links, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={links.map((l) => l.id!)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {links.map((item) => (
            <SortRow
              key={item.id}
              item={item}
              variant={variant}
              onEdit={() => onEdit(item.id!)}
              onToggleHide={() => onToggleHide(item.id!, !item.hidden)}
              onDelete={() => onDelete(item.id!)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortRow({
  item,
  variant,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  item: SocialLinkItem;
  variant: "colored" | "dark";
  onEdit: () => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id! });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-14 items-center rounded-xl border border-primary/20 bg-surface",
        item.hidden && "opacity-50",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex h-full cursor-grab items-center px-2.5 text-primary active:cursor-grabbing"
        aria-label="Drag"
      >
        <GripVertical className="size-5" />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={socialIconUrl(item, variant)}
        alt=""
        className="me-2.5 size-8 shrink-0 rounded-md object-contain"
      />
      <button
        type="button"
        onClick={onEdit}
        className="me-1 flex h-full flex-1 items-center truncate text-start text-sm font-semibold capitalize text-foreground"
      >
        {item.name || item.type}
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit"
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" />
      </button>
      <button
        type="button"
        onClick={onToggleHide}
        aria-label="Toggle visibility"
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {item.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="me-1.5 flex size-8 items-center justify-center text-error"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// ---- Icon style toggle ----

function IconStyleToggle({
  value,
  onChange,
  coloredLabel,
  darkLabel,
}: {
  value: "original" | "darkFilled";
  onChange: (v: "original" | "darkFilled") => void;
  coloredLabel: string;
  darkLabel: string;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface p-1">
      {(["original", "darkFilled"] as const).map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 rounded-[10px] py-2 text-[13px] font-semibold transition-colors",
            value === v ? "bg-card text-foreground shadow-sm" : "text-foreground/45",
          )}
        >
          {v === "original" ? coloredLabel : darkLabel}
        </button>
      ))}
    </div>
  );
}
