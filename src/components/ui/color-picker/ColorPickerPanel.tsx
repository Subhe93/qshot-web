"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { argbToHsva, hsvaToArgb, hsvToRgb, type Hsva } from "@/lib/builder/color";
import { addRecentColor, getRecentColors } from "@/lib/builder/color-storage";
import { primaryArgb, solidArgb, type ColorValue } from "@/lib/builder/color-value";
import { ColorArea } from "./ColorArea";
import { HueSlider } from "./HueSlider";
import { LabeledSlider } from "./LabeledSlider";
import { HexInput } from "./HexInput";
import { SwatchRow } from "./SwatchRow";
import { GradientBar, type GStop } from "./GradientBar";

function rgbStr(h: number, s: number, v: number, a = 1) {
  const { r, g, b } = hsvToRgb(h, s, v);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function initialStops(value: ColorValue): GStop[] {
  if (value.type === "gradient") {
    const n = value.colors.length;
    const stops = value.stops ?? [];
    return value.colors.map((c, i) => ({
      color: c,
      stop: stops[i] ?? i / Math.max(1, n - 1),
    }));
  }
  const solid = solidArgb(value.color);
  return [
    { color: solid, stop: 0 },
    { color: solid, stop: 1 },
  ];
}

/**
 * The full picker body: optional Solid/Linear toggle + gradient bar, HSV area +
 * hue, labeled saturation/brightness/(alpha) sliders, hex input, recent swatches
 * and apply/cancel — mirroring the mobile DefaultColorPicker. Edits a local draft
 * and commits a ColorValue on Apply.
 */
export function ColorPickerPanel({
  value,
  showAlpha,
  showGradient,
  onApply,
  onCancel,
}: {
  value: ColorValue;
  showAlpha?: boolean;
  showGradient?: boolean;
  onApply: (value: ColorValue) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("builder.colorPicker");
  const [mode, setMode] = useState<"solid" | "gradient">(value.type);
  const [hsva, setHsva] = useState<Hsva>(() => argbToHsva(primaryArgb(value)));
  const [gstops, setGstops] = useState<GStop[]>(() => initialStops(value));
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<number[]>(() => getRecentColors());

  // The color currently under the area/sliders — the solid color, or the active stop.
  const editHsva =
    mode === "solid" ? hsva : argbToHsva(gstops[active]?.color ?? 0xff000000);
  const { h, s, v, a } = editHsva;
  const currentArgb = hsvaToArgb(editHsva);

  function setEdit(next: Hsva) {
    const fixed = showAlpha ? next : { ...next, a: 1 };
    if (mode === "solid") setHsva(fixed);
    else
      setGstops((gs) =>
        gs.map((g, i) => (i === active ? { ...g, color: hsvaToArgb(fixed) } : g)),
      );
  }
  const set = (patch: Partial<Hsva>) => setEdit({ ...editHsva, ...patch });
  const selectArgb = (next: number) => setEdit(argbToHsva(next));

  function buildValue(): ColorValue {
    if (mode === "solid") return { type: "solid", color: currentArgb };
    const sorted = [...gstops].sort((x, y) => x.stop - y.stop);
    return {
      type: "gradient",
      gradient: "LinearGradient",
      colors: sorted.map((x) => x.color),
      stops: sorted.map((x) => x.stop),
    };
  }

  function apply() {
    setRecents(addRecentColor(currentArgb));
    onApply(buildValue());
  }

  function switchMode(next: "solid" | "gradient") {
    if (next === mode) return;
    if (next === "gradient") {
      setGstops([
        { color: currentArgb, stop: 0 },
        { color: currentArgb, stop: 1 },
      ]);
      setActive(0);
    } else {
      setHsva(argbToHsva(gstops[active]?.color ?? currentArgb));
    }
    setMode(next);
  }

  return (
    <div className="w-72 space-y-4">
      {showGradient && (
        <div className="flex rounded-lg border border-input p-0.5">
          {(["solid", "gradient"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={
                "flex-1 rounded-md py-1.5 text-xs " +
                (mode === m ? "bg-primary text-white" : "text-muted-foreground")
              }
            >
              {m === "solid" ? t("solidColor") : t("linearGradient")}
            </button>
          ))}
        </div>
      )}

      {mode === "gradient" && (
        <GradientBar
          stops={gstops}
          active={active}
          onSelect={setActive}
          onMove={(i, stop) =>
            setGstops((gs) => gs.map((g, j) => (j === i ? { ...g, stop } : g)))
          }
          onInsert={(color, stop) => {
            setActive(gstops.length);
            setGstops((gs) => [...gs, { color, stop }]);
          }}
        />
      )}

      <div className="flex h-44 gap-3">
        <div className="flex-1">
          <ColorArea h={h} s={s} v={v} onChange={(s, v) => set({ s, v })} />
        </div>
        <HueSlider h={h} onChange={(h) => set({ h })} />
      </div>

      <LabeledSlider
        label={t("saturation")}
        value={s / 100}
        track={`linear-gradient(to right, ${rgbStr(h, 0, v)}, ${rgbStr(h, 100, v)})`}
        onChange={(x) => set({ s: x * 100 })}
      />
      <LabeledSlider
        label={t("brightness")}
        value={v / 100}
        track={`linear-gradient(to right, #000, ${rgbStr(h, s, 100)})`}
        onChange={(x) => set({ v: x * 100 })}
      />
      {showAlpha && (
        <LabeledSlider
          label={t("alpha")}
          value={a}
          checkerboard
          track={`linear-gradient(to right, ${rgbStr(h, s, v, 0)}, ${rgbStr(h, s, v, 1)})`}
          onChange={(x) => set({ a: x })}
        />
      )}

      <HexInput argb={currentArgb} showAlpha={showAlpha} onChange={selectArgb} />

      <SwatchRow
        colors={recents}
        showTransparent={showAlpha}
        onAdd={() => setRecents(addRecentColor(currentArgb))}
        onSelect={selectArgb}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button size="sm" className="flex-1" onClick={apply}>
          {t("apply")}
        </Button>
      </div>
    </div>
  );
}
