import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLinkIndex,
  extractWikiLinks,
  formatWikiLink,
  getBacklinks,
  getBrokenLinks,
  resolveLinkBody,
  transformWikiLinks,
  updateLinksForRenamedNote,
} from "../src/lib/links.js";

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
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

test("wiki links are extracted outside code and inline code", () => {
  const content = [
    "Link to [[Networking Basics]] and [[Routing|note-2]].",
    "`[[Inline code]]`",
    "```md",
    "[[Fenced code]]",
    "```",
  ].join("\n");
  const links = extractWikiLinks(content);
  assert.deepEqual(
    links.map((link) => [link.label, link.targetId]),
    [
      ["Networking Basics", null],
      ["Routing", "note-2"],
    ],
  );
});

test("links resolve by title or stable id and report ambiguity and Trash", () => {
  const notes = [
    note("a", "Networking Basics", "[[Routing]]"),
    note("b", "Routing", "[[Networking Basics]]"),
    note("c", "Routing", ""),
    note("d", "Archived", "", { deletedAt: 5 }),
  ];
  const index = buildLinkIndex(notes);

  assert.equal(resolveLinkBody(index, "Networking Basics").note.id, "a");
  assert.equal(resolveLinkBody(index, "Routing|c").note.id, "c");
  assert.equal(resolveLinkBody(index, "Routing").status, "ambiguous");
  assert.equal(resolveLinkBody(index, "Archived").status, "trashed");
  assert.equal(resolveLinkBody(index, "Missing note").status, "missing");

  const backlinks = getBacklinks(index, "a");
  assert.equal(backlinks.length, 1);
  assert.equal(backlinks[0].note.id, "b");
  assert.equal(getBrokenLinks(index, "a")[0].status, "ambiguous");
});

test("backlink indexing de-duplicates repeated references from one note", () => {
  const notes = [
    note("source", "Source", "[[Target]] and [[Target|target]]"),
    note("target", "Target", ""),
  ];
  const index = buildLinkIndex(notes);
  assert.equal(getBacklinks(index, "target").length, 1);
});

test("renaming rewrites unambiguous title links and keeps id links stable", () => {
  const notes = [
    note("target", "Old title", ""),
    note("title-link", "Title link", "See [[Old title]]."),
    note("id-link", "ID link", "See [[Old title|target]]."),
    note("other", "Other", "No links."),
  ];
  const renamed = updateLinksForRenamedNote(notes, "target", "Old title", "New title");
  assert.equal(renamed.find((item) => item.id === "title-link").content, "See [[New title]].");
  assert.equal(renamed.find((item) => item.id === "id-link").content, "See [[New title|target]].");
});

test("renaming does not rewrite ambiguous title links", () => {
  const notes = [
    note("target", "Same title", ""),
    note("duplicate", "Same title", ""),
    note("source", "Source", "[[Same title]]"),
  ];
  const renamed = updateLinksForRenamedNote(notes, "target", "Same title", "Renamed");
  assert.equal(renamed.find((item) => item.id === "source").content, "[[Same title]]");
});

test("trashed duplicates do not block a rename rewrite", () => {
  const notes = [
    note("target", "Shared title", ""),
    note("trashed", "Shared title", "", { deletedAt: 5 }),
    note("source", "Source", "[[Shared title]]"),
  ];
  const renamed = updateLinksForRenamedNote(notes, "target", "Shared title", "Fresh title");
  assert.equal(renamed.find((item) => item.id === "source").content, "[[Fresh title]]");
});

test("links recover after a trashed note is restored", () => {
  const trashed = note("target", "Target", "", { deletedAt: 5 });
  const source = note("source", "Source", "[[Target]]");
  const index = buildLinkIndex([source, trashed]);
  assert.equal(resolveLinkBody(index, "Target").status, "trashed");
  assert.equal(getBacklinks(index, "target").length, 0);

  const restoredIndex = buildLinkIndex([source, { ...trashed, deletedAt: null }]);
  assert.equal(resolveLinkBody(restoredIndex, "Target").status, "resolved");
  assert.equal(getBacklinks(restoredIndex, "target").length, 1);
});

test("wiki links transform into internal Markdown links", () => {
  const index = buildLinkIndex([note("a", "A note", ""), note("b", "B note", "")]);
  const markdown = transformWikiLinks("Go to [[A note]] and [[Missing]].", index);
  assert.match(markdown, /\[A note\]\(leekam-note:\/\/A%20note\)/);
  assert.match(markdown, /\[Missing\]\(leekam-note:\/\/Missing\)/);
});

test("titles containing link syntax fall back to stable id links", () => {
  const target = note("target", "Cooking | Roti");
  const index = buildLinkIndex([target]);
  const raw = formatWikiLink(target);
  assert.equal(raw, "[[Cooking %7C Roti|target]]");
  assert.equal(resolveLinkBody(index, raw.slice(2, -2)).note.id, "target");

  const renamed = updateLinksForRenamedNote(
    [note("target", "Old title"), note("source", "Source", "[[Old title]]")],
    "target",
    "Old title",
    "Cooking | Roti",
  );
  assert.equal(renamed.find((item) => item.id === "source").content, "[[Cooking %7C Roti|target]]");
});
