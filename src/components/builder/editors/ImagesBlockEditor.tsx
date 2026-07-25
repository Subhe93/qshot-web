"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { nanoid } from "nanoid";
import {
  ArrowUpDown,
  LayoutGrid,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Trash2,
  GripVertical,
  Copy,
  ImagePlus,
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
import { uploadImage } from "@/lib/api/media";
import { hexToArgbA } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type {
  ImagesBlock,
  ImageItem,
  ImagesLayoutType,
} from "@/lib/types/blocks";
import { ImageUploader } from "@/components/builder/hero/CoverTab";
import { ImageCropper } from "@/components/ui/image-cropper";
import { croppedUploadFile } from "@/lib/builder/crop-image";
import {
  SheetTabBar,
  GroupedCard,
  GroupedRow,
  ColorRow,
  type SheetTab,
} from "./sheet-kit";
import { LayoutPicker } from "./LayoutPicker";

type Tab = "sort" | "layout" | "settings";

/**
 * Layout metadata mirroring the mobile `ImagesBlockLayoutType` enum + the layout
 * picker labels in images_settings_sheet.dart. `aspect` is the per-card
 * cardAspectRatio used by the crop step; `null` for singleSizable.
 */
const LAYOUTS: ReadonlyArray<{
  type: ImagesLayoutType;
  label: string;
  aspect: number | null;
  svg: string;
}> = [
  { type: "cards", label: "Square Large 1:1", aspect: 1, svg: "layout_swiper_card_large.svg" },
  { type: "carousel", label: "Square Small 1:1", aspect: 1, svg: "image_layout_carousel.svg" },
  { type: "shorts", label: "Vertical 9:16", aspect: 9 / 16, svg: "image_layout_shorts.svg" },
  { type: "swiper", label: "Horizontal 16:9", aspect: 16 / 9, svg: "image_layout_swiper_16_9.svg" },
  { type: "list", label: "List 16:9", aspect: 16 / 9, svg: "layout_list.svg" },
  { type: "grid", label: "Grid 1:1", aspect: 1, svg: "layout_grid.svg" },
  {
    type: "singleSizable",
    label: "Single resizable image",
    aspect: null,
    svg: "image_layout_swiper_sizable.svg",
  },
];

/**
 * Per-layout crop aspect ratio (width/height), keyed by layout_type. Mirrors the
 * mobile `cardAspectRatio` and the web viewer's per-card aspect. `null` =
 * singleSizable (free / no fixed crop). Used to decide whether a layout change
 * needs the images re-cropped.
 */
const ASPECT = Object.fromEntries(
  LAYOUTS.map((l) => [l.type, l.aspect]),
) as Record<ImagesLayoutType, number | null>;

/**
 * Image block editor, mirroring the mobile ImagesSettingsSheet:
 * Sort (add/reorder/hide/replace/delete images) / Layout (swipe picker of the
 * five layout types) / Settings (duplicate + background color).
 */
export function ImagesBlockEditor({ block }: { block: ImagesBlock }) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const addBlock = useEditorStore((s) => s.addBlock);
  const [tab, setTab] = useState<Tab>("sort");
  // Sequential re-crop queue after a layout change to a different aspect
  // (mobile cropImagesRect). `index` walks the items list one image at a time.
  const [recrop, setRecrop] = useState<{ aspect: number; index: number } | null>(
    null,
  );

  const items = block.items ?? [];
  const setBlock = (patch: Partial<ImagesBlock>) => updateBlock(block.id, patch);
  const setItems = (next: ImageItem[]) => setBlock({ items: next });

  const tabs: SheetTab<Tab>[] = [
    { value: "sort", label: t("tabs.sort"), Icon: ArrowUpDown },
    { value: "layout", label: t("tabs.layout"), Icon: LayoutGrid },
    { value: "settings", label: t("tabs.settings"), Icon: SettingsIcon },
  ];

  return (
    <div className="space-y-4">
      <SheetTabBar tabs={tabs} current={tab} onChange={setTab} />

      {tab === "sort" && (
        <SortTab
          items={items}
          // Mobile _addItems crops at block.layoutType.cardAspectRatio — the
          // CURRENT layout drives the crop (carousel/cards/grid 1:1, shorts
          // 9:16, swiper/list 16:9). singleSizable has no fixed aspect (null);
          // fall back to 16:9 (the image stays freely resizable via its rect).
          aspect={ASPECT[block.layout_type ?? "cards"] ?? 16 / 9}
          onAdd={(url) =>
            setItems([...items, { id: nanoid(), url, hidden: false }])
          }
          onReplace={(id, url) =>
            setItems(items.map((it) => (it.id === id ? { ...it, url } : it)))
          }
          onReorder={setItems}
          onToggleHide={(id, hidden) =>
            setItems(items.map((it) => (it.id === id ? { ...it, hidden } : it)))
          }
          onDelete={(id) => setItems(items.filter((it) => it.id !== id))}
        />
      )}

      {tab === "layout" && (
        <LayoutPicker
          options={LAYOUTS.map((l) => ({
            type: l.type,
            label: t(`imageLayouts.${l.type}`),
            svg: l.svg,
          }))}
          value={block.layout_type ?? "cards"}
          onChange={(v) => {
            const current = block.layout_type ?? "cards";
            const nextAspect = ASPECT[v];
            const changedAspect =
              nextAspect != null && nextAspect !== ASPECT[current];
            // Apply the new layout immediately (live preview, matching the mobile
            // page-change preview). If the crop aspect changed and there are
            // images, kick off a sequential re-crop starting at the first image.
            setBlock({ layout_type: v });
            if (changedAspect && items.length > 0) {
              setRecrop({ aspect: nextAspect, index: 0 });
            }
          }}
        />
      )}

      {tab === "settings" && (
        <GroupedCard>
          <ColorRow
            label={t("fields.background")}
            color={block.background_color ?? hexToArgbA("#000000")!}
            enabled={!!block.use_background_color}
            onColor={(c) => setBlock({ background_color: c })}
            onToggle={(v) => setBlock({ use_background_color: v })}
          />
          <GroupedRow
            Icon={Copy}
            color="#7c3aed"
            title={t("fields.duplicate")}
            onClick={() => addBlock({ ...block, id: nanoid() })}
          />
        </GroupedCard>
      )}

      {/* Re-crop each image to the newly chosen layout aspect (mobile
          cropImagesRect). Runs sequentially; cancelling stops the queue but
          keeps the already-applied layout and any images cropped so far. */}
      {recrop && items[recrop.index] && (
        <ImageCropper
          key={recrop.index}
          // Load through our same-origin proxy — the CDN has no CORS headers, so
          // a direct CDN <img> would taint the canvas and break toBlob() export.
          src={`/api/image-proxy?url=${encodeURIComponent(
            cdnUrl(items[recrop.index].url),
          )}`}
          title={t("cropTitle")}
          cancelLabel={tc("cancel")}
          confirmLabel={t("cropConfirm")}
          aspect={recrop.aspect}
          onCancel={() => setRecrop(null)}
          onCropped={async (blob) => {
            const idx = recrop.index;
            const file = croppedUploadFile(blob, "image");
            const uploaded = await uploadImage(file);
            if (uploaded) {
              // Crop is baked into the uploaded pixels, so clear any stale rect
              // (matches the add-image flow, which stores no rect).
              setItems(
                items.map((it, i) =>
                  i === idx ? { ...it, url: uploaded, rect: null } : it,
                ),
              );
            }
            const next = idx + 1;
            setRecrop(next < items.length ? { aspect: recrop.aspect, index: next } : null);
          }}
        />
      )}
    </div>
  );
}

// ---- Sort tab ----

function SortTab({
  items,
  aspect,
  onAdd,
  onReplace,
  onReorder,
  onToggleHide,
  onDelete,
}: {
  items: ImageItem[];
  /** Crop aspect for add/replace — the current layout's cardAspectRatio. */
  aspect: number;
  onAdd: (url: string) => void;
  onReplace: (id: string, url: string) => void;
  onReorder: (next: ImageItem[]) => void;
  onToggleHide: (id: string, hidden: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((it) => it.id === active.id);
    const to = items.findIndex((it) => it.id === over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to));
  }

  return (
    <div className="space-y-2">
      {/* Add image (mobile: pickMultiImage → crop at the layout's aspect →
          upload). The web uploader crops + uploads a single image; appended. */}
      <ImageUploader
        path={undefined}
        onUploaded={onAdd}
        onDelete={() => {}}
        aspect={aspect}
        rounded="rounded-xl"
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((it) => it.id!)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortRow
                key={item.id}
                item={item}
                aspect={aspect}
                onReplace={(url) => onReplace(item.id!, url)}
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

function SortRow({
  item,
  aspect,
  onReplace,
  onToggleHide,
  onDelete,
}: {
  item: ImageItem;
  /** Crop aspect (the current layout's cardAspectRatio). */
  aspect: number;
  onReplace: (url: string) => void;
  onToggleHide: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id! });
  const [busy, setBusy] = useState(false);
  // Replacement goes through the same crop-at-layout-aspect step as adding
  // (mobile replaces via the image editor too — never a raw upload).
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  function onPickReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function onCropped(blob: Blob) {
    setBusy(true);
    try {
      const url = await uploadImage(croppedUploadFile(blob, "image"));
      if (url) onReplace(url);
    } finally {
      setBusy(false);
      closeCropper();
    }
  }

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
        aria-label={t("fields.drag")}
      >
        <GripVertical className="size-5" />
      </span>

      {/* 16:9 thumbnail (mobile sort item), tap to replace */}
      <label
        className="relative me-2.5 flex h-10 w-[71px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg"
        style={{
          border: "1px solid rgba(0,0,0,0.38)",
          backgroundColor: "rgba(255,255,255,0.2)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cdnUrl(item.url)} alt="" className="size-full object-cover" />
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-semibold text-white">
            …
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onPickReplace} />
      </label>

      <label className="flex flex-1 cursor-pointer items-center text-sm font-medium text-muted-foreground">
        <ImagePlus className="me-1.5 size-4" />
        {t("fields.replace")}
        <input type="file" accept="image/*" className="hidden" onChange={onPickReplace} />
      </label>

      <button
        type="button"
        onClick={onToggleHide}
        aria-label={t("fields.toggleVisibility")}
        className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {item.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={tc("delete")}
        className="me-1.5 flex size-8 items-center justify-center text-error"
      >
        <Trash2 className="size-4" />
      </button>

      {cropSrc && (
        <ImageCropper
          src={cropSrc}
          title={t("cropTitle")}
          cancelLabel={tc("cancel")}
          confirmLabel={t("cropConfirm")}
          aspect={aspect}
          onCancel={closeCropper}
          onCropped={onCropped}
        />
      )}
    </div>
  );
}

