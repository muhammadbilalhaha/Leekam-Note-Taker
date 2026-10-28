import assert from "node:assert/strict";
import test from "node:test";
import { getGlobalSearchResults } from "../src/lib/notes.js";

function makeTestNote(id, title, content, tags = [], extra = {}) {
  return {
    id,
    title,
    content,
    tags,
    color: "sage",
    pinned: false,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

const notes = [
  makeTestNote(
    "product",
    "Product Settings",
    "Generate separate corporate ratings for every release.",
    ["work"],
  ),
  makeTestNote("reading", "Reading list", "Books to revisit this winter.", ["personal"]),
  makeTestNote("pinned", "Pinned idea", "A small idea worth keeping.", ["ideas"], {
    pinned: true,
  }),
];

const folders = [
  { id: "work", name: "Work notes", parentId: null, createdAt: 1 },
  { id: "projects", name: "Projects", parentId: "work", createdAt: 2 },
];

const notesWithFolders = [
  { ...notes[0], folderId: "projects" },
  notes[1],
  notes[2],
  makeTestNote("trashed", "Old work draft", "A deleted idea.", ["work"], {
    folderId: "work",
    deletedAt: 10,
  }),
];

test("partial words match inside titles and content", () => {
  const results = getGlobalSearchResults(notes, "rate");
  assert.equal(results.notes.length, 1);
  assert.equal(results.notes[0].note.id, "product");
  assert.match(results.notes[0].snippet, /Generate/);
  assert.match(results.notes[0].snippet, /corporate/);
});

test("search is case-insensitive", () => {
  const lower = getGlobalSearchResults(notes, "product");
  const upper = getGlobalSearchResults(notes, "PRODUCT");
  const mixed = getGlobalSearchResults(notes, "PrOdUcT");

  assert.deepEqual(
    lower.notes.map((result) => result.note.id),
    upper.notes.map((result) => result.note.id),
  );
  assert.deepEqual(
    lower.notes.map((result) => result.note.id),
    mixed.notes.map((result) => result.note.id),
  );
});

test("partial queries find tags and views as well as records", () => {
  const tagResults = getGlobalSearchResults(notes, "per");
  assert.deepEqual(
    tagResults.tags.map((tag) => tag.name),
    ["personal"],
  );

  const viewResults = getGlobalSearchResults(notes, "pin");
  assert.equal(viewResults.notes[0].note.id, "pinned");
  assert.equal(viewResults.views[0].id, "pinned");
  assert.equal(viewResults.total, 2);
});

test("every matching group is returned and counted", () => {
  const results = getGlobalSearchResults(notes, "book");
  assert.equal(results.notes.length, 1);
  assert.equal(results.tags.length, 0);
  assert.equal(results.views.length, 0);
  assert.equal(results.total, 1);
});

test("folders are searched and report notes in their subtree", () => {
  const results = getGlobalSearchResults(notesWithFolders, "work", folders);
  assert.equal(results.folders[0].id, "work");
  assert.equal(results.folders[0].count, 1);
  assert.equal(results.notes[0].note.id, "product");
  assert.ok(results.tags.some((tag) => tag.name === "work"));

  const nested = getGlobalSearchResults(notesWithFolders, "proj", folders);
  assert.equal(nested.folders[0].id, "projects");
  assert.equal(nested.folders[0].count, 1);
});

test("trashed notes stay out of normal search results", () => {
  const results = getGlobalSearchResults(notesWithFolders, "deleted", folders);
  assert.equal(results.notes.length, 0);
  assert.equal(results.folders.length, 0);
});

test("empty and unmatched queries return no results", () => {
  assert.deepEqual(getGlobalSearchResults(notes, ""), {
    notes: [],
    folders: [],
    tags: [],
    views: [],
    total: 0,
  });
  assert.equal(getGlobalSearchResults(notes, "   ").total, 0);
  assert.equal(getGlobalSearchResults(notes, "zzzz").total, 0);
});
