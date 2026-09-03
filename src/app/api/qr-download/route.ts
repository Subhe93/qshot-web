import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin download proxy for stored QR images (agent issue #7): the CDN
 * serves them without CORS or Content-Disposition, so a client-side
 * fetch→blob fails and a bare link opens the image in a tab instead of
 * downloading. This route streams the file back with an attachment header.
 *
 * Locked to the QR storage prefixes on our own CDNs — it must never become an
 * open proxy.
 */
const ALLOWED_HOSTS = new Set(["cdn.qshot.com", "cdn.speaknet.app"]);
const ALLOWED_PREFIXES = ["/user-qrcodes/", "/png-logos/"];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  const name = (req.nextUrl.searchParams.get("name") ?? "qr").replace(
    /[^\w.\- ]+/g,
    "_",
  );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 });
  }
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(url.hostname) ||
    !ALLOWED_PREFIXES.some((p) => url.pathname.startsWith(p))
  ) {
    return NextResponse.json({ error: "url not allowed" }, { status: 400 });
  }

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "application/octet-stream";
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
