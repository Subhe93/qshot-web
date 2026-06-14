/**
 * Google sign-in for the web via Google Identity Services (GIS).
 *
 * Reuses the existing Web OAuth client from the mobile Google project
 * (qshot-be6f9). The token flow yields an OAuth **access_token**, matching what
 * the mobile app sends to the backend `social/login` ({ type:"google", token }).
 *
 * NOTE: the web app's domain (e.g. http://localhost:3000 and the production
 * origin) must be added to this client's "Authorized JavaScript origins" in the
 * Google Cloud Console, otherwise Google rejects the request.
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  "1093638977251-tdijln45t1htuenk1jm9vr4k2pblvrn2.apps.googleusercontent.com";

interface TokenResponse {
  access_token?: string;
  error?: string;
}
interface TokenClient {
  requestAccessToken: () => void;
}
interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (resp: TokenResponse) => void;
    error_callback?: (err: { type?: string }) => void;
  }): TokenClient;
}
interface GoogleNamespace {
  accounts?: { oauth2?: GoogleOAuth2 };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

let loader: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(script);
  });
  return loader;
}

/** Open the Google popup and resolve with an OAuth access_token (matches mobile). */
export async function getGoogleAccessToken(): Promise<string> {
  await loadGis();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google Identity Services unavailable");
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "email profile",
      callback: (resp) => {
        if (resp.access_token) resolve(resp.access_token);
        else reject(new Error(resp.error ?? "Google sign-in failed"));
      },
      error_callback: (err) => reject(new Error(err.type ?? "Google sign-in cancelled")),
    });
    client.requestAccessToken();
  });
}
