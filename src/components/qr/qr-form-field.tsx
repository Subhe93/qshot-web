"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  AlignLeft,
  ListChecks,
  Star,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * QR dynamic "form" attribute builder — mirrors the mobile FormBuilder /
 * CreateFormBlock. Stores an array of { type, data } questions:
 *  - text/paragraph: { question, description, required, hint }
 *  - choices:        { question, description, required, choices_type, choices }
 *  - rating:         { question, description, required, stars_number }
 */

type QFType = "text" | "paragraph" | "choices" | "rating";
interface QFQuestion {
  type: QFType;
  data: {
    question?: string;
    description?: string;
    required?: boolean;
    hint?: string;
    choices_type?: "single" | "multiple";
    choices?: string[];
    stars_number?: number;
    [key: string]: unknown;
  };
}

const TYPE_META: { type: QFType; labelKey: string; Icon: typeof Type }[] = [
  { type: "text", labelKey: "shortText", Icon: Type },
  { type: "paragraph", labelKey: "paragraphType", Icon: AlignLeft },
  { type: "choices", labelKey: "choicesType", Icon: ListChecks },
  { type: "rating", labelKey: "ratingType", Icon: Star },
];

function toQuestions(value: unknown): QFQuestion[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as QFQuestion[]) : [];
}

export function QrFormField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const t = useTranslations("qr");
  const questions = toQuestions(value);
  const [editing, setEditing] = useState<{ index: number; q: QFQuestion } | null>(
    null,
  );

  function commit(next: QFQuestion[]) {
    onChange(next);
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = questions.slice();
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }
  function remove(i: number) {
    commit(questions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      {questions.map((q, i) => {
        const meta = TYPE_META.find((m) => m.type === q.type) ?? TYPE_META[0];
        return (
          <div
            key={i}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-primary">
              <meta.Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {q.data.question || t(meta.labelKey)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t(meta.labelKey)}
                {q.data.required ? ` · ${t("required")}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => move(i, -1)} aria-label="Up" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === 0}>
              <ChevronUp className="size-4" />
            </button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Down" className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={i === questions.length - 1}>
              <ChevronDown className="size-4" />
            </button>
            <button type="button" onClick={() => setEditing({ index: i, q })} aria-label="Edit" className="text-muted-foreground hover:text-primary">
              <Pencil className="size-4" />
            </button>
            <button type="button" onClick={() => remove(i)} aria-label="Delete" className="text-muted-foreground hover:text-error">
              <Trash2 className="size-4" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          setEditing({
            index: -1,
            q: { type: "text", data: { required: true } },
          })
        }
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
      >
        <Plus className="size-4" /> {t("addQuestion")}
      </button>

      {editing && (
        <QuestionEditor
          initial={editing.q}
          onClose={() => setEditing(null)}
          onSave={(q) => {
            const next = questions.slice();
            if (editing.index < 0) next.push(q);
            else next[editing.index] = q;
            commit(next);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function QuestionEditor({
  initial,
  onClose,
  onSave,
}: {
  initial: QFQuestion;
  onClose: () => void;
  onSave: (q: QFQuestion) => void;
}) {
  const t = useTranslations("qr");
  const [type, setType] = useState<QFType>(initial.type);
  const [question, setQuestion] = useState(initial.data.question ?? "");
  const [description, setDescription] = useState(initial.data.description ?? "");
  const [required, setRequired] = useState(initial.data.required ?? true);
  const [hint, setHint] = useState(initial.data.hint ?? "");
  const [choicesType, setChoicesType] = useState<"single" | "multiple">(
    initial.data.choices_type ?? "single",
  );
  const [choices, setChoices] = useState<string[]>(
    initial.data.choices ?? ["", ""],
  );
  const [stars, setStars] = useState(initial.data.stars_number ?? 5);

  function build(): QFQuestion {
    const data: QFQuestion["data"] = { question, description, required };
    if (type === "text" || type === "paragraph") data.hint = hint;
    else if (type === "choices") {
      data.choices_type = choicesType;
      data.choices = choices.map((c) => c.trim()).filter(Boolean);
    } else if (type === "rating") data.stars_number = stars;
    return { type, data };
  }

  const valid =
    question.trim() &&
    (type !== "choices" || choices.filter((c) => c.trim()).length >= 2);

  return (
    <BottomSheet
      title={initial.data.question ? t("editQuestion") : t("newQuestion")}
      onClose={onClose}
      footer={
        <div className="p-4">
          <Button
            variant="gradient"
            className="w-full"
            disabled={!valid}
            onClick={() => onSave(build())}
          >
            {t("save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Type picker */}
        <div className="grid grid-cols-4 gap-2">
          {TYPE_META.map(({ type: tt, labelKey, Icon }) => (
            <button
              key={tt}
              type="button"
              onClick={() => setType(tt)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-medium transition-colors ${
                type === tt
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-surface"
              }`}
            >
              <Icon className="size-5" />
              {t(labelKey)}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">{t("questionLabel")}</span>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("questionLabel")} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">{t("descriptionOptional")}</span>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        {(type === "text" || type === "paragraph") && (
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("hintLabel")}</span>
            <Input value={hint} onChange={(e) => setHint(e.target.value)} />
          </label>
        )}

        {type === "choices" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              {(["single", "multiple"] as const).map((ct) => (
                <button
                  key={ct}
                  type="button"
                  onClick={() => setChoicesType(ct)}
                  className={`h-8 flex-1 rounded-lg text-xs font-medium ${
                    choicesType === ct ? "brand-gradient text-white" : "border border-border"
                  }`}
                >
                  {ct === "single" ? t("singleChoice") : t("multipleChoice")}
                </button>
              ))}
            </div>
            {choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={c}
                  placeholder={`${t("choice")} ${i + 1}`}
                  onChange={(e) =>
                    setChoices(choices.map((x, idx) => (idx === i ? e.target.value : x)))
                  }
                />
                <button
                  type="button"
                  onClick={() => setChoices(choices.filter((_, idx) => idx !== i))}
                  aria-label="Remove choice"
                  className="text-muted-foreground hover:text-error"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setChoices([...choices, ""])}
              className="text-sm font-medium text-primary"
            >
              + {t("addChoice")}
            </button>
          </div>
        )}

        {type === "rating" && (
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("starsNumber")}</span>
            <div className="flex gap-2">
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n)}
                  className={`h-9 flex-1 rounded-lg text-sm font-medium ${
                    stars === n ? "brand-gradient text-white" : "border border-border"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Required toggle */}
        <label className="flex items-center justify-between">
          <span className="text-sm">{t("required")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={required}
            onClick={() => setRequired((v) => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${required ? "brand-gradient" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${required ? "start-[22px]" : "start-0.5"}`} />
          </button>
        </label>
      </div>
    </BottomSheet>
  );
}
