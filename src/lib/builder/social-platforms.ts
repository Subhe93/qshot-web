/**
 * Social platforms, mirroring the mobile LinkConfiguration set. Each platform's
 * icon is a bundled brand SVG (public/brand-icons). The platform `name` is stored
 * as the link item's `type`; non-custom links derive their icon from the type,
 * while `dynamic` platforms (custom) allow an uploaded icon.
 */

import { cdnUrl } from "@/lib/api/qrcodes";
import { BRAND_ICON_SETS, brandIconUrl } from "./brand-icons";
import type { SocialLinkItem } from "@/lib/types/blocks";

const DARK_FILES = new Set(
  BRAND_ICON_SETS.find((s) => s.dir === "dark")?.files ?? [],
);

export type PlatformCategory = "popular" | "social" | "contact";

export interface SocialPlatform {
  name: string; // stored as item.type
  label: string;
  file: string; // svg in /brand-icons/{colored,dark}
  category: PlatformCategory;
  hint: string;
  dynamic?: boolean; // allows a custom uploaded icon
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  // Popular
  { name: "instagram", label: "Instagram", file: "instagram.svg", category: "popular", hint: "https://instagram.com/username" },
  { name: "facebook", label: "Facebook", file: "facebook.svg", category: "popular", hint: "https://facebook.com/yourpage" },
  { name: "whatsapp", label: "WhatsApp", file: "whatsapp.svg", category: "popular", hint: "https://wa.me/1234567890" },
  { name: "tiktok", label: "TikTok", file: "tiktok.svg", category: "popular", hint: "https://tiktok.com/@username" },
  { name: "youtube", label: "YouTube", file: "youtube.svg", category: "popular", hint: "https://youtube.com/@channel" },
  { name: "twitter", label: "X (Twitter)", file: "twitter.svg", category: "popular", hint: "https://x.com/username" },
  { name: "snapchat", label: "Snapchat", file: "snapchat.svg", category: "popular", hint: "https://snapchat.com/add/username" },
  { name: "telegram", label: "Telegram", file: "telegram.svg", category: "popular", hint: "https://t.me/username" },
  // Social
  { name: "linkedin", label: "LinkedIn", file: "linkedin.svg", category: "social", hint: "https://linkedin.com/in/username" },
  { name: "pinterest", label: "Pinterest", file: "pinterest.svg", category: "social", hint: "https://pinterest.com/username" },
  { name: "twitch", label: "Twitch", file: "twitch.svg", category: "social", hint: "https://twitch.tv/username" },
  { name: "vimeo", label: "Vimeo", file: "vimeo.svg", category: "social", hint: "https://vimeo.com/username" },
  { name: "behance", label: "Behance", file: "behance.svg", category: "social", hint: "https://behance.net/username" },
  { name: "dribbble", label: "Dribbble", file: "dribbble.svg", category: "social", hint: "https://dribbble.com/username" },
  { name: "github", label: "GitHub", file: "github.svg", category: "social", hint: "https://github.com/username" },
  { name: "discord", label: "Discord", file: "discord.svg", category: "social", hint: "https://discord.gg/invite" },
  { name: "medium", label: "Medium", file: "medium.svg", category: "social", hint: "https://medium.com/@username" },
  { name: "wechat", label: "WeChat", file: "wechat.svg", category: "social", hint: "wechat-id" },
  // Contact
  { name: "phone", label: "Phone", file: "fi-br-call.svg", category: "contact", hint: "+1234567890" },
  { name: "email", label: "Email", file: "email.svg", category: "contact", hint: "name@example.com" },
  { name: "website", label: "Website", file: "website.svg", category: "contact", hint: "https://example.com" },
  { name: "location", label: "Location", file: "location.svg", category: "contact", hint: "https://maps.google.com/?q=..." },
  { name: "link", label: "Link", file: "link.svg", category: "contact", hint: "https://example.com" },
  { name: "custom", label: "Custom link", file: "link.svg", category: "contact", hint: "https://example.com", dynamic: true },
];

const BY_NAME = new Map(SOCIAL_PLATFORMS.map((p) => [p.name, p]));

export function platformByName(name?: string): SocialPlatform | undefined {
  return name ? BY_NAME.get(name) : undefined;
}

export function isDynamicPlatform(name?: string): boolean {
  return !!platformByName(name)?.dynamic;
}

/** Resolve a social link's display icon URL: uploaded custom icon, else the
 *  platform's brand SVG (colored / dark variant). */
export function socialIconUrl(
  item: Pick<SocialLinkItem, "type" | "icon">,
  variant: "colored" | "dark" = "colored",
): string {
  if (item.icon) return cdnUrl(item.icon);
  const file = platformByName(item.type)?.file ?? "link.svg";
  // Some platforms have no dark variant — fall back to the colored icon.
  const dir = variant === "dark" && DARK_FILES.has(file) ? "dark" : "colored";
  return brandIconUrl(dir, file);
}
