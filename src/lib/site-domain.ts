/**
 * The domain published sites live on — the single source of truth for every
 * user-facing site URL in the builder and dashboard.
 *
 * Configure with `NEXT_PUBLIC_SITE_DOMAIN`; defaults to production `qshot.com`,
 * so nothing changes for anyone who doesn't set it. Point it at a test domain
 * (`speaknet.app`) to preview the whole app against a staging deployment.
 *
 * ⚠️ Next.js inlines `process.env.NEXT_PUBLIC_*` at BUILD time, and only when
 * the full literal appears in the source — a computed lookup is not replaced.
 * That also means flipping the value needs a rebuild (delete `.next` if a stale
 * value survives).
 *
 * This is the DISPLAY/link domain only. It is unrelated to `NEXT_PUBLIC_API_BASE`
 * (where the API lives) — the two moved independently in the past, which is
 * exactly why they are separate knobs.
 */
export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "qshot.com";

/** `myslug.qshot.com` — bare host, no scheme. For display. */
export function siteHost(slug: string): string {
  return `${slug}.${SITE_DOMAIN}`;
}

/** `https://myslug.qshot.com` — the link target. */
export function siteUrl(slug: string): string {
  return `https://${siteHost(slug)}`;
}

/**
 * Host of the separate provider portal app (`provider-portal/`), shown to site
 * owners so they can pass it to their staff. It is deployed as a subdomain of
 * the same site domain, so it moves with it rather than needing its own knob.
 */
export const PROVIDER_PORTAL_HOST = `provider.${SITE_DOMAIN}`;
