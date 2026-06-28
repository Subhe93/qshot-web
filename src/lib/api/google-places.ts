import { api } from "./client";

/**
 * Google Places, proxied through the qshot backend (same endpoints the mobile
 * app uses via `GoogleMapsPlaces` → `https://api.qshot.com/q-profile/google-map`).
 * The server holds the Places API key, so nothing secret lives in the browser.
 * Responses are wrapped as `{ data: { result } }`; autocomplete's result carries
 * `predictions`, details' result carries `result` (the place object).
 */

export interface GooglePrediction {
  place_id: string;
  description: string;
}

export interface GoogleReviewRaw {
  author_name?: string;
  profile_photo_url?: string;
  rating?: number;
  text?: string;
  relative_time_description?: string;
  time?: number;
}

export interface GooglePlaceDetails {
  place_id: string;
  name?: string;
  url?: string;
  formatted_address?: string;
  vicinity?: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: GoogleReviewRaw[];
  geometry?: { location?: { lat: number; lng: number } };
}

// Same field set the mobile requests (google_maps_places_service.dart).
const DETAIL_FIELDS = [
  "formatted_address",
  "geometry",
  "place_id",
  "icon",
  "name",
  "vicinity",
  "rating",
  "url",
  "user_ratings_total",
  "reviews",
].join(",");

type Wrapped = { data?: { result?: unknown } };

export async function googlePlacesAutocomplete(
  input: string,
): Promise<GooglePrediction[]> {
  const q = input.trim();
  if (!q) return [];
  const body = await api
    .get("q-profile/google-map/autocomplete", { searchParams: { input: q } })
    .json<Wrapped>();
  const r = body?.data?.result as
    | { predictions?: GooglePrediction[] }
    | GooglePrediction[]
    | undefined;
  const list = Array.isArray(r) ? r : (r?.predictions ?? []);
  return list.filter((p) => p && p.place_id);
}

export async function googlePlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails | null> {
  const body = await api
    .get("q-profile/google-map/details", {
      searchParams: { place_id: placeId, fields: DETAIL_FIELDS },
    })
    .json<Wrapped>();
  const r = body?.data?.result as
    | { result?: GooglePlaceDetails }
    | GooglePlaceDetails
    | undefined;
  if (!r) return null;
  const place = "result" in r && r.result ? r.result : (r as GooglePlaceDetails);
  return place?.place_id ? place : null;
}
