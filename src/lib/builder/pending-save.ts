/**
 * The builder's last save, when it is still in flight after the editor
 * unmounted (contract docs/profile-history-api-contract.md §7.1).
 *
 * Leaving the builder with an unsaved edit flushes a final save from the
 * unmount cleanup (BuilderShell). The screen the user lands on next may start
 * a restore straight away — History is one tap from the settings panel — and a
 * restore that overtakes that save would be overwritten by it a moment later.
 * So the flush is tracked here and `awaitPendingSave()` is called before every
 * restore route. A flush that did not save (refused by the pre-save checks,
 * rejected by the server, offline) is remembered so the next screen can say
 * so — the builder is gone by then and cannot toast. Module state is fine:
 * there is one builder per tab.
 */

/** What one save attempt came to. */
export type SaveOutcome = "saved" | "refused" | "failed";

let pending: Promise<void> | null = null;
let failed = false;
let flushedAt = 0;

/** Track a flush. `awaitPendingSave` always resolves; a non-save is recorded. */
export function trackPendingSave(save: Promise<SaveOutcome>): Promise<void> {
  flushedAt = Date.now();
  const tracked: Promise<void> = save
    .then(
      (outcome) => {
        if (outcome !== "saved") failed = true;
      },
      () => {
        failed = true;
      },
    )
    .finally(() => {
      if (pending === tracked) pending = null;
    });
  pending = tracked;
  return tracked;
}

/** Resolves once no flushed save is in flight (immediately when none is). */
export function awaitPendingSave(): Promise<void> {
  return pending ?? Promise.resolve();
}

/**
 * When the last flush was tracked (epoch ms; 0 = never). The builder's unmount
 * cleanup runs synchronously before the next screen mounts, so "a flush
 * happened in this navigation" is `lastFlushAt() >= thatScreen'sMountTime`.
 */
export function lastFlushAt(): number {
  return flushedAt;
}

/** True while a flushed save that did not reach the server is unacknowledged. */
export function hasFlushFailure(): boolean {
  return failed;
}

export function clearFlushFailure(): void {
  failed = false;
}
