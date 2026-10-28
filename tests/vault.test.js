import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVaultFiles,
  buildVaultImport,
  parseFrontMatter,
  parseVaultFile,
} from "../src/lib/vault.js";
import { createZip } from "../src/lib/zip.js";

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
    createdAt: Date.UTC(2026, 9, 1),
    updatedAt: Date.UTC(2026, 9, 2),
    ...extra,
  };
}

const folders = [
  { id: "work", name: "Work", parentId: null, createdAt: 1 },
  { id: "ccna", name: "CCNA", parentId: "work", createdAt: 2 },
];

const notes = [
  note("a", "Routing basics", "See [[Subnetting]].", {
    tags: ["networking"],
    folderId: "ccna",
    favorite: true,
  }),
  note("b", "Subnetting", "Masks.", { tags: ["networking"], folderId: "work" }),
  note("c", "Routing basics", "Duplicate title.", { folderId: "ccna" }),
];

test("vault export preserves folders, metadata, and unique filenames", () => {
  const files = buildVaultFiles(notes, folders);
  assert.equal(files.length, 3);
  const routing = files.find((file) => file.content.includes('leekam-id: "a"'));
  assert.equal(routing.path, "Work/CCNA/Routing basics.md");
  assert.match(routing.content, /tags: \["networking"\]/);
  assert.match(routing.content, /favorite: true/);
  assert.ok(files.some((file) => file.path === "Work/Subnetting.md"));
  assert.equal(new Set(files.map((file) => file.path)).size, files.length);
});

test("front matter and imported files parse title, tags, and folders", () => {
  const parsed = parseFrontMatter('---\ntitle: "Hello"\ntags: ["one", "two"]\n---\nBody');
  assert.equal(parsed.metadata.title, "Hello");
  assert.deepEqual(parsed.metadata.tags, ["one", "two"]);
  assert.equal(parsed.content, "Body");

  const file = parseVaultFile({
    path: "Work/CCNA/Networking.md",
    content: '---\ntags: ["ccna"]\nfavorite: true\n---\n# Networking\n\nOSPF',
  });
  assert.equal(file.ok, true);
  assert.equal(file.file.title, "Networking");
  assert.deepEqual(file.file.tags, ["ccna"]);
  assert.deepEqual(file.file.folderSegments, ["Work", "CCNA"]);
  assert.equal(file.file.favorite, true);
});

test("merge import reuses folders, repairs duplicate IDs, and remaps links", () => {
  const files = [
    {
      path: "Work/CCNA/Routing basics.md",
      content:
        '---\nleekam-id: "a"\ntitle: "Routing basics"\ntags: ["networking"]\n---\nSee [[Subnetting|b]].',
    },
    {
      path: "Work/Subnetting.md",
      content:
        '---\nleekam-id: "b"\ntitle: "Subnetting"\n---\nSee [[Routing basics|a]].',
    },
  ];
  const result = buildVaultImport(files, [note("a", "Existing")], folders, { mode: "merge" });
  assert.equal(result.notes.length, 3);
  assert.equal(result.summary.duplicateIds, 1);
  assert.ok(result.folders.some((folder) => folder.id === "ccna"));
  const importedRouting = result.importedNotes.find((item) => item.title === "Routing basics");
  const importedSubnetting = result.importedNotes.find((item) => item.title === "Subnetting");
  assert.notEqual(importedRouting.id, "a");
  assert.match(importedRouting.content, new RegExp(importedSubnetting.id));
  assert.match(importedSubnetting.content, new RegExp(importedRouting.id));
});

test("replace import produces only the Markdown vault", () => {
  const result = buildVaultImport(
    [
      {
        path: "Personal/Journal.md",
        content: "# Journal\n\nToday",
      },
    ],
    [note("old", "Old")],
    folders,
    { mode: "replace" },
  );
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0].title, "Journal");
  assert.equal(result.folders.length, 1);
  assert.equal(result.folders[0].name, "Personal");
  assert.equal(result.notes[0].folderId, result.folders[0].id);
});

test("ZIP archive is store-only and contains vault paths", () => {
  const files = buildVaultFiles(notes, folders);
  const bytes = createZip(files, new Date(2026, 9, 28));
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.includes("Work/CCNA/Routing basics.md"));
  assert.ok(text.includes("leekam-id"));
});
