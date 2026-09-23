/**
 * The platforms a CUSTOM temporary-redirect destination may point at — a
 * client-side narrowing on top of the server's own rules, never a replacement
 * (mobile `domain/temp_redirect_domains.dart`). A host that passes here can
 * still come back as `INVALID_URL`.
 *
 * Adding a platform: one entry, the name a user recognises plus every
 * registrable domain it serves (no scheme, no `www.`, lower-case). Subdomains
 * match automatically. Never add a general-purpose shortener (goo.gl, g.co,
 * t.co, bit.ly): one short link can resolve anywhere, which would walk straight
 * through this list.
 */

export interface TempRedirectPlatform {
  name: string;
  domains: readonly string[];
}

export const TEMP_REDIRECT_PLATFORMS: readonly TempRedirectPlatform[] = [
  // ── Social networks ──
  { name: "Bluesky", domains: ["bsky.app"] },
  { name: "DeviantArt", domains: ["deviantart.com"] },
  { name: "Dribbble", domains: ["dribbble.com"] },
  { name: "Facebook", domains: ["facebook.com", "fb.com", "fb.me", "fb.watch"] },
  { name: "Flickr", domains: ["flickr.com", "flic.kr"] },
  { name: "Instagram", domains: ["instagram.com", "instagr.am", "ig.me"] },
  { name: "LinkedIn", domains: ["linkedin.com", "lnkd.in"] },
  { name: "Mastodon", domains: ["mastodon.social"] },
  { name: "Pinterest", domains: ["pinterest.com", "pin.it"] },
  { name: "Quora", domains: ["quora.com"] },
  { name: "Reddit", domains: ["reddit.com", "redd.it"] },
  { name: "Snapchat", domains: ["snapchat.com", "snap.com"] },
  { name: "Threads", domains: ["threads.net", "threads.com"] },
  { name: "TikTok", domains: ["tiktok.com"] },
  { name: "Tumblr", domains: ["tumblr.com"] },
  { name: "VK", domains: ["vk.com"] },
  { name: "Weibo", domains: ["weibo.com"] },
  { name: "X (Twitter)", domains: ["twitter.com", "x.com"] },

  // ── Messaging ──
  { name: "Discord", domains: ["discord.com", "discord.gg", "discordapp.com"] },
  { name: "KakaoTalk", domains: ["kakao.com"] },
  { name: "LINE", domains: ["line.me"] },
  { name: "Messenger", domains: ["messenger.com", "m.me"] },
  { name: "Signal", domains: ["signal.me", "signal.org"] },
  { name: "Skype", domains: ["skype.com"] },
  { name: "Slack", domains: ["slack.com"] },
  { name: "Telegram", domains: ["telegram.me", "telegram.org", "t.me"] },
  { name: "Viber", domains: ["viber.com"] },
  { name: "WeChat", domains: ["wechat.com", "weixin.qq.com"] },
  { name: "WhatsApp", domains: ["whatsapp.com", "wa.me", "wa.link"] },

  // ── Video, audio & creator platforms ──
  { name: "Apple Music & Podcasts", domains: ["apple.com", "apple.co"] },
  { name: "Bandcamp", domains: ["bandcamp.com"] },
  { name: "Behance", domains: ["behance.net"] },
  { name: "Dailymotion", domains: ["dailymotion.com", "dai.ly"] },
  { name: "GitHub", domains: ["github.com"] },
  { name: "Medium", domains: ["medium.com"] },
  { name: "Mixcloud", domains: ["mixcloud.com"] },
  { name: "SoundCloud", domains: ["soundcloud.com", "snd.sc"] },
  { name: "Spotify", domains: ["spotify.com", "spoti.fi"] },
  { name: "Substack", domains: ["substack.com"] },
  { name: "Twitch", domains: ["twitch.tv"] },
  { name: "Vimeo", domains: ["vimeo.com"] },
  { name: "YouTube", domains: ["youtube.com", "youtu.be"] },

  // ── Commerce & support ──
  { name: "Amazon", domains: ["amazon.com", "amzn.to"] },
  { name: "Buy Me a Coffee", domains: ["buymeacoffee.com"] },
  { name: "Etsy", domains: ["etsy.com"] },
  { name: "Gumroad", domains: ["gumroad.com"] },
  { name: "Ko-fi", domains: ["ko-fi.com"] },
  { name: "Patreon", domains: ["patreon.com"] },
  { name: "Shopify", domains: ["shopify.com", "myshopify.com"] },

  // ── Link-in-bio & publishing ──
  { name: "About.me", domains: ["about.me"] },
  { name: "Beacons", domains: ["beacons.ai"] },
  { name: "Bio.link", domains: ["bio.link"] },
  { name: "Carrd", domains: ["carrd.co"] },
  { name: "Linktree", domains: ["linktr.ee"] },
  { name: "Notion", domains: ["notion.so", "notion.site"] },
  { name: "Taplink", domains: ["taplink.cc"] },

  // ── Scheduling & meetings ──
  { name: "Cal.com", domains: ["cal.com"] },
  { name: "Calendly", domains: ["calendly.com"] },
  { name: "Eventbrite", domains: ["eventbrite.com"] },
  { name: "Meetup", domains: ["meetup.com"] },
  { name: "Microsoft Teams", domains: ["microsoft.com"] },
  { name: "Zoom", domains: ["zoom.us", "zoom.com"] },

  // ── Google surfaces (Maps, Meet, Forms, Drive) ──
  { name: "Google", domains: ["google.com"] },
];

/** Every accepted registrable domain, flattened so the matcher and the
 *  user-facing list can never disagree. */
export const TEMP_REDIRECT_ALLOWED_DOMAINS: ReadonlySet<string> = new Set(
  TEMP_REDIRECT_PLATFORMS.flatMap((platform) => platform.domains),
);

/**
 * Lower-cased, DNS root label dropped: `Acme.Qshot.com.` is `acme.qshot.com`
 * to every resolver. Shared by the loop guard and the allowlist so the two can
 * never disagree about whether two hosts are the same.
 */
export function canonicalTempRedirectHost(host: string): string {
  let value = host.toLowerCase();
  while (value.endsWith(".")) value = value.slice(0, -1);
  return value;
}

/** `== domain || endsWith(".domain")` — never a substring test, which keeps
 *  `youtube.com.evil.com`, `evilyoutube.com` and `youtube.company` out. */
export function isAllowedTempRedirectDomain(host: string): boolean {
  const value = canonicalTempRedirectHost(host);
  if (!value) return false;
  for (const domain of TEMP_REDIRECT_ALLOWED_DOMAINS) {
    if (value === domain || value.endsWith(`.${domain}`)) return true;
  }
  return false;
}
