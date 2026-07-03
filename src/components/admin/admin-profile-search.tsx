"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Loader2, User } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { FancyField } from "@/components/ui/fancy-field";
import { searchProfiles, type AdminProfileSummary } from "@/lib/api/admin";
import { cdnUrl } from "@/lib/api/qrcodes";

/**
 * Reusable admin profile search (mirrors mobile `find_user_layout`): a debounced
 * search field feeding `["admin","search", term]` and a results list. Each row
 * shows avatar / display name / `@handle` / bio. `onSelect(name)` overrides the
 * default action (navigate to `/admin/profiles/[name]`) — used by the Cloudflare
 * create sheet to pick a `profileId` instead.
 */
export function AdminProfileSearch({
  onSelect,
  autoFocus,
}: {
  onSelect?: (profile: AdminProfileSummary) => void;
  autoFocus?: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  // ~400ms debounce so we don't fire a request on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 400);
    return () => clearTimeout(id);
  }, [term]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["admin", "search", debounced],
    queryFn: () => searchProfiles(debounced),
    enabled: debounced.length > 0,
  });

  const results = data?.profiles ?? [];

  function handleSelect(profile: AdminProfileSummary) {
    if (onSelect) {
      onSelect(profile);
      return;
    }
    router.push(`/admin/profiles/${encodeURIComponent(profile.name)}`);
  }

  return (
    <div className="space-y-3">
      <FancyField
        id="admin-search"
        label={t("search.placeholder")}
        iconSrc="/brand/ic_gradient_hash.svg"
        autoFocus={autoFocus}
        value={term}
        onChange={(e) => setTerm(e.target.value)}
      />

      {debounced.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {isFetching && (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          )}

          {!isFetching && isError && (
            <p className="p-6 text-center text-sm text-error">
              {t("search.error")}
            </p>
          )}

          {!isFetching && !isError && results.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {t("search.empty")}
            </p>
          )}

          {!isFetching && !isError && results.length > 0 && (
            <ul className="divide-y divide-border">
              {results.map((profile) => {
                // Mobile settings are NESTED objects, not flat strings.
                const avatar = cdnUrl(profile.settings?.profile_picture?.image_url);
                const displayName = profile.settings?.name?.text ?? profile.name;
                const bio = profile.settings?.bio?.text;
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(profile)}
                      className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-muted"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                        {avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatar}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <User className="size-5 text-muted-foreground" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {displayName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{profile.name}
                        </span>
                        {bio && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {bio}
                          </span>
                        )}
                      </span>
                      <span className="brand-gradient-text shrink-0 text-sm font-semibold">
                        {t("open")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
