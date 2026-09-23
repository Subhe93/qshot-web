"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { useRouter } from "@/i18n/navigation";

/**
 * Save confirmation toast — web mirror of mobile `contacts_fragment.dart`
 * `_confirmSaved` (v2.4.0): a save no longer ends on its own confirmation
 * screen, it ends back where the user was with ONE toast. Line 1 says
 * saved / already-saved, a quiet second line appears only when the tag
 * assign missed (the save itself succeeded — never worded as an error), and
 * the single action opens the contact. Mobile's share-back branch has no web
 * equivalent and is skipped.
 *
 * A single instance lives in the app layout (like `UpgradePlanDialog`);
 * showing a new toast replaces the previous one (mobile `clearSnackBars()`).
 */
export interface ContactSaveToastData {
  message: string;
  /** Quiet second line — e.g. "Saved — but the tags couldn't be added." */
  sub?: string;
  actionLabel?: string;
  /** In-app href the action opens (e.g. `/contacts/123`). */
  actionHref?: string;
}

interface ContactSaveToastState {
  toast: ContactSaveToastData | null;
  show: (toast: ContactSaveToastData) => void;
  clear: () => void;
}

export const useContactSaveToast = create<ContactSaveToastState>((set) => ({
  toast: null,
  show: (toast) => set({ toast }),
  clear: () => set({ toast: null }),
}));

export function ContactSaveToast() {
  const { toast, clear } = useContactSaveToast();
  const router = useRouter();

  // Mobile: 5 seconds, then gone.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clear, 5_000);
    return () => clearTimeout(id);
  }, [toast, clear]);

  if (!toast) return null;
  const { message, sub, actionLabel, actionHref } = toast;
  return (
    // Same layer as the plan toast: above every dialog/sheet in the app.
    <div className="fixed bottom-6 left-1/2 z-200 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl bg-dark px-4 py-3 text-white shadow-xl">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{message}</p>
        {sub && <p className="mt-0.5 text-xs text-white/70">{sub}</p>}
      </div>
      {actionLabel && actionHref && (
        <button
          type="button"
          onClick={() => {
            clear();
            router.push(actionHref);
          }}
          className="shrink-0 text-sm font-bold text-[#7dd8d5] hover:opacity-80"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
