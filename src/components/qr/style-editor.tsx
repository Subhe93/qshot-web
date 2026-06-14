"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ColorPickerField } from "@/components/ui/color-picker";
import { argbToHex, hexToArgb } from "@/lib/builder/color";
import {
  createQrCode,
  editQrCode,
  previewQrCode,
  cdnUrl,
  listQrLogos,
  createQrLogo,
  deleteQrLogo,
  type Customizes,
  type QrConfig,
  type QrType,
  type QrLogo,
} from "@/lib/api/qrcodes";
import {
  borderSrc,
  centerSrc,
  CORNER_BORDERS,
  CORNER_CENTERS,
  DOT_PATTERNS,
  dotSrc,
  frameSrc,
  frameTextLines,
  FRAMES,
  logoThumbSrc,
  logoValue,
  LOGOS,
  shapeSrc,
  SHAPES,
} from "@/lib/qr/style-catalog";
import { cn } from "@/lib/utils";

type Tab = "colors" | "shape" | "frames" | "logo";

const TABS: { key: Tab; icon: string; labelKey: string }[] = [
  { key: "colors", icon: "/qr/icons/ic_qr_color.svg", labelKey: "colors" },
  { key: "frames", icon: "/qr/icons/ic_qr_border.svg", labelKey: "frames" },
  { key: "shape", icon: "/qr/icons/ic_qr_shape.svg", labelKey: "shapeForm" },
  { key: "logo", icon: "/qr/icons/ic_qr_logo.svg", labelKey: "logo" },
];

const FONTS = [
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Raleway",
  "Poppins",
  "Oswald",
  "Merriweather",
  "Playfair Display",
  "Nunito",
];

/** Loads a Google Font into the document so the inline SVG <text> can use it. */
function ensureFontLoaded(family: string) {
  if (typeof document === "undefined" || !family) return;
  const id = "gf-" + family.replace(/\s+/g, "-").toLowerCase();
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}

/**
 * The frame templates returned by the preview ship with an empty
 * `<image id="_text_placeholder" xlink:href="">` where the banner text goes —
 * the server doesn't fill it, the client must. We replace each placeholder with
 * a fitted SVG <text> so the preview shows the frame text (mirrors the mobile).
 */
function injectFrameText(svg: string, c: Customizes): string {
  if (frameTextLines(c.advancedShape) === 0 || !c.text.trim()) return svg;
  if (typeof window === "undefined") return svg;
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    // Only the empty <image> slots are real text holders; the sibling
    // <rect id="text_placeholder"> elements are layout guides — skip them.
    const slots = Array.from(
      doc.querySelectorAll('image[id*="text_placeholder"]'),
    ).sort(
      (a, b) =>
        parseFloat(a.getAttribute("y") || "0") -
        parseFloat(b.getAttribute("y") || "0"),
    );
    if (!slots.length) return svg;
    const lines = c.text.split("\n");
    const NS = "http://www.w3.org/2000/svg";
    slots.forEach((ph, i) => {
      // Multi-line frames (coupon) map one line per slot; single-line frames
      // use the whole text in their one slot.
      const value = slots.length > 1 ? (lines[i] ?? "") : c.text;
      if (!value.trim()) {
        ph.remove();
        return;
      }
      const x = parseFloat(ph.getAttribute("x") || "0");
      const y = parseFloat(ph.getAttribute("y") || "0");
      const w = parseFloat(ph.getAttribute("width") || "0");
      const h = parseFloat(ph.getAttribute("height") || "0");
      const text = doc.createElementNS(NS, "text");
      text.setAttribute("x", String(x + w / 2));
      text.setAttribute("y", String(y + h / 2));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "central");
      text.setAttribute("fill", c.textColor || "#000000");
      text.setAttribute(
        "font-family",
        `'${c.fontFamily || "Roboto"}', sans-serif`,
      );
      text.setAttribute("font-weight", "700");
      text.setAttribute("font-size", String(h * 0.72));
      if (w > 0) {
        text.setAttribute("textLength", String(w * 0.92));
        text.setAttribute("lengthAdjust", "spacingAndGlyphs");
      }
      text.textContent = value;
      ph.replaceWith(text);
    });
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svg;
  }
}

export function StyleEditor({
  config,
  qrType,
  name,
  data,
  customizes,
  editId,
  onCustomizes,
}: {
  config: QrConfig;
  qrType: QrType;
  name: string;
  data: Record<string, unknown>;
  customizes: Customizes;
  editId?: string;
  onCustomizes: (c: Customizes) => void;
}) {
  const t = useTranslations("qr");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("colors");

  const [svg, setSvg] = useState("");
  const [previewing, setPreviewing] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  const reqRef = useRef(0);
  const payloadKey = useMemo(
    () => JSON.stringify({ type: config.tag, data, customizes }),
    [config.tag, data, customizes],
  );

  useEffect(() => {
    const id = ++reqRef.current;
    const timer = setTimeout(async () => {
      setPreviewing(true);
      setPreviewError(false);
      try {
        const markup = await previewQrCode(
          { type: config.tag, data, customizes },
          qrType,
        );
        if (reqRef.current === id) {
          setSvg(injectFrameText(markup, customizes));
          setPreviewing(false);
        }
      } catch {
        if (reqRef.current === id) {
          setPreviewError(true);
          setPreviewing(false);
        }
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [payloadKey, config.tag, data, customizes, qrType]);

  // Load the chosen Google Font so the injected SVG <text> renders in it.
  useEffect(() => {
    ensureFontLoaded(customizes.fontFamily);
  }, [customizes.fontFamily]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        qrcode: config._id,
        type: config.tag,
        data,
        customizes,
      };
      return editId
        ? editQrCode({ id: editId, ...payload }, qrType)
        : createQrCode(payload, qrType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      router.push("/qr-codes");
    },
  });

  function set<K extends keyof Customizes>(key: K, value: Customizes[K]) {
    onCustomizes({ ...customizes, [key]: value });
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {/* Preview + save */}
      <div className="space-y-4 md:sticky md:top-6 md:self-start">
        <div className="shadow-soft relative flex aspect-square items-center justify-center rounded-2xl border border-border bg-white p-8">
          {previewError ? (
            <p className="text-sm text-error">{t("loadError")}</p>
          ) : svg ? (
            <div
              className="flex size-full items-center justify-center [&_svg]:size-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : null}
          {previewing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <Button
          variant="gradient"
          className="w-full"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          {save.isPending ? t("saving") : t("save")}
        </Button>
        {save.isError && (
          <p className="text-center text-xs text-error">{t("loadError")}</p>
        )}
      </div>

      {/* Tabs + panel */}
      <div>
        <div className="flex gap-2">
          {TABS.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => setTab(tb.key)}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 text-[11px] font-medium transition-colors",
                  active
                    ? "brand-tint border-primary text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tb.icon} alt="" className="size-5" />
                {t(tb.labelKey)}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          {tab === "colors" && (
            <ColorsPanel t={t} customizes={customizes} set={set} />
          )}
          {tab === "shape" && (
            <ShapePanel t={t} customizes={customizes} set={set} />
          )}
          {tab === "frames" && (
            <FramesPanel t={t} customizes={customizes} set={set} />
          )}
          {tab === "logo" && (
            <LogoPanel t={t} customizes={customizes} set={set} />
          )}
        </div>
      </div>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;
type SetFn = <K extends keyof Customizes>(k: K, v: Customizes[K]) => void;

// --- Colors ---------------------------------------------------------------

function ColorsPanel({
  t,
  customizes,
  set,
}: {
  t: T;
  customizes: Customizes;
  set: SetFn;
}) {
  const rows: { label: string; key: keyof Customizes }[] = [
    { label: t("background"), key: "backgroundColor" },
    { label: t("foreground"), key: "foregroundColor" },
    { label: t("eyeOuter"), key: "eyeExternalColor" },
    { label: t("eyeInner"), key: "eyeInternalColor" },
  ];
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div
          key={r.key}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
        >
          <span className="text-sm font-medium">{r.label}</span>
          <div className="w-40">
            <ColorPickerField
              value={hexToArgb(String(customizes[r.key]))}
              onChange={(argb) => set(r.key, argbToHex(argb))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Shape ----------------------------------------------------------------

function ShapePanel({
  t,
  customizes,
  set,
}: {
  t: T;
  customizes: Customizes;
  set: SetFn;
}) {
  return (
    <div className="space-y-6">
      <Section title={t("shapes")}>
        <Grid>
          {SHAPES.map((s) => (
            <Tile
              key={s}
              label={prettyName(s)}
              selected={customizes.shape === s}
              none={s === "none"}
              src={shapeSrc(s)}
              tint
              onClick={() => set("shape", s)}
            />
          ))}
        </Grid>
      </Section>

      <Section title={t("bodyPatterns")}>
        <Grid>
          {DOT_PATTERNS.map((d) => (
            <Tile
              key={d}
              label={prettyName(d)}
              selected={customizes.module === d}
              src={dotSrc(d)}
              onClick={() => set("module", d)}
            />
          ))}
        </Grid>
      </Section>

      <Section title={t("cornerBorder")}>
        <Grid>
          {CORNER_BORDERS.map((c) => (
            <Tile
              key={c}
              label={prettyName(c)}
              selected={customizes.finder === c}
              src={borderSrc(c)}
              onClick={() => set("finder", c)}
            />
          ))}
        </Grid>
      </Section>

      <Section title={t("cornerCenter")}>
        <Grid>
          {CORNER_CENTERS.map((c) => (
            <Tile
              key={c}
              label={prettyName(c)}
              selected={customizes.finderDot === c}
              src={centerSrc(c)}
              onClick={() => set("finderDot", c)}
            />
          ))}
        </Grid>
      </Section>
    </div>
  );
}

// --- Frames ---------------------------------------------------------------

function FramesPanel({
  t,
  customizes,
  set,
}: {
  t: T;
  customizes: Customizes;
  set: SetFn;
}) {
  const lineCount = frameTextLines(customizes.advancedShape);
  const lines = customizes.text.split("\n");

  function setLine(index: number, value: string) {
    const next = customizes.text.split("\n");
    while (next.length < lineCount) next.push("");
    next[index] = value;
    set("text", next.slice(0, Math.max(lineCount, 1)).join("\n"));
  }

  return (
    <div className="space-y-5">
      <Section title={t("frames")}>
        <Grid cols="grid-cols-3">
          {FRAMES.map((f) => (
            <Tile
              key={f}
              label={prettyName(f)}
              selected={customizes.advancedShape === f}
              none={f === "none"}
              src={frameSrc(f)}
              wide
              onClick={() => set("advancedShape", f)}
            />
          ))}
        </Grid>
      </Section>

      {lineCount > 0 && (
        <>
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>
              <label className="mb-1.5 block text-xs text-muted-foreground">
                {lineCount > 1 ? `${t("frameText")} ${i + 1}` : t("frameText")}
              </label>
              <input
                value={lineCount > 1 ? (lines[i] ?? "") : customizes.text}
                maxLength={40}
                onChange={(e) =>
                  lineCount > 1
                    ? setLine(i, e.target.value)
                    : set("text", e.target.value)
                }
                className="h-11 w-full rounded-[10px] border border-input bg-white px-3 text-sm outline-none"
              />
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
            <span className="text-sm font-medium">{t("textColor")}</span>
            <div className="w-40">
              <ColorPickerField
                value={hexToArgb(customizes.textColor)}
                onChange={(argb) => set("textColor", argbToHex(argb))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">
              {t("font")}
            </label>
            <select
              value={customizes.fontFamily}
              onChange={(e) => set("fontFamily", e.target.value)}
              className="h-11 w-full rounded-[10px] border border-input bg-white px-3 text-sm outline-none"
            >
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

// --- Logo -----------------------------------------------------------------

function LogoPanel({
  t,
  customizes,
  set,
}: {
  t: T;
  customizes: Customizes;
  set: SetFn;
}) {
  const sliders: {
    label: string;
    key: "logoPositionX" | "logoPositionY" | "logoRotate";
  }[] = [
    { label: t("verticalPosition"), key: "logoPositionY" },
    { label: t("horizontalPosition"), key: "logoPositionX" },
    { label: t("rotation"), key: "logoRotate" },
  ];

  return (
    <div className="space-y-5">
      <Section title={t("logo")}>
        <Grid>
          <Tile
            none
            label={prettyName("none")}
            selected={!customizes.logoUrl}
            src=""
            round
            onClick={() => set("logoUrl", "")}
          />
          {LOGOS.map((l) => (
            <Tile
              key={l}
              label={prettyName(l)}
              selected={customizes.logoUrl === logoValue(l)}
              src={logoThumbSrc(l)}
              round
              onClick={() => set("logoUrl", logoValue(l))}
            />
          ))}
        </Grid>
      </Section>

      <CustomLogos t={t} customizes={customizes} set={set} />

      {sliders.map((s) => (
        <div key={s.key}>
          <label className="mb-1 block text-xs text-muted-foreground">
            {s.label}
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={parseFloat(customizes[s.key]) || 0}
            onChange={(e) => set(s.key, String(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      ))}
    </div>
  );
}

// --- Custom (user-uploaded) logos -----------------------------------------

function CustomLogos({
  t,
  customizes,
  set,
}: {
  t: T;
  customizes: Customizes;
  set: SetFn;
}) {
  const [logos, setLogos] = useState<QrLogo[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listQrLogos()
      .then(setLogos)
      .catch(() => setLogos([]));
  }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const logo = await createQrLogo(file);
      if (logo) {
        setLogos((prev) => [logo, ...prev]);
        set("logoUrl", logo.image);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove(logo: QrLogo) {
    const id = logo._id ?? logo.id;
    if (!id) return;
    setLogos((prev) => prev.filter((l) => (l._id ?? l.id) !== id));
    if (customizes.logoUrl === logo.image) set("logoUrl", "");
    await deleteQrLogo(id).catch(() => undefined);
  }

  return (
    <Section title={t("customLogos")}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
      <Grid>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-primary/40 text-primary transition-colors hover:bg-primary/5"
          aria-label={t("uploadLogo")}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <Plus className="size-5" />}
        </button>
        {logos.map((l) => {
          const selected = customizes.logoUrl === l.image;
          return (
            <div key={l._id ?? l.id} className="relative">
              <button
                type="button"
                onClick={() => set("logoUrl", l.image)}
                className={cn(
                  "flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border bg-white",
                  selected ? "border-primary ring-2 ring-primary/40" : "border-border",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cdnUrl(l.image)} alt="" className="size-full object-contain p-1" />
              </button>
              <button
                type="button"
                onClick={() => remove(l)}
                aria-label="Delete"
                className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-error text-white shadow"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          );
        })}
      </Grid>
    </Section>
  );
}

// --- Shared bits ----------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Grid({
  cols = "grid-cols-4",
  children,
}: {
  cols?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("grid gap-2", cols)}>{children}</div>;
}

/** "water-drop" → "Water Drop", "fourTriangles" → "Four Triangles". */
function prettyName(n: string): string {
  return n
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Tile({
  src,
  label,
  selected,
  none,
  tint,
  wide,
  round,
  onClick,
}: {
  src: string;
  label?: string;
  selected: boolean;
  none?: boolean;
  tint?: boolean;
  wide?: boolean;
  round?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors",
        selected
          ? "brand-tint border-primary"
          : "border-border hover:border-primary/50",
      )}
    >
      <span
        className={cn(
          "flex w-full items-center justify-center overflow-hidden bg-white p-1.5",
          round ? "aspect-square rounded-full" : "rounded-md",
          wide ? "h-14" : "aspect-square",
        )}
      >
        {none || !src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/qr/icons/none.svg" alt="" className="size-6 opacity-60" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className={cn(
              "max-h-full max-w-full object-contain",
              tint && "[filter:brightness(0)_saturate(0)] opacity-80",
            )}
          />
        )}
      </span>
      {label && (
        <span className="line-clamp-1 w-full text-center text-[10px] leading-tight text-muted-foreground">
          {label}
        </span>
      )}
      {selected && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/qr/icons/selected.svg"
          alt=""
          className="absolute -right-1 -top-1 size-4"
        />
      )}
    </button>
  );
}
