"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowUpDown,
  LayoutGrid,
  Palette,
  Settings as SettingsIcon,
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ArrowRight,
  Type,
  FoldVertical,
  CheckCircle2,
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
import { cdnUrl } from "@/lib/api/qrcodes";
import { hexToArgbA, argbToCss } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type {
  ButtonBlock,
  ButtonItem,
  ButtonsLayoutType,
  ButtonThemeType,
} from "@/lib/types/blocks";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  ToggleSwitch,
  type SheetTab,
} from "./sheet-kit";
import { ButtonItemEditor } from "./ButtonItemEditor";

type Tab = "sort" | "layout" | "theme" | "settings";

/**
 * Mobile brand color (AppColors.primary = 0xFF4488ff). Theme templates derive
 * every color from it, exactly like the Flutter `ButtonThemeType.applyTo`.
 */
const PRIMARY = "#4488ff";

/** ARGB int for the brand color at a given alpha (0..1). */
function primaryAlpha(alpha: number): number {
  const base = hexToArgbA(PRIMARY)! & 0x00ffffff;
  return (((Math.round(alpha * 255) & 0xff) << 24) | base) >>> 0;
}

/** ARGB int for an arbitrary hex at a given alpha (0..1). */
function hexAlpha(hex: string, alpha: number): number {
  const base = hexToArgbA(hex)! & 0x00ffffff;
  return (((Math.round(alpha * 255) & 0xff) << 24) | base) >>> 0;
}

/**
 * The five style templates, mirroring the mobile `ButtonThemeType` enum and its
 * `applyTo` exactly (order: minimal, solid, soft, outline, pill). Each entry is
 * a full `ButtonItem` style patch that gets stamped onto every button when the
 * theme is picked, plus the resolved colors used to render the preview chip.
 */
const THEMES = [
  {
    theme: "minimal",
    label: "Minimal",
    patch: {
      use_background_color: true,
      background_color: hexAlpha("#9e9e9e", 0.3), // Colors.grey @ 30%
      use_border: false,
      use_text_color: false,
      corner_radius: 8,
    },
    preview: { fill: hexAlpha("#9e9e9e", 0.3), text: null, border: null, radius: 8 },
  },
  {
    theme: "solid",
    label: "Solid",
    patch: {
      use_background_color: true,
      background_color: hexToArgbA(PRIMARY)!,
      use_border: false,
      use_text_color: true,
      text_color: hexToArgbA("#ffffff")!,
      corner_radius: 12,
    },
    preview: { fill: hexToArgbA(PRIMARY)!, text: hexToArgbA("#ffffff")!, border: null, radius: 12 },
  },
  {
    theme: "soft",
    label: "Soft",
    patch: {
      use_background_color: true,
      background_color: primaryAlpha(0.14),
      use_border: false,
      use_text_color: true,
      text_color: hexToArgbA(PRIMARY)!,
      corner_radius: 12,
    },
    preview: { fill: primaryAlpha(0.14), text: hexToArgbA(PRIMARY)!, border: null, radius: 12 },
  },
  {
    theme: "outline",
    label: "Outline",
    patch: {
      use_background_color: false,
      use_border: true,
      border_color: hexToArgbA(PRIMARY)!,
      use_text_color: true,
      text_color: hexToArgbA(PRIMARY)!,
      corner_radius: 12,
    },
    preview: { fill: null, text: hexToArgbA(PRIMARY)!, border: hexToArgbA(PRIMARY)!, radius: 12 },
  },
  {
    theme: "pill",
    label: "Pill",
    patch: {
      use_background_color: true,
      background_color: hexToArgbA(PRIMARY)!,
      use_border: false,
      use_text_color: true,
      text_color: hexToArgbA("#ffffff")!,
      corner_radius: 100,
    },
    preview: { fill: hexToArgbA(PRIMARY)!, text: hexToArgbA("#ffffff")!, border: null, radius: 100 },
  },
] as const satisfies ReadonlyArray<{
  theme: ButtonThemeType;
  label: string;
  patch: Partial<ButtonItem>;
  preview: {
    fill: number | null;
    text: number | null;
    border: number | null;
    radius: number;
  };
}>;

type Theme = (typeof THEMES)[number];

/**
 * Complete Button block editor, mirroring the mobile ButtonsSettingsSheet:
 * Sort / Layout / Theme / Settings tabs, with a nested single-item editor.
 */
export function ButtonBlockEditor({ block }: { block: ButtonBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  const [editingId, setEditingId] = useState<string | null>(null);

  const buttons = block.buttons ?? [];
  const setBlock = (patch: Partial<ButtonBlock>) => updateBlock(block.id, patch);
  const setButtons = (next: ButtonItem[]) => setBlock({ buttons: next });
  const patchButton = (id: string, patch: Partial<ButtonItem>) =>
    setButtons(buttons.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const editing = buttons.find((b) => b.id === editingId) ?? null;

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "theme", label: t("tabs.theme"), Icon: Palette },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <SortTab
          buttons={buttons}
          onReorder={setButtons}
          onAdd={() => {
            const item: ButtonItem = { id: nanoid(), title: "Button", url: "" };
            setButtons([...buttons, item]);
            setEditingId(item.id!);
          }}
          onEdit={(id) => setEditingId(id)}
          onToggleHide={(id, hidden) => patchButton(id, { hidden })}
          onDelete={(id) => setButtons(buttons.filter((b) => b.id !== id))}
          addLabel={t("fields.addButton")}
          fallbackLabel={t("blocks.button")}
        />
      )}

      {tab === "layout" && (
        <LayoutTab
          value={block.layout_type ?? "list"}
          onChange={(v) => setBlock({ layout_type: v })}
          listLabel={t("layoutList")}
          gridLabel={t("layoutGrid")}
          hint={t("swipeLayouts")}
        />
      )}

      {tab === "theme" && (
        <div className="space-y-2.5">
          {THEMES.map((theme) => (
            <ThemeOption
              key={theme.theme}
              theme={theme}
              selected={block.theme === theme.theme}
              onApply={() =>
                setBlock({
                  theme: theme.theme,
                  // Picking a theme re-stamps every button (mobile applyTo).
                  buttons: buttons.map((b) => ({ ...b, ...theme.patch })),
                })
              }
            />
          ))}
        </div>
      )}

      {tab === "settings" && (
        <div className="space-y-4">
          <AccentField
            Icon={Type}
            value={block.title ?? ""}
            placeholder={t("fields.title")}
            onChange={(v) => setBlock({ title: v })}
          />
          <GroupedCard>
            <GroupedRow
              Icon={FoldVertical}
              color="var(--primary)"
              title="Dropdown"
              trailing={
                <ToggleSwitch
                  checked={!!block.foldable}
                  onChange={(v) => setBlock({ foldable: v })}
                />
              }
            />
            <GroupedRow
              Icon={ArrowRight}
              color="#5b5bd6"
              title={t("fields.showArrow")}
              trailing={
                <ToggleSwitch
                  checked={!!block.show_arrow}
                  onChange={(v) => setBlock({ show_arrow: v })}
                />
              }
            />
            <GroupedRow
              Icon={Copy}
              color="#7c3aed"
              title={t("fields.duplicate")}
              onClick={() => addBlock({ ...block, id: nanoid() })}
            />
            <ColorRow
              label={t("fields.background")}
              color={block.background_color ?? hexToArgbA("#000000")!}
              enabled={!!block.use_background_color}
              onColor={(c) => setBlock({ background_color: c })}
              onToggle={(v) => setBlock({ use_background_color: v })}
            />
          </GroupedCard>
        </div>
      )}

      {editing && (
        <ButtonItemEditor
          item={editing}
          onChange={(patch) => patchButton(editing.id!, patch)}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// ---- Sort tab ----

function SortTab({
  buttons,
  onReorder,
  onAdd,
  onEdit,
  onToggleHide,
  onDelete,
  addLabel,
  fallbackLabel,
}: {
  buttons: ButtonItem[];
  onReorder: (next: ButtonItem[]) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
  addLabel: string;
  fallbackLabel: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = buttons.findIndex((b) => b.id === active.id);
    const to = buttons.findIndex((b) => b.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(buttons, from, to));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" />
        {addLabel}
      </button>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={buttons.map((b) => b.id!)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {buttons.map((item) => (
              <SortableButtonRow
                key={item.id}
                item={item}
                fallbackLabel={fallbackLabel}
                onEdit={() => onEdit(item.id!)}
                onToggleHide={() => onToggleHide(item.id!, !item.hidden)}
                onDelete={() => onDelete(item.id!)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableButtonRow({
  item,
  fallbackLabel,
  onEdit,
  onToggleHide,
  onDelete,
}: {
  item: ButtonItem;
  fallbackLabel: string;
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
      <span className="me-2.5 size-9 shrink-0 overflow-hidden rounded-md bg-foreground/5">
        {item.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnUrl(item.icon)} alt="" className="size-full object-cover" />
        ) : null}
      </span>
      <button
        type="button"
        onClick={onEdit}
        className="me-1 flex h-full flex-1 items-center truncate text-start text-sm font-semibold text-foreground"
      >
        {item.title || fallbackLabel}
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

// ---- Layout tab ----

/**
 * Layout tab — mirrors the mobile buttons settings PageView of layout previews
 * (buttons_settings_sheet.dart:391) with its swipe hint + SmoothPageIndicator.
 * Uses the same `layout_list.svg` / `layout_grid.svg` assets the mobile app
 * renders (Assets.svg.layoutList / layoutGrid).
 */
function LayoutTab({
  value,
  onChange,
  listLabel,
  gridLabel,
  hint,
}: {
  value: ButtonsLayoutType;
  onChange: (v: ButtonsLayoutType) => void;
  listLabel: string;
  gridLabel: string;
  hint: string;
}) {
  const layouts: { type: ButtonsLayoutType; label: string; svg: string }[] = [
    { type: "list", label: listLabel, svg: "/layouts/layout_list.svg" },
    { type: "grid", label: gridLabel, svg: "/layouts/layout_grid.svg" },
  ];

  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    layouts.findIndex((l) => l.type === value),
  );

  useEffect(() => {
    const slide = scrollRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedIndex]);

  const go = (index: number) => {
    const i = Math.min(layouts.length - 1, Math.max(0, index));
    onChange(layouts[i].type);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <LayoutArrow dir="prev" disabled={selectedIndex === 0} onClick={() => go(selectedIndex - 1)} />
        <div
          ref={scrollRef}
          className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {layouts.map((layout) => {
            const selected = layout.type === value;
            return (
              <button
                key={layout.type}
                type="button"
                onClick={() => onChange(layout.type)}
                className={cn(
                  "relative flex w-full shrink-0 snap-center flex-col items-center gap-3 rounded-2xl border p-3 transition-colors",
                  selected ? "border-primary bg-primary/[0.04]" : "border-transparent",
                )}
              >
                {selected && (
                  <span className="absolute end-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-white shadow">
                    <Check className="size-3" />
                  </span>
                )}
                <div className="flex h-32 w-full items-center justify-center rounded-xl bg-muted px-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={layout.svg} alt="" className="h-full w-full object-contain" />
                </div>
                <span className="text-sm font-semibold text-foreground">{layout.label}</span>
              </button>
            );
          })}
        </div>
        <LayoutArrow
          dir="next"
          disabled={selectedIndex === layouts.length - 1}
          onClick={() => go(selectedIndex + 1)}
        />
      </div>

      <p className="text-center text-xs text-muted-foreground">{hint}</p>

      <div className="flex justify-center gap-1.5">
        {layouts.map((layout, i) => (
          <button
            key={layout.type}
            type="button"
            aria-label={layout.type}
            onClick={() => onChange(layout.type)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === selectedIndex ? "w-3.5 bg-primary" : "w-1.5 bg-primary/20",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function LayoutArrow({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir}
      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-opacity hover:bg-muted disabled:opacity-30"
    >
      {dir === "prev" ? (
        <ChevronLeft className="size-5 rtl:rotate-180" />
      ) : (
        <ChevronRight className="size-5 rtl:rotate-180" />
      )}
    </button>
  );
}

// ---- Theme tab ----

function ThemeOption({
  theme,
  selected,
  onApply,
}: {
  theme: Theme;
  selected: boolean;
  onApply: () => void;
}) {
  const { fill, text, border, radius } = theme.preview;
  return (
    <button
      type="button"
      onClick={onApply}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-xl border bg-surface p-3 text-start transition-colors",
        selected ? "border-primary" : "border-foreground/[0.08] hover:border-primary/40",
      )}
    >
      <span
        className="flex h-[34px] w-16 items-center justify-center text-[13px] font-semibold"
        style={{
          background: fill != null ? argbToCss(fill) : "transparent",
          // Minimal theme keeps the foreground text color (use_text_color: false).
          color: text != null ? argbToCss(text) : "var(--foreground)",
          border: border != null ? `1.5px solid ${argbToCss(border)}` : undefined,
          borderRadius: Math.min(radius, 17),
        }}
      >
        Aa
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground">{theme.label}</span>
      {selected && <CheckCircle2 className="size-5 shrink-0 text-primary" />}
    </button>
  );
}

// ---- Accent text field (mirrors mobile buildAccentTitleField) ----

function AccentField({
  Icon,
  value,
  placeholder,
  onChange,
}: {
  Icon: typeof Type;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface px-3.5">
      <Icon className="size-[18px] shrink-0 text-primary" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        dir="auto"
        className="h-12 flex-1 bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-foreground/35"
      />
    </div>
  );
}
