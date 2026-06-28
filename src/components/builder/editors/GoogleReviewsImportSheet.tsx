"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Star, Loader2, MapPin, Info } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  googlePlacesAutocomplete,
  googlePlaceDetails,
  type GooglePrediction,
  type GooglePlaceDetails,
} from "@/lib/api/google-places";

const AMBER = "#FFC107";

/**
 * "Fetch from Google" sheet — mirrors the mobile PlacePickerSheet but uses a
 * text autocomplete instead of a map. Search → pick a place → fetch its details
 * → import its reviews. Import is only allowed for a business (has a rating) that
 * actually has reviews, matching the mobile `_canSave` rule.
 */
export function GoogleReviewsImportSheet({
  onImport,
  onClose,
}: {
  onImport: (details: GooglePlaceDetails) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<GooglePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<GooglePlaceDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  // Debounced autocomplete. All state updates happen inside the deferred
  // callback (never synchronously in the effect body).
  useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    const handle = setTimeout(
      async () => {
        if (!q || selected) {
          if (id === reqId.current) {
            setPredictions([]);
            setSearching(false);
          }
          return;
        }
        if (id === reqId.current) setSearching(true);
        try {
          const list = await googlePlacesAutocomplete(q);
          if (id === reqId.current) setPredictions(list);
        } catch {
          if (id === reqId.current) setPredictions([]);
        } finally {
          if (id === reqId.current) setSearching(false);
        }
      },
      q && !selected ? 350 : 0,
    );
    return () => clearTimeout(handle);
  }, [query, selected]);

  async function pick(p: GooglePrediction) {
    setLoadingDetails(true);
    setError(null);
    setPredictions([]);
    try {
      const details = await googlePlaceDetails(p.place_id);
      if (!details) {
        setError("Couldn't load this place. Try another.");
        return;
      }
      setSelected(details);
      setQuery(details.name ?? p.description);
    } catch {
      setError("Couldn't load this place. Try another.");
    } finally {
      setLoadingDetails(false);
    }
  }

  function reset() {
    setSelected(null);
    setQuery("");
    setError(null);
  }

  const isBusiness = selected?.rating != null;
  const reviewCount = selected?.reviews?.length ?? 0;
  const canImport = isBusiness && reviewCount > 0;
  const hint = !selected
    ? null
    : !isBusiness
      ? "Not a business location"
      : reviewCount === 0
        ? "No reviews available for this place"
        : null;

  return (
    <BottomSheet
      title="Fetch from Google"
      subtitle={selected?.name || "Reviews"}
      onClose={onClose}
    >
      <div className="space-y-3">
        {/* Search box */}
        <div className="flex items-center gap-2 rounded-xl border border-input bg-surface px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              if (selected) setSelected(null);
              setQuery(e.target.value);
            }}
            placeholder="Search for your business on Google…"
            className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none"
          />
          {(searching || loadingDetails) && (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        {error && <p className="px-1 text-xs text-error">{error}</p>}

        {/* Predictions */}
        {!selected && predictions.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            {predictions.map((p) => (
              <button
                key={p.place_id}
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-start last:border-b-0 hover:bg-muted"
              >
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm text-foreground">
                  {p.description}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Selected place preview */}
        {selected && (
          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {selected.name}
                </p>
                {(selected.formatted_address || selected.vicinity) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.formatted_address || selected.vicinity}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                Change
              </button>
            </div>

            <div className="flex items-center gap-3 text-sm">
              {isBusiness && (
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Star className="size-4" style={{ color: AMBER }} fill={AMBER} strokeWidth={0} />
                  {selected.rating?.toFixed(1)}
                </span>
              )}
              <span className="text-muted-foreground">
                {reviewCount} review{reviewCount === 1 ? "" : "s"} to import
              </span>
            </div>

            {hint && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0" />
                {hint}
              </p>
            )}
          </div>
        )}

        {/* Import button */}
        <button
          type="button"
          disabled={!canImport}
          onClick={() => {
            if (selected && canImport) {
              onImport(selected);
              onClose();
            }
          }}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-white transition-opacity disabled:bg-foreground/10 disabled:text-foreground/30"
        >
          Import reviews
        </button>
      </div>
    </BottomSheet>
  );
}
