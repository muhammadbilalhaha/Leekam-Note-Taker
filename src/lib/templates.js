import { makeNote, normalizeTag } from "./notes.js";

export const DAILY_TEMPLATE_ID = "template-daily";

export const DEFAULT_TEMPLATES = [
  {
    id: "template-study",
    name: "Study notes",
    description: "Capture a topic, key ideas, and questions to revisit.",
    titleTemplate: "Study notes — {{date}}",
    content: `## Topic

## Key ideas

-

## Questions to revisit

- [ ]

## Summary

`,
    defaultTags: ["study"],
    defaultFolderId: null,
    builtin: true,
  },
  {
    id: "template-meeting",
    name: "Meeting notes",
    description: "Agenda, decisions, and follow-up tasks.",
    titleTemplate: "Meeting notes — {{date}}",
    content: `## Attendees

## Agenda

-

## Decisions

-

## Follow-up

- [ ]

`,
    defaultTags: ["meeting"],
    defaultFolderId: null,
    builtin: true,
  },
  {
    id: "template-project",
    name: "Project planning",
    description: "Define an outcome, milestones, risks, and next actions.",
    titleTemplate: "Project plan — {{date}}",
    content: `## Outcome

## Milestones

- [ ]

## Risks

-

## Next actions

- [ ]

`,
    defaultTags: ["project"],
    defaultFolderId: null,
    builtin: true,
  },
  {
    id: DAILY_TEMPLATE_ID,
    name: "Daily journal",
    description: "A calm daily page for focus, notes, and reflection.",
    titleTemplate: "{{date}}",
    content: `## Focus

- [ ]

## Notes

## Grateful for

-

## Tomorrow

-
`,
    defaultTags: ["journal"],
    defaultFolderId: null,
    builtin: true,
  },
  {
    id: "template-reading",
    name: "Reading notes",
    description: "Keep the useful parts of a book or article close.",
    titleTemplate: "Reading notes — {{date}}",
    content: `## Source

## Key passages

>

## Ideas to keep

-

## Related notes

- [[ ]]
`,
    defaultTags: ["reading"],
    defaultFolderId: null,
    builtin: true,
  },
  {
    id: "template-general",
    name: "General note",
    description: "A blank page with a little structure.",
    titleTemplate: "",
    content: `## Notes

`,
    defaultTags: [],
    defaultFolderId: null,
    builtin: true,
  },
];

function cleanText(value, max = 20000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  return tags
    .filter((tag) => typeof tag === "string")
    .map(normalizeTag)
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

export function makeTemplate(initial = {}) {
  const now = Date.now();
  return {
    id: `template-${now}-${Math.random().toString(16).slice(2)}`,
    name: "Untitled template",
    description: "",
    titleTemplate: "",
    content: "",
    defaultTags: [],
    defaultFolderId: null,
    builtin: false,
    createdAt: now,
    updatedAt: now,
    ...initial,
  };
}

export function parseTemplates(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  return value
    .filter((template) => template && typeof template === "object")
    .map((template) => {
      const name = cleanText(template.name, 80).trim();
      if (!name) return null;
      const id =
        typeof template.id === "string" && template.id && !seen.has(template.id)
          ? template.id
          : makeTemplate().id;
      if (seen.has(id)) return null;
      seen.add(id);
      const createdAt = Number(template.createdAt);
      const updatedAt = Number(template.updatedAt);
      return {
        id,
        name,
        description: cleanText(template.description, 240).trim(),
        titleTemplate: cleanText(template.titleTemplate, 180),
        content: cleanText(template.content),
        defaultTags: cleanTags(template.defaultTags),
        defaultFolderId:
          typeof template.defaultFolderId === "string" && template.defaultFolderId
            ? template.defaultFolderId
            : null,
        builtin: Boolean(template.builtin),
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      };
    })
    .filter(Boolean);
}

export function cloneDefaultTemplates() {
  return DEFAULT_TEMPLATES.map((template) => ({
    ...template,
    defaultTags: [...template.defaultTags],
  }));
}

export function renderTemplateText(text, context = {}) {
  const now = context.date instanceof Date ? context.date : new Date();
  const dateKey = context.dateKey ?? localDateKey(now);
  const replacements = {
    date: now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    date_key: dateKey,
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
    month: now.toLocaleDateString("en-US", { month: "long" }),
    year: String(now.getFullYear()),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    title: context.title ?? "",
  };

  return String(text ?? "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
    const value = replacements[key.toLowerCase()];
    return value === undefined ? match : value;
  });
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function createNoteFromTemplate(template, context = {}) {
  if (!template) return null;
  const now = context.date instanceof Date ? context.date : new Date();
  const dateKey = context.dateKey ?? localDateKey(now);
  const renderedTitle = renderTemplateText(template.titleTemplate, { ...context, now, dateKey }).trim();
  return makeNote({
    title: renderedTitle,
    content: renderTemplateText(template.content, { ...context, title: renderedTitle, dateKey }),
    tags: template.defaultTags ?? [],
    folderId: template.defaultFolderId ?? null,
    ...(context.color ? { color: context.color } : {}),
  });
}
