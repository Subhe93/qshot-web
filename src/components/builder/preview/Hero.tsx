"use client";

import { useEffect, useState } from "react";
import type {
  WebsiteSettings,
  HeroStyle,
  HeroText,
  HeroButton,
  CoverPhotoSize,
  HeroTab,
  RectTuple,
} from "@/lib/types/profile";
import { argbToCss } from "@/lib/builder/color";
import { headerStyleDefaults } from "@/lib/builder/hero-defaults";
import { colorValueToCss, solidArgb, lerpArgb, type ColorValue } from "@/lib/builder/color-value";
import { cdnUrl } from "@/lib/api/qrcodes";
import { dirOf } from "@/lib/builder/text-direction";
import { fontStack } from "@/lib/builder/google-fonts";
import { BadgeCheck, Menu } from "lucide-react";

/**
 * Faithful port of the mobile hero rendering (Flutter ONLY as reference):
 *   - hero_template.dart  → per-style STRUCTURE (HERO_TEMPLATES below)
 *   - website_editor_layout.dart buildGeneralSection/buildHeroSection/buildWidgetsContent
 *   - hero_cover_widget.dart, hero_name_widget.dart, cover_entity.dart, header_entity.dart
 *
 * buildGeneralSection = [pageBackground] → hero section → name (26px bold) → bio.
 * Values (colors/images/text/cover size) come from `settings`; the per-style
 * STRUCTURE (which elements show, layout, alignment, font weights, button shape)
 * is fixed by the template.
 */

type ButtonLayout = "horizontal" | "vertical";
type Align = "start" | "center" | "end";
type EditFn = (tab: HeroTab) => void;

/**
 * Wraps a hero region so that, in the builder (onEdit provided), tapping it opens
 * the matching settings sheet. In read-only previews (no onEdit) it renders the
 * children untouched. Uses pointer-events-auto so empty cover areas fall through
 * to the cover's own handler beneath an overlay.
 */
function Editable({
  onEdit,
  tab,
  children,
  className,
  style,
}: {
  onEdit?: EditFn;
  tab: HeroTab;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!onEdit) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onEdit(tab);
      }}
      className={`pointer-events-auto cursor-pointer rounded outline-none ring-primary/60 transition hover:ring-2 ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

interface HeroTemplate {
  layout: "stack" | "column";
  buttonLayout: ButtonLayout;
  /** title/text alignment */
  textAlign: Align;
  /** stack overlay alignment: where the content column sits over the cover */
  contentAlign: "center" | "bottom" | "centerLeft";
  contentPadding: number;
  hasProfileImage: boolean;
  hasHeaderTitle: boolean;
  hasTitle: boolean;
  hasText: boolean;
  hasButton1: boolean;
  hasButton2: boolean;
  hasCard: boolean;
  titleStyle: { size: number; weight: number; italic?: boolean; family?: string };
  textStyle: { size: number; weight: number };
  /** button corner radius, symmetric padding, label size, optional border. */
  buttonStyle: { radius: number; padX: number; padY: number; fontSize: number; border?: boolean };
}

// hero_template.dart HeroTemplateRegistry — structure only.
const HERO_TEMPLATES: Record<HeroStyle, HeroTemplate> = {
  style1: {
    layout: "stack", buttonLayout: "horizontal", textAlign: "center", contentAlign: "center", contentPadding: 0,
    hasProfileImage: true, hasHeaderTitle: true, hasTitle: false, hasText: false, hasButton1: false, hasButton2: false, hasCard: false,
    titleStyle: { size: 24, weight: 700 }, textStyle: { size: 14, weight: 400 }, buttonStyle: { radius: 20, padX: 16, padY: 12, fontSize: 14 },
  },
  style2: {
    layout: "stack", buttonLayout: "horizontal", textAlign: "center", contentAlign: "bottom", contentPadding: 0,
    hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false,
    titleStyle: { size: 36, weight: 900 }, textStyle: { size: 14, weight: 400 }, buttonStyle: { radius: 20, padX: 16, padY: 12, fontSize: 14 },
  },
  style3: {
    layout: "stack", buttonLayout: "horizontal", textAlign: "center", contentAlign: "center", contentPadding: 0,
    hasProfileImage: false, hasHeaderTitle: false, hasTitle: true, hasText: true, hasButton1: false, hasButton2: false, hasCard: false,
    titleStyle: { size: 36, weight: 100, italic: true, family: '"Playfair Display", serif' }, textStyle: { size: 14, weight: 400 }, buttonStyle: { radius: 20, padX: 16, padY: 12, fontSize: 14 },
  },
  style4: {
    layout: "stack", buttonLayout: "vertical", textAlign: "center", contentAlign: "center", contentPadding: 40,
    hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false,
    titleStyle: { size: 26, weight: 900 }, textStyle: { size: 14, weight: 400 }, buttonStyle: { radius: 10, padX: 18, padY: 18, fontSize: 16 },
  },
  style5: {
    layout: "stack", buttonLayout: "vertical", textAlign: "center", contentAlign: "center", contentPadding: 40,
    hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false,
    titleStyle: { size: 26, weight: 600 }, textStyle: { size: 14, weight: 400 }, buttonStyle: { radius: 10, padX: 14, padY: 14, fontSize: 16 },
  },
  style6: {
    layout: "stack", buttonLayout: "vertical", textAlign: "center", contentAlign: "center", contentPadding: 40,
    hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: false,
    titleStyle: { size: 36, weight: 900, family: '"Roboto", sans-serif' }, textStyle: { size: 16, weight: 500 }, buttonStyle: { radius: 12, padX: 14, padY: 14, fontSize: 16, border: true },
  },
  style7: {
    layout: "column", buttonLayout: "vertical", textAlign: "start", contentAlign: "centerLeft", contentPadding: 0,
    hasProfileImage: false, hasHeaderTitle: true, hasTitle: true, hasText: true, hasButton1: true, hasButton2: true, hasCard: true,
    titleStyle: { size: 22, weight: 800 }, textStyle: { size: 14, weight: 500 }, buttonStyle: { radius: 30, padX: 14, padY: 14, fontSize: 16 },
  },
};

// cover_entity.dart CoverPhotoSize
const COVER: Record<CoverPhotoSize, { ratio: string; limited: boolean }> = {
  horizontal: { ratio: "16 / 9", limited: true },
  square: { ratio: "1 / 1", limited: true },
  poster: { ratio: "4 / 5", limited: false },
  vertical: { ratio: "9 / 16", limited: false },
};

/**
 * DESKTOP (Nuxt public front) per-style typography — VIEW ONLY, applied when
 * the desktop "computer" preview renders (BuilderCanvas deviceWidth === "full").
 * Values verified against the Nuxt hero components (source of truth):
 * Style2-7 titles are `text-4xl md:text-5xl` (48px/lh 1) or scoped-CSS 48px;
 * overlay text is `md:text-base`/`md:text-lg` (16/18px, weight 400).
 * `titleFamily: null` clears a template-forced family (style6 uses the page
 * font on the public site, not Roboto). Phone canvas is untouched.
 */
interface DesktopContentStyle {
  titleSize: number;
  titleWeight?: number;
  /** undefined → inherit (Nuxt style3/6 titles have no line-height class). */
  titleLineHeight?: number;
  titleFamily?: string | null;
  textSize: number;
  textWeight: number;
  textLineHeight?: string;
  /** Nuxt `max-w-md m-auto` (448px) on the overlay text. */
  textMaxW: boolean;
  textOpacity?: number;
}
const DESKTOP_CONTENT: Partial<Record<HeroStyle, DesktopContentStyle>> = {
  style2: { titleSize: 48, titleWeight: 700, titleLineHeight: 1, textSize: 16, textWeight: 400, textLineHeight: "1.5rem", textMaxW: true, textOpacity: 0.9 },
  style3: { titleSize: 48, textSize: 16, textWeight: 400, textLineHeight: "1.5rem", textMaxW: true },
  style4: { titleSize: 48, titleLineHeight: 1, textSize: 18, textWeight: 400, textLineHeight: "1.75rem", textMaxW: true },
  style5: { titleSize: 48, titleLineHeight: 1, textSize: 18, textWeight: 400, textLineHeight: "1.75rem", textMaxW: true },
  style6: { titleSize: 48, titleFamily: null, textSize: 18, textWeight: 400, textLineHeight: "1.75rem", textMaxW: true },
  style7: { titleSize: 48, titleLineHeight: 1, textSize: 16, textWeight: 400, textLineHeight: "1.5rem", textMaxW: false },
};

const HEADER_ABOVE_HEIGHT = 72;
const HEADER_ON_HEIGHT = 44;

function rgbaWithAlpha(argb: number, alpha: number): string {
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function alignItems(a: Align) {
  return a === "start" ? "items-start" : a === "end" ? "items-end" : "items-center";
}
function textAlignClass(a: Align) {
  return a === "start" ? "text-start" : a === "end" ? "text-end" : "text-center";
}
function imgAlignItems(a?: string | null) {
  return a === "start" ? "items-start" : a === "end" ? "items-end" : "items-center";
}

// kDefaultColor = Colors.white (utils.dart:59); AppColors.black = 0xFF1F1F26.
const K_DEFAULT_COLOR = 0xffffffff;
const APP_BLACK = 0xff1f1f26;

/** SettingsEntity.getBackgroundColor() = background.solidColor ?? AppColors.black. */
function backgroundSolidArgb(settings: WebsiteSettings): number {
  const cv = settings.background?.color_value as ColorValue | null | undefined;
  if (cv && cv.type === "solid") return solidArgb(cv.color);
  // Mobile getBackgroundColor() for a gradient = lerp(first, last, 0.5).
  if (cv && cv.type === "gradient" && cv.colors.length) {
    return lerpArgb(cv.colors[0], cv.colors[cv.colors.length - 1], 0.5);
  }
  return APP_BLACK;
}
/** SettingsEntity.getForegroundColor() = font_color ?? kDefaultColor(white). */
function foregroundArgb(settings: WebsiteSettings): number {
  return settings.font_color ?? K_DEFAULT_COLOR;
}
/** Full page background (WebsiteBackgroundWidget) — solid or gradient color_value. */
function pageBackgroundCss(settings: WebsiteSettings): string | undefined {
  const cv = settings.background?.color_value as ColorValue | null | undefined;
  return colorValueToCss(cv) ?? argbToCss(APP_BLACK);
}

function visibleText(f?: HeroText | null): string | null {
  if (!f || f.hide === true) return null;
  const t = (f.text ?? "").trim();
  return t.length ? t : null;
}

function HeroBtn({
  b,
  tpl,
  stretch,
  onEdit,
  editTab,
  desktop,
  heroStyle,
}: {
  b?: HeroButton | null;
  tpl: HeroTemplate;
  stretch: boolean;
  onEdit?: EditFn;
  editTab: "button1" | "button2";
  desktop?: boolean;
  heroStyle?: HeroStyle;
}) {
  const text = (b?.text ?? "").trim();
  const hidden = !b || b.hide === true;
  // Read-only: render only a real, visible button. Editable: always render
  // (placeholder when empty/hidden) so it can be tapped to edit.
  if ((hidden || !text) && !onEdit) return null;
  const label = text || "Button";
  // ── Desktop (Nuxt) view-only overrides ──
  // style2: pill `px-5 py-2.5 rounded-full font-medium` inheriting 16px;
  // style6: border rgba(128,128,128,.3); style7 button2: `|| 16777215` → white
  // default (falsy black too); every Nuxt hero button has hover:opacity-90.
  let radius: number = tpl.buttonStyle.radius;
  let padding = `${tpl.buttonStyle.padY}px ${tpl.buttonStyle.padX}px`;
  let fontSize: number = tpl.buttonStyle.fontSize;
  let fontWeight: number | undefined;
  // AppColors.grey = 0xFF818490
  let border = tpl.buttonStyle.border ? "1px solid rgba(129,132,144,0.3)" : undefined;
  let bg = argbToCss(b?.background_color) ?? "rgb(0,0,0)";
  if (desktop) {
    if (heroStyle === "style2") {
      radius = 9999;
      padding = "10px 20px";
      fontSize = 16;
      fontWeight = 500;
    }
    if (heroStyle === "style6") border = "1px solid rgba(128, 128, 128, 0.3)";
    if (heroStyle === "style7" && editTab === "button2") {
      bg = argbToCss(b?.background_color || 16777215) ?? "rgb(255, 255, 255)";
    }
  }
  return (
    <a
      href={onEdit ? undefined : b?.url || undefined}
      onClick={(e) => {
        e.preventDefault();
        if (onEdit) {
          e.stopPropagation();
          onEdit(editTab);
        }
      }}
      className={`flex items-center justify-center font-bold ${stretch ? "w-full" : ""} ${desktop ? "transition-opacity hover:opacity-90" : ""} ${onEdit ? "pointer-events-auto cursor-pointer" : ""} ${hidden ? "opacity-40" : ""}`}
      style={{
        backgroundColor: bg,
        color: argbToCss(b?.foreground_color) ?? "#ffffff",
        borderRadius: radius,
        padding,
        fontSize,
        fontWeight,
        border,
      }}
    >
      {label}
    </a>
  );
}

/** title/text/buttons content (website_editor_layout.dart buildWidgetsContent). */
function Content({
  settings,
  tpl,
  onEdit,
  desktop,
  heroStyle,
}: {
  settings: WebsiteSettings;
  tpl: HeroTemplate;
  onEdit?: EditFn;
  desktop?: boolean;
  heroStyle: HeroStyle;
}) {
  const fg = foregroundArgb(settings);
  const title = visibleText(settings.title);
  const text = visibleText(settings.text);
  const titleColor = argbToCss(settings.title?.color ?? fg);
  const textColor = argbToCss(settings.text?.color ?? fg);

  const showTitle = tpl.hasTitle && (title || onEdit);
  const showText = tpl.hasText && (text || onEdit);
  const titleHidden = settings.title?.hide === true;
  const textHidden = settings.text?.hide === true;

  // Desktop (Nuxt) view-only typography overrides; no clamp on the public site.
  const dc = desktop ? DESKTOP_CONTENT[heroStyle] : undefined;

  const titleEl = showTitle ? (
    <Editable onEdit={onEdit} tab="title">
      <p
        dir={dirOf(title ?? "")}
        // Mobile AutoSizeText caps at 3 lines; clamp to approximate.
        className={`${desktop ? "" : "line-clamp-3 "}${textAlignClass(tpl.textAlign)} ${titleHidden ? "opacity-40" : ""}`}
        style={{
          fontSize: dc?.titleSize ?? tpl.titleStyle.size,
          fontWeight: dc?.titleWeight ?? tpl.titleStyle.weight,
          fontStyle: tpl.titleStyle.italic ? "italic" : undefined,
          fontFamily: desktop
            ? dc && "titleFamily" in dc
              ? dc.titleFamily ?? undefined
              : tpl.titleStyle.family
            : tpl.titleStyle.family,
          color: titleColor,
          lineHeight: desktop ? dc?.titleLineHeight : 1.1,
        }}
      >
        {title ?? "Your Title"}
      </p>
    </Editable>
  ) : null;

  const textEl = showText ? (
    <Editable onEdit={onEdit} tab="text">
      <p
        dir={dirOf(text ?? "")}
        className={`${desktop ? "" : "line-clamp-3 "}${desktop && dc?.textMaxW ? "mx-auto w-full max-w-md " : ""}${textAlignClass(tpl.textAlign)} ${textHidden ? "opacity-40" : ""}`}
        style={{
          fontSize: dc?.textSize ?? tpl.textStyle.size,
          fontWeight: dc?.textWeight ?? tpl.textStyle.weight,
          lineHeight: desktop ? dc?.textLineHeight : undefined,
          opacity: dc?.textOpacity,
          color: textColor,
        }}
      >
        {text ?? "Your description text"}
      </p>
    </Editable>
  ) : null;

  // ── DESKTOP (Nuxt) layouts — view only, phone canvas keeps the mobile ones ──
  if (desktop && heroStyle === "style7") {
    // Style7.vue card flow: title → 8px → text → 24px → buttons column gap 10.
    return (
      <div>
        {titleEl}
        {titleEl && <div className="h-2" />}
        {textEl}
        {textEl && <div className="h-6" />}
        <div className="flex w-full flex-col" style={{ gap: 10 }}>
          {tpl.hasButton1 && <HeroBtn b={settings.button1} tpl={tpl} stretch onEdit={onEdit} editTab="button1" desktop heroStyle={heroStyle} />}
          {tpl.hasButton2 && <HeroBtn b={settings.button2} tpl={tpl} stretch onEdit={onEdit} editTab="button2" desktop heroStyle={heroStyle} />}
        </div>
      </div>
    );
  }
  if (desktop && (heroStyle === "style4" || heroStyle === "style5" || heroStyle === "style6")) {
    // Style4/5/6.vue overlay: justify-between [empty, text block, 24px, buttons
    // gap 10] with 40px padding — buttons flush to the bottom edge.
    return (
      <div className="flex h-full flex-col items-stretch justify-between" style={{ padding: 40 }}>
        <div />
        <div className="text-center">
          {titleEl}
          {titleEl && <div className="h-2" />}
          {textEl}
        </div>
        <div className="h-6" />
        <div className="flex w-full flex-col" style={{ gap: 10 }}>
          {tpl.hasButton1 && <HeroBtn b={settings.button1} tpl={tpl} stretch onEdit={onEdit} editTab="button1" desktop heroStyle={heroStyle} />}
          {tpl.hasButton2 && <HeroBtn b={settings.button2} tpl={tpl} stretch onEdit={onEdit} editTab="button2" desktop heroStyle={heroStyle} />}
        </div>
      </div>
    );
  }
  if (desktop && heroStyle === "style3") {
    // Style3.vue overlay: centered column, px-6, title → 8px → text, no buttons.
    return (
      <div className="flex h-full flex-col items-center justify-center px-6">
        {titleEl}
        {titleEl && <div className="h-2" />}
        {textEl}
      </div>
    );
  }
  if (desktop && heroStyle === "style2") {
    // Style2.vue overlay: bottom-anchored `gap-3 pb-6 px-4`, buttons row mt-2
    // gap-3 flex-wrap (pill buttons).
    return (
      <div className="flex h-full flex-col items-center justify-end gap-3 px-4 pb-6">
        {titleEl}
        {textEl}
        <div className="mt-2 flex flex-row flex-wrap items-center justify-center gap-3">
          {tpl.hasButton1 && <HeroBtn b={settings.button1} tpl={tpl} stretch={false} onEdit={onEdit} editTab="button1" desktop heroStyle={heroStyle} />}
          {tpl.hasButton2 && <HeroBtn b={settings.button2} tpl={tpl} stretch={false} onEdit={onEdit} editTab="button2" desktop heroStyle={heroStyle} />}
        </div>
      </div>
    );
  }

  if (tpl.buttonLayout === "vertical") {
    return (
      <div
        className="flex h-full flex-col justify-around"
        style={{ padding: tpl.contentPadding }}
      >
        <span />
        <div className="flex flex-col gap-2">
          {titleEl}
          {textEl}
        </div>
        <div className="flex flex-col gap-1">
          {tpl.hasButton1 && <HeroBtn b={settings.button1} tpl={tpl} stretch onEdit={onEdit} editTab="button1" />}
          {tpl.hasButton2 && <HeroBtn b={settings.button2} tpl={tpl} stretch onEdit={onEdit} editTab="button2" />}
        </div>
      </div>
    );
  }

  // horizontal — mobile inserts 8px (title→text) then 24px (text→buttons).
  const justify = tpl.contentAlign === "bottom" ? "justify-end" : "justify-center";
  return (
    <div className={`flex h-full flex-col ${justify} ${alignItems(tpl.textAlign)} p-4`}>
      <div className="flex flex-col items-center">
        {titleEl}
        {titleEl && textEl && <div className="h-2" />}
        {textEl}
        {(tpl.hasButton1 || tpl.hasButton2) && <div className="h-6" />}
        {(tpl.hasButton1 || tpl.hasButton2) && (
          <div className="flex flex-row justify-center gap-2.5">
            {tpl.hasButton1 && <HeroBtn b={settings.button1} tpl={tpl} stretch={false} onEdit={onEdit} editTab="button1" />}
            {tpl.hasButton2 && <HeroBtn b={settings.button2} tpl={tpl} stretch={false} onEdit={onEdit} editTab="button2" />}
          </div>
        )}
      </div>
    </div>
  );
}

function isValidRect(rect: RectTuple): boolean {
  return rect.length === 4 && rect[2] > rect[0] && rect[3] > rect[1];
}

/**
 * Cover image honouring the optional crop `image_rect` ([left, top, right, bottom]
 * in ABSOLUTE source pixels — mobile draws `image, rect → destRect` via
 * canvas.drawImageRect). When a valid rect is present we load the image to read
 * its natural size, then render a div whose background is sized so the cropped
 * region fills the box; otherwise a plain object-cover <img>. (Replicated inline
 * from ImagesBlockView's RectImg to avoid coupling.)
 */
function CoverImg({ url, rect }: { url: string; rect?: RectTuple | null }) {
  const hasRect = !!(rect && isValidRect(rect));
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!hasRect) return;
    let active = true;
    const image = new window.Image();
    image.onload = () => {
      if (active) setNat({ w: image.naturalWidth, h: image.naturalHeight });
    };
    image.src = url;
    return () => {
      active = false;
    };
  }, [url, hasRect]);

  if (hasRect && nat && rect) {
    const [left, top, right, bottom] = rect;
    const cropW = right - left;
    const cropH = bottom - top;
    // Scale the source so the crop window fills the element, then offset to the
    // crop origin (as a % of the leftover space).
    const bgW = cropW > 0 ? (nat.w / cropW) * 100 : 100;
    const bgH = cropH > 0 ? (nat.h / cropH) * 100 : 100;
    const posX = nat.w - cropW > 0 ? (left / (nat.w - cropW)) * 100 : 0;
    const posY = nat.h - cropH > 0 ? (top / (nat.h - cropH)) * 100 : 0;
    return (
      <div
        className="absolute inset-0 size-full"
        role="img"
        style={{
          backgroundImage: `url(${url})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${bgW}% ${bgH}%`,
          backgroundPosition: `${posX}% ${posY}%`,
        }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
  );
}

function Cover({
  settings,
  onEdit,
  desktop,
  heroStyle,
}: {
  settings: WebsiteSettings;
  onEdit?: EditFn;
  desktop?: boolean;
  heroStyle: HeroStyle;
}) {
  const cover = settings.cover_photo;
  const size = (cover?.size ?? "poster") as CoverPhotoSize;
  const ratio = COVER[size]?.ratio ?? "4 / 5";
  const img = cover?.image_url && cover.hide !== true ? cdnUrl(cover.image_url) : undefined;
  const transparency = cover?.transparency ?? 1;
  const overlay = rgbaWithAlpha(cover?.color ?? backgroundSolidArgb(settings), transparency);
  const fade = cover?.fade === true;

  if (desktop) {
    // ── DESKTOP (Nuxt public front) cover — VIEW ONLY ──
    // useHeroHelpers.getCoverPhotoAspectRatio: `shape ?? size`; unknown/absent →
    // 22/9 + margin-bottom clamp(4rem,3vw,2rem) (=64px). Style2 then forces
    // margin-bottom:0; Style7 has its own map defaulting to square 1/1.
    const shapeKey = ((cover as ({ shape?: string } & typeof cover) | null | undefined)?.shape ??
      cover?.size) as CoverPhotoSize | undefined;
    let dRatio: string;
    let marginBottom: string | undefined;
    let maxHeight: string | undefined;
    if (heroStyle === "style7") {
      dRatio = COVER[(cover?.size ?? "square") as CoverPhotoSize]?.ratio ?? "1 / 1";
    } else if (shapeKey && COVER[shapeKey]) {
      dRatio = COVER[shapeKey].ratio;
    } else {
      dRatio = "22 / 9";
      if (heroStyle !== "style2") marginBottom = "clamp(4rem, 3vw, 2rem)";
    }
    // Style1.vue: horizontal cover reserves space below for the overlapping
    // avatar (condition uses `size` and requires profile_picture.image_url).
    if (
      heroStyle === "style1" &&
      cover?.size === "horizontal" &&
      settings.profile_picture?.hide !== true &&
      settings.profile_picture?.image_url
    ) {
      marginBottom = "clamp(4rem, 3vw, 2rem)";
    }
    // Scoped CSS at min-width:768 — style2: 70vh (90vh vertical); style3-6: 90vh.
    if (heroStyle === "style2") {
      maxHeight = shapeKey === "vertical" ? "90vh" : "70vh";
    } else if (heroStyle !== "style1" && heroStyle !== "style7") {
      maxHeight = "90vh";
    }
    const style7 = heroStyle === "style7";
    // Legacy profile: no `color` → the IMAGE fades by transparency (default 0).
    // Updated: `color` set → image opaque + color overlay at `transparency ?? 0`.
    // Style7 renders the raw image (no overlay, no fade) on the public site.
    const imageOpacity = style7 ? 1 : cover?.color != null ? 1 : 1 - (cover?.transparency ?? 0);
    const fadeMask =
      !style7 && fade ? "linear-gradient(to top, transparent 0%, black 15%)" : undefined;
    return (
      <div
        onClick={onEdit ? (e) => { e.stopPropagation(); onEdit("cover"); } : undefined}
        className={`relative w-full ${onEdit ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary/60" : ""}`}
        style={{ aspectRatio: dRatio, marginBottom, maxHeight }}
      >
        {img && (
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ opacity: imageOpacity, WebkitMaskImage: fadeMask, maskImage: fadeMask }}
          >
            <CoverImg url={img} rect={cover?.image_rect} />
          </div>
        )}
        {!style7 && cover?.color != null && (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{ backgroundColor: argbToCss(cover.color), opacity: cover?.transparency ?? 0 }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onEdit ? (e) => { e.stopPropagation(); onEdit("cover"); } : undefined}
      className={`relative w-full overflow-hidden ${onEdit ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary/60" : ""}`}
      style={{
        aspectRatio: ratio,
        WebkitMaskImage: fade
          ? "linear-gradient(to bottom, #000 80%, transparent)"
          : undefined,
        maskImage: fade
          ? "linear-gradient(to bottom, #000 80%, transparent)"
          : undefined,
      }}
    >
      {img && <CoverImg url={img} rect={cover?.image_rect} />}
      <div className="absolute inset-0" style={{ backgroundColor: overlay }} />
    </div>
  );
}

function Header({
  settings,
  tpl,
  overlay,
  onEdit,
  desktop,
  heroStyle,
}: {
  settings: WebsiteSettings;
  tpl: HeroTemplate;
  overlay: boolean;
  onEdit?: EditFn;
  desktop?: boolean;
  heroStyle?: HeroStyle;
}) {
  const h = settings.header;
  const hidden = h?.hide === true;
  // Mobile SettingsEntity.fillDefaults: an ABSENT header key resolves to the
  // hero style's template default (headerStyleDefaults) — onCover + unfilled
  // pill for styles 1/3, aboveCover + filled elsewhere, bar colors for 5/6/7.
  // Phone and desktop now share the mobile semantics (Nuxt was fixed in
  // lockstep, so all three targets agree).
  const def = headerStyleDefaults(heroStyle ?? settings.style);
  const onCover = (h?.position ?? def.position) === "onCover";
  const filled = h?.fillSides ?? def.fillSides;
  const pill = onCover && !filled;
  const height = pill ? HEADER_ON_HEIGHT : HEADER_ABOVE_HEIGHT;
  // getLogoDimension: 28 when onCover & unfilled, else 38.
  const logoDim = pill ? 28 : 38;
  // Mobile uses ONLY logo.image_url (no website_logo fallback) and respects hide.
  const logo =
    settings.logo?.hide === true ? undefined : settings.logo?.image_url ?? undefined;
  const titleText = visibleText(h?.title);
  // Mobile color chain: header.foreground_color (or the style's template
  // default) → site font color → white. title.color / header_text are unused.
  const fg =
    argbToCss(h?.foreground_color ?? def.foreground_color ?? foregroundArgb(settings)) ?? "#fff";
  // Mobile applies background_opacity only when the header is onCover (it has
  // transparency); an aboveCover bar is always opaque. hide removes the bg.
  const headerOpacity = onCover ? (h?.background_opacity ?? 1) : 1;
  const bgArgb = h?.background_color ?? def.background_color;
  const bg = hidden
    ? undefined
    : bgArgb != null
      ? rgbaWithAlpha(bgArgb, headerOpacity)
      : overlay
        ? "transparent"
        : undefined;
  const leading = h?.leading_alignment ?? "start";
  // Pill geometry (mobile): 14 margin + 8 outer padding → side inset 22, top
  // gap 10 + 8 = 18; inner pad 5 (+3 row pad on the group below).
  const barPad = pill ? "mx-[22px] mt-[18px] px-[5px]" : "px-5";
  // Mobile hide:true keeps the bar's layout space — bg and logo+title are
  // simply removed. The editable canvas instead shows a 40%-opacity ghost.
  if (hidden && !onEdit) return <div className={barPad} style={{ height }} />;
  const group = (
    <div className="flex min-w-0 items-center gap-[5px] px-[3px]">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cdnUrl(logo)} alt="" className="w-auto rounded-[4px] object-contain" style={{ height: logoDim }} />
      ) : null}
      {tpl.hasHeaderTitle && titleText ? (
        <span dir={dirOf(titleText)} className="truncate text-lg font-bold" style={{ color: fg }}>
          {titleText}
        </span>
      ) : null}
    </div>
  );
  return (
    <div
      onClick={onEdit ? (e) => { e.stopPropagation(); onEdit("header"); } : undefined}
      className={`relative flex items-center gap-[5px] ${barPad} ${
        leading === "end" ? "flex-row-reverse" : ""
      } ${
        onEdit ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary/60" : ""
      } ${hidden ? "opacity-40" : ""}`}
      style={{
        height,
        backgroundColor: bg,
        color: fg,
        borderRadius: pill ? 6 : undefined,
      }}
    >
      {/* Logo → title, ALWAYS in that order (the mobile Row never flips, even
          end-aligned); `center` is true-centered over the bar (mobile Stack
          alignment), not centered beside the menu icon. */}
      {leading === "center" ? (
        <>
          <div className="pointer-events-none absolute inset-x-10 top-1/2 flex -translate-y-1/2 justify-center">
            {group}
          </div>
          <div className="min-w-0 flex-1" />
        </>
      ) : (
        <div className={`flex min-w-0 flex-1 items-center ${leading === "end" ? "justify-end" : "justify-start"}`}>
          {group}
        </div>
      )}
      {/* Pages/menu icon — the mobile editor always shows it (flipped to the
          inline start when leading is `end`); the Nuxt front renders a
          hamburger only when sub-pages exist (none in the builder), so the
          desktop view drops it. */}
      {!desktop && <Menu className="size-5 shrink-0" style={{ color: fg }} aria-hidden />}
    </div>
  );
}

function ProfilePicture({ settings, onEdit }: { settings: WebsiteSettings; onEdit?: EditFn }) {
  const p = settings.profile_picture;
  if (p?.hide === true && !onEdit) return null;
  // Mobile uses ONLY profile_picture.image_url (no logo fallback).
  const img = p?.image_url ? cdnUrl(p.image_url) : undefined;
  // Mobile shows nothing in read-only/live when there's no image.
  if (!img && !onEdit) return null;
  const fg = foregroundArgb(settings);
  // kAvatarSize=90; rectangle width = 90 * 16/9 (=160), else 90. circle → full radius, else 12.
  const shape = p?.shape ?? "circle";
  const width = shape === "rectangle" ? 90 * (16 / 9) : 90;
  const radius = shape === "circle" ? "9999px" : "12px";
  return (
    <div className={`flex flex-col px-4 ${imgAlignItems(p?.alignment)}`}>
      <div
        onClick={onEdit ? (e) => { e.stopPropagation(); onEdit("picture"); } : undefined}
        className={`flex items-center justify-center overflow-hidden ${onEdit ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-primary/60" : ""} ${p?.hide === true ? "opacity-40" : ""}`}
        style={{
          width,
          height: 90,
          borderRadius: radius,
          borderStyle: "solid",
          borderWidth: p?.border_width ?? 0,
          // Mobile default border color is the foreground; empty fill = fg @ 50%.
          borderColor: argbToCss(p?.border_color) ?? argbToCss(fg),
          backgroundColor: rgbaWithAlpha(fg, 0.5),
        }}
      >
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="size-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="size-6 text-foreground/25" fill="currentColor">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6Z" />
          </svg>
        )}
      </div>
    </div>
  );
}

/**
 * DESKTOP style1 avatar — Nuxt ProfilePicture placement (VIEW ONLY).
 * useHeroHelpers.getProfilePicturePosition: hangs clamp(52-80px) below the
 * cover edge (horizontal / no cover), or pins to top:300px centered for
 * square/poster/vertical covers (>=771px). Rendered absolutely inside the
 * cover's relative wrapper.
 */
function desktopAvatarPos(
  cover: WebsiteSettings["cover_photo"],
  alignment?: string | null,
): React.CSSProperties {
  const base: React.CSSProperties = { position: "absolute", zIndex: 10 };
  if (!alignment || alignment === "center") {
    base.left = "50%";
    base.transform = "translateX(-50%)";
  } else if (alignment === "start") {
    base.left = "1.25rem";
  } else if (alignment === "end") {
    base.right = "1.25rem";
  }
  const shape = ((cover as ({ shape?: string } & typeof cover) | null | undefined)?.shape ??
    cover?.size) as string | undefined;
  if (!cover || !cover.image_url || cover.hide === true || shape === "horizontal") {
    return { ...base, bottom: "calc(-1 * clamp(52px, 5vw, 80px))" };
  }
  if (shape === "square" || shape === "poster" || shape === "vertical") {
    return { position: "absolute", top: 300, left: "50%", transform: "translate(-50%, 50%)", zIndex: 10 };
  }
  return { ...base, bottom: "2rem" };
}

function DesktopAvatar({ settings, onEdit }: { settings: WebsiteSettings; onEdit?: EditFn }) {
  const p = settings.profile_picture;
  // Nuxt: visible when not hidden and either the avatar image or the logo
  // exists (logo is the fallback image; then /person.svg — dead path).
  const imgPath = p?.image_url || settings.logo?.image_url || undefined;
  const visible = p?.hide !== true && !!imgPath;
  if (!visible && !onEdit) return null;
  const shape = p?.shape === "square" || p?.shape === "rectangle" ? p.shape : "circle";
  const pos = desktopAvatarPos(settings.cover_photo, p?.alignment ?? undefined);
  // Nuxt: border only when border_width is set (color falls back transparent).
  const border = p?.border_width
    ? `${p.border_width}px solid ${p.border_color != null ? argbToCss(p.border_color) : "transparent"}`
    : undefined;
  return (
    <div
      onClick={onEdit ? (e) => { e.stopPropagation(); onEdit("picture"); } : undefined}
      className={`overflow-hidden ${shape === "circle" ? "rounded-full" : "rounded-lg"} ${
        onEdit ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-primary/60" : ""
      } ${p?.hide === true ? "opacity-40" : ""}`}
      style={{
        ...pos,
        // md:size-44 = 176px; rectangle md:w-96 aspect-[16/9] = 384x216.
        width: shape === "rectangle" ? 384 : 176,
        height: shape === "rectangle" ? 216 : 176,
        border,
      }}
    >
      {imgPath ? (
        <div className="relative size-full">
          <CoverImg url={cdnUrl(imgPath)} rect={p?.image_rect} />
        </div>
      ) : (
        <div className="flex size-full items-center justify-center bg-white/10">
          <svg viewBox="0 0 24 24" className="size-6 text-foreground/25" fill="currentColor">
            <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6Z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function NameBio({
  settings,
  onEdit,
  desktop,
}: {
  settings: WebsiteSettings;
  onEdit?: EditFn;
  desktop?: boolean;
}) {
  const heroStyle = (settings.style ?? "style1") as HeroStyle;
  const fg = foregroundArgb(settings);
  const name = settings.name;
  const bio = settings.bio;
  const nameText = name?.hide === true ? "" : (name?.text ?? "").trim();
  const bioText = bio?.hide === true ? "" : (bio?.text ?? "").trim();
  // Nuxt style7 defaults name/bio to the LEFT; every other style centers.
  const defaultAlign: Align = desktop && heroStyle === "style7" ? "start" : "center";
  const nameAlign = (name?.alignment ?? defaultAlign) as Align;
  const bioAlign = (bio?.alignment ?? defaultAlign) as Align;
  const showName = nameText || onEdit;
  const showBio = bioText || onEdit;
  if (!showName && !showBio) return null;

  if (desktop) {
    // ── DESKTOP (Nuxt) name + bio — VIEW ONLY ──
    // Style1: h1 text-4xl (36px/40px, weight 400) pt-[1.55rem]|pt-4, wrapper
    // px-5, bio text-2xl (24px) px-4 pt-4 (36px total sides).
    // Style2: wrapper px-5 py-4; Style3-6: name mt-4; all: name 48px/lh1 bold
    // mb-2, bio 20px. Bio honours bio.color at opacity .8 and \n line breaks.
    const s1 = heroStyle === "style1";
    const nameTopPad = s1
      ? settings.profile_picture?.hide === true || settings.cover_photo?.size !== "horizontal"
        ? "pt-[1.55rem]"
        : "pt-4"
      : "";
    const nameMargins =
      heroStyle === "style3" || heroStyle === "style4" || heroStyle === "style5" || heroStyle === "style6"
        ? "mb-2 mt-4"
        : s1
          ? ""
          : "mb-2";
    const bioColor = (bio as { color?: number | null } | null | undefined)?.color;
    return (
      <div className={`flex flex-col ${heroStyle === "style2" ? "py-4" : ""}`}>
        {showName ? (
          <Editable onEdit={onEdit} tab="name" className={`px-5 ${nameTopPad} ${nameMargins}`}>
            <div
              className={`flex items-center ${
                nameAlign === "start"
                  ? "justify-start"
                  : nameAlign === "end"
                    ? "justify-end"
                    : "justify-center"
              }`}
            >
              <p
                dir={dirOf(nameText)}
                className={`min-w-0 ${textAlignClass(nameAlign)} ${!nameText ? "opacity-40" : ""}`}
                style={{
                  color: argbToCss(name?.color ?? fg),
                  fontSize: s1 ? 36 : 48,
                  fontWeight: s1 ? 400 : 700,
                  lineHeight: s1 ? "2.5rem" : 1,
                }}
              >
                {nameText || "Your Name"}
              </p>
              {settings.verified === true && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/verified_badge.svg"
                  alt=""
                  aria-label="Verified"
                  className="inline-block size-4 shrink-0 scale-[2]"
                  style={{ marginLeft: 7, marginBottom: 2 }}
                />
              )}
            </div>
          </Editable>
        ) : null}
        {showBio ? (
          <Editable onEdit={onEdit} tab="bio" className={s1 ? "px-9 pt-4" : "px-5"}>
            <p
              dir={dirOf(bioText)}
              className={`whitespace-pre-line ${textAlignClass(bioAlign)} ${!bioText ? "opacity-40" : ""}`}
              style={{
                color: argbToCss(bioColor ?? fg),
                opacity: 0.8,
                fontSize: s1 ? 24 : 20,
                lineHeight: s1 ? "2rem" : "1.75rem",
              }}
            >
              {bioText || "Your bio / tagline"}
            </p>
          </Editable>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {showName ? (
        <Editable onEdit={onEdit} tab="name" className="px-6">
          {/* Mobile WebsiteNameWidget: when verified, name sits in a Row with a
              22px verified badge (6px gap), justified per the name alignment. */}
          <div
            className={`flex items-center gap-1.5 ${
              nameAlign === "start"
                ? "justify-start"
                : nameAlign === "end"
                  ? "justify-end"
                  : "justify-center"
            }`}
          >
            <p
              dir={dirOf(nameText)}
              className={`min-w-0 text-[26px] font-bold leading-tight ${textAlignClass(nameAlign)} ${!nameText ? "opacity-40" : ""}`}
              style={{ color: argbToCss(name?.color ?? fg) }}
            >
              {nameText || "Your Name"}
            </p>
            {settings.verified === true && (
              <BadgeCheck className="size-[22px] shrink-0" style={{ color: "#4488ff" }} aria-label="Verified" />
            )}
          </div>
        </Editable>
      ) : null}
      {showBio ? (
        <Editable onEdit={onEdit} tab="bio" className="px-6 pt-1.5">
          <p
            dir={dirOf(bioText)}
            // Mobile bio is fixed at 50% of the foreground color.
            className={`text-sm ${textAlignClass(bioAlign)} ${!bioText ? "opacity-40" : ""}`}
            style={{ color: rgbaWithAlpha(fg, 0.5) }}
          >
            {bioText || "Your bio / tagline"}
          </p>
        </Editable>
      ) : null}
    </div>
  );
}

export function Hero({
  settings,
  onEdit,
  transparentBg = false,
  desktop = false,
}: {
  settings: WebsiteSettings;
  onEdit?: (tab: HeroTab) => void;
  /** Skip painting the page background (the desktop "computer" frame paints it). */
  transparentBg?: boolean;
  /**
   * Desktop "computer" preview (BuilderCanvas deviceWidth === "full") — render
   * with the Nuxt public-front desktop layout/typography instead of the mobile
   * canvas one. VIEW ONLY: no stored-JSON/editor/serialization impact.
   */
  desktop?: boolean;
}) {
  const style = (settings.style ?? "style1") as HeroStyle;
  const tpl = HERO_TEMPLATES[style] ?? HERO_TEMPLATES.style1;
  const header = settings.header;
  // Mobile per-style defaults for absent position/fillSides (fillDefaults);
  // the header ALWAYS keeps its layout space — even hidden or empty — so the
  // cover only moves when position actually changes (mobile spacer is not
  // gated on hide, website_editor_layout.dart:1049-1089).
  const hdrDef = headerStyleDefaults(style);
  const onCover = (header?.position ?? hdrDef.position) === "onCover";

  const coverSize = (settings.cover_photo?.size ?? "poster") as CoverPhotoSize;
  const limited = COVER[coverSize]?.limited ?? false;

  // Page background (WebsiteBackgroundWidget) behind the whole general section.
  const bgImage = settings.background?.image ? cdnUrl(settings.background.image) : undefined;
  const fontFamily = fontStack(settings.font_family);
  // Mobile checks color_value FIRST — image only shows when there's no color.
  const hasColorValue = !!settings.background?.color_value;
  const pageStyle: React.CSSProperties = transparentBg
    ? { fontFamily }
    : !hasColorValue && bgImage
      ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center", fontFamily }
      : { background: pageBackgroundCss(settings), fontFamily };

  let heroSection: React.ReactNode;

  if (tpl.layout === "column") {
    // Style 7 — header, then a card { cover, [picture], content }.
    const s = settings;
    // Mirror getHide(): a present element with hide===undefined is NOT hidden;
    // only absent or hide===true counts as hidden.
    const hidden = (f?: { hide?: boolean | null } | null) => !f || f.hide === true;
    const allHidden =
      hidden(s.cover_photo) &&
      hidden(s.title) &&
      hidden(s.text) &&
      hidden(s.button1) &&
      hidden(s.button2);
    const coverVisible = !!s.cover_photo && s.cover_photo.hide !== true;
    // Nuxt Style7 showCard is CONTENT-based (an empty white card never shows);
    // the hidden-but-set cover keeps its aspect box. Desktop read-only adopts it.
    const showCard =
      desktop && !onEdit
        ? !!(
            (s.cover_photo?.image_url && s.cover_photo.hide !== true) ||
            visibleText(s.title) ||
            visibleText(s.text) ||
            (s.button1 && s.button1.hide !== true && (s.button1.text ?? "").trim()) ||
            (s.button2 && s.button2.hide !== true && (s.button2.text ?? "").trim())
          )
        : !allHidden || !!onEdit;
    const showCoverBox = desktop
      ? !!s.cover_photo?.image_url || !!onEdit
      : coverVisible || !!onEdit;
    heroSection = (
      <div className={`${desktop && onCover ? "relative " : ""}flex flex-col`}>
        {desktop && onCover ? (
          // Nuxt Header/Style1 is absolute when onCover — 0 layout height,
          // overlaying the card top.
          <div className={`absolute inset-x-0 top-0 z-[12] ${onEdit ? "pointer-events-none" : ""}`}>
            <Header settings={settings} tpl={tpl} overlay onEdit={onEdit} desktop heroStyle={style} />
          </div>
        ) : (
          <Header settings={settings} tpl={tpl} overlay={false} onEdit={onEdit} desktop={desktop} heroStyle={style} />
        )}
        {showCard && (
          <div
            className="m-5 flex flex-col rounded-[20px] p-5 pb-2.5 shadow-[0_0_10px_rgba(0,0,0,0.1)]"
            style={{ backgroundColor: argbToCss(settings.card_style?.color) ?? "#fff" }}
          >
            {showCoverBox && (
              <div className="overflow-hidden rounded-2xl">
                <Cover settings={settings} onEdit={onEdit} desktop={desktop} heroStyle={style} />
              </div>
            )}
            {tpl.hasProfileImage && <ProfilePicture settings={settings} onEdit={onEdit} />}
            <div className="h-5" />
            <Content settings={settings} tpl={tpl} onEdit={onEdit} desktop={desktop} heroStyle={style} />
          </div>
        )}
      </div>
    );
  } else if (desktop) {
    // ── DESKTOP stack (Nuxt index.vue order) — VIEW ONLY ──
    // aboveCover header in flow, then the cover box with the content overlay
    // and (style1) the absolutely-positioned avatar inside its relative frame.
    heroSection = (
      <>
        {!onCover && (
          <Header settings={settings} tpl={tpl} overlay={false} onEdit={onEdit} desktop heroStyle={style} />
        )}
        <div className="relative">
          <Cover settings={settings} onEdit={onEdit} desktop heroStyle={style} />
          {onCover && (
            <div className={`absolute inset-x-0 top-0 z-[12] ${onEdit ? "pointer-events-none" : ""}`}>
              <Header settings={settings} tpl={tpl} overlay onEdit={onEdit} desktop heroStyle={style} />
            </div>
          )}
          {!limited && (
            <div className={`absolute inset-0 z-[2] ${onEdit ? "pointer-events-none" : ""}`}>
              <Content settings={settings} tpl={tpl} onEdit={onEdit} desktop heroStyle={style} />
            </div>
          )}
          {tpl.hasProfileImage && <DesktopAvatar settings={settings} onEdit={onEdit} />}
        </div>
      </>
    );
  } else {
    // Stack — cover behind, header on top, content overlaid. For style1 the
    // profile picture straddles the BOTTOM of the cover (mobile getPicturePadding
    // pushes it down to overlap by half the avatar); name/bio then sit below.
    heroSection = (
      <>
        <div className="relative">
          {/* cover, offset by header height when the header is above it —
              the spacer is NOT gated on hide (mobile keeps the space) */}
          <div className="flex flex-col">
            {!onCover && <div style={{ height: HEADER_ABOVE_HEIGHT }} />}
            <Cover settings={settings} onEdit={onEdit} heroStyle={style} />
          </div>

          {/* header (floating on cover — pill top gap lives in Header's
              mt-[18px] — or in the offset space above it) */}
          <div className={`absolute inset-x-0 top-0 flex flex-col ${onEdit ? "pointer-events-none" : ""}`}>
            <Header settings={settings} tpl={tpl} overlay={onCover} onEdit={onEdit} heroStyle={style} />
          </div>

          {/* title/text/buttons overlaid — hidden for limited covers (16:9, 1:1),
              unconditionally, matching the mobile editor (limitedContent gate at
              website_editor_layout.dart:1068 is not gated on preview/edit). */}
          {!limited && (
            <div className={`absolute inset-0 ${onEdit ? "pointer-events-none" : ""}`}>
              <Content settings={settings} tpl={tpl} onEdit={onEdit} heroStyle={style} />
            </div>
          )}
        </div>

        {/* style1 — avatar overlapping the cover's bottom edge */}
        {tpl.hasProfileImage && (
          <div className="relative z-10 -mt-[45px] mb-1">
            <ProfilePicture settings={settings} onEdit={onEdit} />
          </div>
        )}
      </>
    );
  }

  return (
    <div style={pageStyle}>
      {heroSection}
      {/* Desktop: Nuxt spacing comes from the per-style name padding/margins. */}
      {!desktop && <div className="h-3" />}
      <NameBio settings={settings} onEdit={onEdit} desktop={desktop} />
      <div className="h-5" />
    </div>
  );
}
