import assert from "node:assert/strict";
import test from "node:test";
import { validateBackup, buildBackup, purgeExpiredTrash } from "../src/lib/backup.js";
import {
  buildFolderTree,
  getFolderDescendantIds,
  getFolderNoteCounts,
  removeFolder,
} from "../src/lib/folders.js";
import { markdownToPlainText, toggleTaskAtIndex } from "../src/lib/markdown.js";
import { getFilterTitle, getVisibleNotes } from "../src/lib/notes.js";

const folders = [
  { id: "personal", name: "Personal", parentId: null, createdAt: 1 },
  { id: "reading", name: "Reading", parentId: "personal", createdAt: 2 },
  { id: "work", name: "Work", parentId: null, createdAt: 3 },
];

function note(id, title, folderId = null, extra = {}) {
  return {
    id,
    title,
    content: "Some content about books.",
    tags: [],
    color: "sage",
    pinned: false,
    folderId,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

const notes = [
  note("root", "Root note", "personal"),
  note("nested", "Nested note", "reading"),
  note("work", "Work note", "work"),
  note("trash", "Deleted note", "personal", { deletedAt: 5 }),
];

test("folder filters include nested folders and exclude Trash", () => {
  const ids = getFolderDescendantIds(folders, "personal");
  assert.deepEqual([...ids].sort(), ["personal", "reading"]);

  const visible = getVisibleNotes(
    notes,
    { type: "folder", folderId: "personal" },
    "",
    ids,
  );
  assert.deepEqual(
    visible.map((item) => item.id).sort(),
    ["nested", "root"],
  );
});

test("Trash only shows deleted notes and supports its own query", () => {
  const trashed = getVisibleNotes(notes, { type: "trash" }, "deleted");
  assert.deepEqual(
    trashed.map((item) => item.id),
    ["trash"],
  );
  assert.equal(getFilterTitle({ type: "trash" }), "Trash");
});

test("folder counts roll up to parent folders", () => {
  const counts = getFolderNoteCounts(folders, notes);
  assert.equal(counts.get("personal"), 2);
  assert.equal(counts.get("reading"), 1);
  assert.equal(counts.get("work"), 1);
  assert.equal(buildFolderTree(folders).length, 2);
});

test("deleting a folder moves notes and subfolders up one level", () => {
  const result = removeFolder(folders, notes, "personal");
  assert.equal(result.folders.some((folder) => folder.id === "personal"), false);
  assert.equal(result.folders.find((folder) => folder.id === "reading").parentId, null);
  assert.equal(result.notes.find((item) => item.id === "root").folderId, null);
  assert.equal(result.notes.find((item) => item.id === "nested").folderId, "reading");
});

test("Markdown text is searchable and task items can be toggled", () => {
  assert.equal(
    markdownToPlainText("## Heading\n\n- [ ] **Bold** task\n- [x] Done"),
    "Heading Bold task Done",
  );
  assert.equal(
    toggleTaskAtIndex("- [ ] first\n- [x] second", 0),
    "- [x] first\n- [x] second",
  );
  assert.equal(
    toggleTaskAtIndex("- [ ] first\n- [x] second", 1),
    "- [ ] first\n- [ ] second",
  );
});

test("backups validate notes, folders, and settings", () => {
  const backup = buildBackup(notes, folders, {
    trashRetentionDays: 90,
    lastBackupAt: 123,
  });
  const result = validateBackup(JSON.stringify(backup));

  assert.equal(result.ok, true);
  assert.equal(result.data.notes.length, 4);
  assert.equal(result.data.folders.length, 3);
  assert.equal(result.data.settings.trashRetentionDays, 90);
  assert.equal(result.summary.trashed, 1);

  const invalid = validateBackup("{not json");
  assert.equal(invalid.ok, false);

  const missing = validateBackup(JSON.stringify({ hello: "world" }));
  assert.equal(missing.ok, false);
});

test("imports repair invalid folder references and duplicate note ids", () => {
  const payload = {
    notes: [
      { id: "one", title: "One", folderId: "missing" },
      { id: "one", title: "Duplicate" },
    ],
    folders: [{ id: "valid", name: "Valid", parentId: "valid" }],
    settings: { trashRetentionDays: 12 },
  };
  const result = validateBackup(JSON.stringify(payload));

  assert.equal(result.ok, true);
  assert.equal(result.data.notes.length, 1);
  assert.equal(result.data.notes[0].folderId, null);
  assert.equal(result.data.folders[0].parentId, null);
  assert.equal(result.data.settings.trashRetentionDays, 30);
});

test("legacy note arrays are accepted and expired Trash items are purged", () => {
  const legacy = validateBackup(JSON.stringify([{ id: "legacy", title: "Legacy" }]));
  assert.equal(legacy.ok, true);
  assert.equal(legacy.data.notes.length, 1);
  assert.equal(legacy.data.folders.length, 0);

  const now = 10 * 24 * 60 * 60 * 1000;
  const purged = purgeExpiredTrash(
    [
      note("old", "Old", null, { deletedAt: 1 }),
      note("new", "New", null, { deletedAt: now - 2 * 24 * 60 * 60 * 1000 }),
      note("active", "Active"),
    ],
    7,
    now,
  );
  assert.deepEqual(
    purged.map((item) => item.id).sort(),
    ["active", "new"],
  );
});
