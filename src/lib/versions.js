import { markdownToPlainText } from "./markdown.js";

export const VERSIONS_KEY = "leekam.versions.v1";
export const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_TOTAL_VERSIONS = 1000;

function makeVersionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `version-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanTags(tags) {
  return Array.isArray(tags) ? tags.filter((tag) => typeof tag === "string").slice(0, 40) : [];
}

function parseVersion(raw, noteId) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.content !== "string") return null;
  const createdAt = Number(raw.createdAt);
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : makeVersionId(),
    noteId: typeof raw.noteId === "string" && raw.noteId ? raw.noteId : noteId,
    title: typeof raw.title === "string" ? raw.title : "",
    content: raw.content,
    tags: cleanTags(raw.tags),
    folderId: typeof raw.folderId === "string" && raw.folderId ? raw.folderId : null,
    color: typeof raw.color === "string" ? raw.color : "sage",
    pinned: Boolean(raw.pinned),
    favorite: Boolean(raw.favorite),
    createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
  };
}

export function parseVersions(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const versions = {};
    Object.entries(parsed).forEach(([noteId, list]) => {
      if (typeof noteId !== "string" || !Array.isArray(list)) return;
      const seen = new Set();
      const snapshots = list
        .map((raw) => parseVersion(raw, noteId))
        .filter(Boolean)
        .filter((version) => {
          if (seen.has(version.id)) return false;
          seen.add(version.id);
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 100);
      if (snapshots.length > 0) versions[noteId] = snapshots;
    });
    return versions;
  } catch {
    return null;
  }
}

export function loadVersions() {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY);
    if (raw === null) return {};
    return parseVersions(raw) ?? {};
  } catch {
    return {};
  }
}

export function saveVersions(versions) {
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
    return true;
  } catch {
    return false;
  }
}

export function makeVersion(note, createdAt = Date.now()) {
  return {
    id: makeVersionId(),
    noteId: note.id,
    title: note.title ?? "",
    content: note.content ?? "",
    tags: [...(note.tags ?? [])],
    folderId: note.folderId ?? null,
    color: note.color ?? "sage",
    pinned: Boolean(note.pinned),
    favorite: Boolean(note.favorite),
    createdAt,
  };
}

export function getLatestVersion(versions, noteId) {
  return versions[noteId]?.[0] ?? null;
}

export function shouldSnapshot(note, versions, now = Date.now(), interval = SNAPSHOT_INTERVAL_MS) {
  if (!note?.id || note.deletedAt) return false;
  if (!String(note.title ?? "").trim() && !String(note.content ?? "").trim()) return false;
  const latest = getLatestVersion(versions, note.id);
  if (!latest) return true;
  if (latest.title === note.title && latest.content === note.content) return false;
  return now - latest.createdAt >= interval;
}

export function addVersion(versions, note, { limit = 20, force = false, now = Date.now() } = {}) {
  if (!note?.id || note.deletedAt) return versions;
  const current = versions[note.id] ?? [];
  const latest = current[0];
  if (
    !force &&
    latest &&
    latest.title === note.title &&
    latest.content === note.content
  ) {
    return versions;
  }
  if (!force && latest && now - latest.createdAt < SNAPSHOT_INTERVAL_MS) {
    return versions;
  }

  const snapshot = makeVersion(note, now);
  return {
    ...versions,
    [note.id]: [snapshot, ...current].slice(0, limit),
  };
}

export function pruneVersions(versions, notes, limit = 20) {
  const ids = new Set(notes.map((note) => note.id));
  let total = 0;
  const next = {};
  const orderedIds = Object.keys(versions).sort((a, b) => {
    const aTime = versions[a]?.[0]?.createdAt ?? 0;
    const bTime = versions[b]?.[0]?.createdAt ?? 0;
    return bTime - aTime;
  });

  orderedIds.forEach((noteId) => {
    if (!ids.has(noteId) || total >= MAX_TOTAL_VERSIONS) return;
    const remaining = MAX_TOTAL_VERSIONS - total;
    const list = (versions[noteId] ?? []).slice(0, Math.min(limit, remaining));
    if (list.length > 0) {
      next[noteId] = list;
      total += list.length;
    }
  });

  return next;
}

export function removeVersionsForNotes(versions, noteIds) {
  const ids = new Set(noteIds);
  const next = { ...versions };
  ids.forEach((id) => delete next[id]);
  return next;
}

export function getVersionWordCount(version) {
  const plain = markdownToPlainText(version?.content ?? "");
  return plain ? plain.split(/\s+/).length : 0;
}

export function diffLines(previousContent, currentContent) {
  const before = String(previousContent ?? "").split("\n");
  const after = String(currentContent ?? "").split("\n");
  const n = before.length;
  const m = after.length;

  if (n * m > 1_000_000) {
    return [
      ...before.map((text) => ({ type: "removed", text })),
      ...after.map((text) => ({ type: "added", text })),
    ];
  }

  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        before[i] === after[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      lines.push({ type: "same", text: before[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ type: "removed", text: before[i] });
      i += 1;
    } else {
      lines.push({ type: "added", text: after[j] });
      j += 1;
    }
  }
  while (i < n) {
    lines.push({ type: "removed", text: before[i] });
    i += 1;
  }
  while (j < m) {
    lines.push({ type: "added", text: after[j] });
    j += 1;
  }
  return lines;
}
