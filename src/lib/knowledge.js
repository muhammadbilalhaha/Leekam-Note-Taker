import { cloneDefaultTemplates, parseTemplates } from "./templates.js";

export const KNOWLEDGE_KEY = "leekam.knowledge.v1";
export const RECENT_LIMIT = 40;

function makeSavedSearchId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `search-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeSavedSearch({ name, query } = {}) {
  const now = Date.now();
  return {
    id: makeSavedSearchId(),
    name: String(name ?? "").trim().slice(0, 80) || "Saved search",
    query: String(query ?? "").trim().slice(0, 500),
    createdAt: now,
    updatedAt: now,
  };
}

export function parseSavedSearches(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .filter((search) => search && typeof search === "object")
    .map((search) => {
      const name = String(search.name ?? "").trim().slice(0, 80);
      const query = String(search.query ?? "").trim().slice(0, 500);
      if (!name || !query) return null;
      let id =
        typeof search.id === "string" && search.id && !seen.has(search.id)
          ? search.id
          : makeSavedSearchId();
      if (seen.has(id)) id = makeSavedSearchId();
      seen.add(id);
      const createdAt = Number(search.createdAt);
      const updatedAt = Number(search.updatedAt);
      return {
        id,
        name,
        query,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
      };
    })
    .filter(Boolean);
}

export function parseRecent(value) {
  if (!Array.isArray(value)) return [];
  const byId = new Map();
  value.forEach((entry) => {
    if (!entry || typeof entry !== "object" || typeof entry.noteId !== "string") return;
    const openedAt = Number(entry.openedAt);
    if (!Number.isFinite(openedAt) || openedAt <= 0) return;
    const current = byId.get(entry.noteId);
    if (!current || current.openedAt < openedAt) {
      byId.set(entry.noteId, { noteId: entry.noteId, openedAt });
    }
  });
  return [...byId.values()]
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, RECENT_LIMIT);
}

export function defaultKnowledge() {
  return {
    templates: cloneDefaultTemplates(),
    savedSearches: [],
    recent: [],
  };
}

export function parseKnowledge(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const templates = parseTemplates(parsed.templates);
    return {
      templates: templates ?? cloneDefaultTemplates(),
      savedSearches: parseSavedSearches(parsed.savedSearches),
      recent: parseRecent(parsed.recent),
    };
  } catch {
    return null;
  }
}

export function loadKnowledge() {
  try {
    const raw = localStorage.getItem(KNOWLEDGE_KEY);
    if (raw === null) return defaultKnowledge();
    return parseKnowledge(raw) ?? defaultKnowledge();
  } catch {
    return defaultKnowledge();
  }
}

export function saveKnowledge(knowledge) {
  try {
    localStorage.setItem(KNOWLEDGE_KEY, JSON.stringify(knowledge));
    return true;
  } catch {
    return false;
  }
}

export function addRecentNote(recent, noteId, openedAt = Date.now()) {
  return [
    { noteId, openedAt },
    ...recent.filter((entry) => entry.noteId !== noteId),
  ].slice(0, RECENT_LIMIT);
}

export function pruneRecent(recent, notes) {
  const activeIds = new Set(notes.filter((note) => !note.deletedAt).map((note) => note.id));
  return recent.filter((entry) => activeIds.has(entry.noteId));
}

export function getRecentNotes(recent, notes, limit = 6) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  return recent
    .map((entry) => ({ note: byId.get(entry.noteId), openedAt: entry.openedAt }))
    .filter((entry) => entry.note && !entry.note.deletedAt)
    .slice(0, limit);
}
