"use client";

import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "@/stores/editor-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { argbToHex, hexToArgb } from "@/lib/builder/color";
import type {
  Block,
  ButtonBlock,
  ButtonItem,
  DividerBlock,
  HeaderBlock,
  ParagraphBlock,
  SocialLinksBlock,
  SpacerBlock,
} from "@/lib/types/blocks";
import { nanoid } from "nanoid";

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
  const name = typeof settings.name === "object" ? settings.name?.text : "";
  const bio = typeof settings.bio === "string" ? settings.bio : settings.bio?.text;

  return (
    <Section title={t("heroSettings")}>
      <Field label={t("fields.name")}>
        <Input
          value={name ?? ""}
          onChange={(e) => update({ name: { ...settings.name, text: e.target.value } })}
        />
      </Field>
      <Field label={t("fields.bio")}>
        <Textarea
          value={bio ?? ""}
          onChange={(e) => update({ bio: e.target.value })}
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
    </Section>
  );
}

function BlockSettings({ block }: { block: Block }) {
  const t = useTranslations("builder");
  const update = useEditorStore((s) => s.updateBlock);
  const set = (patch: Partial<Block>) => update(block.id, patch);

  let body: React.ReactNode = null;

  switch (block.type) {
    case "HeaderBlock": {
      const b = block as HeaderBlock;
      body = (
        <>
          <Field label={t("fields.text")}>
            <Input value={b.value} onChange={(e) => set({ value: e.target.value } as Partial<Block>)} />
          </Field>
          <Field label={t("fields.size")}>
            <Input
              type="number"
              value={b.size}
              onChange={(e) => set({ size: Number(e.target.value) } as Partial<Block>)}
            />
          </Field>
          <Field label={t("fields.align")}>
            <Segmented
              value={b.align}
              options={["left", "center", "right"]}
              onChange={(v) => set({ align: v } as Partial<Block>)}
            />
          </Field>
        </>
      );
      break;
    }
    case "ParagraphBlock": {
      const b = block as ParagraphBlock;
      body = (
        <Field label={t("fields.text")}>
          <Textarea
            value={b.content}
            onChange={(e) => set({ content: e.target.value } as Partial<Block>)}
          />
        </Field>
      );
      break;
    }
    case "ButtonBlock": {
      const b = block as ButtonBlock;
      const buttons = b.buttons ?? [];
      const setButtons = (next: ButtonItem[]) =>
        set({ buttons: next } as Partial<Block>);
      body = (
        <>
          <Field label={t("fields.layout")}>
            <Segmented
              value={b.layout_type ?? "list"}
              options={["list", "grid"]}
              onChange={(v) => set({ layout_type: v } as Partial<Block>)}
            />
          </Field>
          {buttons.map((btn, i) => (
            <div key={btn.id ?? i} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("fields.button")} {i + 1}
                </span>
                <button
                  type="button"
                  className="text-error"
                  onClick={() => setButtons(buttons.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <Input
                placeholder={t("fields.title")}
                value={btn.title}
                onChange={(e) =>
                  setButtons(
                    buttons.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                placeholder="https://…"
                value={btn.url ?? ""}
                onChange={(e) =>
                  setButtons(
                    buttons.map((x, j) =>
                      j === i ? { ...x, url: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          <AddRow
            label={t("fields.addButton")}
            onClick={() =>
              setButtons([...buttons, { id: nanoid(), title: "Button", url: "" }])
            }
          />
        </>
      );
      break;
    }
    case "SocialLinksBlock": {
      const b = block as SocialLinksBlock;
      const links = b.links ?? [];
      const setLinks = (next: typeof links) => set({ links: next } as Partial<Block>);
      body = (
        <>
          {links.map((l, i) => (
            <div key={l.id ?? i} className="space-y-2 rounded-lg border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {t("fields.link")} {i + 1}
                </span>
                <button
                  type="button"
                  className="text-error"
                  onClick={() => setLinks(links.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <select
                value={l.type}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)),
                  )
                }
                className="h-10 w-full rounded-lg border border-input bg-card px-2 text-sm"
              >
                {["instagram", "twitter", "facebook", "linkedin", "github", "youtube"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ),
                )}
              </select>
              <Input
                placeholder="https://…"
                value={l.url}
                onChange={(e) =>
                  setLinks(
                    links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                  )
                }
              />
            </div>
          ))}
          <AddRow
            label={t("fields.addLink")}
            onClick={() =>
              setLinks([
                ...links,
                { id: nanoid(), type: "instagram", url: "" },
              ])
            }
          />
        </>
      );
      break;
    }
    case "DividerBlock": {
      const b = block as DividerBlock;
      body = (
        <>
          <Field label={t("fields.thickness")}>
            <Input
              type="number"
              value={b.space}
              onChange={(e) => set({ space: Number(e.target.value) } as Partial<Block>)}
            />
          </Field>
          <Field label={t("fields.color")}>
            <input
              type="color"
              value={typeof b.color === "string" ? b.color : "#e4e7ed"}
              onChange={(e) => set({ color: e.target.value } as Partial<Block>)}
              className="h-10 w-full rounded-lg border border-input"
            />
          </Field>
        </>
      );
      break;
    }
    case "SpacerBlock": {
      const b = block as SpacerBlock;
      body = (
        <Field label={t("fields.height")}>
          <Input
            type="number"
            value={b.space}
            onChange={(e) => set({ space: Number(e.target.value) } as Partial<Block>)}
          />
        </Field>
      );
      break;
    }
    default:
      body = (
        <p className="text-sm text-muted-foreground">{t("noSettings")}</p>
      );
  }

  const supportsBg = block.type !== "SpacerBlock" && block.type !== "DividerBlock";

  return (
    <Section title={t(`blocks.${labelKeyOf(block.type)}`)}>
      {body}
      {supportsBg && (
        <Field label={t("fields.background")}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!block.useBackgroundColor}
              onChange={(e) =>
                set({ useBackgroundColor: e.target.checked } as Partial<Block>)
              }
            />
            <input
              type="color"
              value={argbToHex(block.backgroundColor ?? undefined)}
              onChange={(e) =>
                set({ backgroundColor: hexToArgb(e.target.value) } as Partial<Block>)
              }
              className="h-10 flex-1 rounded-lg border border-input"
            />
          </div>
        </Field>
      )}
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

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-lg border border-input p-0.5">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={
            "flex-1 rounded-md py-1.5 text-xs capitalize " +
            (value === o ? "bg-primary text-white" : "text-muted-foreground")
          }
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 text-sm text-primary"
    >
      <Plus className="size-4" />
      {label}
    </button>
  );
}

function labelKeyOf(type: string): string {
  const map: Record<string, string> = {
    HeaderBlock: "header",
    ParagraphBlock: "paragraph",
    ButtonBlock: "button",
    SocialLinksBlock: "social",
    DividerBlock: "divider",
    SpacerBlock: "spacer",
  };
  return map[type] ?? "block";
}
