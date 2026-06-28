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
}: {
  b?: HeroButton;
  tpl: HeroTemplate;
  stretch: boolean;
  onEdit?: EditFn;
  editTab: "button1" | "button2";
}) {
  const text = (b?.text ?? "").trim();
  const hidden = !b || b.hide === true;
  // Read-only: render only a real, visible button. Editable: always render
  // (placeholder when empty/hidden) so it can be tapped to edit.
  if ((hidden || !text) && !onEdit) return null;
  const label = text || "Button";
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
      className={`flex items-center justify-center font-bold ${stretch ? "w-full" : ""} ${onEdit ? "pointer-events-auto cursor-pointer" : ""} ${hidden ? "opacity-40" : ""}`}
      style={{
        backgroundColor: argbToCss(b?.background_color) ?? "rgb(0,0,0)",
        color: argbToCss(b?.foreground_color) ?? "#ffffff",
        borderRadius: tpl.buttonStyle.radius,
        padding: `${tpl.buttonStyle.padY}px ${tpl.buttonStyle.padX}px`,
        fontSize: tpl.buttonStyle.fontSize,
        // AppColors.grey = 0xFF818490
        border: tpl.buttonStyle.border ? "1px solid rgba(129,132,144,0.3)" : undefined,
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
}: {
  settings: WebsiteSettings;
  tpl: HeroTemplate;
  onEdit?: EditFn;
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

  const titleEl = showTitle ? (
    <Editable onEdit={onEdit} tab="title">
      <p
        dir={dirOf(title ?? "")}
        // Mobile AutoSizeText caps at 3 lines; clamp to approximate.
        className={`line-clamp-3 ${textAlignClass(tpl.textAlign)} ${titleHidden ? "opacity-40" : ""}`}
        style={{
          fontSize: tpl.titleStyle.size,
          fontWeight: tpl.titleStyle.weight,
          fontStyle: tpl.titleStyle.italic ? "italic" : undefined,
          fontFamily: tpl.titleStyle.family,
          color: titleColor,
          lineHeight: 1.1,
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
        className={`line-clamp-3 ${textAlignClass(tpl.textAlign)} ${textHidden ? "opacity-40" : ""}`}
        style={{
          fontSize: tpl.textStyle.size,
          fontWeight: tpl.textStyle.weight,
          color: textColor,
        }}
      >
        {text ?? "Your description text"}
      </p>
    </Editable>
  ) : null;

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

function Cover({ settings, onEdit }: { settings: WebsiteSettings; onEdit?: EditFn }) {
  const cover = settings.cover_photo;
  const size = (cover?.size ?? "poster") as CoverPhotoSize;
  const ratio = COVER[size]?.ratio ?? "4 / 5";
  const img = cover?.image_url && cover.hide !== true ? cdnUrl(cover.image_url) : undefined;
  const transparency = cover?.transparency ?? 1;
  const overlay = rgbaWithAlpha(cover?.color ?? backgroundSolidArgb(settings), transparency);
  const fade = cover?.fade === true;
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
}: {
  settings: WebsiteSettings;
  tpl: HeroTemplate;
  overlay: boolean;
  onEdit?: EditFn;
}) {
  const h = settings.header;
  if (h?.hide === true && !onEdit) return null;
  const onCover = h?.position === "onCover";
  const filled = h?.fillSides === true;
  const height = onCover && !filled ? HEADER_ON_HEIGHT : HEADER_ABOVE_HEIGHT;
  // getLogoDimension: 28 when onCover & unfilled, else 38.
  const logoDim = onCover && !filled ? 28 : 38;
  // Mobile uses ONLY logo.image_url (no website_logo fallback) and respects hide.
  const logo =
    settings.logo?.hide === true ? undefined : settings.logo?.image_url ?? undefined;
  const titleText = visibleText(h?.title);
  const fg = argbToCss(h?.foreground_color ?? foregroundArgb(settings)) ?? "#111";
  // Mobile applies background_opacity only when the header is onCover (it has
  // transparency); an aboveCover bar is always opaque.
  const headerOpacity = onCover ? (h?.background_opacity ?? 1) : 1;
  const bg =
    h?.background_color != null
      ? rgbaWithAlpha(h.background_color, headerOpacity)
      : overlay
        ? "transparent"
        : undefined;
  const leading = h?.leading_alignment ?? "start";
  return (
    <div
      onClick={onEdit ? (e) => { e.stopPropagation(); onEdit("header"); } : undefined}
      className={`flex items-center gap-2 ${onCover ? "mx-3.5 mt-2.5 px-3" : "px-5"} ${
        onEdit ? "pointer-events-auto cursor-pointer hover:ring-2 hover:ring-inset hover:ring-primary/60" : ""
      } ${h?.hide === true ? "opacity-40" : ""}`}
      style={{ height, backgroundColor: bg, color: fg, borderRadius: onCover ? 6 : undefined }}
    >
      {/* Logo + title group, justified per leading_alignment. */}
      <div
        className={`flex min-w-0 flex-1 items-center gap-2 ${
          leading === "center" ? "justify-center" : leading === "end" ? "justify-end" : "justify-start"
        }`}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cdnUrl(logo)} alt="" className="w-auto rounded-[4px] object-contain" style={{ height: logoDim }} />
        ) : null}
        {tpl.hasHeaderTitle && titleText ? (
          <span dir={dirOf(titleText)} className="truncate text-xl font-bold" style={{ color: fg }}>
            {titleText}
          </span>
        ) : null}
      </div>
      {/* Pages/menu icon — present on every mobile hero header (trailing). */}
      <Menu className="size-5 shrink-0" style={{ color: fg }} aria-hidden />
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

function NameBio({ settings, onEdit }: { settings: WebsiteSettings; onEdit?: EditFn }) {
  const fg = foregroundArgb(settings);
  const name = settings.name;
  const bio = settings.bio;
  const nameText = name?.hide === true ? "" : (name?.text ?? "").trim();
  const bioText = bio?.hide === true ? "" : (bio?.text ?? "").trim();
  const nameAlign = (name?.alignment ?? "center") as Align;
  const bioAlign = (bio?.alignment ?? "center") as Align;
  const showName = nameText || onEdit;
  const showBio = bioText || onEdit;
  if (!showName && !showBio) return null;
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
}: {
  settings: WebsiteSettings;
  onEdit?: (tab: HeroTab) => void;
  /** Skip painting the page background (the desktop "computer" frame paints it). */
  transparentBg?: boolean;
}) {
  const style = (settings.style ?? "style1") as HeroStyle;
  const tpl = HERO_TEMPLATES[style] ?? HERO_TEMPLATES.style1;
  const header = settings.header;
  const onCover = header?.position === "onCover";
  const filled = header?.fillSides === true;
  const headerHidden = header?.hide === true;
  const headerHeight = onCover && !filled ? HEADER_ON_HEIGHT : HEADER_ABOVE_HEIGHT;

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
    heroSection = (
      <div className="flex flex-col">
        {(!headerHidden || onEdit) && <Header settings={settings} tpl={tpl} overlay={false} onEdit={onEdit} />}
        {(!allHidden || onEdit) && (
          <div
            className="m-5 flex flex-col rounded-[20px] p-5 pb-2.5 shadow-[0_0_10px_rgba(0,0,0,0.1)]"
            style={{ backgroundColor: argbToCss(settings.card_style?.color) ?? "#fff" }}
          >
            {(coverVisible || onEdit) && (
              <div className="overflow-hidden rounded-2xl">
                <Cover settings={settings} onEdit={onEdit} />
              </div>
            )}
            {tpl.hasProfileImage && <ProfilePicture settings={settings} onEdit={onEdit} />}
            <div className="h-5" />
            <Content settings={settings} tpl={tpl} onEdit={onEdit} />
          </div>
        )}
      </div>
    );
  } else {
    // Stack — cover behind, header on top, content overlaid. For style1 the
    // profile picture straddles the BOTTOM of the cover (mobile getPicturePadding
    // pushes it down to overlap by half the avatar); name/bio then sit below.
    heroSection = (
      <>
        <div className="relative">
          {/* cover, offset by header height when the header is above it */}
          <div className="flex flex-col">
            {!onCover && !headerHidden && <div style={{ height: headerHeight }} />}
            <Cover settings={settings} onEdit={onEdit} />
          </div>

          {/* header (floating on cover, or in the offset space above it) */}
          <div className={`absolute inset-x-0 top-0 flex flex-col ${onEdit ? "pointer-events-none" : ""}`}>
            {onCover && !filled && <div className="h-2.5" />}
            {(!headerHidden || onEdit) && <Header settings={settings} tpl={tpl} overlay={onCover} onEdit={onEdit} />}
          </div>

          {/* title/text/buttons overlaid — hidden for limited covers (16:9, 1:1),
              unconditionally, matching the mobile editor (limitedContent gate at
              website_editor_layout.dart:1068 is not gated on preview/edit). */}
          {!limited && (
            <div className={`absolute inset-0 ${onEdit ? "pointer-events-none" : ""}`}>
              <Content settings={settings} tpl={tpl} onEdit={onEdit} />
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
      <div className="h-3" />
      <NameBio settings={settings} onEdit={onEdit} />
      <div className="h-5" />
    </div>
  );
}
