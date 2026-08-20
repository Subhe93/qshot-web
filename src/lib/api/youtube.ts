import { api } from "./client";

/**
 * YouTube channel-id resolution — mobile `Links.fetchYoutubeChannelId`
 * (`YoutubeFeedDataSource.resolveChannelId`):
 *
 *   GET q-profile/youtube-channel/name?url={channel url}  →  { data: "UC…" }
 *
 * The public RSS endpoint that actually renders the feed
 * (`youtube.com/feeds/videos.xml`) takes a CHANNEL ID, but users paste handle
 * URLs (`youtube.com/@channel`). Mobile resolves those through this backend
 * call before storing the block — the web builder must do the same, or the
 * stored `channel_id` is a URL the renderer can't feed to the RSS endpoint.
 *
 * Returns null on ANY failure (network, 4xx, unexpected shape): resolution is
 * an enhancement over the caller's offline `UC…` extraction, and a typo mid-
 * typing must never surface as an error state of its own.
 */
export async function resolveYoutubeChannelId(url: string): Promise<string | null> {
  try {
    const res = await api
      .get("q-profile/youtube-channel/name", { searchParams: { url } })
      .json<{ data?: unknown }>();
    const id = res?.data;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}
