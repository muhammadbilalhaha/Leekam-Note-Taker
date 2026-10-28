const WIKI_LINK_PATTERN = /\[\[([^\[\]\n]+?)\]\]/g;

export function normalizeTitle(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function parseWikiLink(rawBody) {
  const body = String(rawBody ?? "").trim();
  const separator = body.indexOf("|");
  const label = (separator === -1 ? body : body.slice(0, separator)).trim();
  const targetId = separator === -1 ? null : body.slice(separator + 1).trim() || null;
  return { body, label, targetId };
}

function encodeWikiLinkLabel(value) {
  return value.replace(/[|\[\]\n\r]/g, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
  });
}

export function formatWikiLink(note, duplicate = false) {
  const title = String(note?.title ?? "").trim() || "Untitled note";
  const needsId = duplicate || /[|\[\]\n\r]/.test(title);
  if (!needsId) return `[[${title}]]`;
  return `[[${encodeWikiLinkLabel(title)}|${note.id}]]`;
}

function getCodeRanges(content) {
  const ranges = [];
  const lines = content.split("\n");
  let offset = 0;
  let fence = null;
  let fenceStart = 0;

  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    const trimmed = line.trimStart();

    if (fence) {
      if (
        trimmed.startsWith(fence.marker) &&
        trimmed.slice(0, fence.marker.length) === fence.marker
      ) {
        ranges.push([fenceStart, lineEnd]);
        fence = null;
      }
    } else {
      const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
      if (fenceMatch) {
        fence = { marker: fenceMatch[1] };
        fenceStart = lineStart;
      } else {
        const inlinePattern = /(`+)([^\n]*?)\1/g;
        let match;
        while ((match = inlinePattern.exec(line)) !== null) {
          ranges.push([lineStart + match.index, lineStart + match.index + match[0].length]);
        }
      }
    }

    offset = lineEnd + 1;
  }

  if (fence) ranges.push([fenceStart, content.length]);
  return ranges;
}

function isInsideRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Applies a replacer only to wiki links outside fenced and inline code.
 * Returning the original match leaves the link untouched.
 */
export function replaceWikiLinks(content, replacer) {
  if (typeof content !== "string" || !content.includes("[[")) return content;
  const ranges = getCodeRanges(content);
  return content.replace(WIKI_LINK_PATTERN, (match, body, offset) => {
    if (isInsideRanges(offset, ranges)) return match;
    return replacer(parseWikiLink(body), match, offset) ?? match;
  });
}

export function extractWikiLinks(content) {
  const links = [];
  replaceWikiLinks(content, (link, match) => {
    links.push({ ...link, raw: match });
    return match;
  });
  return links;
}

export function buildTitleIndex(notes) {
  const index = new Map();
  notes.forEach((note) => {
    const key = normalizeTitle(note.title);
    if (!key) return;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(note);
  });
  return index;
}

function result(status, link, extra = {}) {
  return { status, link, ...extra };
}

export function resolveWikiLink(link, index) {
  if (link.targetId) {
    const note = index.byId.get(link.targetId);
    if (!note) {
      return result("missing", link, {
        reason: "The linked note no longer exists.",
      });
    }
    if (note.deletedAt) {
      return result("trashed", link, {
        note,
        reason: "The linked note is in Trash.",
      });
    }
    return result("resolved", link, { note });
  }

  const candidates = index.titleIndex.get(normalizeTitle(link.label)) ?? [];
  if (candidates.length === 0) {
    return result("missing", link, {
      reason: "No note has this title.",
    });
  }

  const active = candidates.filter((note) => !note.deletedAt);
  if (active.length === 1) {
    return result("resolved", link, { note: active[0] });
  }
  if (active.length > 1) {
    return result("ambiguous", link, {
      candidates: active,
      reason: "More than one note has this title.",
    });
  }
  if (candidates.length === 1) {
    return result("trashed", link, {
      note: candidates[0],
      reason: "The linked note is in Trash.",
    });
  }
  return result("ambiguous", link, {
    candidates,
    reason: "More than one trashed note has this title.",
  });
}

/**
 * Builds a derived link graph for active notes. Trashed notes are still
 * resolvable targets so links can recover automatically after restore.
 */
export function buildLinkIndex(notes) {
  const byId = new Map(notes.map((note) => [note.id, note]));
  const titleIndex = buildTitleIndex(notes);
  const index = { byId, titleIndex };
  const outgoing = new Map();
  const backlinks = new Map();
  const broken = new Map();
  const trashed = new Map();
  const linkedNoteIds = new Set();
  const backlinkSeen = new Set();

  notes
    .filter((note) => !note.deletedAt)
    .forEach((note) => {
      const entries = [];
      extractWikiLinks(note.content).forEach((link) => {
        const resolution = resolveWikiLink(link, index);
        const entry = { ...resolution, sourceId: note.id };
        entries.push(entry);

        if (resolution.status === "resolved") {
          const target = resolution.note;
          linkedNoteIds.add(note.id);
          linkedNoteIds.add(target.id);
          if (target.id !== note.id) {
            const key = `${note.id}\u0000${target.id}`;
            if (!backlinkSeen.has(key)) {
              backlinkSeen.add(key);
              if (!backlinks.has(target.id)) backlinks.set(target.id, []);
              backlinks.get(target.id).push({ note, link, resolution });
            }
          }
        } else if (resolution.status === "trashed") {
          if (!trashed.has(note.id)) trashed.set(note.id, []);
          trashed.get(note.id).push(entry);
        } else {
          if (!broken.has(note.id)) broken.set(note.id, []);
          broken.get(note.id).push(entry);
        }
      });
      outgoing.set(note.id, entries);
    });

  return {
    byId,
    titleIndex,
    outgoing,
    backlinks,
    broken,
    trashed,
    linkedNoteIds,
  };
}

export function getOutgoingLinks(index, noteId) {
  return index?.outgoing.get(noteId) ?? [];
}

export function getBacklinks(index, noteId) {
  return index?.backlinks.get(noteId) ?? [];
}

export function getBrokenLinks(index, noteId) {
  return index?.broken.get(noteId) ?? [];
}

export function getTrashedLinks(index, noteId) {
  return index?.trashed.get(noteId) ?? [];
}

export function resolveLinkBody(index, rawBody) {
  return resolveWikiLink(parseWikiLink(rawBody), index);
}

export function countTitleOccurrences(notes, title) {
  const key = normalizeTitle(title);
  if (!key) return 0;
  return notes.reduce(
    (count, note) => count + (normalizeTitle(note.title) === key ? 1 : 0),
    0,
  );
}

/**
 * Keeps readable title links working after a rename. ID-qualified links always
 * follow the stable note ID; title-only links are only rewritten when they
 * unambiguously referred to the renamed note.
 */
export function updateLinksForRenamedNote(notes, noteId, oldTitle, newTitle) {
  const normalizedOld = normalizeTitle(oldTitle);
  const normalizedNew = normalizeTitle(newTitle);
  if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) return notes;

  const activeNotes = notes.filter((note) => !note.deletedAt);
  const oldUnique = countTitleOccurrences(activeNotes, oldTitle) === 1;
  if (!oldUnique) return notes;

  const newDuplicate = countTitleOccurrences(activeNotes, newTitle) > 1;
  const replacementForTitle = formatWikiLink(
    { id: noteId, title: newTitle },
    newDuplicate,
  );

  let changed = false;
  const next = notes.map((note) => {
    const content = replaceWikiLinks(note.content, (link, match) => {
      if (link.targetId) {
        if (link.targetId !== noteId) return match;
        changed = true;
        return formatWikiLink({ id: noteId, title: newTitle }, true);
      }
      if (normalizeTitle(link.label) !== normalizedOld) return match;
      changed = true;
      return replacementForTitle;
    });
    return content === note.content ? note : { ...note, content };
  });

  return changed ? next : notes;
}

function escapeMarkdownLabel(label) {
  return label.replace(/([\\\[\]])/g, "\\$1");
}

/**
 * Converts readable wiki links to temporary Markdown links so react-markdown
 * can render them without exposing raw HTML.
 */
export function transformWikiLinks(content, index) {
  return replaceWikiLinks(content, (link, match) => {
    const resolution = resolveWikiLink(link, index);
    const label =
      resolution.status === "resolved"
        ? resolution.note.title.trim() || link.label
        : link.label;
    const href = `leekam-note://${encodeURIComponent(link.body)}`;
    return `[${escapeMarkdownLabel(label)}](${href})`;
  });
}

export function getLinkSuggestions(notes, query, folders = [], limit = 8) {
  const term = normalizeTitle(query);
  const active = notes.filter((note) => !note.deletedAt && note.title.trim());
  const titleCounts = new Map();
  active.forEach((note) => {
    const key = normalizeTitle(note.title);
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  });

  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
  return active
    .filter((note) => !term || normalizeTitle(note.title).includes(term))
    .sort((a, b) => {
      const aTitle = normalizeTitle(a.title);
      const bTitle = normalizeTitle(b.title);
      const aStarts = aTitle.startsWith(term) ? 0 : 1;
      const bStarts = bTitle.startsWith(term) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.updatedAt - a.updatedAt || a.title.localeCompare(b.title);
    })
    .slice(0, limit)
    .map((note) => ({
      note,
      duplicate: (titleCounts.get(normalizeTitle(note.title)) ?? 0) > 1,
      folderName: folderNames.get(note.folderId) ?? "",
    }));
}

export function getActiveLinkTargets(index) {
  const ids = new Set();
  index?.outgoing.forEach((entries) => {
    entries.forEach((entry) => {
      if (entry.status === "resolved" && entry.note.id !== entry.sourceId) {
        ids.add(entry.sourceId);
        ids.add(entry.note.id);
      }
    });
  });
  return ids;
}
