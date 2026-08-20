/**
 * YouTube / Vimeo public RSS feeds for the builder preview, parsed CLIENT-SIDE.
 *
 * Mobile fetches these XML endpoints directly with a bare Dio client
 * (`youtube_feed_data_source.dart` → `youtube.com/feeds/videos.xml?channel_id=…`,
 * `vimeo_feed_data_source.dart` → `vimeo.com/{id}/videos/rss`). A browser
 * can't — neither host sends CORS headers — so the fetch goes through our own
 * `/api/feed-proxy` route (strict two-URL allowlist, XML pass-through) and the
 * parsing happens here with `DOMParser`, mirroring the field choices of mobile
 * `youtube_feed_model.dart` / `vimeo_feed_model.dart`.
 *
 * Both providers normalize into the provider-agnostic `VideoFeed` shape —
 * mobile `video_feed.dart` (`VideoFeedItem { url, thumbnailUrl, title }`) —
 * which the TikTok proxy feed (`./tiktok`) shares, exactly like mobile.
 *
 * DOM APIs only — this module must be imported from client components.
 */

// ─── Models (mobile video_feed.dart) ────────────────────────────────────────

export interface VideoFeedItem {
  url: string;
  thumbnailUrl: string;
  title: string;
}

export interface VideoFeed {
  items: VideoFeedItem[];
}

// ─── Vimeo id extraction ────────────────────────────────────────────────────

/**
 * Mobile `VimeoFeedConfiguration.extractId` — regex
 * `^(?:https://vimeo\.com/)?(?<id>.+)$`: strip the optional canonical prefix,
 * keep everything else verbatim (mobile does NOT validate further; a bad value
 * simply 404s and surfaces as the feed's error state).
 */
export function extractVimeoId(value: string): string {
  const m = /^(?:https:\/\/vimeo\.com\/)?(.+)$/.exec(value);
  return m ? m[1] : "";
}

// ─── XML helpers ────────────────────────────────────────────────────────────

/**
 * Parse or throw. `DOMParser` never throws on bad XML — it yields a document
 * containing a `<parsererror>` element instead — so surface that as the same
 * kind of failure mobile's `XmlDocument.parse` throws.
 */
function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagNameNS("*", "parsererror").length > 0) {
    throw new Error("Malformed XML feed");
  }
  return doc;
}

/**
 * Direct children with the given LOCAL name. Matching on `localName` keeps the
 * namespace prefixes (`media:group`, `yt:videoId`) out of the picture — the
 * xml package's `getElement("media:group")` matches the qualified name, but
 * a re-prefixed (yet valid) feed would break that; localName matching accepts
 * both spellings.
 */
function childrenNamed(parent: Element, name: string): Element[] {
  return Array.from(parent.children).filter((el) => el.localName === name);
}

function childNamed(parent: Element, name: string): Element | null {
  return childrenNamed(parent, name)[0] ?? null;
}

function textOf(el: Element | null): string {
  return el?.textContent ?? "";
}

// ─── YouTube (Atom) — mobile youtube_feed_model.dart ────────────────────────

/**
 * Mobile `VideoModel.fromXml` per `<entry>`:
 *   link      ← `link` href (YouTube emits a single `rel="alternate"` link;
 *               prefer that rel explicitly, fall back to the first like mobile)
 *   title     ← `media:group` → `media:title`
 *   thumbnail ← `media:group` → `media:thumbnail` url
 * Items are NOT dropped on missing fields — mobile renders what it gets and
 * the card falls back per-field (`VideoCard` shows a glyph for no thumbnail).
 */
export function parseYoutubeFeed(xml: string): VideoFeed {
  const doc = parseXml(xml);
  if (doc.documentElement?.localName !== "feed") {
    // Mobile YoutubeFeedDataSource: FormatException("Malformed YouTube feed").
    throw new Error("Malformed YouTube feed");
  }
  const items = Array.from(doc.getElementsByTagNameNS("*", "entry")).map(
    (entry) => {
      const group = childNamed(entry, "group");
      const links = childrenNamed(entry, "link");
      const link =
        links.find((l) => (l.getAttribute("rel") ?? "alternate") === "alternate") ??
        links[0] ??
        null;
      return {
        url: link?.getAttribute("href") ?? "",
        thumbnailUrl:
          (group && childNamed(group, "thumbnail")?.getAttribute("url")) || "",
        title: group ? textOf(childNamed(group, "title")) : "",
      };
    },
  );
  return { items };
}

// ─── Vimeo (RSS 2.0) — mobile vimeo_feed_model.dart ─────────────────────────

/**
 * Mobile `VimeoVideoModel.fromXml` per `<item>`:
 *   link      ← `link` text
 *   title     ← `title` text
 *   thumbnail ← first `media:content` → `media:thumbnail` url
 * Plus two fallbacks mobile never needs (its feeds always carry
 * `media:thumbnail`) but RSS variants use: the `enclosure`/`media:content`
 * url attribute, then the first `<img src>` inside the HTML `description`.
 */
export function parseVimeoFeed(xml: string): VideoFeed {
  const doc = parseXml(xml);
  const channel = doc.getElementsByTagNameNS("*", "channel")[0];
  if (!channel) {
    // Mobile VimeoFeedDataSource: FormatException("Malformed Vimeo feed").
    throw new Error("Malformed Vimeo feed");
  }
  const items = Array.from(channel.getElementsByTagNameNS("*", "item")).map(
    (item) => ({
      url: textOf(childNamed(item, "link")).trim(),
      thumbnailUrl: vimeoThumbnail(item),
      title: textOf(childNamed(item, "title")).trim(),
    }),
  );
  return { items };
}

function vimeoThumbnail(item: Element): string {
  // `content` by localName matches `media:content` (RSS `content:encoded` has
  // localName "encoded", so it can't be confused here).
  const content = item.getElementsByTagNameNS("*", "content")[0] ?? null;
  const fromMedia = content
    ? childNamed(content, "thumbnail")?.getAttribute("url")
    : null;
  if (fromMedia) return fromMedia;
  const direct = content?.getAttribute("url") ?? childNamed(item, "enclosure")?.getAttribute("url");
  if (direct) return direct;
  const m = /<img[^>]+src="([^"]+)"/.exec(textOf(childNamed(item, "description")));
  return m ? m[1] : "";
}

// ─── Fetchers (via /api/feed-proxy) ─────────────────────────────────────────

async function fetchFeedXml(target: string): Promise<string> {
  const res = await fetch(`/api/feed-proxy?url=${encodeURIComponent(target)}`);
  if (!res.ok) throw new Error(`feed-proxy ${res.status}`);
  return res.text();
}

/** Mobile `YoutubeFeedDataSource.fetchByChannelId` (public Atom feed). */
export async function getYoutubeFeed(channelId: string): Promise<VideoFeed> {
  return parseYoutubeFeed(
    await fetchFeedXml(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
    ),
  );
}

/**
 * Mobile `VimeoFeedDataSource.fetchById` (public RSS feed). `vimeoId` is
 * interpolated verbatim, like mobile — a value that produces a path the proxy
 * allowlist rejects (extra slashes etc.) fails and renders the error state.
 */
export async function getVimeoFeed(vimeoId: string): Promise<VideoFeed> {
  return parseVimeoFeed(
    await fetchFeedXml(`https://vimeo.com/${vimeoId}/videos/rss`),
  );
}
