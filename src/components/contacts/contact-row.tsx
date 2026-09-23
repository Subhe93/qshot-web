"use client";

import { useTranslations } from "next-intl";
import { Mail, MessageCircle, Phone, Star } from "lucide-react";
import {
  callablePhone,
  contactDisplayName,
  dialNumber,
  primaryEmail,
  primaryPhone,
  whatsappNumber,
  type Contact,
} from "@/lib/api/contacts";
import { ContactAvatar } from "@/components/contacts/shared";
import {
  QUICK_ACTION_FALLBACK_ORDER,
  type ContactQuickAction,
} from "@/lib/contacts-prefs";
import { cn } from "@/lib/utils";

/**
 * One book row — avatar, name, company · phone, the one-tap action and the
 * favourite star. The action is the user's DEVICE preference (mobile
 * ContactQuickAction), falling back call → WhatsApp → email when the chosen
 * one has nothing to act on; a fax-only contact never shows a call button,
 * and a row with nothing to act on shows no dead icon at all.
 *
 * Shared by the book (`contacts/page.tsx`) and the event-session details
 * page (`contacts/events/[id]`), the web mirror of mobile `ContactCard`.
 */
export function ContactRow({
  contact,
  quickAction,
  onOpen,
  onToggleFavorite,
}: {
  contact: Contact;
  quickAction: ContactQuickAction;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const t = useTranslations("contacts");
  const name = contactDisplayName(contact) || t("unnamed");
  const phone = primaryPhone(contact);
  const call = callablePhone(contact);
  const email = primaryEmail(contact);
  const subtitle = [contact.company, phone?.number].filter(Boolean).join(" · ");

  // The preferred action first, then the fixed fallback order.
  const order: ContactQuickAction[] = [
    quickAction,
    ...QUICK_ACTION_FALLBACK_ORDER.filter((a) => a !== quickAction),
  ];
  let action: { href: string; Icon: typeof Phone; label: string } | null = null;
  for (const kind of order) {
    if (kind === "call" && call) {
      action = { href: `tel:${dialNumber(call)}`, Icon: Phone, label: t("call") };
      break;
    }
    if (kind === "whatsapp" && call) {
      action = {
        href: `https://wa.me/${whatsappNumber(call)}`,
        Icon: MessageCircle,
        label: t("whatsapp"),
      };
      break;
    }
    if (kind === "email" && email) {
      action = { href: `mailto:${email.address}`, Icon: Mail, label: t("email") };
      break;
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-muted/50">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <ContactAvatar contact={contact} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {name}
          </span>
          {subtitle && (
            <span className="block truncate text-xs text-muted-foreground" dir="auto">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {action && (
        <a
          href={action.href}
          target={action.href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          aria-label={action.label}
          className="shrink-0 rounded-full border border-border p-2 text-foreground hover:bg-muted"
          onClick={(e) => e.stopPropagation()}
        >
          <action.Icon className="size-4" />
        </a>
      )}
      <button
        type="button"
        aria-label={t("filterFavourites")}
        onClick={onToggleFavorite}
        className="shrink-0 rounded-full p-2"
      >
        <Star
          className={cn(
            "size-4",
            contact.isFavorite
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground",
          )}
        />
      </button>
    </div>
  );
}
