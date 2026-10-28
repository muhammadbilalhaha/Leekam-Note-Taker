import { getFolderDescendantIds } from "./folders.js";
import { buildLinkIndex, getActiveLinkTargets } from "./links.js";
import { markdownToPlainText } from "./markdown.js";

export const STORAGE_KEY = "leekam.notes.v1";
export const THEME_KEY = "leekam.theme";

export const NOTE_COLORS = [
  { id: "sage", value: "#4e8a70", label: "Sage" },
  { id: "ocean", value: "#517fa6", label: "Ocean" },
  { id: "amber", value: "#c18a3e", label: "Amber" },
  { id: "rose", value: "#bf6f7d", label: "Rose" },
  { id: "violet", value: "#826cae", label: "Violet" },
  { id: "stone", value: "#77827b", label: "Stone" },
];

const DEFAULT_COLOR = NOTE_COLORS[0].id;

export function getAccent(colorId) {
  return (NOTE_COLORS.find((color) => color.id === colorId) ?? NOTE_COLORS[0]).value;
}

export function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeNote(initial = {}) {
  const now = Date.now();
  return {
    id: makeId(),
    title: "",
    content: "",
    tags: [],
    color: DEFAULT_COLOR,
    pinned: false,
    favorite: false,
    folderId: null,
    dailyDate: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...initial,
  };
}

function createSeedNotes() {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  return [
    {
      id: "seed-welcome",
      title: "Welcome to Leekam",
      content: `This is your quiet corner for thoughts, lists, and half-formed ideas.

Everything you write stays in this browser — no account, no cloud, no database. Close the tab and your notes will be right here when you return.

## A few things to try

- Press **Ctrl + K** (or **⌘K**) to search everything — titles, content, tags, folders, and views.
- Pin a note to keep it at the top.
- Add **tags** for flexible organisation, or create **folders** when you want structure.
- Switch to **Preview** or **Split** in the editor to see your Markdown take shape.
- Tick task checkboxes right inside the preview.

That's it. Make yourself at home.`,
      tags: ["welcome"],
      color: "sage",
      pinned: true,
      createdAt: now - hour * 30,
      updatedAt: now - hour * 2,
    },
    {
      id: "seed-week",
      title: "Small rituals for a clearer week",
      content:
        "Monday — choose three things that would make the week feel complete.\n\nWednesday — take a proper walk without a podcast. Let the thoughts arrive on their own.\n\nFriday — close the loop on open tabs, loose ends, and anything still living in my head.\n\nA quieter week is usually a smaller week.",
      tags: ["personal", "rituals"],
      color: "ocean",
      pinned: false,
      createdAt: now - hour * 52,
      updatedAt: now - hour * 7,
    },
    {
      id: "seed-ideas",
      title: "Ideas worth keeping",
      content:
        "A reading app that shows one page at a time and nothing else.\n\nA weekly review template that fits on a single index card.\n\nA tiny tool that turns any walk into a map of things noticed: the blue door, the bakery smell, the dog waiting outside the post office.\n\nKeep the ideas small enough to start.",
      tags: ["ideas"],
      color: "amber",
      pinned: false,
      createdAt: now - hour * 74,
      updatedAt: now - hour * 26,
    },
    {
      id: "seed-books",
      title: "Books to revisit",
      content:
        "The Creative Act — Rick Rubin\n\nA Field Guide to Getting Lost — Rebecca Solnit\n\nBird by Bird — Anne Lamott\n\nNotes on re-reading: leave a little room in the margin for the person you were the first time.",
      tags: ["reading", "personal"],
      color: "rose",
      pinned: false,
      createdAt: now - hour * 100,
      updatedAt: now - hour * 45,
    },
  ].map((note) => ({
    ...note,
    folderId: null,
    dailyDate: null,
    favorite: false,
    deletedAt: null,
  }));
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

export function normalizeTag(value) {
  return value
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .toLowerCase()
    .slice(0, 28);
}

export function parseNotes(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    return parsed
      .filter((note) => note && typeof note === "object" && typeof note.id === "string")
      .map((note) => {
        const createdAt = Number(note.createdAt);
        const updatedAt = Number(note.updatedAt);
        const deletedAt = Number(note.deletedAt);
        return {
          id: note.id,
          title: typeof note.title === "string" ? note.title : "",
          content: typeof note.content === "string" ? note.content : "",
          tags: cleanTags(note.tags),
          color: NOTE_COLORS.some((color) => color.id === note.color) ? note.color : DEFAULT_COLOR,
          pinned: Boolean(note.pinned),
          favorite: Boolean(note.favorite),
          folderId: typeof note.folderId === "string" && note.folderId ? note.folderId : null,
          dailyDate:
            typeof note.dailyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(note.dailyDate)
              ? note.dailyDate
              : null,
          deletedAt: Number.isFinite(deletedAt) && deletedAt > 0 ? deletedAt : null,
          createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
          updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        };
      });
  } catch {
    return null;
  }
}

export function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return createSeedNotes();
    return parseNotes(raw) ?? createSeedNotes();
  } catch {
    return createSeedNotes();
  }
}

export function saveNotes(notes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

export function getFilterTitle(filter, folders = []) {
  if (filter.type === "pinned") return "Pinned";
  if (filter.type === "favorites") return "Favorites";
  if (filter.type === "tag") return `#${filter.tag}`;
  if (filter.type === "trash") return "Trash";
  if (filter.type === "graph") return "Knowledge graph";
  if (filter.type === "dashboard") return "Home";
  if (filter.type === "folder") {
    return folders.find((folder) => folder.id === filter.folderId)?.name ?? "Folder";
  }
  return "All notes";
}

export function getVisibleNotes(notes, filter, query = "", folderIds = null) {
  const search = query.trim().toLowerCase();
  const isTrash = filter.type === "trash";

  const filtered = notes.filter((note) => {
    if (isTrash) {
      if (!note.deletedAt) return false;
    } else {
      if (note.deletedAt) return false;
      if (filter.type === "pinned" && !note.pinned) return false;
      if (filter.type === "favorites" && !note.favorite) return false;
      if (filter.type === "tag" && !note.tags.includes(filter.tag)) return false;
      if (filter.type === "folder" && !folderIds?.has(note.folderId)) return false;
    }

    if (!search) return true;
    return (
      note.title.toLowerCase().includes(search) ||
      markdownToPlainText(note.content).toLowerCase().includes(search) ||
      note.tags.some((tag) => tag.includes(search))
    );
  });

  return filtered.sort((a, b) => {
    if (isTrash) return b.deletedAt - a.deletedAt || b.updatedAt - a.updatedAt;
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function getTagSummary(notes) {
  const counts = new Map();
  notes.forEach((note) => {
    if (note.deletedAt) return;
    note.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const SEARCH_VIEWS = [
  {
    id: "all",
    title: "All notes",
    description: "Browse every note in your library",
    keywords: "home library everything all notes",
  },
  {
    id: "pinned",
    title: "Pinned notes",
    description: "The notes you keep close at hand",
    keywords: "pin pinned keep close",
  },
  {
    id: "favorites",
    title: "Favorites",
    description: "Notes you have starred for the long term",
    keywords: "favorite favorites favourite favourites starred saved",
  },
  {
    id: "trash",
    title: "Trash",
    description: "Notes you deleted, kept recoverable",
    keywords: "trash deleted bin recycle recover removed",
  },
  {
    id: "graph",
    title: "Knowledge graph",
    description: "Explore how your notes connect",
    keywords: "graph network connections links map",
  },
  {
    id: "dashboard",
    title: "Home",
    description: "Recent notes, favorites, and knowledge health",
    keywords: "home dashboard overview recent",
  },
];

const searchableNoteCache = new WeakMap();

function getSearchableNote(note) {
  const cached = searchableNoteCache.get(note);
  if (cached) return cached;

  const plainContent = markdownToPlainText(note.content);
  const searchable = {
    title: note.title.toLowerCase(),
    content: plainContent.toLowerCase(),
    plainContent,
  };
  searchableNoteCache.set(note, searchable);
  return searchable;
}

export function getMatchSnippet(text, query, radius = 64) {
  const clean = text.replace(/\s+/g, " ").trim();
  const term = query.trim().toLowerCase();
  if (!clean) return "";

  const index = clean.toLowerCase().indexOf(term);
  if (!term || index === -1) return excerpt(clean, 145);

  const start = Math.max(0, index - radius);
  const end = Math.min(clean.length, index + term.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";

  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

const EMPTY_SEARCH = { notes: [], folders: [], tags: [], views: [], total: 0 };

function parseUpdatedDays(value) {
  const clean = value.toLowerCase();
  if (clean === "today") return 1;
  if (clean === "week") return 7;
  if (clean === "month") return 30;
  if (clean === "year") return 365;
  const match = /^(\d+)(d|w|m|y)$/.exec(clean);
  if (!match) return null;
  const amount = Number(match[1]);
  const multiplier = match[2] === "d" ? 1 : match[2] === "w" ? 7 : match[2] === "m" ? 30 : 365;
  return amount * multiplier;
}

export function parseSearchQuery(query) {
  const raw = String(query ?? "").trim();
  const filters = {
    tags: [],
    folders: [],
    is: [],
    has: [],
    updatedDays: null,
    scope: "active",
  };
  const invalidFilters = [];
  const freeText = [];

  if (!raw) return { raw, term: "", filters, invalidFilters, filterChips: [] };

  const tokens = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];
  tokens.forEach((token) => {
    const match = /^(tag|folder|is|updated|has|in):(.*)$/i.exec(token);
    if (!match) {
      freeText.push(token.replace(/^"|"$/g, ""));
      return;
    }

    const key = match[1].toLowerCase();
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1).trim();
    }
    if (!value) {
      invalidFilters.push(token);
      return;
    }

    if (key === "tag") {
      const tag = normalizeTag(value);
      if (tag) filters.tags.push(tag);
      else invalidFilters.push(token);
    } else if (key === "folder") {
      filters.folders.push(value.toLowerCase());
    } else if (key === "updated") {
      const days = parseUpdatedDays(value);
      if (days === null) invalidFilters.push(token);
      else filters.updatedDays = days;
    } else if (key === "has") {
      const flag = value.toLowerCase();
      if (flag === "links" || flag === "backlinks") filters.has.push(flag);
      else invalidFilters.push(token);
    } else if (key === "in") {
      const scope = value.toLowerCase();
      if (scope === "trash" || scope === "all" || scope === "active") filters.scope = scope;
      else invalidFilters.push(token);
    } else if (key === "is") {
      const flag = value.toLowerCase();
      if (flag === "pinned") filters.is.push("pinned");
      else if (flag === "favorite" || flag === "favorites" || flag === "starred")
        filters.is.push("favorite");
      else if (flag === "trash") {
        filters.is.push("trash");
        filters.scope = "trash";
      } else if (flag === "isolated") filters.is.push("isolated");
      else invalidFilters.push(token);
    }
  });

  const term = freeText.join(" ").trim().toLowerCase();
  const filterChips = [];
  filters.tags.forEach((tag) => filterChips.push({ kind: "tag", label: `#${tag}` }));
  filters.folders.forEach((folder) =>
    filterChips.push({ kind: "folder", label: `Folder: ${folder}` }),
  );
  if (filters.is.includes("pinned")) filterChips.push({ kind: "is", label: "Pinned" });
  if (filters.is.includes("favorite")) filterChips.push({ kind: "is", label: "Favorite" });
  if (filters.is.includes("isolated")) filterChips.push({ kind: "is", label: "Isolated" });
  if (filters.updatedDays !== null)
    filterChips.push({ kind: "updated", label: `Updated ≤ ${filters.updatedDays}d` });
  filters.has.forEach((flag) =>
    filterChips.push({ kind: "has", label: flag === "links" ? "Has links" : "Has backlinks" }),
  );
  if (filters.scope === "trash") filterChips.push({ kind: "scope", label: "In Trash" });
  if (filters.scope === "all") filterChips.push({ kind: "scope", label: "Including Trash" });

  return { raw, term, filters, invalidFilters, filterChips };
}

function resolveFolderFilterIds(folders, values) {
  const ids = new Set();
  let missing = false;
  values.forEach((value) => {
    const exact = folders.filter(
      (folder) =>
        folder.id === value || folder.name.toLowerCase() === value.toLowerCase(),
    );
    const matches =
      exact.length > 0
        ? exact
        : folders.filter((folder) => folder.name.toLowerCase().includes(value));
    if (matches.length === 0) missing = true;
    matches.forEach((folder) => {
      getFolderDescendantIds(folders, folder.id).forEach((id) => ids.add(id));
    });
  });
  return { ids, missing };
}

/**
 * Searches every note field plus the library's folders, tags, and views.
 * Matching is case-insensitive and uses plain substring matching, so a
 * query like "rate" still finds "Generate" and "corporate".
 *
 * Optional filters use the same field: `tag:work folder:Projects is:pinned
 * updated:7d has:links has:backlinks in:trash`.
 */
export function getGlobalSearchResults(notes, query, folders = [], options = {}) {
  const parsed = parseSearchQuery(query);
  if (!parsed.raw) return { ...EMPTY_SEARCH };

  const { term, filters, invalidFilters, filterChips } = parsed;
  if (invalidFilters.length > 0) {
    return {
      ...EMPTY_SEARCH,
      term,
      filters,
      filterChips,
      invalidFilters,
    };
  }

  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const needsLinks = filters.has.length > 0 || filters.is.includes("isolated");
  const linkIndex =
    options.linkIndex ?? (needsLinks ? buildLinkIndex(notes) : null);
  const linkedIds = linkIndex ? getActiveLinkTargets(linkIndex) : null;
  const activeNotes = notes.filter((note) => !note.deletedAt);
  const folderFilter = resolveFolderFilterIds(folders, filters.folders);
  const scopeNotes = notes.filter((note) => {
    if (filters.scope === "trash") return Boolean(note.deletedAt);
    if (filters.scope === "all") return true;
    return !note.deletedAt;
  });

  const noteResults = [];
  scopeNotes.forEach((note) => {
    if (filters.tags.length > 0 && !filters.tags.every((tag) => note.tags.includes(tag))) return;
    if (filters.folders.length > 0) {
      if (folderFilter.missing || !note.folderId || !folderFilter.ids.has(note.folderId)) return;
    }
    if (filters.is.includes("pinned") && !note.pinned) return;
    if (filters.is.includes("favorite") && !note.favorite) return;
    if (filters.is.includes("trash") && !note.deletedAt) return;
    if (filters.is.includes("isolated") && linkedIds?.has(note.id)) return;
    if (
      filters.updatedDays !== null &&
      note.updatedAt < now - filters.updatedDays * 24 * 60 * 60 * 1000
    )
      return;
    if (filters.has.includes("links") && !(linkIndex?.outgoing.get(note.id)?.length > 0)) return;
    if (filters.has.includes("backlinks") && !(linkIndex?.backlinks.get(note.id)?.length > 0))
      return;

    const searchable = getSearchableNote(note);
    const matchingTags = term ? note.tags.filter((tag) => tag.includes(term)) : [];
    const titleIndex = term ? searchable.title.indexOf(term) : -1;
    const contentIndex = term ? searchable.content.indexOf(term) : -1;

    if (term && titleIndex === -1 && contentIndex === -1 && matchingTags.length === 0) return;

    const match = !term
      ? "filter"
      : titleIndex !== -1
        ? "title"
        : matchingTags.length > 0
          ? "tag"
          : "content";
    let snippet = excerpt(searchable.plainContent, 145);
    if (contentIndex !== -1) {
      snippet = getMatchSnippet(searchable.plainContent, term);
    } else if (!snippet && matchingTags.length > 0) {
      snippet = `Tagged #${matchingTags[0]}`;
    }

    noteResults.push({
      note,
      match,
      matchingTags,
      snippet,
      score: match === "title" ? 0 : match === "tag" ? 1 : match === "content" ? 2 : 3,
    });
  });

  noteResults.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.note.pinned !== b.note.pinned) return a.note.pinned ? -1 : 1;
    return b.note.updatedAt - a.note.updatedAt;
  });

  const includeGroups = filters.scope === "active" && Boolean(term);
  const folderResults = includeGroups
    ? folders
        .filter((folder) => folder.name.toLowerCase().includes(term))
        .map((folder) => {
          const ids = getFolderDescendantIds(folders, folder.id);
          const count = activeNotes.filter((note) => ids.has(note.folderId)).length;
          return { ...folder, count };
        })
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    : [];

  const tags = includeGroups
    ? getTagSummary(activeNotes).filter((tag) => tag.name.includes(term))
    : [];

  const views = includeGroups
    ? SEARCH_VIEWS.filter((view) =>
        [view.title, view.description, view.keywords].some((value) =>
          value.toLowerCase().includes(term),
        ),
      )
    : [];

  return {
    notes: noteResults,
    folders: folderResults,
    tags,
    views,
    total: noteResults.length + folderResults.length + tags.length + views.length,
    term,
    filters,
    filterChips,
    invalidFilters,
    scope: filters.scope,
  };
}

export function excerpt(text, length = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > length ? `${clean.slice(0, length).trimEnd()}…` : clean;
}

export function countWords(text) {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatCardDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) return "Just now";
  if (diff < 60 * 60 * 1000) return `${Math.max(1, Math.floor(diff / (60 * 1000)))}m`;

  if (isSameDay(date, now)) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatEditedAt(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) return "Edited just now";
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(diff / (60 * 1000)));
    return `Edited ${minutes} min ago`;
  }

  if (isSameDay(date, now)) {
    return `Edited today at ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Edited yesterday";

  return `Edited ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  })}`;
}

export function isMacPlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}
