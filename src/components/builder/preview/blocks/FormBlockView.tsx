import type { FormBlock, FormQuestion } from "@/lib/types/blocks";
import { dirOf } from "@/lib/builder/text-direction";

/**
 * Read-only preview of a FormModule, mirroring the mobile `FormWidget` +
 * `FormPreview` (lib/features/website/widget/editor/form_widget.dart).
 *
 * Mobile layout:
 *  - Outer Material card: foreground @ 10% opacity fill, rounded-8, padding
 *    vertical 12 / horizontal 16.
 *  - Title (headlineMedium bold) above, then a 15px gap.
 *  - FormPreview: vertical column, each question is a stretched field with a
 *    label ("question" + "*" when required), optional description (bodySmall,
 *    foreground @ 70%), an 8px gap, the input, then a 20px gap, a full-width
 *    Divider in the foreground color, and another 20px gap.
 *  - Inputs are non-submitting; a black "Submit" button closes the list.
 *
 * Question `type` variants (the FormModule has no layout_type — each QUESTION
 * renders differently): text, paragraph, choices (single/multiple), rating.
 * The foreground color is the page text color, so we use `currentColor` with
 * the mobile alpha steps (0.1 / 0.2 / 0.4 / 0.7).
 */
export function FormBlockView({ block }: { block: FormBlock }) {
  const questions = block.questions ?? [];

  return (
    <div className="my-[5px]">
      <div
        className="rounded-lg px-4 py-3"
        style={{ backgroundColor: "color-mix(in srgb, currentColor 10%, transparent)" }}
      >
        {block.title ? (
          <h2
            dir={dirOf(block.title)}
            className="text-2xl font-bold text-foreground"
          >
            {block.title}
          </h2>
        ) : null}

        <div className="h-[15px]" />

        {/* FormPreview: vertical 8px padding */}
        <div className="flex flex-col py-2">
          {questions.map((q, i) => (
            <QuestionField key={i} question={q} />
          ))}

          {/* Submit button (non-submitting) */}
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="flex h-12 items-center justify-center rounded-md bg-black px-5 text-sm font-medium text-white"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldDivider() {
  return (
    <>
      <div className="h-5" />
      <hr style={{ borderTopColor: "currentColor", borderTopWidth: 1 }} />
      <div className="h-5" />
    </>
  );
}

function FieldLabel({ data }: { data: FormQuestion["data"] }) {
  const question = (data.question ?? "") + (data.required ? "*" : "");
  return (
    <>
      <span dir={dirOf(data.question)} className="text-sm text-foreground">
        {question}
      </span>
      {data.description ? (
        <span
          dir={dirOf(data.description)}
          className="py-1 text-xs"
          style={{ color: "color-mix(in srgb, currentColor 70%, transparent)" }}
        >
          {data.description}
        </span>
      ) : null}
    </>
  );
}

const fillStyle = {
  backgroundColor: "color-mix(in srgb, currentColor 20%, transparent)",
};

function QuestionField({ question }: { question: FormQuestion }) {
  const data = question.data ?? {};

  switch (question.type) {
    case "text":
      return (
        <div className="flex flex-col">
          <FieldLabel data={data} />
          <div className="h-2" />
          <input
            type="text"
            readOnly
            placeholder={data.hint as string | undefined}
            className="rounded border border-transparent px-5 py-2.5 text-sm text-foreground outline-none placeholder:opacity-100"
            style={fillStyle}
          />
          <FieldDivider />
        </div>
      );

    case "paragraph":
      return (
        <div className="flex flex-col">
          <FieldLabel data={data} />
          <div className="h-2" />
          <textarea
            readOnly
            rows={5}
            placeholder={data.hint as string | undefined}
            className="resize-none rounded border border-transparent px-5 py-2.5 text-sm text-foreground outline-none"
            style={fillStyle}
          />
          <FieldDivider />
        </div>
      );

    case "choices": {
      const choices = (data.choices as string[] | undefined) ?? [];
      const multiple = data.choices_type === "multiple";
      return (
        <div className="flex flex-col">
          <FieldLabel data={data} />
          <div className="h-2" />
          <div className="flex flex-col gap-[5px]">
            {choices.map((choice, i) => (
              <label
                key={i}
                className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-foreground"
                style={fillStyle}
              >
                <span
                  aria-hidden
                  className={multiple ? "size-[18px] rounded-[3px]" : "size-[18px] rounded-full"}
                  style={{ border: "2px solid currentColor", opacity: 0.6 }}
                />
                <span dir={dirOf(choice)}>{choice}</span>
              </label>
            ))}
          </div>
          <FieldDivider />
        </div>
      );
    }

    case "rating": {
      const stars = (data.stars_number as number | undefined) ?? 5;
      return (
        <div className="flex flex-col">
          <div className="h-2" />
          <FieldLabel data={data} />
          <div className="h-2" />
          <div
            className="flex items-center justify-center rounded-[10px]"
            style={fillStyle}
          >
            {Array.from({ length: stars }).map((_, i) => (
              <span
                key={i}
                className="flex size-12 items-center justify-center text-foreground"
              >
                <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path d="M12 2.5l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.55l-5.9 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
                </svg>
              </span>
            ))}
          </div>
          <FieldDivider />
        </div>
      );
    }

    default:
      return null;
  }
}
