/**
 * The ONE localStorage layer — namespaced by account and profile so nothing
 * stored for one user or one site can ever bleed into another.
 *
 * ── Why ────────────────────────────────────────────────────────────────────
 * localStorage is a single flat map per origin. Several accounts log into the
 * same browser, and each account owns several profiles (sites); a bare key
 * like `qshot:recent-colors` is therefore shared by ALL of them — which is
 * exactly how account A's colors leaked into account B's picker. This module
 * makes the scope part of the key, so isolation is structural rather than a
 * per-feature discipline.
 *
 * ── Key schema ─────────────────────────────────────────────────────────────
 *   qshot.v1.device.<name>                             per BROWSER
 *   qshot.v1.acc.<accountId>.<name>                    per ACCOUNT
 *   qshot.v1.acc.<accountId>.site.<profileId>.<name>   per PROFILE (site)
 *
 * `v1` versions the whole schema: a future breaking change bumps it and
 * migrates (or abandons) old keys without colliding with them. The account id
 * is resolved AT CALL TIME from the auth store — callers never pass it, so a
 * login/logout/account-switch re-scopes every read and write automatically.
 * Before login the account scope is `anon`; anon data is deliberately NOT
 * migrated into the account on login (it may belong to someone else at a
 * shared machine).
 *
 * ── Rules for new entries (follow these, they are the point) ───────────────
 *  1. Never call window.localStorage directly — define an entry here-through.
 *  2. Pick the NARROWEST scope that fits: device for browser-wide flags
 *     (promo seen), account for user preferences (recent colors), profile for
 *     anything about ONE site (per-site drafts, per-site UI state).
 *  3. Always provide `validate` — localStorage is user-editable input, treat
 *     it like network data. Invalid/corrupt values fall back and are purged.
 *  4. Secrets stay OUT of this layer. The auth token lives in the zustand
 *     `persist` slot `qshot-auth` (a device-level singleton by design —
 *     renaming it would force-log-out every user).
 *
 * Every operation is SSR-safe and quota/private-mode-safe: reads fall back,
 * writes fail silently — a storage failure must never break a feature.
 */

import { useAuthStore } from "@/stores/auth-store";

const PREFIX = "qshot.v1.";

/** Account identity for scoping — the logged-in user, else `anon`. */
function accountId(): string {
  const user = useAuthStore.getState().user;
  return String(user?.id ?? user?._id ?? "anon");
}

/**
 * Path segments must not smuggle separators into the key (an id containing
 * `.` could alias another scope's key). Real ids are hex/uuid-safe; this
 * guards the schema against the weird ones.
 */
function seg(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // quota exceeded / private mode — storage is best-effort by contract
  }
}

function removeRaw(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

interface EntryOptions<T> {
  /** Last key segment. Stable forever — it IS the storage identity. */
  name: string;
  /** Returned when the key is missing or fails validation. */
  fallback: T;
  /** Shape check for what came off disk — treat it as untrusted input. */
  validate: (value: unknown) => value is T;
  /**
   * Pre-schema key to adopt: if the new key is empty and this one exists and
   * validates, its value is moved (copied then DELETED) on first read. Note
   * the scope change is deliberate lossiness: a legacy GLOBAL value is
   * adopted by whichever scope reads it first — acceptable for preferences,
   * which is all the legacy keys ever held.
   */
  legacyKey?: string;
}

export interface StorageEntry<T> {
  get: () => T;
  set: (value: T) => void;
  remove: () => void;
}

/** get/set bound to a resolved full key (scope already applied). */
function entryAt<T>(fullKey: () => string, opts: EntryOptions<T>): StorageEntry<T> {
  const { fallback, validate, legacyKey } = opts;

  function get(): T {
    const key = fullKey();
    const raw = readRaw(key);
    if (raw != null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (validate(parsed)) return parsed;
      } catch {
        // fall through to purge
      }
      removeRaw(key); // corrupt/foreign value — never serve it again
      return fallback;
    }
    if (legacyKey != null) {
      const legacy = readRaw(legacyKey);
      if (legacy != null) {
        removeRaw(legacyKey);
        try {
          const parsed: unknown = JSON.parse(legacy);
          if (validate(parsed)) {
            writeRaw(key, legacy);
            return parsed;
          }
        } catch {
          // invalid legacy value — dropped
        }
      }
    }
    return fallback;
  }

  return {
    get,
    set: (value: T) => writeRaw(fullKey(), JSON.stringify(value)),
    remove: () => removeRaw(fullKey()),
  };
}

/** Per-browser entry — flags about THIS device, not about any user. */
export function deviceEntry<T>(opts: EntryOptions<T>): StorageEntry<T> {
  return entryAt(() => `${PREFIX}device.${seg(opts.name)}`, opts);
}

/** Per-account entry — user preferences that follow the login, not the site. */
export function accountEntry<T>(opts: EntryOptions<T>): StorageEntry<T> {
  return entryAt(() => `${PREFIX}acc.${seg(accountId())}.${seg(opts.name)}`, opts);
}

export interface ProfileStorageEntry<T> {
  get: (profileId: string) => T;
  set: (profileId: string, value: T) => void;
  remove: (profileId: string) => void;
}

/**
 * Per-profile entry — state about ONE of the account's sites. Keyed under the
 * account as well, so two accounts that ever see the same profile id (admin
 * mode edits ANY profile) still never share a key.
 */
export function profileEntry<T>(opts: EntryOptions<T>): ProfileStorageEntry<T> {
  const keyFor = (profileId: string) =>
    `${PREFIX}acc.${seg(accountId())}.site.${seg(profileId)}.${seg(opts.name)}`;
  return {
    get: (profileId) => entryAt(() => keyFor(profileId), opts).get(),
    set: (profileId, value) => entryAt(() => keyFor(profileId), opts).set(value),
    remove: (profileId) => entryAt(() => keyFor(profileId), opts).remove(),
  };
}

/** Every stored key under a prefix — snapshot first: removing while iterating
 *  localStorage shifts its indices. */
function keysUnder(prefix: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key != null && key.startsWith(prefix)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

/**
 * Drop everything stored for one account (its profile entries included).
 * For account-deletion flows. NOT called on logout: scoping already prevents
 * conflicts, and preferences should survive a re-login like they do on mobile.
 */
export function clearAccountStorage(id: string = accountId()): void {
  for (const key of keysUnder(`${PREFIX}acc.${seg(id)}.`)) removeRaw(key);
}

/** Drop everything stored for one profile of the current account. */
export function clearProfileStorage(profileId: string): void {
  const prefix = `${PREFIX}acc.${seg(accountId())}.site.${seg(profileId)}.`;
  for (const key of keysUnder(prefix)) removeRaw(key);
}
