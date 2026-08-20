/**
 * Same-origin proxy for the two PUBLIC social RSS feeds the builder preview
 * renders client-side. Mobile fetches these XML endpoints directly
 * (`youtube_feed_data_source.dart`, `vimeo_feed_data_source.dart`); neither
 * host sends CORS headers, so the browser has to go through our origin.
 *
 * STRICTLY allowlisted by parsed URL — not string matching — to exactly the
 * two shapes mobile requests, so this can't be used as an open proxy / SSRF:
 *
 *   https://www.youtube.com/feeds/videos.xml?channel_id=…   (Atom)
 *   https://vimeo.com/{segment}/videos/rss                  (RSS 2.0)
 *
 * Everything else answers 400. The XML is passed through as text with a short
 * shared cache — aligned with the client's 10-minute feed TTL (mobile
 * `FeedRepositoryImpl._ttl`), so repeated editor loads don't hammer the hosts.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";

function isAllowedFeedUrl(u: URL): boolean {
  if (u.protocol !== "https:") return false;
  // Credentials in the URL are never legitimate for these feeds.
  if (u.username || u.password) return false;
  if (u.hostname === "www.youtube.com") {
    return u.pathname === "/feeds/videos.xml";
  }
  if (u.hostname === "vimeo.com") {
    // Exactly one path segment before /videos/rss (a user/channel id).
    return /^\/[^/]+\/videos\/rss$/.test(u.pathname);
  }
  return false;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (!isAllowedFeedUrl(target)) {
    return new Response("url not allowed", { status: 400 });
  }

  const upstream = await fetch(target.toString(), {
    cache: "no-store",
    headers: {
      accept:
        "application/atom+xml, application/rss+xml, application/xml, text/xml",
    },
  });
  if (!upstream.ok) {
    return new Response("upstream error", { status: 502 });
  }

  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=600, stale-while-revalidate=300",
    },
  });
}
