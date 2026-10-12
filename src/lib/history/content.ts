import type { HistoryRowContent } from "@/lib/api/history";
import type { Block } from "@/lib/types/blocks";
import type { WebsiteSettings } from "@/lib/types/profile";
import { parseBlocks, parseSettings } from "@/lib/builder/serialization";

/**
 * A `show` row's content as the editor model, through the SAME parsers the
 * builder runs when it loads a live site (`getProfile`, `BuilderShell`'s
 * admin loader, `showPage`): `parseBlocks` on `info.modules`, `parseSettings`
 * on `settings`. So a history snapshot renders in the read-only preview
 * exactly like the page did at that moment — same defaults, same ids.
 *
 * `settings` is `null` for sub-pages (§4: `show` carries it on `main` only);
 * the preview then keeps the live site's settings for the frame.
 */
export function historyRowToEditorState(row: HistoryRowContent): {
  blocks: Block[];
  settings: WebsiteSettings | null;
} {
  const info = row.info ?? {};
  // Legacy location mirrored from `getProfile`: very old snapshots may carry
  // the blocks under `settings.modules`.
  const rawBlocks = Array.isArray(info.modules)
    ? info.modules
    : Array.isArray(row.settings?.modules)
      ? row.settings.modules
      : [];
  return {
    blocks: parseBlocks(rawBlocks),
    settings: row.settings ? parseSettings(row.settings) : null,
  };
}
