import assert from "node:assert/strict";
import test from "node:test";
import {
  findDailyNote,
  formatDailyTitle,
  getLocalDateKey,
  makeDailyNote,
  parseLocalDateKey,
  shiftDateKey,
} from "../src/lib/daily.js";
import {
  cloneDefaultTemplates,
  createNoteFromTemplate,
  DEFAULT_TEMPLATES,
  renderTemplateText,
} from "../src/lib/templates.js";

function note(id, title, extra = {}) {
  return {
    id,
    title,
    content: "",
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

test("daily date keys use local calendar boundaries", () => {
  assert.equal(getLocalDateKey(new Date(2026, 9, 28, 23, 59, 59)), "2026-10-28");
  assert.equal(getLocalDateKey(new Date(2026, 9, 29, 0, 0, 1)), "2026-10-29");
  assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(parseLocalDateKey("not-a-date"), null);
});

test("daily titles are configurable and local", () => {
  assert.equal(formatDailyTitle("2026-10-28", "iso"), "2026-10-28");
  assert.match(formatDailyTitle("2026-10-28", "long"), /October 28, 2026/);
  assert.match(formatDailyTitle("2026-10-28", "weekday"), /Wednesday/);
});

test("daily note lookup prevents duplicates and includes trashed notes", () => {
  const active = note("one", "2026-10-28", { dailyDate: "2026-10-28" });
  const trashed = note("two", "Old", { dailyDate: "2026-10-28", deletedAt: 5 });
  const other = note("three", "Other", { dailyDate: "2026-10-27" });
  assert.equal(findDailyNote([active, trashed, other], "2026-10-28").id, "one");
  assert.equal(findDailyNote([trashed, other], "2026-10-28").id, "two");
  assert.equal(findDailyNote([active, other], "2026-10-29"), null);
  assert.equal(makeDailyNote({ dateKey: "2026-10-28", title: "Today" }).dailyDate, "2026-10-28");
});

test("starter templates include the required set", () => {
  const names = DEFAULT_TEMPLATES.map((template) => template.name);
  for (const expected of [
    "Study notes",
    "Meeting notes",
    "Project planning",
    "Daily journal",
    "Reading notes",
    "General note",
  ]) {
    assert.ok(names.includes(expected));
  }
  assert.ok(cloneDefaultTemplates().every((template) => template.builtin));
});

test("template tokens render and create independent notes", () => {
  const template = cloneDefaultTemplates().find((item) => item.id === "template-meeting");
  const date = new Date(2026, 9, 28, 9, 30);
  const rendered = renderTemplateText("{{weekday}} {{date}} {{time}}", {
    date,
    dateKey: "2026-10-28",
  });
  assert.match(rendered, /Wednesday/);
  assert.match(rendered, /October 28, 2026/);

  const first = createNoteFromTemplate(template, { date, dateKey: "2026-10-28" });
  const second = createNoteFromTemplate(template, { date, dateKey: "2026-10-28" });
  assert.notEqual(first.id, second.id);
  assert.deepEqual(first.tags, ["meeting"]);
  assert.match(first.content, /## Agenda/);
});
