"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronRight,
  Type,
  AlignLeft,
  ListChecks,
  Star,
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
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "@/stores/editor-store";
import { hexToArgbA } from "@/lib/builder/color";
import { cn } from "@/lib/utils";
import type { FormBlock, FormQuestion } from "@/lib/types/blocks";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Input } from "@/components/ui/input";
import { GroupedCard, ColorRow } from "./sheet-kit";

/** Question types — mobile FormBlockType enum order/labels. */
const QUESTION_TYPES = [
  { type: "text", Icon: Type, label: "Text" },
  { type: "paragraph", Icon: AlignLeft, label: "Paragraph" },
  { type: "choices", Icon: ListChecks, label: "Choices" },
  { type: "rating", Icon: Star, label: "Rating" },
] as const;

type QType = (typeof QUESTION_TYPES)[number]["type"];

function QuestionTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = QUESTION_TYPES.find((q) => q.type === type)?.Icon ?? Type;
  return <Icon className={className} />;
}

/**
 * Form block editor mirroring the mobile `FormEditorSheet` + `FormBuilder` +
 * `ComposeFormModuleSheet`. The mobile sheet is a single scroll body (no tabs):
 * accent title field, a grouped background-color card, a divider, then the
 * reorderable question list with an "add question" button. Tapping a question
 * opens a compose sheet (type panel + question / description / required +
 * per-type fields). Edits apply live via updateBlock.
 */
export function FormBlockEditor({ block }: { block: FormBlock }) {
  const t = useTranslations("builder");
  const updateBlock = useEditorStore((s) => s.updateBlock);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const questions = block.questions ?? [];
  const setBlock = (patch: Partial<FormBlock>) => updateBlock(block.id, patch);
  const setQuestions = (next: FormQuestion[]) => setBlock({ questions: next });

  function addQuestion() {
    const q: FormQuestion = {
      type: "text",
      data: { question: "", description: null, required: true, hint: "" },
    };
    const next = [...questions, q];
    setQuestions(next);
    setEditingIndex(next.length - 1);
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          {t("fields.title")}
        </label>
        <Input
          dir={block.title && /[؀-ۿ]/.test(block.title) ? "rtl" : undefined}
          value={block.title}
          onChange={(e) => setBlock({ title: e.target.value })}
        />
      </div>

      {/* Background color */}
      <GroupedCard>
        <ColorRow
          label={t("fields.background")}
          color={block.background_color ?? hexToArgbA("#000000")!}
          enabled={!!block.use_background_color}
          onColor={(c) => setBlock({ background_color: c })}
          onToggle={(v) => setBlock({ use_background_color: v })}
        />
      </GroupedCard>

      <div className="h-px bg-foreground/[0.15]" />

      {/* Question list */}
      <QuestionList
        questions={questions}
        onReorder={setQuestions}
        onEdit={(i) => setEditingIndex(i)}
        onDelete={(i) => setQuestions(questions.filter((_, idx) => idx !== i))}
        defaultLabel="Default"
      />

      <button
        type="button"
        onClick={addQuestion}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-foreground/30 bg-foreground/[0.06] py-3 text-sm font-semibold text-primary transition-colors hover:bg-foreground/[0.1]"
      >
        <Plus className="size-4" />
        {"New question"}
      </button>

      {editingIndex != null && questions[editingIndex] && (
        <QuestionEditor
          question={questions[editingIndex]}
          onSave={(q) => {
            setQuestions(questions.map((x, i) => (i === editingIndex ? q : x)));
            setEditingIndex(null);
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}

// ---- Reorderable question list (mobile FormBuilder ReorderableList) ----

function QuestionList({
  questions,
  onReorder,
  onEdit,
  onDelete,
  defaultLabel,
}: {
  questions: FormQuestion[];
  onReorder: (next: FormQuestion[]) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  defaultLabel: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    if (from !== -1 && to !== -1) onReorder(arrayMove(questions, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={questions.map((_, i) => String(i))}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {questions.map((q, i) => (
            <SortableQuestionRow
              key={i}
              id={String(i)}
              question={q}
              defaultLabel={defaultLabel}
              onEdit={() => onEdit(i)}
              onDelete={() => onDelete(i)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableQuestionRow({
  id,
  question,
  defaultLabel,
  onEdit,
  onDelete,
}: {
  id: string;
  question: FormQuestion;
  defaultLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const data = question.data ?? {};
  const label = (data.question ?? "") + (data.required ? "*" : "");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center rounded-[10px] border border-foreground/20 bg-foreground/[0.1] ps-1.5",
        isDragging && "z-10 shadow-lg",
      )}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center p-2 text-foreground active:cursor-grabbing"
        aria-label="Drag"
      >
        <GripVertical className="size-5" />
      </span>
      <span className="me-2 h-[30px] w-px bg-foreground" />
      <QuestionTypeIcon type={question.type} className="size-5 shrink-0 text-foreground" />
      <button
        type="button"
        onClick={onEdit}
        className="ms-1 flex h-12 flex-1 items-center gap-1 truncate text-start text-sm font-medium text-foreground"
      >
        <span className="truncate">{label}</span>
        <ChevronRight className="size-3 shrink-0 rtl:rotate-180" />
      </button>
      {data.by_default ? (
        <span className="mx-1 shrink-0 rounded-md bg-primary px-1.5 py-[3px] text-[9px] font-medium text-white">
          {defaultLabel}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete"
        className="flex size-10 items-center justify-center text-foreground"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

// ---- Compose question sheet (mobile ComposeFormModuleSheet) ----

function QuestionEditor({
  question,
  onSave,
  onClose,
}: {
  question: FormQuestion;
  onSave: (q: FormQuestion) => void;
  onClose: () => void;
}) {
  const t = useTranslations("builder");
  const [type, setType] = useState<QType>(
    (QUESTION_TYPES.find((q) => q.type === question.type)?.type ?? "text") as QType,
  );
  // Defaults match the mobile CreateFormBlockCubit._defaultData.
  const [data, setData] = useState<FormQuestion["data"]>({
    choices_type: "single",
    required: true,
    stars_number: 5,
    ...question.data,
  });

  const put = (key: string, value: unknown) =>
    setData((d) => ({ ...d, [key]: value }));

  const choices = (data.choices as string[] | undefined) ?? [];

  function save() {
    // Project the data down to the type's relevant keys (mobile `result`).
    const result: FormQuestion["data"] = {
      question: data.question,
      description: data.description,
      required: data.required,
    };
    if (data.by_default != null) result.by_default = data.by_default;
    if (type === "text" || type === "paragraph") {
      result.hint = data.hint;
    } else if (type === "choices") {
      result.choices_type = data.choices_type;
      result.choices = choices;
    } else if (type === "rating") {
      result.stars_number = data.stars_number;
    }
    onSave({ type, data: result });
  }

  return (
    <BottomSheet onClose={onClose} className="max-w-md">
      <div className="space-y-6 px-[18px] py-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-full bg-surface text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Type panel */}
        <div className="flex gap-2">
          {QUESTION_TYPES.map(({ type: ty, Icon, label }) => {
            const selected = ty === type;
            return (
              <button
                key={ty}
                type="button"
                onClick={() => setType(ty)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-xl border py-3 text-[11px] font-semibold transition-colors",
                  selected
                    ? "border-primary bg-primary/[0.06] text-primary"
                    : "border-border text-foreground/55",
                )}
              >
                <Icon className="size-6" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Question */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Question
          </label>
          <Input
            value={(data.question as string) ?? ""}
            maxLength={40}
            placeholder="Add your question"
            onChange={(e) => put("question", e.target.value)}
          />
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            Description
          </label>
          <textarea
            value={(data.description as string) ?? ""}
            maxLength={100}
            rows={2}
            placeholder="Describe your question (optional)"
            onChange={(e) => put("description", e.target.value)}
            className="w-full resize-none rounded-md border border-border bg-card px-5 py-2.5 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>

        {/* Required / optional */}
        <ChipSelect
          label={t("fields.required")}
          options={[
            { label: t("fields.required"), value: true },
            { label: "Optional", value: false },
          ]}
          selected={data.required}
          onChange={(v) => put("required", v)}
        />

        {/* Type-specific */}
        {(type === "text" || type === "paragraph") && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Hint
            </label>
            <Input
              value={(data.hint as string) ?? ""}
              placeholder="Hint text (optional)"
              onChange={(e) => put("hint", e.target.value)}
            />
          </div>
        )}

        {type === "choices" && (
          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">
              Choices
            </label>
            {choices.map((choice, i) => (
              <div key={i} className="relative">
                <Input
                  value={choice}
                  placeholder="Your option"
                  onChange={(e) =>
                    put(
                      "choices",
                      choices.map((c, idx) => (idx === i ? e.target.value : c)),
                    )
                  }
                  className="pe-9"
                />
                <button
                  type="button"
                  aria-label="Remove option"
                  onClick={() => put("choices", choices.filter((_, idx) => idx !== i))}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => put("choices", [...choices, ""])}
              className="w-full rounded-md border border-border py-2 text-sm font-medium italic text-primary"
            >
              Add choice
            </button>
            <ChipSelect
              label={t("fields.type")}
              options={[
                { label: "Multiple choices", value: "multiple" },
                { label: "Single choice", value: "single" },
              ]}
              selected={data.choices_type}
              onChange={(v) => put("choices_type", v)}
            />
          </div>
        )}

        {type === "rating" && (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Number of stars
            </label>
            <Input
              type="number"
              min={3}
              max={5}
              value={String((data.stars_number as number | undefined) ?? 5)}
              onChange={(e) => put("stars_number", Number(e.target.value) || 5)}
            />
          </div>
        )}

        <button
          type="button"
          onClick={save}
          className="h-12 w-full rounded-xl bg-primary text-sm font-semibold text-white"
        >
          {t("save")}
        </button>
      </div>
    </BottomSheet>
  );
}

// ---- Chip-style segmented selection (mobile buildSelection) ----

function ChipSelect<T>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  selected: unknown;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-muted-foreground">{label}</label>
      <div className="flex flex-wrap gap-2.5">
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "h-8 rounded-full px-[15px] text-[13px] font-medium transition-colors",
                active ? "bg-primary text-white" : "bg-foreground/[0.08] text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
