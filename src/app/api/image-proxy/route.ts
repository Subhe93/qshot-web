/**
 * Same-origin image proxy. The CDN (cdn.qshot.com) serves assets WITHOUT CORS
 * headers, so loading a stored image into a <canvas> taints it and `toBlob()`
 * throws a SecurityError. Streaming the bytes back through our own origin lets
 * the cropper export the result (used when re-cropping an existing cover image
 * to a new aspect ratio). Host-allowlisted to avoid an open proxy / SSRF.
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set(["cdn.qshot.com"]);

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return new Response("forbidden host", { status: 403 });
  }

  const upstream = await fetch(target.toString(), { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error", { status: 502 });
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/octet-stream";
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
    },
  });
}
