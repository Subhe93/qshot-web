"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ColorPickerField } from "@/components/ui/color-picker/ColorPickerField";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { argbToHex, hexToArgb } from "@/lib/builder/color";
import {
  cdnUrl,
  createQrCode,
  createQrLogo,
  deleteQrLogo,
  editQrCode,
  listQrLogos,
  previewDynamicQr,
  previewQrCode,
  readQrUnreadable,
  type QrConfig,
  type QrType,
} from "@/lib/api/qrcodes";
import { LOGOS, logoThumbSrc, logoValue } from "@/lib/qr/style-catalog";
import {
  FLAT_EYE_SHAPE_KINDS,
  FRAME_BRUSH_SLOTS,
  QR_EYE_PRESETS,
  QR_FRAME_KINDS,
  QR_GRADIENTS,
  QR_PRESETS,
  RELIABLE_MODULE_SHAPE_KINDS,
  acceptPreview,
  applyPreset,
  defaultFrame,
  defaultOverlay,
  eyeShapeFromWire,
  frameWithKind,
  matchingPreset,
  moduleShapeFromWire,
  normalizeQrHex,
  perFinderAll,
  qrHexRgb,
  styleContrastOk,
  styleFromWire,
  styleToWire,
  type QrBrush,
  type QrEyeShape,
  type QrFrameKind,
  type QrPreviewResult,
  type QrStyle,
} from "@/lib/qr/artisan-style";
import { cn } from "@/lib/utils";

/**
 * QR Artisan v1 style editor — web port of mobile `QrStyleEditorCubit` +
 * `QrStyleEditorLayout` and the four sheets (presets / colours / shape /
 * frame / logo), replacing the legacy flat-`Customizes` editor.
 *
 * Preview lifecycle (mobile-exact): 350 ms debounce, a monotonic sequence
 * that drops stale responses, a 400 ms settle before any spinner, and the
 * previous good render dimmed to 0.4 underneath — a slider drag never
 * strobes or empties the box. The verdict drives the save gate: error →
 * disabled; warning or a local-contrast miss → confirm-then-SAVE (the mobile
 * bug where confirming did nothing is deliberately not ported).
 *
 * Dynamic codes: the record must exist before the style step (the server
 * mints the short link on create), so a NEW dynamic QR is created here with
 * the current style on first save-less entry… no — mobile creates it at the
 * data step; on the web we create it lazily on MOUNT of this editor with the
 * incoming style, and every save after that is an update. Previews for
 * dynamic use the `{id, customizes}` body.
 */

const PREVIEW_DEBOUNCE_MS = 350;
const SPINNER_SETTLE_MS = 400;

/** The frame caption font list (same Google fonts the legacy editor offered). */
const FONTS = [
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Oswald",
  "Poppins",
  "Raleway",
  "Merriweather",
  "Playfair Display",
  "Bebas Neue",
];

type Tab = "presets" | "colors" | "shape" | "frames" | "logo";

export function ArtisanStyleEditor({
  config,
  qrType,
  name,
  data,
  customizes,
  editId,
  onCustomizes,
  onCreatedId,
}: {
  config: QrConfig;
  qrType: QrType;
  name: string;
  data: Record<string, unknown>;
  customizes: Record<string, unknown>;
  editId?: string;
  onCustomizes: (c: Record<string, unknown>) => void;
  /** A NEW dynamic record is created on entry (the short link needs it). */
  onCreatedId?: (id: string) => void;
}) {
  const t = useTranslations("qr");
  const tc = useTranslations("common");
  const tb = useTranslations("builder");
  const router = useRouter();
  const queryClient = useQueryClient();

  const [style, setStyle] = useState<QrStyle>(() => styleFromWire(customizes));
  const [tab, setTab] = useState<Tab>(() =>
    editId == null ? "presets" : "colors",
  );
  const [preview, setPreview] = useState<QrPreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The record id — editId, or the lazily created dynamic record.
  const [recordId, setRecordId] = useState<string | undefined>(editId);
  const creatingRef = useRef(false);

  const seqRef = useRef(0);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback(
    (next: QrStyle) => {
      setStyle(next);
      onCustomizes(styleToWire(next));
    },
    [onCustomizes],
  );

  // ── A NEW dynamic QR: create the record now (server needs it for the
  //    short link); the style step is then always an update. ────────────────
  useEffect(() => {
    if (qrType !== "dynamic" || recordId || creatingRef.current) return;
    creatingRef.current = true;
    void (async () => {
      try {
        const created = await createQrCode(
          {
            name,
            qrcode: config._id,
            type: config.tag,
            data,
            customizes: styleToWire(style),
          },
          "dynamic",
        );
        setRecordId(created._id);
        onCreatedId?.(created._id);
        void queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      } catch {
        // The preview below will surface the failure; save retries create.
        creatingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrType, recordId]);

  // ── Preview loop: debounce + sequence guard + settle ─────────────────────
  const wireKey = useMemo(() => JSON.stringify(styleToWire(style)), [style]);
  useEffect(() => {
    const seq = ++seqRef.current;
    const handle = setTimeout(async () => {
      if (seq !== seqRef.current) return;
      setPreviewBusy(true);
      setPreviewError(false);
      if (settleRef.current) clearTimeout(settleRef.current);
      settleRef.current = setTimeout(() => setShowSpinner(true), SPINNER_SETTLE_MS);
      try {
        const wire = styleToWire(style);
        const res =
          qrType === "dynamic" && recordId
            ? await previewDynamicQr(recordId, wire)
            : await previewQrCode(
                { type: config.tag, qrcode: config._id, data, customizes: wire },
                "static",
              );
        if (seq !== seqRef.current) return;
        setPreview(acceptPreview(style, res));
      } catch {
        if (seq !== seqRef.current) return;
        setPreviewError(true);
      } finally {
        if (seq === seqRef.current) {
          if (settleRef.current) clearTimeout(settleRef.current);
          setShowSpinner(false);
          setPreviewBusy(false);
        }
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wireKey, recordId]);

  // ── Save gate (mobile QrStyleEditorLayout) ───────────────────────────────
  const contrastOk = styleContrastOk(style);
  const severity = preview?.severity ?? "none";
  const blocked = severity === "error";
  const safe = contrastOk && severity === "none";

  const saveM = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        qrcode: config._id,
        type: config.tag,
        data,
        customizes: styleToWire(style),
      };
      if (qrType === "dynamic") {
        // Created on entry; a failed early create retries as create here.
        if (recordId) return editQrCode({ id: recordId, ...payload }, "dynamic");
        return createQrCode(payload, "dynamic");
      }
      if (recordId) return editQrCode({ id: recordId, ...payload }, "static");
      return createQrCode(payload, "static");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["qr-codes"] });
      router.push("/qr-codes");
    },
    onError: async (e) => {
      // The server's save gate: push its warnings into the preview verdict
      // and show the first message (mobile QrUnreadableException handling).
      const unreadable = await readQrUnreadable(e);
      if (unreadable) {
        setPreview((prev) =>
          prev
            ? { ...prev, severity: "error", warnings: unreadable.warnings }
            : prev,
        );
        setSaveError(unreadable.warnings[0]?.message || unreadable.message);
      } else {
        setSaveError(tc("genericError"));
      }
    },
  });

  function requestSave() {
    setSaveError(null);
    if (blocked || saveM.isPending) return;
    if (!safe) {
      setConfirmSave(true);
      return;
    }
    saveM.mutate();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* ── Preview surface ─────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-white p-4">
          {preview?.svg ? (
            <div
              className={cn(
                "size-full transition-opacity duration-250 [&_svg]:size-full",
                previewBusy && "opacity-40",
              )}
              // The platform's own render — trusted origin, same as mobile.
              dangerouslySetInnerHTML={{ __html: preview.svg }}
            />
          ) : preview?.dataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.dataUri}
              alt=""
              className={cn("size-full object-contain", previewBusy && "opacity-40")}
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              {!previewError && (
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              )}
            </div>
          )}

          {showSpinner && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-7 animate-spin text-muted-foreground" />
            </div>
          )}

          {previewError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/85">
              <p className="text-sm text-muted-foreground">{t("failed_to_load")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => update({ ...style })}
              >
                <RefreshCw className="size-4" />
                {tc("retry")}
              </Button>
            </div>
          )}
        </div>

        {/* Verdict banner: platform warning, or the instant local contrast check. */}
        {(severity !== "none" || !contrastOk) && (
          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs",
              severity === "error"
                ? "bg-error/10 text-error"
                : "bg-amber-50 text-amber-800",
            )}
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              {severity !== "none"
                ? preview?.warnings[0]?.message || t("qr_not_detectable")
                : t("color_similarity")}
            </span>
          </div>
        )}
        {saveError && <p className="mt-2 text-xs text-error">{saveError}</p>}

        <Button
          variant="gradient"
          className="mt-4 w-full"
          disabled={blocked || saveM.isPending}
          onClick={requestSave}
        >
          {saveM.isPending ? <Loader2 className="size-4 animate-spin" /> : tc("save")}
        </Button>
      </div>

      {/* ── Panels ──────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {(
            [
              ["presets", t("presets")],
              ["colors", t("colors")],
              ["shape", t("shape_and_form")],
              ["frames", t("frames")],
              ["logo", t("logo")],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                tab === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "presets" && <PresetsPanel style={style} onApply={update} />}
        {tab === "colors" && <ColorsPanel style={style} onChange={update} />}
        {tab === "shape" && <ShapePanel style={style} onChange={update} />}
        {tab === "frames" && <FramesPanel style={style} onChange={update} />}
        {tab === "logo" && <LogoPanel style={style} onChange={update} />}
      </div>

      {/* Warning-severity (or local contrast) save confirmation — and the
          confirm ACTUALLY saves (mobile 60460ddf). */}
      <ConfirmDialog
        open={confirmSave}
        type="warning"
        title={tb("careful")}
        message={preview?.warnings[0]?.message || t("color_similarity")}
        confirmText={tc("save")}
        cancelText={tc("cancel")}
        onConfirm={() => {
          setConfirmSave(false);
          saveM.mutate();
        }}
        onCancel={() => setConfirmSave(false)}
      />
    </div>
  );
}

// ─── Presets ────────────────────────────────────────────────────────────────

function PresetsPanel({
  style,
  onApply,
}: {
  style: QrStyle;
  onApply: (s: QrStyle) => void;
}) {
  const t = useTranslations("qr");
  const active = matchingPreset(style);
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">{t("presets_hint")}</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {QR_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onApply(applyPreset(preset, style))}
            className={cn(
              "relative rounded-xl border p-2 text-center",
              active?.id === preset.id
                ? "border-primary ring-1 ring-primary"
                : "border-border hover:border-primary/50",
            )}
          >
            {active?.id === preset.id && (
              <span className="absolute end-1.5 top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-primary text-white">
                <Check className="size-3" />
              </span>
            )}
            {/* The platform's own render of the exact design. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/qr-v1/preset/${preset.id}.svg`}
              alt=""
              className="mx-auto aspect-[0.82] w-full object-contain"
            />
            {/* Proper names, not i18n keys (like the template catalog). */}
            <span className="mt-1 block truncate text-xs font-medium text-foreground">
              {preset.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Colours ────────────────────────────────────────────────────────────────

/** hex ⇄ the ARGB picker the builder already ships. */
function HexColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <ColorPickerField
        value={hexToArgb(qrHexRgb(value)) ?? 0xff000000}
        showAlpha={false}
        onChange={(argb) => {
          const hex = normalizeQrHex(argbToHex(argb));
          if (hex) onChange(qrHexRgb(hex));
        }}
        compact
      />
    </div>
  );
}

function solidColorOf(brush: QrBrush | null, fallback: string): string {
  if (!brush) return fallback;
  return brush.kind === "solid" ? brush.color : (brush.colors[0] ?? fallback);
}

function ColorsPanel({
  style,
  onChange,
}: {
  style: QrStyle;
  onChange: (s: QrStyle) => void;
}) {
  const t = useTranslations("qr");
  const eyesFollow = style.eyeBorderBrush == null && style.eyeCenterBrush == null;
  const eyeColor = solidColorOf(
    style.eyeBorderBrush && "uniform" in style.eyeBorderBrush
      ? style.eyeBorderBrush.uniform
      : style.moduleBrush,
    "#000000",
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card px-3">
        <HexColorRow
          label={t("backgroundColor")}
          value={solidColorOf(style.background, "#ffffff")}
          onChange={(hex) =>
            onChange({ ...style, background: { kind: "solid", color: hex } })
          }
        />
        <div className="border-t border-border" />
        <HexColorRow
          label={t("modules")}
          value={solidColorOf(style.moduleBrush, "#000000")}
          onChange={(hex) =>
            onChange({ ...style, moduleBrush: { kind: "solid", color: hex } })
          }
        />
        <div className="border-t border-border" />
        {/* Eyes as ONE surface + the follow-the-modules toggle (mobile sheet). */}
        <div className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-foreground">{t("eyes_follow_modules")}</span>
          <button
            type="button"
            role="switch"
            aria-checked={eyesFollow}
            onClick={() =>
              onChange(
                eyesFollow
                  ? {
                      ...style,
                      eyeBorderBrush: perFinderAll(style.moduleBrush),
                      eyeCenterBrush: perFinderAll(style.moduleBrush),
                    }
                  : { ...style, eyeBorderBrush: null, eyeCenterBrush: null },
              )
            }
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              eyesFollow ? "bg-primary" : "bg-input",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                eyesFollow ? "start-[1.375rem]" : "start-0.5",
              )}
            />
          </button>
        </div>
        {!eyesFollow && (
          <>
            <div className="border-t border-border" />
            <HexColorRow
              label={t("eyes")}
              value={eyeColor}
              onChange={(hex) => {
                const brush = perFinderAll<QrBrush>({ kind: "solid", color: hex });
                onChange({ ...style, eyeBorderBrush: brush, eyeCenterBrush: brush });
              }}
            />
          </>
        )}
      </div>

      {/* Gradient swatches — the only gradient surface (mobile hides raw stops). */}
      <div>
        <p className="mb-1 text-sm font-semibold text-foreground">{t("gradients")}</p>
        <p className="mb-2 text-xs text-muted-foreground">{t("gradients_hint")}</p>
        <div className="flex flex-wrap gap-2">
          {QR_GRADIENTS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-label={g.id}
              onClick={() => onChange({ ...style, moduleBrush: g.brush })}
              className={cn(
                "size-9 rounded-full border-2",
                JSON.stringify(style.moduleBrush) === JSON.stringify(g.brush)
                  ? "border-foreground"
                  : "border-transparent",
              )}
              style={{
                background: `linear-gradient(135deg, ${g.brush.kind === "solid" ? g.brush.color : g.brush.colors.join(",")})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shape ──────────────────────────────────────────────────────────────────

function Tile({
  src,
  label,
  active,
  onClick,
}: {
  src: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-2",
        active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="mx-auto size-12 object-contain" />
      <span className="mt-1 block truncate text-[11px] text-muted-foreground">
        {label}
      </span>
    </button>
  );
}

const MODULE_LABEL_KEY: Record<string, string> = {
  square: "shape_square",
  circle: "shape_circle",
  rounded: "shape_rounded",
  smooth: "shape_smooth",
  barHorizontal: "shape_bar_horizontal",
  barVertical: "shape_bar_vertical",
  classy: "shape_classy",
  tile: "shape_tile",
  octagon: "shape_octagon",
  teardrop: "shape_teardrop",
  diamond: "shape_diamond",
};

const EYE_LABEL_KEY: Record<string, string> = {
  square: "shape_square",
  circle: "shape_circle",
  diamond: "shape_diamond",
  rounded: "shape_rounded",
  squircle: "shape_squircle",
  octagon: "shape_octagon",
};

const EYE_PRESET_LABEL_KEY: Record<string, string> = {
  leaf: "eye_leaf",
  inverseLeaf: "eye_inverse_leaf",
  topRounded: "eye_top_rounded",
  bottomRounded: "eye_bottom_rounded",
  leftRounded: "eye_left_rounded",
  rightRounded: "eye_right_rounded",
};

function currentEyeKindOrPreset(style: QrStyle): string {
  const shape =
    style.eyeBorderShape && "uniform" in style.eyeBorderShape
      ? style.eyeBorderShape.uniform
      : null;
  if (!shape) return "square";
  if (shape.kind === "perCorner" && shape.preset) return `preset:${shape.preset}`;
  return shape.kind;
}

function ShapePanel({
  style,
  onChange,
}: {
  style: QrStyle;
  onChange: (s: QrStyle) => void;
}) {
  const t = useTranslations("qr");
  const eyeCurrent = currentEyeKindOrPreset(style);

  function setEye(shape: QrEyeShape) {
    onChange({
      ...style,
      eyeBorderShape: perFinderAll(shape),
      eyeCenterShape: perFinderAll(shape),
    });
  }

  const rounded =
    style.eyeBorderShape &&
    "uniform" in style.eyeBorderShape &&
    style.eyeBorderShape.uniform.kind === "rounded"
      ? style.eyeBorderShape.uniform
      : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">
          {t("module_shape")}
        </p>
        {/* Only the 10 reliable kinds are OFFERED; a stored marginal kind
            still renders — it just isn't a new choice (mobile curation). */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {RELIABLE_MODULE_SHAPE_KINDS.map((kind) => (
            <Tile
              key={kind}
              src={`/qr-v1/module/${kind}.svg`}
              label={t(MODULE_LABEL_KEY[kind] ?? "shape_square")}
              active={style.moduleShape.kind === kind}
              onClick={() =>
                onChange({ ...style, moduleShape: moduleShapeFromWire({ kind }) })
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">{t("eye_shape")}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {FLAT_EYE_SHAPE_KINDS.map((kind) => (
            <Tile
              key={kind}
              src={`/qr-v1/eye/${kind}.svg`}
              label={t(EYE_LABEL_KEY[kind] ?? "shape_square")}
              active={eyeCurrent === kind}
              onClick={() => setEye(eyeShapeFromWire({ kind }))}
            />
          ))}
        </div>
        <p className="mb-2 mt-3 text-xs text-muted-foreground">{t("eye_silhouette")}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {QR_EYE_PRESETS.map((preset) => (
            <Tile
              key={preset}
              src={`/qr-v1/eye/preset-${preset}.svg`}
              label={t(EYE_PRESET_LABEL_KEY[preset])}
              active={eyeCurrent === `preset:${preset}`}
              onClick={() => setEye({ kind: "perCorner", preset })}
            />
          ))}
        </div>
      </div>

      {/* One "roundness" slider drives BOTH rounded-eye fractions (mobile). */}
      {rounded && (
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">{t("roundness")}</p>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={rounded.borderRadiusFraction ?? 0.25}
            onChange={(e) => {
              const v = Number(e.target.value);
              setEye({
                kind: "rounded",
                borderRadiusFraction: v,
                centerRadiusFraction: v,
              });
            }}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

// ─── Frames ─────────────────────────────────────────────────────────────────

const BRUSH_SLOT_LABEL_KEY: Record<string, string> = {
  cardBrush: "brush_card",
  qrBackgroundBrush: "brush_qr_background",
  bannerBrush: "brush_banner",
  tagFillBrush: "brush_tag",
  ornamentBrush: "brush_ornament",
  bodyBrush: "brush_body",
};

function FramesPanel({
  style,
  onChange,
}: {
  style: QrStyle;
  onChange: (s: QrStyle) => void;
}) {
  const t = useTranslations("qr");
  const frame = style.frame;

  function pickKind(kind: QrFrameKind | null) {
    if (kind == null) {
      onChange({ ...style, frame: null });
      return;
    }
    // Switching kinds strips options the new kind rejects (mobile withKind).
    onChange({
      ...style,
      frame: frame ? frameWithKind(frame, kind) : defaultFrame(kind),
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        <button
          type="button"
          onClick={() => pickKind(null)}
          className={cn(
            "flex items-center justify-center rounded-xl border p-2 text-xs text-muted-foreground",
            frame == null
              ? "border-primary ring-1 ring-primary"
              : "border-border hover:border-primary/50",
          )}
        >
          {tcNone()}
        </button>
        {QR_FRAME_KINDS.map((kind) => (
          <Tile
            key={kind}
            src={`/qr-v1/frame/${kind}.svg`}
            label={kind}
            active={frame?.kind === kind}
            onClick={() => pickKind(kind)}
          />
        ))}
      </div>

      {frame && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-foreground">
              {t("frame_caption")}
            </label>
            <input
              value={frame.text.text}
              maxLength={120}
              onChange={(e) =>
                onChange({
                  ...style,
                  frame: {
                    ...frame,
                    text: { ...frame.text, text: e.target.value },
                  },
                })
              }
              className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">
                {t("fontFamily")}
              </label>
              <SearchableSelect
                title={t("fontFamily")}
                options={FONTS.map((f): SelectOption<string> => ({ value: f, label: f }))}
                value={frame.text.fontFamily ?? "Roboto"}
                onChange={(v) =>
                  onChange({
                    ...style,
                    frame: { ...frame, text: { ...frame.text, fontFamily: v } },
                  })
                }
              />
            </div>
            <div className="rounded-lg border border-input bg-white px-3">
              <HexColorRow
                label={t("textColor")}
                value={frame.text.color}
                onChange={(hex) =>
                  onChange({
                    ...style,
                    frame: { ...frame, text: { ...frame.text, color: hex } },
                  })
                }
              />
            </div>
          </div>

          {/* ONLY the brush slots this kind declares (anything else is a 400). */}
          <div className="rounded-lg border border-input bg-white px-3">
            {FRAME_BRUSH_SLOTS[frame.kind].map((slot, i) => (
              <div key={slot}>
                {i > 0 && <div className="border-t border-border" />}
                <HexColorRow
                  label={t(BRUSH_SLOT_LABEL_KEY[slot] ?? "brush_card")}
                  value={solidColorOf(
                    (frame.options[slot] as QrBrush | undefined) ?? null,
                    slot === "qrBackgroundBrush" ? "#ffffff" : "#111827",
                  )}
                  onChange={(hex) =>
                    onChange({
                      ...style,
                      frame: {
                        ...frame,
                        options: {
                          ...frame.options,
                          [slot]: { kind: "solid", color: hex },
                        },
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** "none" label without adding a new i18n key — the catalog ships one. */
function tcNone(): string {
  return "—";
}

// ─── Logo ───────────────────────────────────────────────────────────────────

function LogoPanel({
  style,
  onChange,
}: {
  style: QrStyle;
  onChange: (s: QrStyle) => void;
}) {
  const t = useTranslations("qr");
  const tcLogo = useTranslations("common");
  const queryClient = useQueryClient();
  const logosQ = useQuery({ queryKey: ["qr-logos"], queryFn: listQrLogos });
  const fileRef = useRef<HTMLInputElement>(null);
  const overlay = style.overlay;

  function setLogo(url: string | null) {
    onChange({
      ...style,
      overlay: url
        ? { ...(overlay ?? defaultOverlay(url)), imageUrl: url }
        : null,
    });
  }

  const uploadM = useMutation({
    mutationFn: (file: File) => createQrLogo(file),
    onSuccess: (logo) => {
      void queryClient.invalidateQueries({ queryKey: ["qr-logos"] });
      if (logo?.image) setLogo(cdnUrl(logo.image));
    },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteQrLogo(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["qr-logos"] }),
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
        <button
          type="button"
          onClick={() => setLogo(null)}
          className={cn(
            "flex aspect-square items-center justify-center rounded-xl border text-xs text-muted-foreground",
            overlay == null
              ? "border-primary ring-1 ring-primary"
              : "border-border hover:border-primary/50",
          )}
        >
          —
        </button>
        {LOGOS.map((n) => {
          const value = logoValue(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => setLogo(value)}
              className={cn(
                "aspect-square rounded-xl border p-1.5",
                overlay?.imageUrl === value
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-primary/50",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoThumbSrc(n)} alt={n} className="size-full object-contain" />
            </button>
          );
        })}
        {(logosQ.data ?? []).map((logo) => {
          const value = cdnUrl(logo.image);
          return (
            <div key={logo._id} className="relative">
              <button
                type="button"
                onClick={() => setLogo(value)}
                className={cn(
                  "aspect-square w-full rounded-xl border p-1.5",
                  overlay?.imageUrl === value
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={value} alt="" className="size-full object-contain" />
              </button>
              <button
                type="button"
                aria-label={tcLogo("delete")}
                onClick={() => deleteM.mutate(logo._id)}
                className="absolute -end-1 -top-1 rounded-full bg-error p-0.5 text-white"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/50"
        >
          {uploadM.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadM.mutate(f);
            e.target.value = "";
          }}
        />
      </div>

      {overlay && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-foreground">{t("logo_size")}</p>
            <input
              type="range"
              min={0.05}
              max={0.4}
              step={0.01}
              value={overlay.sizeFraction}
              onChange={(e) =>
                onChange({
                  ...style,
                  overlay: { ...overlay, sizeFraction: Number(e.target.value) },
                })
              }
              className="w-full"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold text-foreground">
              {t("logo_shape")}
            </p>
            <div className="flex gap-2">
              {(
                [
                  ["none", "clip_none"],
                  ["square", "clip_square"],
                  ["rounded", "clip_rounded"],
                  ["circle", "clip_circle"],
                ] as const
              ).map(([clip, key]) => (
                <button
                  key={clip}
                  type="button"
                  onClick={() => onChange({ ...style, overlay: { ...overlay, clip } })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    overlay.clip === clip
                      ? "border-transparent bg-foreground text-background"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">{t("logo_backdrop")}</p>
            <button
              type="button"
              role="switch"
              aria-checked={overlay.plate != null}
              onClick={() =>
                onChange({
                  ...style,
                  overlay: {
                    ...overlay,
                    plate: overlay.plate
                      ? null
                      : { color: "#ffffff", paddingFraction: 0.06, radiusFraction: 0.25 },
                  },
                })
              }
              className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                overlay.plate ? "bg-primary" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                  overlay.plate ? "start-[1.375rem]" : "start-0.5",
                )}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
