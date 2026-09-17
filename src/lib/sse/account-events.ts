import { API_BASE } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * The live plan channel — `GET /account/events` over SSE
 * (docs/PLAN-ACTIVATION-WEB.md is the binding contract).
 *
 * Hand-rolled on fetch + ReadableStream because the native EventSource cannot
 * send the Authorization header this backend requires (no cookies cross-origin),
 * and because the backend's error filter wraps auth failures as 400 with the
 * real 401 inside the BODY — telling those apart needs full response control.
 *
 * The governing rule: events carry no entitlement. The only thing a consumer
 * ever does with them is re-read `GET /account`.
 */

export type ChannelStatus =
  | "connecting" // opening, or between reconnect attempts
  | "connected" // stream open — live events flowing
  | "unavailable" // 503/404/non-stream: channel off — poll instead
  | "stopped"; // aborted, or auth failure — no more attempts

/** `plan.changed` payload — all values strings; display-only until refetch. */
export interface PlanChangedEvent {
  type?: string;
  activationId?: string;
  planId?: string;
  planName?: string;
  reason?: string;
  expiresAt?: string;
}

export interface AccountEventsOptions {
  /** `ready` — on every (re)connect. Always re-read the account, silently. */
  onReady: () => void;
  /** `plan.changed` — de-duplicate, refetch, then message. */
  onPlanChanged: (event: PlanChangedEvent) => void;
  onStatus: (status: ChannelStatus) => void;
  /** 400 whose body carries statusCode 401 — stop for good, go to sign-in. */
  onAuthError: () => void;
  signal: AbortSignal;
}

// ── Tuning (contract §3.1 + §2) ─────────────────────────────────────────────
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** Heartbeat is every 25s — silence past this means a dead proxy connection. */
const SILENCE_TIMEOUT_MS = 60_000;
/** Channel answered 503/404 (off / over-limit / not deployed): retry slowly. */
const UNAVAILABLE_RETRY_MS = 5 * 60_000;

function jittered(base: number): number {
  return Math.round(base * (0.7 + Math.random() * 0.6));
}

/** Exponential backoff with jitter, CLAMPED to the contract's 1s–30s band
 *  (§3.1) — jitter spreads downward from the step, never past the cap. */
function backoffDelay(attempt: number): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt);
  const withJitter = base / 2 + Math.random() * (base / 2);
  return Math.max(BACKOFF_MIN_MS, Math.min(BACKOFF_MAX_MS, Math.round(withJitter)));
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const id = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(id);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

/** The backend hides 401 inside a 400 body: `error.description.statusCode`. */
async function isWrapped401(res: Response): Promise<boolean> {
  try {
    const body = (await res.json()) as {
      error?: { description?: { statusCode?: number | string } };
    };
    return Number(body?.error?.description?.statusCode) === 401;
  } catch {
    return false;
  }
}

interface SseMessage {
  event: string;
  data: string;
  id: string;
}

/**
 * Open the channel and keep it open until `signal` aborts: reconnects with
 * exponential backoff + jitter (1s→30s), falls back to slow retries while the
 * server says the channel is unavailable, and stops permanently on an auth
 * failure. Pure DOM/fetch — no React — so it is testable against any mock.
 */
export function openAccountEvents(opts: AccountEventsOptions): void {
  runLoop(opts).catch(() => {
    // A consumer callback that throws must surface as a closed channel, never
    // as an unhandled rejection.
  });
}

async function runLoop(rawOpts: AccountEventsOptions): Promise<void> {
  const { signal } = rawOpts;
  // A dead loop (aborted by sign-out, a token change, or StrictMode's first
  // mount) must never speak again: a late status write would clobber the live
  // loop's, and a wrapped-401 parsed after abort would log out the NEW session.
  const opts: AccountEventsOptions = {
    signal,
    onReady: () => !signal.aborted && rawOpts.onReady(),
    onPlanChanged: (e) => void (!signal.aborted && rawOpts.onPlanChanged(e)),
    onStatus: (s) => !signal.aborted && rawOpts.onStatus(s),
    onAuthError: () => !signal.aborted && rawOpts.onAuthError(),
  };
  let attempt = 0;

  while (!signal.aborted) {
    const token = useAuthStore.getState().token;
    if (!token) {
      opts.onStatus("stopped");
      return;
    }

    opts.onStatus("connecting");
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/account/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        cache: "no-store",
        signal,
      });
    } catch {
      if (signal.aborted) break;
      await sleep(backoffDelay(attempt), signal);
      attempt++;
      continue;
    }

    if (signal.aborted) break;

    // 400 wrapping a 401 → invalid session: stop for good (§3.1).
    if (res.status === 400 && (await isWrapped401(res))) {
      opts.onStatus("stopped");
      opts.onAuthError();
      return;
    }

    const isStream = (res.headers.get("content-type") ?? "").includes(
      "text/event-stream",
    );
    // 503 = disabled/over-limit (contract). 404 or a non-stream 200 = the
    // route isn't deployed on this API host yet — same treatment: behave as
    // if the feature does not exist and let polling carry the updates.
    if (res.status === 503 || res.status === 404 || (res.ok && !isStream)) {
      res.body?.cancel().catch(() => {});
      opts.onStatus("unavailable");
      await sleep(jittered(UNAVAILABLE_RETRY_MS), signal);
      attempt = 0;
      continue;
    }

    if (!res.ok || !res.body) {
      // transient server error — back off and retry
      res.body?.cancel().catch(() => {});
      await sleep(backoffDelay(attempt), signal);
      attempt++;
      continue;
    }

    opts.onStatus("connected");
    const openedAt = Date.now();

    try {
      await readStream(res.body, opts, signal);
    } catch {
      // dropped / silence timeout — fall through to reconnect
    }
    if (signal.aborted) break;

    // Only a connection that PROVED durable resets the backoff. A server that
    // accepts the stream then drops it immediately (rolling deploy, sick LB)
    // must keep escalating — resetting on mere connection success reconnects
    // at ~1/s forever, straight through the 30 req/min IP limit §3.1 promises
    // backed-off clients never hit.
    if (Date.now() - openedAt > 30_000) attempt = 0;
    else attempt++;

    opts.onStatus("connecting");
    await sleep(backoffDelay(attempt), signal);
  }

  opts.onStatus("stopped");
}

/**
 * Parse the open stream and dispatch events. Resolves/throws when the stream
 * ends, errors, or stays silent past SILENCE_TIMEOUT_MS (the 25s heartbeat
 * makes prolonged silence a reliable dead-connection signal).
 */
async function readStream(
  body: ReadableStream<Uint8Array>,
  opts: AccountEventsOptions,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let message: SseMessage = { event: "", data: "", id: "" };

  const abort = () => reader.cancel().catch(() => {});
  signal.addEventListener("abort", abort, { once: true });

  try {
    for (;;) {
      let silenceTimer: ReturnType<typeof setTimeout> | undefined;
      const silence = new Promise<never>((_, reject) => {
        silenceTimer = setTimeout(() => {
          reader.cancel().catch(() => {});
          reject(new Error("sse silence timeout"));
        }, SILENCE_TIMEOUT_MS);
      });
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await Promise.race([reader.read(), silence]);
      } finally {
        clearTimeout(silenceTimer);
      }
      if (chunk.done) return;

      buffer += decoder.decode(chunk.value, { stream: true });

      // Process complete lines; keep the trailing partial in the buffer.
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);

        if (line === "") {
          try {
            dispatch(message, opts);
          } catch {
            // A throwing consumer must not be mistaken for a dead stream.
          }
          message = { event: "", data: "", id: "" };
          continue;
        }
        if (line.startsWith(":")) continue; // comment / keep-alive
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? "" : line.slice(colon + 1);
        if (value.startsWith(" ")) value = value.slice(1);
        if (field === "event") message.event = value;
        else if (field === "data")
          message.data = message.data ? `${message.data}\n${value}` : value;
        else if (field === "id") message.id = value;
      }
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.cancel().catch(() => {});
  }
}

function dispatch(message: SseMessage, opts: AccountEventsOptions): void {
  switch (message.event) {
    case "ready":
      opts.onReady();
      return;
    case "plan.changed": {
      let payload: PlanChangedEvent = {};
      try {
        payload = JSON.parse(message.data) as PlanChangedEvent;
      } catch {
        // Malformed data: the signal still means "re-read" — synthesize the
        // idempotency key from the id: line the contract mirrors into it.
        payload = { activationId: message.id || undefined };
      }
      if (!payload.activationId && message.id) payload.activationId = message.id;
      opts.onPlanChanged(payload);
      return;
    }
    default:
      // ping (and anything unknown): heartbeat only — nothing to do.
      return;
  }
}
