/**
 * Self-check for the Website Change History data layer
 * (`src/lib/api/history.ts`, `src/lib/history/*`) against the contract
 * `docs/profile-history-api-contract.md`.
 *
 * Nothing here touches the network: the readers get the contract's §4 / §5.3
 * example bodies, the error mapping gets real ky `HTTPError` objects built
 * from fake `Response`s with the pre-read `data` ky ≥ 2 attaches, and the
 * summary helpers get hand-built rows.
 *
 * Run: npx tsx scripts/check-history.ts   (Node 22)
 * Two "[zustand persist middleware] Unable to update item" lines are expected:
 * Node has no localStorage; the sign-out assertions read the in-memory store.
 * Exits 1 on any failure.
 */

import { HTTPError, TimeoutError } from "ky";
import {
  HistoryApiError,
  historyDocumentOf,
  historyPageIdOf,
  historyQueryKeys,
  parseHistoryError,
  readHistoryDiff,
  readHistoryEnvelope,
  readHistoryPage,
  readHistoryRestoredPage,
  readHistoryRestoreResult,
  readHistoryRow,
  readHistoryRowContent,
  toHistoryError,
  type HistoryRow,
  type HistorySource,
} from "../src/lib/api/history";
import {
  blockLabelKey,
  blockRestoreHistoryId,
  groupByDay,
  HISTORY_KEEP,
  HISTORY_LABEL_MAX,
  HISTORY_PIN_MAX,
  localDayOf,
  restorableBlocks,
  rowActions,
  summaryLine,
  summaryParts,
  type HistoryStrings,
} from "../src/lib/history/summary";
import { historyRowToEditorState } from "../src/lib/history/content";
import { useAuthStore } from "../src/stores/auth-store";

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed++;
    return;
  }
  failed++;
  console.error(`FAIL ${name}`);
  console.error(`  expected: ${JSON.stringify(expected)}`);
  console.error(`  actual  : ${JSON.stringify(actual)}`);
}

function checkTrue(name: string, actual: boolean): void {
  check(name, actual, true);
}

/* ────────────────────────────────────────────────────────────────────────────
 * A. Readers — §4 row, §5.1 page, §5.3 diff
 * ──────────────────────────────────────────────────────────────────────────── */

const ROW_4 = {
  _id: "6721c0",
  profileId: "66e82ba1d80321e93e437972",
  document: "main",
  seq: 42,
  source: "editor",
  actor: { userId: "66e7", role: "owner" },
  summary: {
    added: [{ id: "6f1c", type: "ProductsModule" }],
    removed: [{ id: "a03e", type: "ReviewsModule" }],
    edited: [{ id: "91bd", type: "HeaderModule" }],
    moved: true,
    settings: ["header", "style"],
    info: [],
  },
  startedAt: "2026-10-10T09:00:00.000Z",
  endedAt: "2026-10-10T09:12:40.000Z",
  saveCount: 37,
  restoredFrom: null,
  page: null,
  pinned: null,
};

{
  const row = readHistoryRow(ROW_4);
  check("A.row.id from _id", row.id, "6721c0");
  check("A.row.profileId", row.profileId, "66e82ba1d80321e93e437972");
  check("A.row.document", row.document, "main");
  check("A.row.pageId main → null", row.pageId, null);
  check("A.row.seq", row.seq, 42);
  check("A.row.source", row.source, "editor");
  check("A.row.actor", row.actor, { userId: "66e7", role: "owner" });
  check("A.row.summary.added", row.summary.added, [{ id: "6f1c", type: "ProductsModule" }]);
  check("A.row.summary.removed", row.summary.removed, [{ id: "a03e", type: "ReviewsModule" }]);
  check("A.row.summary.edited", row.summary.edited, [{ id: "91bd", type: "HeaderModule" }]);
  check("A.row.summary.moved", row.summary.moved, true);
  check("A.row.summary.settings", row.summary.settings, ["header", "style"]);
  check("A.row.summary.info", row.summary.info, []);
  check("A.row.startedAt stays a string", row.startedAt, "2026-10-10T09:00:00.000Z");
  check("A.row.endedAt stays a string", row.endedAt, "2026-10-10T09:12:40.000Z");
  check("A.row.saveCount", row.saveCount, 37);
  check("A.row.restoredFrom", row.restoredFrom, null);
  check("A.row.page", row.page, null);
  check("A.row.pinned", row.pinned, null);
}

{
  // A sub-page row, deleted, pinned, restored.
  const row = readHistoryRow({
    ...ROW_4,
    _id: "deadbeef",
    document: "page:66aa11",
    source: "page_deleted",
    actor: { userId: "u1", role: "company" },
    summary: {},
    saveCount: 0,
    restoredFrom: "6721b9",
    page: { urlName: "menu", listName: "Menu", listViewStatus: true, order: 4, restoredPageId: null },
    pinned: { label: "Before redesign", pinnedAt: "2026-10-11T00:00:00.000Z", pinnedBy: "u1" },
  });
  check("A.page.pageId from page:<id>", row.pageId, "66aa11");
  check("A.page.source", row.source, "page_deleted");
  check("A.page.actor company", row.actor?.role, "company");
  check("A.page.summary empty object → empty arrays", row.summary, {
    added: [],
    removed: [],
    edited: [],
    moved: false,
    settings: [],
    info: [],
  });
  check("A.page.restoredFrom", row.restoredFrom, "6721b9");
  check("A.page.page", row.page, {
    urlName: "menu",
    listName: "Menu",
    listViewStatus: true,
    order: 4,
    restoredPageId: null,
  });
  check("A.page.pinned", row.pinned, {
    label: "Before redesign",
    pinnedAt: "2026-10-11T00:00:00.000Z",
    pinnedBy: "u1",
  });
}

{
  // Defensive defaults.
  const empty = readHistoryRow({});
  check("A.def.id", empty.id, "");
  check("A.def.document", empty.document, "main");
  check("A.def.pageId", empty.pageId, null);
  check("A.def.seq", empty.seq, 0);
  // A missing / unknown `source` reads as `external` so it is still badged.
  check("A.def.source", empty.source, "external");
  check("A.def.actor", empty.actor, null);
  check("A.def.summary.moved", empty.summary.moved, false);
  check("A.def.summary.added", empty.summary.added, []);
  check("A.def.startedAt", empty.startedAt, "");
  check("A.def.saveCount", empty.saveCount, 0);
  check("A.def.page", empty.page, null);
  check("A.def.pinned", empty.pinned, null);

  const garbage = readHistoryRow("nope");
  check("A.def.non-object → default row", garbage.document, "main");

  const coerced = readHistoryRow({
    id: "x1", // `id` tolerated when `_id` is absent
    seq: "7",
    document: 12,
    source: "whatever",
    actor: { role: "admin" }, // no userId → null
    summary: { moved: "true", added: [{ id: "b1" }, "junk", { type: "NoId" }], settings: "style" },
    saveCount: "3",
    page: { order: "2", listViewStatus: "false" },
  });
  check("A.coerce.id fallback", coerced.id, "x1");
  check("A.coerce.seq string → int", coerced.seq, 7);
  check("A.coerce.document number → string", coerced.document, "12");
  check("A.coerce.unknown source → external (still badged)", coerced.source, "external");
  check("A.coerce.actor without userId → null", coerced.actor, null);
  check("A.coerce.moved 'true' → true", coerced.summary.moved, true);
  check("A.coerce.added keeps only id-bearing refs", coerced.summary.added, [{ id: "b1", type: "" }]);
  check("A.coerce.settings non-array → []", coerced.summary.settings, []);
  check("A.coerce.saveCount", coerced.saveCount, 3);
  check("A.coerce.page order/listViewStatus", [coerced.page?.order, coerced.page?.listViewStatus], [2, false]);

  const actorRole = readHistoryRow({ actor: { userId: "u", role: "superuser" } });
  check("A.coerce.unknown role → owner", actorRole.actor?.role, "owner");
}

{
  check("A.pageIdOf main", historyPageIdOf("main"), null);
  check("A.pageIdOf page:", historyPageIdOf("page:"), null);
  check("A.pageIdOf page:abc", historyPageIdOf("page:abc"), "abc");
  check("A.documentOf null", historyDocumentOf(null), "main");
  check("A.documentOf id", historyDocumentOf("abc"), "page:abc");
}

{
  const page = readHistoryPage({ history: [ROW_4, { _id: "b" }], next_cursor: 12 });
  check("A.list.count", page.history.length, 2);
  check("A.list.nextCursor", page.nextCursor, 12);
  check("A.list.last page", readHistoryPage({ history: [], next_cursor: null }).nextCursor, null);
  check("A.list.missing history", readHistoryPage({}).history, []);
  check("A.list.camelCase cursor tolerated", readHistoryPage({ nextCursor: "5" }).nextCursor, 5);
  check("A.list.cursor garbage → null", readHistoryPage({ next_cursor: "abc" }).nextCursor, null);
}

{
  const content = readHistoryRowContent({
    ...ROW_4,
    info: { modules: [{ id: "m1", type: "HeaderModule", value: "Hi" }] },
    settings: { style: "style2", website_name: "Shop" },
  });
  check("A.show.info", content.info, { modules: [{ id: "m1", type: "HeaderModule", value: "Hi" }] });
  check("A.show.settings", content.settings, { style: "style2", website_name: "Shop" });
  check("A.show.row fields kept", content.seq, 42);
  const sub = readHistoryRowContent({ ...ROW_4, document: "page:p1", info: { modules: [] } });
  check("A.show.sub-page settings → null", sub.settings, null);
  check("A.show.info missing → {}", readHistoryRowContent({}).info, {});
}

{
  const envelope = {
    success: true,
    data: {
      historyId: "6721c0",
      previous: { _id: "6721b9", seq: 41 },
      blocks: [
        { id: "91bd", type: "HeaderModule", change: "edited", before: { value: "a" }, after: { value: "b" } },
        { id: "6f1c", type: "ProductsModule", change: "added", before: null, after: { id: "6f1c" } },
        { id: "a03e", type: "ReviewsModule", change: "removed", before: { id: "a03e" }, after: null },
        { id: "zz", type: "X", change: "exploded" }, // unknown change → dropped
      ],
      order: { before: ["a03e", "91bd"], after: ["91bd", "6f1c"] },
      settings: [{ key: "style", before: "style1", after: "style2" }],
      info: [],
    },
  };
  const diff = readHistoryDiff(readHistoryEnvelope(envelope));
  check("A.diff.historyId", diff.historyId, "6721c0");
  check("A.diff.previous", diff.previous, { id: "6721b9", seq: 41 });
  check("A.diff.blocks.length (unknown change dropped)", diff.blocks.length, 3);
  check(
    "A.diff.blocks.changes",
    diff.blocks.map((b) => b.change),
    ["edited", "added", "removed"],
  );
  check("A.diff.blocks[1].before", diff.blocks[1].before, null);
  check("A.diff.blocks[2].after", diff.blocks[2].after, null);
  check("A.diff.order", diff.order, { before: ["a03e", "91bd"], after: ["91bd", "6f1c"] });
  check("A.diff.settings", diff.settings, [{ key: "style", before: "style1", after: "style2" }]);
  check("A.diff.info", diff.info, []);

  const first = readHistoryDiff({ historyId: "x", previous: null, blocks: [], order: null, settings: [], info: [] });
  check("A.diff.first row previous null", first.previous, null);
  check("A.diff.first row order null", first.order, null);
  check("A.diff.empty object", readHistoryDiff({}), {
    historyId: "",
    previous: null,
    blocks: [],
    order: null,
    settings: [],
    info: [],
  });
  const inferred = readHistoryDiff({
    blocks: [{ change: "added", after: { id: "k9", type: "ButtonModule" } }],
    settings: [{ key: "logo", after: "x" }],
  });
  check("A.diff.block id/type inferred from after", inferred.blocks[0], {
    id: "k9",
    type: "ButtonModule",
    change: "added",
    before: null,
    after: { id: "k9", type: "ButtonModule" },
  });
  check("A.diff.settings missing before → null", inferred.settings[0].before, null);
}

{
  check("A.env.wrapped", readHistoryEnvelope({ success: true, data: { a: 1 } }), { a: 1 });
  check("A.env.flat", readHistoryEnvelope({ history: [] }), { history: [] });
  check("A.env.data null", readHistoryEnvelope({ success: true, data: null }), {});
  check("A.env.text", readHistoryEnvelope("ok"), {});
  check("A.env.undefined", readHistoryEnvelope(undefined), {});
}

{
  check("A.restore.result", readHistoryRestoreResult({ changed: false, document: "main" }), {
    changed: false,
    document: "main",
  });
  check("A.restore.result empty → changed true", readHistoryRestoreResult({}), { changed: true, document: "main" });
  check(
    "A.restorePage.page",
    readHistoryRestoredPage({ _id: "newid", urlName: "menu-2", listName: "Menu", listViewStatus: true, order: 4 }),
    { id: "newid", urlName: "menu-2", listName: "Menu", listViewStatus: true, order: 4 },
  );
}

{
  check("A.keys.list", historyQueryKeys.list("p1"), ["history", "p1", "list", "", false]);
  check("A.keys.list filtered", historyQueryKeys.list("p1", "main", true), ["history", "p1", "list", "main", true]);
  check("A.keys.show", historyQueryKeys.show("p1", "h1"), ["history", "p1", "show", "h1"]);
  check("A.keys.diff", historyQueryKeys.diff("p1", "h1"), ["history", "p1", "diff", "h1"]);
  check("A.keys.all is a prefix of list", historyQueryKeys.all("p1"), ["history", "p1"]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * B. Summary line (§6.3)
 * ──────────────────────────────────────────────────────────────────────────── */

const STRINGS: HistoryStrings = {
  blockName: (type) => blockLabelKey(type) ?? type,
  blocksAdded: (n) => `${n} blocks added`,
  blocksRemoved: (n) => `${n} blocks removed`,
  blocksEdited: (n) => `${n} blocks edited`,
  blockAdded: (name) => `${name} added`,
  blockRemoved: (name) => `${name} removed`,
  blockEdited: (name) => `${name} edited`,
  reordered: "Blocks reordered",
  designChanged: "Design changed",
  pageSettingsChanged: "Page settings changed",
  sourceLabel: (source) => `[${source}]`,
};

function row(over: Omit<Partial<HistoryRow>, "summary"> & { summary?: Partial<HistoryRow["summary"]> } = {}): HistoryRow {
  const base = readHistoryRow(ROW_4);
  return {
    ...base,
    ...over,
    summary: { ...base.summary, added: [], removed: [], edited: [], moved: false, settings: [], info: [], ...over.summary },
  };
}

const ref = (id: string, type: string) => ({ id, type });

{
  check("B.full example", summaryLine(readHistoryRow(ROW_4), STRINGS), [
    "products added",
    "reviews removed",
    "header edited",
    "Blocks reordered",
    "Design changed",
  ].join(" · "));
  check("B.added single", summaryParts(row({ summary: { added: [ref("1", "ProductsModule")] } }), STRINGS), [
    "products added",
  ]);
  check(
    "B.added plural",
    summaryParts(row({ summary: { added: [ref("1", "ProductsModule"), ref("2", "HeaderModule")] } }), STRINGS),
    ["2 blocks added"],
  );
  check("B.removed single", summaryParts(row({ summary: { removed: [ref("1", "ReviewsModule")] } }), STRINGS), [
    "reviews removed",
  ]);
  check(
    "B.removed plural",
    summaryParts(row({ summary: { removed: [ref("1", "A"), ref("2", "B"), ref("3", "C")] } }), STRINGS),
    ["3 blocks removed"],
  );
  check("B.edited single", summaryParts(row({ summary: { edited: [ref("1", "HeaderModule")] } }), STRINGS), [
    "header edited",
  ]);
  check("B.edited plural", summaryParts(row({ summary: { edited: [ref("1", "A"), ref("2", "B")] } }), STRINGS), [
    "2 blocks edited",
  ]);
  check("B.moved", summaryParts(row({ summary: { moved: true } }), STRINGS), ["Blocks reordered"]);
  check("B.settings", summaryParts(row({ summary: { settings: ["style"] } }), STRINGS), ["Design changed"]);
  check("B.info", summaryParts(row({ summary: { info: ["title"] } }), STRINGS), ["Page settings changed"]);
  check("B.unknown block type falls back to raw type", summaryParts(row({ summary: { added: [ref("1", "MysteryModule")] } }), STRINGS), [
    "MysteryModule added",
  ]);
  for (const source of ["editor", "initial", "external", "restore", "page_deleted"] as HistorySource[]) {
    check(`B.empty → source label (${source})`, summaryParts(row({ source }), STRINGS), [`[${source}]`]);
  }
  check(
    "B.order: added, removed, edited, moved, settings, info",
    summaryParts(
      row({
        summary: {
          info: ["x"],
          settings: ["y"],
          moved: true,
          edited: [ref("1", "A"), ref("2", "B")],
          removed: [ref("3", "HeaderModule")],
          added: [ref("4", "A"), ref("5", "B")],
        },
      }),
      STRINGS,
    ),
    ["2 blocks added", "header removed", "2 blocks edited", "Blocks reordered", "Design changed", "Page settings changed"],
  );
}

{
  check("B.labelKey products", blockLabelKey("ProductsModule"), "products");
  check("B.labelKey header", blockLabelKey("HeaderModule"), "header");
  check("B.labelKey social", blockLabelKey("social_links"), "social");
  check("B.labelKey booking", blockLabelKey("BookingModule"), "booking");
  check("B.labelKey unknown", blockLabelKey("MysteryModule"), null);
  check("B.labelKey empty", blockLabelKey(""), null);
  check("B.labelKey prototype key", blockLabelKey("constructor"), null);
  check("B.labelKey __proto__", blockLabelKey("__proto__"), null);
}

{
  check("B.constants", [HISTORY_PIN_MAX, HISTORY_LABEL_MAX, HISTORY_KEEP], [10, 60, 300]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * C. Group by day (§6.2.2) — across midnight, fixed zones
 * ──────────────────────────────────────────────────────────────────────────── */

{
  const late = row({ id: "late", endedAt: "2026-10-10T23:30:00.000Z" });
  const early = row({ id: "early", endedAt: "2026-10-11T00:30:00.000Z" });
  const noon = row({ id: "noon", endedAt: "2026-10-10T12:00:00.000Z" });

  check("C.localDayOf UTC", localDayOf("2026-10-10T23:30:00.000Z", "UTC"), "2026-10-10");
  check("C.localDayOf Riyadh (+3) crosses midnight", localDayOf("2026-10-10T23:30:00.000Z", "Asia/Riyadh"), "2026-10-11");
  check("C.localDayOf LA (-7) pulls back", localDayOf("2026-10-11T00:30:00.000Z", "America/Los_Angeles"), "2026-10-10");
  check("C.localDayOf garbage", localDayOf("not a date", "UTC"), null);
  check("C.localDayOf bad zone falls back", typeof localDayOf("2026-10-10T23:30:00.000Z", "Mars/Olympus"), "string");

  const utc = groupByDay([noon, late, early], "UTC");
  check(
    "C.UTC → two days, newest first",
    utc.map((g) => [g.day, g.rows.map((r) => r.id)]),
    [
      ["2026-10-11", ["early"]],
      ["2026-10-10", ["late", "noon"]],
    ],
  );
  const riyadh = groupByDay([noon, late, early], "Asia/Riyadh");
  check(
    "C.Riyadh → late + early share the 11th, noon on the 10th",
    riyadh.map((g) => [g.day, g.rows.map((r) => r.id)]),
    [
      ["2026-10-11", ["early", "late"]],
      ["2026-10-10", ["noon"]],
    ],
  );
  const la = groupByDay([noon, late, early], "America/Los_Angeles");
  check(
    "C.LA → all on the 10th",
    la.map((g) => [g.day, g.rows.map((r) => r.id)]),
    [["2026-10-10", ["early", "late", "noon"]]],
  );

  const tieA = row({ id: "tieA", endedAt: "2026-10-10T10:00:00.000Z" });
  const tieB = row({ id: "tieB", endedAt: "2026-10-10T10:00:00.000Z" });
  check(
    "C.stable on equal endedAt",
    groupByDay([tieA, tieB], "UTC")[0].rows.map((r) => r.id),
    ["tieA", "tieB"],
  );
  const broken = row({ id: "broken", endedAt: "" });
  const grouped = groupByDay([broken, noon], "UTC");
  check(
    "C.unreadable endedAt → last group with day ''",
    grouped.map((g) => [g.day, g.rows.map((r) => r.id)]),
    [
      ["2026-10-10", ["noon"]],
      ["", ["broken"]],
    ],
  );
  check("C.empty input", groupByDay([], "UTC"), []);
}

/* ────────────────────────────────────────────────────────────────────────────
 * D. Row actions (§6.2 table), restorable blocks, which historyId (§5.5/§6.7)
 * ──────────────────────────────────────────────────────────────────────────── */

{
  const withBlocks = { added: [ref("1", "HeaderModule")] };
  check("D.editor with blocks", rowActions(row({ source: "editor", summary: withBlocks })), {
    preview: true,
    diff: true,
    restore: true,
    restoreBlock: true,
    restorePage: false,
  });
  check("D.editor settings only", rowActions(row({ source: "editor", summary: { settings: ["style"] } })), {
    preview: true,
    diff: true,
    restore: true,
    restoreBlock: false,
    restorePage: false,
  });
  check("D.initial", rowActions(row({ source: "initial" })), {
    preview: true,
    diff: false,
    restore: true,
    restoreBlock: false,
    restorePage: false,
  });
  check("D.external", rowActions(row({ source: "external", summary: { edited: [ref("1", "A")] } })), {
    preview: true,
    diff: true,
    restore: true,
    restoreBlock: true,
    restorePage: false,
  });
  check("D.restore", rowActions(row({ source: "restore", summary: { removed: [ref("1", "A")] } })), {
    preview: true,
    diff: true,
    restore: true,
    restoreBlock: true,
    restorePage: false,
  });
  const deletedPage = { urlName: "menu", listName: "Menu", listViewStatus: true, order: 1, restoredPageId: null };
  check("D.page_deleted not yet restored", rowActions(row({ source: "page_deleted", page: deletedPage })), {
    preview: false,
    diff: false,
    restore: false,
    restoreBlock: false,
    restorePage: true,
  });
  check(
    "D.page_deleted already restored",
    rowActions(row({ source: "page_deleted", page: { ...deletedPage, restoredPageId: "newid" } })),
    { preview: false, diff: false, restore: false, restoreBlock: false, restorePage: false },
  );
  check("D.page_deleted without page object", rowActions(row({ source: "page_deleted", page: null })).restorePage, true);
}

{
  const r = row({
    summary: {
      added: [ref("a1", "ProductsModule")],
      removed: [ref("r1", "ReviewsModule")],
      edited: [ref("e1", "HeaderModule"), ref("e2", "ButtonModule")],
    },
  });
  check("D.restorableBlocks order added→removed→edited", restorableBlocks(r), [
    { ref: ref("a1", "ProductsModule"), change: "added" },
    { ref: ref("r1", "ReviewsModule"), change: "removed" },
    { ref: ref("e1", "HeaderModule"), change: "edited" },
    { ref: ref("e2", "ButtonModule"), change: "edited" },
  ]);
  check("D.restorableBlocks empty", restorableBlocks(row()), []);

  const diff = readHistoryDiff({ historyId: "6721c0", previous: { _id: "6721b9", seq: 41 } });
  const noPrevious = readHistoryDiff({ historyId: "6721c0", previous: null });
  check("D.removed → this row, bring_back", blockRestoreHistoryId("removed", r, diff), {
    historyId: "6721c0",
    mode: "bring_back",
  });
  check("D.removed without diff still this row", blockRestoreHistoryId("removed", r, null), {
    historyId: "6721c0",
    mode: "bring_back",
  });
  check("D.added → this row, as_after", blockRestoreHistoryId("added", r, null), {
    historyId: "6721c0",
    mode: "as_after",
  });
  check("D.edited → previous row, undo_edit", blockRestoreHistoryId("edited", r, diff), {
    historyId: "6721b9",
    mode: "undo_edit",
  });
  check("D.edited without previous → null", blockRestoreHistoryId("edited", r, noPrevious), null);
  check("D.edited without diff → null", blockRestoreHistoryId("edited", r, null), null);
}

/* ────────────────────────────────────────────────────────────────────────────
 * E. Error mapping (§9) — real ky HTTPError objects with pre-read `data`
 * ──────────────────────────────────────────────────────────────────────────── */

function httpError(status: number, body: unknown, opts: { asText?: boolean; noData?: boolean } = {}): HTTPError {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const response = new Response(text, {
    status,
    statusText: "",
    headers: { "content-type": typeof body === "string" ? "text/html" : "application/json" },
  });
  const request = new Request("https://api.example.test/q-profile/history/restore", { method: "POST" });
  const err = new HTTPError(response, request, {} as never);
  // ky ≥ 2 pre-reads the body here (JSON parsed for JSON content types, text
  // otherwise) — `httpErrorBody` reads this field first.
  if (!opts.noData) err.data = opts.asText ? text : body;
  return err;
}

{
  const e403 = toHistoryError(httpError(403, { success: false, error: "Not allowed" }));
  check("E.403 → forbidden", [e403.code, e403.status, e403.serverMessage], ["forbidden", 403, "Not allowed"]);
  checkTrue("E.403 is HistoryApiError", e403 instanceof HistoryApiError);
  checkTrue("E.403 is Error", e403 instanceof Error);
  check("E.403 message = server sentence", e403.message, "Not allowed");

  const e404 = toHistoryError(httpError(404, { success: false, error: "History record not found" }));
  check("E.404 → not_found", [e404.code, e404.serverMessage], ["not_found", "History record not found"]);

  const e409 = toHistoryError(httpError(409, { success: false, error: "Unpin one first" }));
  check("E.409 → conflict", [e409.code, e409.serverMessage], ["conflict", "Unpin one first"]);

  const eDeleted = toHistoryError(
    httpError(422, { success: false, error: "This page was deleted. Use q-profile/history/restore-page." }),
  );
  check("E.422 deleted page → deleted_page", eDeleted.code, "deleted_page");
  check("E.422 deleted page validation null", eDeleted.validation, null);

  const eValidation = toHistoryError(
    httpError(422, {
      success: false,
      error: {
        name: "ProfileValidationError",
        description: {
          message: "Profile info failed schema validation",
          schemaVersion: "2.0.0",
          target: "info",
          errors: [
            { path: "/modules/3/links/0", message: 'unknown field "icon" is not allowed', keyword: "additionalProperties", field: "icon" },
            { junk: true },
          ],
        },
        isOperational: true,
      },
    }),
  );
  check("E.422 ProfileValidationError → validation", eValidation.code, "validation");
  check("E.422 validation.status", eValidation.validation?.status, 422);
  check("E.422 validation.message", eValidation.validation?.message, "Profile info failed schema validation");
  check("E.422 validation.schemaVersion", eValidation.validation?.schemaVersion, "2.0.0");
  check("E.422 validation.target", eValidation.validation?.target, "info");
  check("E.422 validation.errors (junk dropped)", eValidation.validation?.errors, [
    { path: "/modules/3/links/0", message: 'unknown field "icon" is not allowed', keyword: "additionalProperties", field: "icon" },
  ]);
  check("E.422 validation serverMessage", eValidation.serverMessage, "Profile info failed schema validation");

  const e422 = toHistoryError(httpError(422, { success: false, error: "Invalid historyId" }));
  check("E.422 generic → bad_request", [e422.code, e422.serverMessage], ["bad_request", "Invalid historyId"]);

  useAuthStore.setState({ token: "tok", user: null });
  const eUnauthorized = toHistoryError(
    httpError(400, { error: { name: "UnauthorizedException", description: { message: "Unauthorized" }, isOperational: false } }),
  );
  check("E.400 UnauthorizedException → unauthorized", [eUnauthorized.code, eUnauthorized.status], ["unauthorized", 400]);
  check("E.400 UnauthorizedException signs out", useAuthStore.getState().token, null);

  useAuthStore.setState({ token: "tok", user: null });
  const eWrapped = toHistoryError(
    httpError(400, { error: { name: "HttpException", description: { statusCode: 401, message: "jwt expired" } } }),
  );
  check("E.400 wrapped 401 → unauthorized", [eWrapped.code, eWrapped.serverMessage], ["unauthorized", "jwt expired"]);
  check("E.400 wrapped 401 signs out", useAuthStore.getState().token, null);

  useAuthStore.setState({ token: "tok", user: null });
  const eBad = toHistoryError(
    httpError(400, {
      error: {
        name: "BadRequestException",
        description: { message: ["historyId should not be empty", "label must be shorter than or equal to 60 characters"] },
        isOperational: false,
      },
    }),
  );
  check(
    "E.400 BadRequestException → bad_request, joined message",
    [eBad.code, eBad.serverMessage],
    ["bad_request", "historyId should not be empty, label must be shorter than or equal to 60 characters"],
  );
  check("E.400 BadRequestException keeps the session", useAuthStore.getState().token, "tok");

  const e401 = toHistoryError(httpError(401, { message: "Unauthorized" }));
  check("E.real 401 → unauthorized", [e401.code, e401.serverMessage], ["unauthorized", "Unauthorized"]);

  const e500 = toHistoryError(httpError(500, { message: "Internal server error" }));
  check("E.500 → unknown", [e500.code, e500.status, e500.serverMessage], ["unknown", 500, "Internal server error"]);

  const eHtml = toHistoryError(httpError(502, "<html>Bad gateway</html>", { asText: true }));
  check("E.502 HTML body → unknown with text", [eHtml.code, eHtml.serverMessage], ["unknown", "<html>Bad gateway</html>"]);

  const eTextJson = toHistoryError(httpError(404, { success: false, error: "Row gone" }, { asText: true }));
  check("E.text body holding JSON is decoded", [eTextJson.code, eTextJson.serverMessage], ["not_found", "Row gone"]);

  const eNoData = toHistoryError(httpError(403, { error: "x" }, { noData: true }));
  check("E.no pre-read data → status still mapped", [eNoData.code, eNoData.serverMessage], ["forbidden", null]);
  checkTrue("E.no data message falls back to ky's", eNoData.message.startsWith("Request failed with status code 403"));

  const eTimeout = toHistoryError(new TimeoutError(new Request("https://api.example.test/x")));
  check("E.TimeoutError → network", [eTimeout.code, eTimeout.status], ["network", null]);
  const eFetch = toHistoryError(new TypeError("fetch failed"));
  check("E.TypeError → network", [eFetch.code, eFetch.message], ["network", "fetch failed"]);
  const eGeneric = toHistoryError(new Error("boom"));
  check("E.Error → unknown", [eGeneric.code, eGeneric.message], ["unknown", "boom"]);
  const eString = toHistoryError("boom");
  check("E.string → unknown", [eString.code, eString.message], ["unknown", "boom"]);
  const mine = new HistoryApiError({ code: "conflict", status: 409 });
  checkTrue("E.HistoryApiError passthrough (same instance)", toHistoryError(mine) === mine);
  check("E.HistoryApiError default message", mine.message, "History request failed (conflict)");
  check("E.HistoryApiError name", mine.name, "HistoryApiError");
}

{
  // The pure mapper directly — the shapes a body can take.
  check("E.pure null status → network", parseHistoryError({ status: null }).code, "network");
  check("E.pure 422 string body", parseHistoryError({ status: 422, body: '{"error":"This page was deleted."}' }).code, "deleted_page");
  check("E.pure 422 undefined body → bad_request", parseHistoryError({ status: 422 }).code, "bad_request");
  check("E.pure 400 plain → bad_request", parseHistoryError({ status: 400, body: { message: "x" } }).code, "bad_request");
  check(
    "E.pure error.description string",
    parseHistoryError({ status: 404, body: { error: { name: "NotFound", description: "gone" } } }).serverMessage,
    "gone",
  );
  check(
    "E.pure transport message when body says nothing",
    parseHistoryError({ status: 500, body: {}, transportMessage: "tx" }).message,
    "tx",
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * F. History content → editor state (same parsers as a loaded site)
 * ──────────────────────────────────────────────────────────────────────────── */

{
  const content = readHistoryRowContent({
    ...ROW_4,
    info: {
      modules: [
        { type: "HeaderModule", value: "Hello" }, // no id → one is generated, like a loaded site
        { id: "p1", type: "ParagraphModule", content: "[]" },
      ],
    },
    settings: { style: "style2", website_name: "Shop", template: { id: "t1" } },
  });
  const state = historyRowToEditorState(content);
  check("F.blocks.length", state.blocks.length, 2);
  check("F.blocks.types", state.blocks.map((b) => b.type), ["HeaderModule", "ParagraphModule"]);
  checkTrue("F.blocks[0] got an id", typeof state.blocks[0].id === "string" && state.blocks[0].id.length > 0);
  check("F.blocks[1] keeps its id", state.blocks[1].id, "p1");
  check("F.settings.style", state.settings?.style, "style2");
  check("F.settings.website_name", state.settings?.website_name, "Shop");

  const sub = historyRowToEditorState(readHistoryRowContent({ ...ROW_4, document: "page:p1", info: { modules: [] } }));
  check("F.sub-page settings null", sub.settings, null);
  check("F.sub-page blocks empty", sub.blocks, []);

  const legacy = historyRowToEditorState(
    readHistoryRowContent({ ...ROW_4, info: {}, settings: { modules: [{ id: "L", type: "HeaderModule" }] } }),
  );
  check("F.legacy settings.modules", legacy.blocks.map((b) => b.id), ["L"]);
  checkTrue("F.legacy settings parsed", legacy.settings !== null);

  const empty = historyRowToEditorState(readHistoryRowContent({}));
  check("F.empty row", [empty.blocks, empty.settings], [[], null]);
}

/* ──────────────────────────────────────────────────────────────────────────── */

console.log(`check-history: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
