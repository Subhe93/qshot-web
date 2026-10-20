"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlatformLinksScreen, type DeepLinkClaim } from "@/components/platform-links/platform-links-screen";
import { normalizeDigits } from "@/lib/platform-redirect/model";

/**
 * `/platform-links` — the account's Platform links (contract: Platform
 * redirects). `?platform=google_reviews&code=43093` is the web form of the
 * "not activated" page's deep link (integration guide §7.6): it opens the
 * "Link a card" sheet pre-filled. Reachable with zero profiles.
 */
export default function PlatformLinksPage() {
  return (
    <Suspense fallback={null}>
      <PlatformLinksRoute />
    </Suspense>
  );
}

function PlatformLinksRoute() {
  const params = useSearchParams();
  const platform = params.get("platform")?.trim() ?? "";
  const code = normalizeDigits(params.get("code") ?? "").slice(0, 5);
  const deepLink: DeepLinkClaim | null = /^[a-z][a-z0-9_]*$/i.test(platform)
    ? { platform, code: code || null }
    : null;
  return <PlatformLinksScreen deepLink={deepLink} />;
}
