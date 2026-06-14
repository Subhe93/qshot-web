"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Home,
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Loader2,
  Check,
  X,
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
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/stores/editor-store";
import {
  listPages,
  showPage,
  storePage,
  renamePage,
  deletePage,
  checkPageUrl,
  updatePagesOrder,
  type WebPage,
} from "@/lib/api/pages";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";

/**
 * Pages panel — mirrors the mobile PagesSettingsFragment: a fixed Home row, then
 * the reorderable list of sub-pages (drag, listed-toggle, open, edit/delete), and
 * an "Add page" button. Opening a page loads its blocks into the editor.
 */
export function PagesPanel({
  profileId,
  onOpenPage,
}: {
  profileId: string;
  onOpenPage: () => void;
}) {
  const enterPage = useEditorStore((s) => s.enterPage);
  const exitToHome = useEditorStore((s) => s.exitToHome);
  const activePageId = useEditorStore((s) => s.pageId);

  const [pages, setPages] = useState<WebPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WebPage | "new" | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPages(await listPages(profileId));
    } catch {
      setPages([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function persistOrder(next: WebPage[]) {
    setPages(next);
    updatePagesOrder(
      next.map((p, i) => ({
        pageId: p._id,
        order: i,
        listViewStatus: p.listViewStatus ?? false,
      })),
    );
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = pages.findIndex((p) => p._id === active.id);
    const to = pages.findIndex((p) => p._id === over.id);
    if (from < 0 || to < 0) return;
    persistOrder(arrayMove(pages, from, to));
  }

  function toggleListed(p: WebPage) {
    persistOrder(
      pages.map((x) =>
        x._id === p._id ? { ...x, listViewStatus: !x.listViewStatus } : x,
      ),
    );
  }

  async function openPage(p: WebPage) {
    setBusyId(p._id);
    try {
      const res = await showPage(p._id);
      if (res) {
        enterPage({ pageId: p._id, pageName: p.listName, blocks: res.blocks });
        onOpenPage();
      }
    } finally {
      setBusyId(null);
    }
  }

  function openHome() {
    exitToHome();
    onOpenPage();
  }

  return (
    <div className="mx-auto max-w-md p-4">
      {/* Home row (fixed) */}
      <button
        type="button"
        onClick={openHome}
        className="mb-2 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-start transition-colors hover:bg-surface"
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Home className="size-[18px]" />
        </span>
        <span className="flex-1 text-sm font-semibold text-foreground">Home</span>
        {activePageId === null && (
          <span className="text-[11px] font-semibold text-primary">Editing</span>
        )}
      </button>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={pages.map((p) => p._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {pages.map((p) => (
                <PageRow
                  key={p._id}
                  page={p}
                  active={activePageId === p._id}
                  busy={busyId === p._id}
                  onOpen={() => openPage(p)}
                  onToggle={() => toggleListed(p)}
                  onEdit={() => setEditing(p)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add page */}
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" /> Add webpage
      </button>

      {editing && (
        <PageEditorSheet
          profileId={profileId}
          page={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function PageRow({
  page,
  active,
  busy,
  onOpen,
  onToggle,
  onEdit,
}: {
  page: WebPage;
  active: boolean;
  busy: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page._id });
  const listed = page.listViewStatus ?? false;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-2xl border bg-card px-2 py-2.5 ${
        active ? "border-primary" : "border-border"
      } ${isDragging ? "opacity-60" : ""} ${listed ? "" : "opacity-50"}`}
    >
      <button
        type="button"
        className="flex size-7 cursor-grab touch-none items-center justify-center text-muted-foreground/60"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
      >
        <GripVertical className="size-4" />
      </button>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-start">
        <p className="truncate text-sm font-semibold text-foreground">{page.listName}</p>
        <p className="truncate text-[11px] text-muted-foreground">/{page.urlName}</p>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle listed"
        className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"
      >
        {listed ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex h-8 items-center rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : "Open"}
      </button>
    </div>
  );
}

function PageEditorSheet({
  profileId,
  page,
  onClose,
  onSaved,
}: {
  profileId: string;
  page: WebPage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(page?.listName ?? "");
  const [url, setUrl] = useState(page?.urlName ?? "");
  const [checking, setChecking] = useState(false);
  const [taken, setTaken] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slugify = (v: string) =>
    v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  function onUrlChange(v: string) {
    const slug = slugify(v);
    setUrl(slug);
    setTaken(null);
    if (debounce.current) clearTimeout(debounce.current);
    if (!slug || slug === page?.urlName) return;
    setChecking(true);
    debounce.current = setTimeout(async () => {
      try {
        setTaken(await checkPageUrl(slug, profileId));
      } catch {
        setTaken(null);
      } finally {
        setChecking(false);
      }
    }, 300);
  }

  const valid = name.trim() && url.trim() && taken !== true && !checking;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      if (page) await renamePage(page._id, url, name);
      else await storePage({ userProfileId: profileId, urlName: url, listName: name });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!page || saving) return;
    setSaving(true);
    try {
      await deletePage(page._id);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      title={page ? "Edit page" : "New page"}
      onClose={onClose}
      footer={
        <div className="flex gap-2 border-t border-border p-4">
          {page && (
            <Button variant="outline" onClick={remove} disabled={saving} aria-label="Delete">
              <Trash2 className="size-4 text-error" />
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={!valid || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!page && !url) onUrlChange(e.target.value);
            }}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
            placeholder="Page name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">URL</span>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-primary">
            <span className="text-sm text-muted-foreground">/</span>
            <input
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm outline-none"
              placeholder="page-url"
            />
            {checking ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : taken === false ? (
              <Check className="size-4 text-success" />
            ) : taken === true ? (
              <X className="size-4 text-error" />
            ) : null}
          </div>
          {taken === true && (
            <span className="mt-1 block text-[11px] text-error">This URL is taken</span>
          )}
        </label>
      </div>
    </BottomSheet>
  );
}
