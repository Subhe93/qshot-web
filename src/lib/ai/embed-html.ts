/**
 * Server-side preparation of AI-written "signature section" HTML for an
 * EmbedModule (configuration "custom").
 *
 * The model writes a self-contained `<style>` + markup snippet with CSS-only
 * animation. Before it is stored we make it SAFE and SELF-CONTAINED for the
 * three places it renders:
 *
 *   - Nuxt public site: `components/EmbedModule/index.vue` injects the html
 *     INLINE into the page document (v-html) — so every selector must be scoped
 *     to this block or it leaks into the whole site, and `@keyframes` names
 *     collide across blocks.
 *   - Mobile app: `SocialEmbed` renders it in a WebView with a `*{background:
 *     none}` reset and `#widget{display:flex;justify-content:center}` — the
 *     root must be `width:100%`.
 *   - Web builder preview: `EmbedBlockView` renders it in a sandboxed srcDoc
 *     iframe.
 *
 * What this does (in order):
 *   1. rejects anything that is not a plausible snippet (type/size);
 *   2. drops a full-document wrapper (`<!doctype>`, `<html>`, `<head>`, `<body>`);
 *   3. strips scripts, external resources, iframes/objects, forms, inline
 *      event handlers and `javascript:` URLs;
 *   4. rejects snippets that pull external resources (`@import`, `url(http…)`,
 *      external `<img src>`), because the block must never depend on a
 *      third-party host;
 *   5. rewrites every CSS selector under a unique wrapper class and renames
 *      every `@keyframes` so several blocks coexist in one document;
 *   6. wraps the markup in a fluid `<div class="qs-ai-embed qs-ai-embed-N">`
 *      with the page direction.
 *
 * Returns `null` when the snippet is unusable — the caller drops the block.
 * Dependency-free and alias-free on purpose (unit-testable with plain node).
 */

export interface EmbedPrepOptions {
  /** 1-based position among the site's embed blocks — makes the scope unique. */
  index: number;
  /** Page direction for the wrapper element. */
  dir: "ltr" | "rtl";
}

const MIN_LEN = 40;
const MAX_INPUT_LEN = 20_000;
const MAX_OUTPUT_LEN = 24_000;

const RAW_AT_RULES = new Set([
  "keyframes",
  "-webkit-keyframes",
  "-moz-keyframes",
  "font-face",
  "property",
  "page",
  "counter-style",
  "font-feature-values",
]);

/** Split a selector list on top-level commas (not inside parentheses). */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Prefix every selector with the scope; fold `:root`/`html`/`body` into it. */
function scopeSelectorList(list: string, scope: string): string {
  return splitSelectors(list)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sel) => {
      // `:root{--x}`, `html{}`, `body{}` → the wrapper itself.
      let s = sel.replace(/^(?::root|html|body)\b/i, scope);
      // `html body .x` / `body > .x` → wrapper .x
      s = s.replace(/^\.qs-ai-embed-\d+\s+(?:html|body)\b/i, scope);
      if (s.startsWith(scope)) return s;
      if (s === "*") return `${scope} *`;
      return `${scope} ${s}`;
    })
    .join(",");
}

/**
 * Scope a stylesheet under `scope`: every style-rule selector (also inside
 * @media/@supports/@container) becomes a descendant of the wrapper; the
 * contents of @keyframes/@font-face/@property are left untouched.
 */
export function scopeCss(input: string, scope: string): string {
  const css = input.replace(/\/\*[\s\S]*?\*\//g, "");
  // Each stack entry says whether preludes at that depth are selectors to scope.
  const stack: Array<"scope" | "raw"> = [];
  let out = "";
  let buf = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      const parentRaw = stack.length > 0 && stack[stack.length - 1] === "raw";
      if (prelude.startsWith("@")) {
        const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
        const raw = parentRaw || RAW_AT_RULES.has(name);
        stack.push(raw ? "raw" : "scope");
        out += `${prelude}{`;
      } else if (parentRaw) {
        // A keyframe step (`from`, `50%`) or a nested rule inside a scoped rule.
        stack.push("raw");
        out += `${prelude}{`;
      } else {
        stack.push("raw"); // declarations follow; nested rules stay as-is
        out += `${scopeSelectorList(prelude, scope)}{`;
      }
      continue;
    }
    if (ch === "}") {
      out += `${buf}}`;
      buf = "";
      stack.pop();
      continue;
    }
    if (ch === ";") {
      out += `${buf};`;
      buf = "";
      continue;
    }
    buf += ch;
  }
  return out + buf;
}

/** Rename every `@keyframes NAME` to `${prefix}NAME` (declaration uses too). */
export function prefixKeyframes(css: string, prefix: string): string {
  const names = new Set<string>();
  const re = /@(?:-webkit-|-moz-)?keyframes\s+([A-Za-z_][\w-]*)/g;
  let m: RegExpExecArray | null;
  // A name the model already prefixed (the prompt asks for "qsN-") is unique
  // enough — don't turn it into "qs1-qs1-float".
  while ((m = re.exec(css)) !== null) if (!m[1].startsWith(prefix)) names.add(m[1]);
  if (!names.size) return css;

  let out = css.replace(re, (all, name: string) =>
    names.has(name) ? all.replace(name, `${prefix}${name}`) : all,
  );
  // animation / animation-name declarations (also inside shorthand lists).
  out = out.replace(
    /((?:^|[;{\s])(?:-webkit-)?animation(?:-name)?\s*:)([^;}]*)/g,
    (_all, head: string, value: string) => {
      let v = value;
      for (const name of names) {
        v = v.replace(new RegExp(`(^|[\\s,])${name}(?=$|[\\s,])`, "g"), `$1${prefix}${name}`);
      }
      return head + v;
    },
  );
  return out;
}

const FORBIDDEN_PAIRS =
  /<(script|iframe|object|embed|form|textarea|select|template|noscript)[\s>][\s\S]*?<\/\1\s*>/gi;
const FORBIDDEN_SINGLE = /<(?:link|meta|base|input|frame|frameset|applet)\b[^>]*>/gi;
const EVENT_ATTR = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /(href|src|xlink:href|action)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi;

/**
 * Prepare one AI embed snippet. Returns the final html to store in
 * `EmbedModule.data.html` (and `.url`), or `null` when it must be dropped.
 */
export function prepareEmbedHtml(raw: unknown, opts: EmbedPrepOptions): string | null {
  if (typeof raw !== "string") return null;
  let html = raw.trim();
  if (html.length < MIN_LEN || html.length > MAX_INPUT_LEN) return null;

  // Pull every <style> out first (a full-document answer keeps them in <head>).
  const styles: string[] = [];
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_m, css: string) => {
    styles.push(css);
    return "";
  });

  // Drop document scaffolding, keep only body-level markup.
  html = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, "")
    .replace(/<\/?(?:html|body)\b[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Active content / external resources are never allowed.
  html = html.replace(FORBIDDEN_PAIRS, "").replace(FORBIDDEN_SINGLE, "");
  html = html.replace(EVENT_ATTR, "").replace(JS_URL, "$1=$2#$2");
  // A stray opening <script> without a closing tag would swallow the rest.
  if (/<script\b/i.test(html)) return null;

  let css = styles.join("\n");
  if (/@import\b/i.test(css) || /expression\s*\(/i.test(css)) return null;
  if (/url\(\s*["']?\s*(?:https?:)?\/\//i.test(css)) return null;
  if (/<(?:img|source|video|audio|track)\b[^>]*\bsrc\s*=\s*["']?\s*(?:https?:)?\/\//i.test(html)) {
    return null;
  }
  if (/\bsrcset\s*=/i.test(html)) return null;

  // Fixed positioning would pin the section to the visitor's viewport.
  css = css.replace(/position\s*:\s*fixed/gi, "position:absolute");

  const scope = `.qs-ai-embed-${opts.index}`;
  css = prefixKeyframes(scopeCss(css, scope), `qs${opts.index}-`);

  const body = html.trim();
  if (!body) return null;

  const wrapper =
    `<div class="qs-ai-embed qs-ai-embed-${opts.index}" dir="${opts.dir}" ` +
    `style="width:100%;max-width:100%;box-sizing:border-box;overflow:hidden;position:relative">`;
  const out = `<style>${css}</style>${wrapper}${body}</div>`;
  if (out.length > MAX_OUTPUT_LEN) return null;
  return out;
}
