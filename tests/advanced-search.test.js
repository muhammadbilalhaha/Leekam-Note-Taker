import assert from "node:assert/strict";
import test from "node:test";
import { getGlobalSearchResults, parseSearchQuery } from "../src/lib/notes.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 28, 12, 0, 0).getTime();

function note(id, title, content = "", extra = {}) {
  return {
    id,
    title,
    content,
    tags: [],
    color: "sage",
    pinned: false,
    favorite: false,
    folderId: null,
    dailyDate: null,
    deletedAt: null,
    createdAt: now - 30 * DAY,
    updatedAt: now - 10 * DAY,
    ...extra,
  };
}

const folders = [
  { id: "work", name: "Work", parentId: null, createdAt: 1 },
  { id: "ccna", name: "CCNA", parentId: "work", createdAt: 2 },
  { id: "personal", name: "Personal", parentId: null, createdAt: 3 },
];

const notes = [
  note("routing", "Routing table", "A note about OSPF and static routes.", {
    tags: ["networking", "ccna"],
    folderId: "ccna",
    pinned: true,
    updatedAt: now - 2 * DAY,
    content: "A note about OSPF and static routes. See [[Subnetting]].",
  }),
  note("subnetting", "Subnetting", "Practice subnet masks.", {
    tags: ["networking"],
    folderId: "work",
    updatedAt: now - 20 * DAY,
  }),
  note("reading", "Reading list", "Books for winter.", {
    tags: ["personal"],
    folderId: "personal",
    favorite: true,
    updatedAt: now - 1 * DAY,
  }),
  note("trashed", "Old routing draft", "Deleted networking notes.", {
    tags: ["networking"],
    deletedAt: now - 1 * DAY,
    updatedAt: now - 1 * DAY,
  }),
];

test("search filters parse quoted values and preserve free text", () => {
  const parsed = parseSearchQuery('tag:"computer networks" folder:CCNA hello world');
  assert.equal(parsed.term, "hello world");
  assert.deepEqual(parsed.filters.tags, ["computer-networks"]);
  assert.deepEqual(parsed.filters.folders, ["ccna"]);
  assert.equal(parsed.invalidFilters.length, 0);
});

test("tag and folder filters combine and include nested folders", () => {
  const result = getGlobalSearchResults(notes, "tag:networking folder:Work", folders, { now });
  assert.deepEqual(
    result.notes.map((item) => item.note.id).sort(),
    ["routing", "subnetting"],
  );
  assert.equal(result.total, 2);
});

test("is, updated, and link filters are applied together", () => {
  const result = getGlobalSearchResults(
    notes,
    "is:pinned updated:7d has:links",
    folders,
    { now },
  );
  assert.deepEqual(result.notes.map((item) => item.note.id), ["routing"]);
});

test("has:backlinks finds notes linked from active notes", () => {
  const result = getGlobalSearchResults(notes, "has:backlinks", folders, { now });
  assert.deepEqual(result.notes.map((item) => item.note.id), ["subnetting"]);
});

test("filter-only searches return matching notes without group results", () => {
  const result = getGlobalSearchResults(notes, "is:favorite", folders, { now });
  assert.deepEqual(result.notes.map((item) => item.note.id), ["reading"]);
  assert.deepEqual(result.folders, []);
  assert.deepEqual(result.tags, []);
  assert.deepEqual(result.views, []);
});

test("Trash is excluded by default and included explicitly", () => {
  const normal = getGlobalSearchResults(notes, "networking", folders, { now });
  assert.ok(normal.notes.every((item) => !item.note.deletedAt));
  const trash = getGlobalSearchResults(notes, "networking in:trash", folders, { now });
  assert.deepEqual(trash.notes.map((item) => item.note.id), ["trashed"]);
  assert.equal(trash.scope, "trash");
});

test("invalid filters fail closed with useful metadata", () => {
  const result = getGlobalSearchResults(notes, "is:imaginary", folders, { now });
  assert.equal(result.total, 0);
  assert.deepEqual(result.invalidFilters, ["is:imaginary"]);
});

test("filter chips describe the active query", () => {
  const result = getGlobalSearchResults(notes, "tag:networking updated:7d", folders, { now });
  assert.deepEqual(
    result.filterChips.map((chip) => chip.label),
    ["#networking", "Updated ≤ 7d"],
  );
});
