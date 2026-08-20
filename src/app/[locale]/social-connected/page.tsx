"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

/**
 * OAuth return landing for the social connect flows (Facebook / TikTok /
 * Instagram) — the WEB counterpart of the `qshot://social` deep link the
 * server callback redirects to for the mobile app.
 *
 * Today the callback ends at `qshot://…`, which a browser cannot open: on
 * desktop the popup shows a dead page (the builder recovers by re-listing on
 * refocus), and on phone browsers it surfaces as a scary "connection failed".
 * We asked the backend for an optional `return_url` param on the connect
 * endpoints; once it ships, the builder will send this page's URL and the
 * popup lands HERE instead.
 *
 * The backend's contract (2026-08-19): our `return_to` gets
 * `?status=connected&connection_id=…&platform=meta|tiktok|instagram&username=…`
 * appended by the callback. This page reads `platform` + `status` (the rest
 * rides along unused — the sheets re-list connections anyway), posts
 * `{ platform, status }` to the opener — `social-connect.ts`'s
 * `returnPlatform()` reads exactly that shape off a message payload — then
 * closes itself. The refocus + re-list path stays as the fallback for openers
 * we can't reach and for browsers that block window.close().
 *
 * Deliberately unauthenticated and translation-free: it can be opened by a
 * popup whose browser context has no session, and it lives for well under a
 * second when everything works.
 */
function SocialConnectedContent() {
  const params = useSearchParams();
  const platform = params.get("platform");
  // `connected` on success; anything else is a failed/aborted handshake — the
  // sheet's re-list simply won't show a new account, which is the right UX.
  const status = params.get("status");
  const connected = status == null || status === "connected";
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    try {
      // Same-app opener only — the payload is not secret (a platform name),
      // but there is no reason to broadcast it wider than our own origin.
      window.opener?.postMessage(
        { platform: platform ?? null, status: status ?? null },
        window.location.origin,
      );
    } catch {
      // Cross-origin opener or none — the refocus fallback covers it.
    }
    const t = setTimeout(() => {
      window.close();
      // Some browsers refuse to close script-opened-less windows; flip the
      // copy so the user knows closing the tab by hand is all that's left.
      setClosed(true);
    }, 400);
    return () => clearTimeout(t);
  }, [platform, status]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      {connected && <CheckCircle2 className="size-12 text-success" />}
      <h1 className="text-lg font-bold text-foreground">
        {connected ? "Account connected" : "Connection not completed"}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {closed
          ? "You can close this window and return to the editor."
          : "Finishing up…"}
      </p>
    </div>
  );
}

export default function SocialConnectedPage() {
  return (
    <Suspense fallback={null}>
      <SocialConnectedContent />
    </Suspense>
  );
}
