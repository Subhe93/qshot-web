/**
 * Parity self-check for src/lib/links/deep-links.ts against the mobile
 * (Flutter) implementation — the serialization source of truth.
 *
 * Ports EVERY case from the mobile test file
 * `test/smart_links/deep_link_builder_test.dart`, plus the divergence cases
 * from docs/web-app-study/sync-2026-07-19/SPEC-smartlinks-parity.md (M1–M5).
 *
 * Run: npx tsx scripts/check-deeplinks-parity.ts
 * Exits 1 on any failure.
 */

import {
  buildDeepLinks,
  detectPlatform,
  normalizeUrl,
} from "../src/lib/links/deep-links";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    passed++;
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  console.error(`  expected: ${JSON.stringify(expected)}`);
  console.error(`  actual  : ${JSON.stringify(actual)}`);
}

function checkContains(name: string, actual: string, needle: string): void {
  check(`${name} (contains ${JSON.stringify(needle)})`, actual.includes(needle), true);
}

// ── detectPlatform: hosts (mobile test lines 5-17) ──────────────────────────
check("detect youtu.be", detectPlatform("https://youtu.be/abc"), "youtube");
check("detect m.youtube.com", detectPlatform("https://m.youtube.com/watch?v=x"), "youtube");
check("detect open.spotify.com", detectPlatform("https://open.spotify.com/track/x"), "spotify");
check("detect vm.tiktok.com", detectPlatform("https://vm.tiktok.com/x"), "tiktok");
check("detect player.vimeo.com", detectPlatform("https://player.vimeo.com/video/1"), "vimeo");
check("detect instagram.com", detectPlatform("https://instagram.com/natgeo"), "instagram");
check("detect fb.watch", detectPlatform("https://fb.watch/x"), "facebook");
check("detect x.com", detectPlatform("https://x.com/jack"), "twitter");
check("detect example.com", detectPlatform("https://example.com"), "custom");

// ── YouTube (mobile test lines 19-45) ───────────────────────────────────────
{
  const r = buildDeepLinks("youtube", "https://youtu.be/dQw4w9WgXcQ");
  check("yt youtu.be iOS", r.iOS, "youtube://watch?v=dQw4w9WgXcQ");
  check("yt youtu.be Fallback", r.Fallback, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  check(
    "yt youtu.be Android",
    r.Android,
    "intent://www.youtube.com/watch?v=dQw4w9WgXcQ#Intent;package=com.google.android.youtube;scheme=https;end",
  );
}
check(
  "yt watch?v=",
  buildDeepLinks("youtube", "https://www.youtube.com/watch?v=abc").iOS,
  "youtube://watch?v=abc",
);
check(
  "yt shorts",
  buildDeepLinks("youtube", "https://youtube.com/shorts/xy_z").iOS,
  "youtube://watch?v=xy_z",
);
{
  const r = buildDeepLinks("youtube", "https://youtube.com/@natgeo");
  check("yt channel all-equal", r.iOS, r.Fallback);
  check("yt channel keeps url", r.iOS, "https://youtube.com/@natgeo");
}

// ── Spotify (mobile test lines 47-55) ───────────────────────────────────────
{
  const r = buildDeepLinks("spotify", "https://open.spotify.com/intl-de/track/ID123");
  check("spotify locale iOS", r.iOS, "spotify:track:ID123");
  check("spotify locale Fallback", r.Fallback, "https://open.spotify.com/track/ID123");
  checkContains("spotify locale Android", r.Android, "com.spotify.music");
}

// ── Vimeo (mobile test lines 57-70) ─────────────────────────────────────────
{
  const r = buildDeepLinks("vimeo", "https://vimeo.com/123456789");
  check("vimeo numeric iOS", r.iOS, "vimeo://videos/123456789");
  check("vimeo numeric Fallback", r.Fallback, "https://vimeo.com/123456789");
}
{
  const r = buildDeepLinks("vimeo", "https://vimeo.com/channels/staffpicks");
  check("vimeo channel all-equal", r.iOS, r.Fallback);
}

// ── TikTok (mobile test lines 72-77) ────────────────────────────────────────
{
  const r = buildDeepLinks("tiktok", "https://www.tiktok.com/@u/video/1");
  check("tiktok universal", r.iOS, r.Fallback);
  checkContains("tiktok Android pkg", r.Android, "com.zhiliaoapp.musically");
  check(
    "tiktok Android no browser_fallback_url",
    r.Android.includes("browser_fallback_url"),
    false,
  );
}

// ── Instagram (mobile test lines 79-88) ─────────────────────────────────────
check(
  "ig profile",
  buildDeepLinks("instagram", "https://instagram.com/natgeo").iOS,
  "instagram://user?username=natgeo",
);
{
  const r = buildDeepLinks("instagram", "https://instagram.com/p/ABC/");
  check("ig post universal", r.iOS, r.Fallback);
}

// ── Facebook (mobile test lines 90-94) ──────────────────────────────────────
{
  const r = buildDeepLinks("facebook", "https://facebook.com/some/page");
  check("fb facewebmodal", r.iOS.startsWith("fb://facewebmodal/f?href="), true);
  checkContains("fb Android pkg", r.Android, "com.facebook.katana");
}

// ── Twitter / X (mobile test lines 96-111) ──────────────────────────────────
{
  const r = buildDeepLinks("twitter", "https://twitter.com/jack/status/20");
  check("tw status iOS", r.iOS, "twitter://status?id=20");
  check("tw status Fallback", r.Fallback, "https://x.com/jack/status/20");
  checkContains("tw status Android", r.Android, "x.com/jack/status/20");
}
check(
  "tw profile",
  buildDeepLinks("twitter", "https://x.com/jack").iOS,
  "twitter://user?screen_name=jack",
);
{
  const r = buildDeepLinks("twitter", "https://x.com/home");
  check("tw reserved fallback", r.iOS, r.Fallback);
}

// ── custom / unparseable (mobile test lines 113-134) ────────────────────────
{
  const r = buildDeepLinks("custom", "https://example.com/x");
  check("custom passthrough iOS", r.iOS, "https://example.com/x");
  check("custom passthrough Android", r.Android, "https://example.com/x");
}
check(
  "bare host normalised",
  buildDeepLinks("youtube", "youtu.be/abc").iOS,
  "youtube://watch?v=abc",
);
{
  const r = buildDeepLinks("youtube", "not a url");
  check("garbage all-equal iOS", r.iOS, r.Fallback);
  check("garbage all-equal Android", r.Android, r.Fallback);
}
{
  const r = buildDeepLinks("youtube", "   ");
  check("empty type custom", r.type, "custom");
  check("empty all-equal", r.iOS, r.Fallback);
}

// ── M1: normalizeUrl keeps an empty path empty (Dart Uri.toString parity) ───
check("M1 bare host", normalizeUrl("example.com"), "https://example.com");
check("M1 bare host + query", normalizeUrl("https://example.com?a=1"), "https://example.com?a=1");
check("M1 bare host + fragment", normalizeUrl("https://example.com#frag"), "https://example.com#frag");
check("M1 explicit slash kept", normalizeUrl("https://example.com/"), "https://example.com/");
check("M1 path untouched", normalizeUrl("https://example.com/x"), "https://example.com/x");
check(
  "M1 custom bare host all fields",
  buildDeepLinks("custom", "example.com").Fallback,
  "https://example.com",
);
check(
  "M1 facebook bare host href",
  buildDeepLinks("facebook", "facebook.com").iOS,
  "fb://facewebmodal/f?href=https%3A%2F%2Ffacebook.com",
);

// ── M2: Spotify case-sensitivity + id charset ───────────────────────────────
{
  const r = buildDeepLinks("spotify", "https://open.spotify.com/TRACK/ID123");
  check("M2 uppercase kind no match", r.iOS, r.Fallback);
  check("M2 uppercase kind type", r.type, "spotify");
}
check(
  "M2 id keeps dash",
  buildDeepLinks("spotify", "https://open.spotify.com/track/ID-x").iOS,
  "spotify:track:ID-x",
);

// ── M3: YouTube case-sensitivity + duplicate ?v= takes LAST ─────────────────
{
  const r = buildDeepLinks("youtube", "https://youtube.com/SHORTS/x");
  check("M3 uppercase path no match", r.iOS, r.Fallback);
}
check(
  "M3 duplicate v last wins",
  buildDeepLinks("youtube", "https://www.youtube.com/watch?v=a&v=b").iOS,
  "youtube://watch?v=b",
);

// ── M4: Twitter substring status/(\d+) semantics ────────────────────────────
check(
  "M4 digit prefix",
  buildDeepLinks("twitter", "https://x.com/jack/status/20abc").iOS,
  "twitter://status?id=20",
);
check(
  "M4 Status case-sensitive",
  buildDeepLinks("twitter", "https://x.com/jack/Status/20").iOS,
  "twitter://user?screen_name=jack",
);
check(
  "M4 substring mystatus",
  buildDeepLinks("twitter", "https://x.com/mystatus/20").iOS,
  "twitter://status?id=20",
);
check(
  "M4 bare trailing ? kept",
  buildDeepLinks("twitter", "https://x.com/jack?").Fallback,
  "https://x.com/jack?",
);

// ── M5: hostPathQuery drops the port (Dart Uri.host parity) ─────────────────
{
  const r = buildDeepLinks("tiktok", "https://tiktok.com:8080/x?a=1");
  check(
    "M5 port stripped from intent",
    r.Android,
    "intent://tiktok.com/x?a=1#Intent;package=com.zhiliaoapp.musically;scheme=https;end",
  );
  check("M5 port kept in Fallback", r.Fallback, "https://tiktok.com:8080/x?a=1");
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
