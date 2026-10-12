"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  historyQueryKeys,
  pinHistory,
  restoreHistory,
  restoreHistoryBlock,
  restoreHistoryPage,
  toHistoryError,
  unpinHistory,
  type HistoryApiError,
  type HistoryRestoredPage,
  type HistoryRow,
} from "@/lib/api/history";
import { awaitPendingSave } from "@/lib/builder/pending-save";
import { historyErrorMessage, type HistoryActionContext } from "./copy";

export const pagesQueryKey = (profileId: string) => ["pages", profileId] as const;

export interface HistoryToast {
  text: string;
  error?: boolean;
}

/**
 * The §6.6–6.9 write flows against one website. Every call: wait for a save
 * the builder flushed on its way out (§7.1), hit the route, then reload the
 * list (§6.2.6) and the site data the rest of the app reads — the dashboard's
 * `["profiles"]` (its cards are the app's "website edited" signal) and this
 * screen's page list — and toast the outcome. Errors go through §9.
 */
export function useHistoryActions(
  profileId: string,
  handlers: {
    toast: (toast: HistoryToast) => void;
    /** 409 on pin: the 10-pin ceiling — the screen switches to the Pinned tab. */
    onPinLimit?: () => void;
  },
) {
  const queryClient = useQueryClient();
  const t = useTranslations("history");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const { toast, onPinLimit } = handlers;

  const afterWrite = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: historyQueryKeys.all(profileId) });
    void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    void queryClient.invalidateQueries({ queryKey: pagesQueryKey(profileId) });
  }, [queryClient, profileId]);

  const fail = useCallback(
    (e: unknown, context: HistoryActionContext): HistoryApiError => {
      const error = toHistoryError(e);
      if (error.code !== "unauthorized") {
        toast({ text: historyErrorMessage(error, t, tc("genericError"), context), error: true });
      }
      // A row that vanished (reverted, pruned, unpinned while old) — or a page
      // restored from another device — means the list is stale: reload it.
      if (error.code === "not_found" || error.code === "conflict") {
        void queryClient.invalidateQueries({ queryKey: historyQueryKeys.all(profileId) });
      }
      if (error.code === "conflict" && context === "pin") onPinLimit?.();
      return error;
    },
    [toast, t, tc, queryClient, profileId, onPinLimit],
  );

  /** Serialises the flows: a second tap while one runs is ignored (mobile `busy`). */
  const run = useCallback(
    async <T,>(context: HistoryActionContext, work: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      try {
        await awaitPendingSave();
        return await work();
      } catch (e) {
        fail(e, context);
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [fail],
  );

  /** §6.6 — whole page. */
  const restore = useCallback(
    (row: HistoryRow) =>
      run("restore", async () => {
        const result = await restoreHistory(profileId, row.id);
        if (result.changed) {
          toast({ text: t("restore.done") });
          await afterWrite();
        } else {
          toast({ text: t("restore.unchanged") });
        }
        return result;
      }),
    [run, profileId, toast, t, afterWrite],
  );

  /** §6.7 — one block; `historyId` already chosen by the §5.5 rule. */
  const restoreBlock = useCallback(
    (historyId: string, blockId: string) =>
      run("block", async () => {
        const result = await restoreHistoryBlock(profileId, historyId, blockId);
        if (result.changed) {
          toast({ text: t("block.done") });
          await afterWrite();
        } else {
          toast({ text: t("restore.unchanged") });
        }
        return result;
      }),
    [run, profileId, toast, t, afterWrite],
  );

  /** §6.8 — recreate a deleted sub-page; the toast shows the (maybe new) url. */
  const restorePage = useCallback(
    (row: HistoryRow): Promise<HistoryRestoredPage | null> =>
      run("page", async () => {
        const page = await restoreHistoryPage(profileId, row.id);
        toast({ text: t("restorePage.done", { url: page.urlName }) });
        await afterWrite();
        return page;
      }),
    [run, profileId, toast, t, afterWrite],
  );

  /** §6.9 — pin or rename. */
  const pin = useCallback(
    (row: HistoryRow, label: string) =>
      run("pin", async () => {
        const pinned = await pinHistory(profileId, row.id, label);
        toast({ text: row.pinned ? t("pin.renamed") : t("pin.done") });
        await afterWrite();
        return pinned;
      }),
    [run, profileId, toast, t, afterWrite],
  );

  /** §6.9 — unpin (the row may be pruned right away, §5.7). */
  const unpin = useCallback(
    (row: HistoryRow) =>
      run("pin", async () => {
        await unpinHistory(profileId, row.id);
        toast({ text: t("pin.unpinned") });
        await afterWrite();
        return true;
      }),
    [run, profileId, toast, t, afterWrite],
  );

  return { busy, restore, restoreBlock, restorePage, pin, unpin };
}
