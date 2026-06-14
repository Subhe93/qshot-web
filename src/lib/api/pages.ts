import { api } from "./client";
import type { ApiResponse } from "@/lib/types/api";
import type { Block } from "@/lib/types/blocks";
import { parseBlocks, serializeBlocks } from "@/lib/builder/serialization";

/**
 * Multi-page (sub-pages) API — mirrors the mobile q-profile/multi-page/* endpoints.
 * Each profile has a home page (the profile itself) + ordered sub-pages, each with
 * its own `info.modules` (blocks). Home settings/hero do not apply to sub-pages.
 */

export interface WebPage {
  _id: string;
  urlName: string;
  listName: string;
  listViewStatus?: boolean;
  order?: number;
}

interface RawPage extends WebPage {
  info?: { modules?: unknown[] };
}

export async function listPages(profileId: string): Promise<WebPage[]> {
  const res = await api
    .get("q-profile/multi-page/index", { searchParams: { profileId } })
    .json<ApiResponse<{ pages?: WebPage[] }>>();
  return (res.data?.pages ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function showPage(
  pageId: string,
): Promise<{ page: WebPage; blocks: Block[]; pagesList: WebPage[] } | null> {
  const res = await api
    .get("q-profile/multi-page/show", { searchParams: { pageId } })
    .json<ApiResponse<{ page?: RawPage; pagesList?: WebPage[] }>>();
  const page = res.data?.page;
  if (!page) return null;
  return {
    page,
    blocks: parseBlocks(page.info?.modules ?? []),
    pagesList: res.data?.pagesList ?? [],
  };
}

/** Default seed block for a new page — a heading carrying the page name (mobile parity). */
function seedModules(listName: string): Record<string, unknown>[] {
  return serializeBlocks(parseBlocks([{ type: "HeaderModule", value: listName }]));
}

export async function storePage(input: {
  userProfileId: string;
  urlName: string;
  listName: string;
  blocks?: Block[];
}): Promise<WebPage | null> {
  const res = await api
    .post("q-profile/multi-page/store", {
      json: {
        urlName: input.urlName,
        listName: input.listName,
        userProfileId: input.userProfileId,
        info: {
          modules: input.blocks
            ? serializeBlocks(input.blocks)
            : seedModules(input.listName),
        },
      },
    })
    .json<ApiResponse<{ page?: WebPage }>>();
  return res.data?.page ?? null;
}

/** Rename / change url (metadata only — does NOT touch blocks). */
export async function renamePage(
  pageId: string,
  urlName: string,
  listName: string,
): Promise<WebPage | null> {
  const res = await api
    .post("q-profile/multi-page/update", { json: { pageId, urlName, listName } })
    .json<ApiResponse<{ page?: WebPage }>>();
  return res.data?.page ?? null;
}

/** Save a page's blocks (update-info). */
export async function savePageBlocks(pageId: string, blocks: Block[]) {
  return api
    .post("q-profile/multi-page/update-info", {
      json: { pageId, info: { modules: serializeBlocks(blocks) } },
    })
    .json<ApiResponse<unknown>>();
}

export async function deletePage(pageId: string) {
  return api
    .post("q-profile/multi-page/delete", { json: { pageId } })
    .json<ApiResponse<unknown>>();
}

/** Check whether a page url slug is already taken (true = taken). */
export async function checkPageUrl(
  pageName: string,
  profileId: string,
): Promise<boolean> {
  const res = await api
    .get("q-profile/multi-page/check-page-url-name", {
      searchParams: { pageName, profileId },
    })
    .json<ApiResponse<{ name_exists?: boolean }>>();
  return res.data?.name_exists === true;
}

/**
 * Persist reorder + listed-status for all pages. Mobile posts a raw JSON array as
 * form-urlencoded (Dio list encoding → `0[pageId]=…&0[order]=…`).
 */
export async function updatePagesOrder(
  pages: { pageId: string; order: number; listViewStatus: boolean }[],
) {
  const body = new URLSearchParams();
  pages.forEach((p, i) => {
    body.append(`${i}[pageId]`, p.pageId);
    body.append(`${i}[order]`, String(p.order));
    body.append(`${i}[listViewStatus]`, String(p.listViewStatus));
  });
  return api
    .post("q-profile/multi-page/update-status-order", { body })
    .json<ApiResponse<unknown>>()
    .catch(() => undefined);
}
