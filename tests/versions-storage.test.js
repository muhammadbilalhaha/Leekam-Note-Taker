import assert from "node:assert/strict";
import test from "node:test";
import { buildBackup, validateBackup } from "../src/lib/backup.js";
import { defaultKnowledge } from "../src/lib/knowledge.js";
import { getBackupReminder, writeJson } from "../src/lib/storage.js";
import {
  addVersion,
  diffLines,
  parseVersions,
  pruneVersions,
  removeVersionsForNotes,
  shouldSnapshot,
} from "../src/lib/versions.js";

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
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  };
}

test("version snapshots avoid duplicates and respect intervals", () => {
  const current = note("a", "A", "First draft");
  let versions = {};
  assert.equal(shouldSnapshot(current, versions, now), true);
  versions = addVersion(versions, current, { now });
  assert.equal(versions.a.length, 1);
  assert.equal(shouldSnapshot({ ...current, content: "Second draft" }, versions, now + 1000), false);
  assert.equal(
    shouldSnapshot({ ...current, content: "Second draft" }, versions, now + 5 * 60 * 1000),
    true,
  );
  const forced = addVersion(versions, { ...current, content: "Second draft" }, {
    now: now + 1000,
    force: true,
  });
  assert.equal(forced.a.length, 2);
  assert.equal(forced.a[0].content, "Second draft");
  assert.equal(shouldSnapshot(note("blank", "", ""), versions, now), false);
});

test("version retention and note deletion prune snapshots", () => {
  let versions = {};
  for (let index = 0; index < 5; index += 1) {
    versions = addVersion(versions, note("a", "A", `Version ${index}`), {
      force: true,
      now: now + index * 1000,
      limit: 3,
    });
  }
  assert.equal(versions.a.length, 3);
  assert.equal(versions.a[0].content, "Version 4");
  assert.deepEqual(pruneVersions(versions, [note("a", "A")], 3), versions);
  assert.deepEqual(removeVersionsForNotes(versions, ["a"]), {});
});

test("version parsing validates snapshots and diffing shows changes", () => {
  const parsed = parseVersions({
    a: [
      { id: "v1", title: "A", content: "one\ntwo", createdAt: 1 },
      { id: "v1", title: "duplicate", content: "ignored", createdAt: 2 },
      { id: "v2", title: "A", content: "one\nthree", createdAt: 3 },
    ],
  });
  assert.equal(parsed.a.length, 2);
  const diff = diffLines("one\ntwo", "one\nthree");
  assert.deepEqual(
    diff.map((line) => `${line.type}:${line.text}`),
    ["same:one", "removed:two", "added:three"],
  );
});

test("backup v2 includes knowledge and versions while legacy backups still load", () => {
  const notes = [note("a", "A", "[[B]]")];
  const folders = [];
  const settings = {
    trashRetentionDays: 30,
    lastBackupAt: null,
    versionLimit: 20,
    storageWarningPercent: 80,
    backupReminderDays: 14,
    dailyTitleFormat: "iso",
    dailyTemplateId: "template-daily",
    dailyFolderId: null,
    dashboardSections: {},
  };
  const knowledge = defaultKnowledge();
  const versions = { a: [{ id: "v1", title: "A", content: "old", createdAt: 1 }] };
  const backup = buildBackup(notes, folders, settings, knowledge, versions);
  assert.equal(backup.version, 2);
  assert.equal(backup.knowledge.templates.length, 6);
  const validated = validateBackup(JSON.stringify(backup));
  assert.equal(validated.ok, true);
  assert.equal(validated.data.knowledge.templates.length, 6);
  assert.equal(validated.data.versions.a.length, 1);

  const legacy = validateBackup(JSON.stringify(notes));
  assert.equal(legacy.ok, true);
  assert.equal(legacy.data.knowledge.templates.length, 6);
  assert.deepEqual(legacy.data.versions, {});
});

test("storage writes report quota failures without throwing", () => {
  const storage = {
    setItem() {
      const error = new Error("full");
      error.name = "QuotaExceededError";
      throw error;
    },
  };
  const result = writeJson("key", { value: 1 }, storage);
  assert.equal(result.ok, false);
  assert.equal(result.quota, true);
  assert.match(result.error, /full/i);
});

test("backup reminders become due based on the configured interval", () => {
  assert.equal(getBackupReminder({ backupReminderDays: 14, lastBackupAt: null }, [], now), null);
  const noBackup = getBackupReminder(
    { backupReminderDays: 14, lastBackupAt: null },
    [note("a", "A")],
    now,
  );
  assert.equal(noBackup.due, true);
  assert.equal(
    getBackupReminder(
      { backupReminderDays: 14, lastBackupAt: now - 15 * DAY },
      [note("a", "A")],
      now,
    ).days,
    15,
  );
  assert.equal(
    getBackupReminder(
      { backupReminderDays: 14, lastBackupAt: now - 2 * DAY },
      [note("a", "A")],
      now,
    ),
    null,
  );
});
