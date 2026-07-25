"use client";

import { createContext, useContext } from "react";

/**
 * True when the block is rendered inside the desktop "computer view" pane
 * (BuilderCanvas `deviceWidth === "full"`), which mirrors the Nuxt public
 * desktop renderer. Views use this to swap in the Nuxt desktop typography;
 * when false every style must resolve to the exact phone-canvas value.
 */
export const DesktopPreviewContext = createContext(false);

export function useDesktopPreview(): boolean {
  return useContext(DesktopPreviewContext);
}

/**
 * The page's SOLID background color as an ARGB int — mobile
 * `SettingsEntity.getBackgroundColor()`: `background.solidColor` (null for a
 * gradient or an image) falling back to black. Blocks that derive a color from
 * the surface behind them (the adaptive social chip) read it here, mirroring
 * `context.editor.backgroundColor` in the Flutter editor.
 */
export const PageBackgroundContext = createContext(0xff000000);

export function usePageBackground(): number {
  return useContext(PageBackgroundContext);
}

/**
 * The shared Nuxt desktop block-title style — every assigned module title on
 * the public desktop site is `h3.text-2xl.w-full.module-title` inside the
 * module's own 20px gutter (components/home/Modules.vue): 24px, weight 400
 * (Tailwind preflight — no bold class), line-height `normal` (main.scss nukes
 * line-heights globally; mirrored by `.builder-preview-desktop`), no extra
 * horizontal padding.
 */
export const DESKTOP_BLOCK_TITLE = "w-full text-2xl font-normal";
