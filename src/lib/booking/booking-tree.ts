import { HTTPError } from "ky";
import { api } from "@/lib/api/client";

/**
 * Read-only view of the PUBLIC booking services tree, as drawn by the website
 * `BookingModule` — the web twin of the mobile
 * `domain/entities/booking/booking_public.dart` +
 * `domain/booking/booking_block_selection.dart` +
 * `widget/editor/booking/booking_block_format.dart`.
 *
 * One route feeds it — the existing, unauthenticated
 * `GET /booking/services/public/:profileId/tree`
 * (docs/booking-block-layouts.md §2). The docs disagree between routes on some
 * field names, so the parser accepts both spellings.
 */

// ─── Model ──────────────────────────────────────────────────────────────────

/** How a bookable service is paid (mobile `BookingPriceKind`). */
export type BookingPriceKind = "free" | "online" | "onSite";

/**
 * One node of the tree. A node with children (`hasChildren: true`) is a
 * CATEGORY: navigable, never bookable, no price or duration. A node without is
 * a LEAF — the only thing a customer can book.
 */
export interface BookingServiceNode {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  /** Parent category's name, filled while parsing so a leaf shown outside its
   *  category (`promo`) can still label it. */
  parentName: string | null;
  isCategory: boolean;
  duration: number | null;
  /** Major currency units — the unit the admin app writes `defaultPrice` in
   *  (contract §6.1, unconfirmed by the backend). */
  price: number | null;
  currency: string | null;
  paymentEnabled: boolean;
  onlinePaymentAvailable: boolean;
  /** Not returned by the API today; read so tiles pick it up if it ever ships. */
  image: string | null;
  order: number | null;
  children: BookingServiceNode[];
}

type Raw = Record<string, unknown>;

/** Unwraps the booking API's `{ "data": … }` envelope; public routes are
 *  documented both with and without it. */
export function unwrapBookingBody(body: unknown): unknown {
  return body != null && typeof body === "object" && !Array.isArray(body) && "data" in body
    ? (body as Raw).data
    : body;
}

function blankToNull(v: unknown): string | null {
  if (v == null) return null;
  const text = String(v).trim();
  return text ? text : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n == null ? null : Math.trunc(n);
}

function nodeFromJson(json: Raw, parentName: string | null): BookingServiceNode {
  const name = String(json.name ?? "");
  const children = parseBookingServiceTree(json.children, name);
  return {
    id: String(json._id ?? json.id ?? ""),
    name,
    description: blankToNull(json.description),
    parentId: json.parentId == null ? null : String(json.parentId),
    parentName,
    isCategory:
      typeof json.hasChildren === "boolean" ? json.hasChildren : children.length > 0,
    duration: int(json.duration),
    price: num(json.defaultPrice ?? json.basePrice ?? json.price),
    currency: blankToNull(json.currency),
    paymentEnabled: json.paymentEnabled === true,
    onlinePaymentAvailable: json.onlinePaymentAvailable === true,
    image: blankToNull(json.image),
    order: int(json.order),
    children,
  };
}

/**
 * Parses a tree level. Siblings keep the server's order unless they carry
 * `order`, in which case they are sorted by it (stable).
 */
export function parseBookingServiceTree(
  body: unknown,
  parentName: string | null = null,
): BookingServiceNode[] {
  const list = unwrapBookingBody(body);
  if (!Array.isArray(list)) return [];
  const nodes = list
    .filter((e): e is Raw => e != null && typeof e === "object")
    .map((e) => nodeFromJson(e, parentName));
  if (nodes.some((n) => n.order != null)) {
    const big = 1 << 30;
    return nodes
      .map((node, index) => ({ node, index }))
      .sort((a, b) => {
        const byOrder = (a.node.order ?? big) - (b.node.order ?? big);
        return byOrder !== 0 ? byOrder : a.index - b.index;
      })
      .map((e) => e.node);
  }
  return nodes;
}

// ─── Derived values ─────────────────────────────────────────────────────────

/** Leading bidi controls a name may start with (LRM/RLM, embeddings,
 *  overrides, isolates) — invisible, never a tile initial. */
const BIDI_CONTROLS = /^[\u200E\u200F\u202A-\u202E\u2066-\u2069]+/;

/**
 * The letter on a service tile: the name's first GRAPHEME (Dart
 * `name.trim().characters.first.toUpperCase()`), so a flag, a family emoji or
 * a combining-mark letter is never split. `Intl.Segmenter` when available,
 * code points as the fallback; empty for a blank name.
 */
export function initialOf(name: string): string {
  const text = name.trim().replace(BIDI_CONTROLS, "");
  if (!text) return "";
  let first: string;
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) {
    const it = new Segmenter(undefined, { granularity: "grapheme" }).segment(text)[Symbol.iterator]();
    first = it.next().value?.segment ?? "";
  } else {
    first = Array.from(text)[0] ?? "";
  }
  return first.toUpperCase();
}

export function isLeaf(node: BookingServiceNode): boolean {
  return !node.isCategory;
}

/** Bookable services in this subtree, depth-first, in display order. A leaf
 *  returns itself. */
export function leavesOf(node: BookingServiceNode): BookingServiceNode[] {
  if (isLeaf(node)) return [node];
  const out: BookingServiceNode[] = [];
  for (const child of node.children) out.push(...leavesOf(child));
  return out;
}

export function leafCount(node: BookingServiceNode): number {
  return leavesOf(node).length;
}

export function priceKind(leaf: BookingServiceNode): BookingPriceKind {
  if ((leaf.price ?? 0) === 0) return "free";
  if (leaf.onlinePaymentAvailable) return "online";
  return "onSite";
}

/**
 * Cheapest leaf price in the subtree — the "from $X" on a category — with its
 * currency. `null` when there is no priced leaf or the leaves mix currencies
 * (a minimum across currencies is meaningless).
 */
export function minPriceOf(
  category: BookingServiceNode,
): { amount: number; currency: string | null } | null {
  const priced = leavesOf(category).filter((l) => l.price != null);
  if (priced.length === 0) return null;
  const currencies = new Set(priced.map((l) => l.currency));
  if (currencies.size > 1) return null;
  const amount = Math.min(...priced.map((l) => l.price as number));
  return { amount, currency: priced[0].currency };
}

// ─── Selection (booking_block_selection.dart) ───────────────────────────────

function prune(node: BookingServiceNode): BookingServiceNode | null {
  if (isLeaf(node)) return node;
  const kept = node.children.map(prune).filter((n): n is BookingServiceNode => n != null);
  return kept.length === 0 ? null : { ...node, children: kept };
}

/**
 * What a booking block shows from the public services tree — the single
 * definition shared by every layout: the whole tree, in the server's order,
 * minus categories that have no bookable service underneath.
 */
export function selectBookingServices(tree: BookingServiceNode[]): BookingServiceNode[] {
  return tree.map(prune).filter((n): n is BookingServiceNode => n != null);
}

/** Every bookable service the selection keeps, depth-first — what the flat
 *  layouts (`promo`, the `swiper` "All" chip) show. */
export function selectedLeaves(selection: BookingServiceNode[]): BookingServiceNode[] {
  const out: BookingServiceNode[] = [];
  for (const node of selection) out.push(...leavesOf(node));
  return out;
}

// ─── Data source (booking_public_data_source.dart) ─────────────────────────

/**
 * The ONLY route the block reads (contract §2). No auth is needed; the shared
 * client's bearer token, when present, is harmless. A 404 means "no services",
 * not an error.
 */
export async function fetchBookingServicesTree(profileId: string): Promise<BookingServiceNode[]> {
  try {
    const body: unknown = await api.get(`booking/services/public/${profileId}/tree`).json();
    return parseBookingServiceTree(body);
  } catch (e) {
    if (e instanceof HTTPError && e.response.status === 404) return [];
    throw e;
  }
}

// ─── Formatting (booking_block_format.dart) ─────────────────────────────────

/** The `builder.bookingBlock.*` strings a layout needs, resolved by the caller
 *  (next-intl `useTranslations("builder.bookingBlock")`). */
export interface BookingFormatStrings {
  free: string;
  payOnSite: string;
  oneService: string;
  servicesCount: (count: number) => string;
  fromPrice: (price: string) => string;
  minutes: (m: number) => string;
  hours: (h: number) => string;
  hoursMinutes: (h: number, m: number) => string;
}

/** `45min`, `1h`, `1h 30min` (localised units). Empty for a missing or
 *  non-positive duration. */
export function formatDuration(minutes: number | null, s: BookingFormatStrings): string {
  if (minutes == null || minutes <= 0) return "";
  if (minutes < 60) return s.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? s.hours(hours) : s.hoursMinutes(hours, rest);
}

/** `USD 25` / `USD 25.50` — the "code amount" shape the booking dashboard uses;
 *  whole amounts drop the decimals. */
export function formatMoney(amount: number, currency: string | null): string {
  const value = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
  return currency == null ? value : `${currency} ${value}`;
}

/** A bookable service's price line: **Free**, or the price. Empty when there is
 *  no price. */
export function formatPrice(leaf: BookingServiceNode, s: BookingFormatStrings): string {
  if (priceKind(leaf) === "free") return s.free;
  return leaf.price == null ? "" : formatMoney(leaf.price, leaf.currency);
}

/** "Pay on site" for a leaf paid on arrival, otherwise `null`. */
export function onSiteHint(leaf: BookingServiceNode, s: BookingFormatStrings): string | null {
  return priceKind(leaf) === "onSite" ? s.payOnSite : null;
}

/** A category's "from $X", or `null` when the subtree has no single-currency
 *  price. */
export function formatFromPrice(
  category: BookingServiceNode,
  s: BookingFormatStrings,
): string | null {
  const min = minPriceOf(category);
  if (min == null) return null;
  if (min.amount === 0) return s.free;
  return s.fromPrice(formatMoney(min.amount, min.currency));
}

/** "1 service" / "N services". */
export function formatServiceCount(count: number, s: BookingFormatStrings): string {
  return count === 1 ? s.oneService : s.servicesCount(count);
}
