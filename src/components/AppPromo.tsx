"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X, Download, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

const SEEN_KEY = "qshot_app_promo_seen";
const IOS_URL =
  "https://apps.apple.com/eg/app/qshot-bio-qr-creator/id6587578534";
const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=linkinbio.qshot.com";

// "Mobile view" = below the app's lg (1024px) desktop breakpoint.
const MOBILE_MQ = "(max-width: 1023px)";
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Mobile-only "get the app" promo (never shown on desktop ≥1024px):
 *  - A one-time full popup on first open (remembered in localStorage).
 *  - After it's dismissed, a slim Facebook-style top bar. The bar's hide is
 *    in-memory only, so it reappears on every page reload.
 *
 * Rendered inside AppShell's column so the bar pushes content down; the popup
 * portals to <body>.
 */
export function AppPromo() {
  const t = useTranslations("appPromo");
  // matchMedia via useSyncExternalStore: server snapshot is false, so the
  // component renders nothing during SSR/hydration (no mismatch, desktop-safe).
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_MQ).matches,
    () => false,
  );
  const [seen, setSeen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [popupOpen, setPopupOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);

  // Open the one-time popup shortly after first open (only if never seen).
  useEffect(() => {
    if (seen) return;
    const id = setTimeout(() => setPopupOpen(true), 700);
    return () => clearTimeout(id);
  }, [seen]);

  function closePopup() {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    setSeen(true);
    setPopupOpen(false);
  }

  if (!isMobile) return null;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(ua);
  const platform = isAndroid ? "Android" : "iOS";
  const primaryUrl = isAndroid ? ANDROID_URL : IOS_URL;

  const badges = [
    <StoreBadge
      key="ios"
      href={IOS_URL}
      icon="/brand-icons/colored/app-store.svg"
      small="Download on the"
      name="App Store"
      onClick={closePopup}
    />,
    <StoreBadge
      key="android"
      href={ANDROID_URL}
      icon="/brand-icons/colored/google-play.svg"
      small="GET IT ON"
      name="Google Play"
      onClick={closePopup}
    />,
  ];
  if (isAndroid) badges.reverse();

  return (
    <>
      {/* Slim top bar (after the popup is dismissed) — reappears on reload. */}
      {seen && !barHidden && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2.5">
          <a
            href={primaryUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-primary"
          >
            <Download className="size-5 shrink-0" />
            <span className="truncate text-sm font-semibold">
              {t("bar", { platform })}
            </span>
          </a>
          <button
            type="button"
            onClick={() => setBarHidden(true)}
            aria-label="Hide"
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* One-time full popup */}
      {popupOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-end justify-center bg-black/45 p-4 sm:items-center"
            onMouseDown={closePopup}
          >
            <div
              role="dialog"
              aria-modal="true"
              onMouseDown={(e) => e.stopPropagation()}
              className="animate-popover-in relative w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl"
            >
              <button
                type="button"
                onClick={closePopup}
                aria-label="Close"
                className="absolute end-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/30"
              >
                <X className="size-4" />
              </button>

              {/* Gradient header with the app logo */}
              <div className="brand-gradient flex flex-col items-center px-6 pb-6 pt-8 text-center">
                <span className="flex size-20 items-center justify-center rounded-3xl bg-white shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/logo.svg" alt="QShot" className="size-12" />
                </span>
                <h2 className="mt-4 text-xl font-bold text-white">{t("title")}</h2>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-white/90">
                  <Sparkles className="size-4" />
                  {t("badge")}
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-5">
                <p className="text-center text-sm text-muted-foreground">
                  {t("body")}
                </p>
                <div className="mt-5 flex items-stretch gap-2.5">{badges}</div>
                <button
                  type="button"
                  onClick={closePopup}
                  className="mt-4 w-full text-center text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t("continue")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Store-badge button using the official colored icon. */
function StoreBadge({
  href,
  icon,
  small,
  name,
  onClick,
}: {
  href: string;
  icon: string;
  small: string;
  name: string;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-dark px-3 py-2.5 text-white transition-transform hover:scale-[1.02]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={icon} alt="" className="size-7 shrink-0" />
      <span className="flex min-w-0 flex-col text-start leading-tight">
        <span className="text-[9px] opacity-80">{small}</span>
        <span className="truncate text-sm font-semibold">{name}</span>
      </span>
    </a>
  );
}
