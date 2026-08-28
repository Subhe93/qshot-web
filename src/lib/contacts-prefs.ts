import { deviceEntry } from "@/lib/local-store";

/**
 * Which one-tap action the contacts-book row offers — web mirror of mobile's
 * `ContactQuickAction` (Hive `contacts/quick_action`). A DEVICE preference,
 * not an account one: the backend has no field for it and never will.
 *
 * The declaration order IS the fallback order: when the chosen action has
 * nothing to act on, the row tries call, then WhatsApp, then email, and shows
 * no button at all when none resolves. Anything unrecognised in storage
 * resolves to "call" — what the row did before the preference existed.
 */
export type ContactQuickAction = "call" | "whatsapp" | "email";

export const QUICK_ACTION_FALLBACK_ORDER: ContactQuickAction[] = [
  "call",
  "whatsapp",
  "email",
];

export const quickActionPref = deviceEntry<ContactQuickAction>({
  name: "contacts-quick-action",
  fallback: "call",
  validate: (v): v is ContactQuickAction =>
    v === "call" || v === "whatsapp" || v === "email",
});
