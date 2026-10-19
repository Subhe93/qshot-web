/**
 * Songs block (`MusicLinksModule`) — what a VISITOR sees, as a pure reader.
 *
 * Mirrors the Nuxt public renderer's `readMusicLinksBlock`
 * (utils/musicPlatforms.ts in the Nuxt repo) rule for rule, so the builder's
 * canvas preview shows exactly what the published page shows
 * (docs/api-contract.en.md §8):
 *  - tracks with `hidden: true` are skipped;
 *  - links with `hidden: true`, a platform outside the registry, or a URL that
 *    is not https are skipped; the owner's order is kept;
 *  - `cover_url` / `preview_url` are used only when https;
 *  - a track left with no button is kept only when it has a preview clip;
 *  - `show_cover` true unless exactly `false`; `button_style` iconText unless
 *    exactly "icon"; an unknown `layout_type` reads as `cards`.
 *
 * Never touches the block data: the editor and the save path keep every link
 * (unknown platforms included) untouched.
 */
import { isKnownMusicPlatform } from "./platforms";

export type MusicRenderLayout = "list" | "grid" | "cards";

export interface MusicRenderLink {
  id: string;
  platform: string;
  url: string;
}

export interface MusicRenderTrack {
  /** Unique within the block (position-suffixed when the id is missing or repeated). */
  key: string;
  title: string;
  artist: string;
  cover: string | null;
  preview: string | null;
  links: MusicRenderLink[];
}

export interface MusicRenderBlock {
  layout: MusicRenderLayout;
  showCover: boolean;
  buttonStyle: "icon" | "iconText";
  tracks: MusicRenderTrack[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** https only — `javascript:`, `data:`, `http:` and unparsable values → null. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

const LAYOUTS: ReadonlySet<string> = new Set(["list", "grid", "cards"]);

export function readMusicRenderBlock(block: unknown): MusicRenderBlock {
  const m = isObj(block) ? block : {};
  const layout = (
    typeof m.layout_type === "string" && LAYOUTS.has(m.layout_type) ? m.layout_type : "cards"
  ) as MusicRenderLayout;
  const tracks: MusicRenderTrack[] = [];
  const seen = new Set<string>();
  (Array.isArray(m.tracks) ? m.tracks : []).forEach((raw: unknown, index: number) => {
    if (!isObj(raw) || raw.hidden === true) return;
    const links: MusicRenderLink[] = [];
    const linkKeys = new Set<string>();
    (Array.isArray(raw.links) ? raw.links : []).forEach((link: unknown, i: number) => {
      if (!isObj(link) || link.hidden === true) return;
      const url = safeHttpsUrl(link.url);
      if (!isKnownMusicPlatform(link.platform) || !url) return;
      let id = typeof link.id === "string" && link.id ? link.id : `#${i}`;
      if (linkKeys.has(id)) id = `${id}#${i}`;
      linkKeys.add(id);
      links.push({ id, platform: link.platform, url });
    });
    const preview = safeHttpsUrl(raw.preview_url);
    if (links.length === 0 && !preview) return;
    let key = typeof raw.id === "string" && raw.id ? raw.id : `#${index}`;
    if (seen.has(key)) key = `${key}#${index}`;
    seen.add(key);
    tracks.push({
      key,
      title: typeof raw.title === "string" ? raw.title.trim() : "",
      artist: typeof raw.artist === "string" ? raw.artist.trim() : "",
      cover: safeHttpsUrl(raw.cover_url),
      preview,
      links,
    });
  });
  return {
    layout,
    showCover: m.show_cover !== false,
    buttonStyle: m.button_style === "icon" ? "icon" : "iconText",
    tracks,
  };
}
