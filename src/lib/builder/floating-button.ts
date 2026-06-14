import type { FloatingButtonVariant } from "@/lib/types/profile";

export const FLOATING_VARIANTS: FloatingButtonVariant[] = [
  "whatsapp",
  "phone",
  "email",
  "telegram",
  "messenger",
  "customLink",
  "form",
  "buyNow",
];

export const floatingIcon = (v: FloatingButtonVariant) => `/floating/${v}.svg`;

/** Variants with a secondary field (message, or subject for email). */
export function secondaryField(v: FloatingButtonVariant): "message" | "subject" | null {
  if (v === "whatsapp" || v === "telegram" || v === "messenger") return "message";
  if (v === "email") return "subject";
  return null;
}

export const hasCustomImage = (v: FloatingButtonVariant) => v === "customLink";

const PHONE_TYPES: FloatingButtonVariant[] = ["phone", "whatsapp", "telegram"];
export const isPhoneType = (v: FloatingButtonVariant) => PHONE_TYPES.includes(v);

/** Sanitize input per type — mirrors the mobile inputFormatters. */
export function sanitizeValue(v: FloatingButtonVariant, raw: string): string {
  if (isPhoneType(v)) return raw.replace(/[^0-9+]/g, "").slice(0, 15); // digits + '+', max 15
  return raw.replace(/\s/g, ""); // email + URL types: no whitespace
}

const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isUri(s: string): boolean {
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Validate the value field per type — mirrors FloatingButtonVariantValidator.
 * Returns an error key under `floatingButton.errors.*`, or null when valid.
 */
export function validateFloatingValue(
  v: FloatingButtonVariant,
  value: string,
): "required" | "phoneInvalid" | "emailInvalid" | "urlInvalid" | null {
  if (!value || !value.trim()) return "required";
  if (isPhoneType(v)) return PHONE_RE.test(value) ? null : "phoneInvalid";
  if (v === "email") return EMAIL_RE.test(value) ? null : "emailInvalid";
  return isUri(value) ? null : "urlInvalid"; // messenger, customLink, form, buyNow
}

/** Build the launch URL — mirrors FloatingButtonVariantLauncher._buildUri. */
export function floatingUrl(
  type: FloatingButtonVariant,
  value: string,
  message?: string,
  subject?: string,
): string {
  switch (type) {
    case "email": {
      const q = subject ? `?subject=${encodeURIComponent(subject)}` : "";
      return `mailto:${value}${q}`;
    }
    case "phone":
      return `tel:${value}`;
    case "whatsapp": {
      const number = value.replace(/\+/g, "");
      const msg = message ? `?text=${encodeURIComponent(message)}` : "";
      return `https://wa.me/${number}${msg}`;
    }
    case "telegram": {
      let base = value;
      if (value.startsWith("@")) base = `https://t.me/${value.slice(1)}`;
      else if (value.startsWith("+")) base = `https://t.me/${value}`;
      if (message) base += `?text=${encodeURIComponent(message)}`;
      return base;
    }
    case "messenger": {
      let pageId = value;
      if (value.includes("m.me/")) pageId = value.split("m.me/").pop()!.split("?")[0];
      else if (value.includes("facebook.com/"))
        pageId = value.split("facebook.com/").pop()!.split("?")[0];
      const msg = message ? `?ref=${encodeURIComponent(message)}` : "";
      return `https://m.me/${pageId}${msg}`;
    }
    default:
      return value;
  }
}
