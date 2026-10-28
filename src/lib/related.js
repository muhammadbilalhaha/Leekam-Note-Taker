import { getFolderPath } from "./folders.js";
import { markdownToPlainText } from "./markdown.js";
import { getBacklinks, getOutgoingLinks, normalizeTitle } from "./links.js";

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have how i if in into is it its of on or our so that the their them then there these they this to was we were what when where which who why will with you your".split(
    " ",
  ),
);

const tokenCache = new WeakMap();

function tokensFor(note) {
  const cached = tokenCache.get(note);
  if (cached) return cached;
  const title = new Set(
    normalizeTitle(note.title)
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
  const content = new Set(
    markdownToPlainText(note.content)
      .toLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  );
  const result = { title, content };
  tokenCache.set(note, result);
  return result;
}

function intersectSize(a, b) {
  if (!a || !b) return 0;
  let count = 0;
  a.forEach((value) => {
    if (b.has(value)) count += 1;
  });
  return count;
}

function intersectValues(a, b, limit = 3) {
  const values = [];
  a.forEach((value) => {
    if (b.has(value) && values.length < limit) values.push(value);
  });
  return values;
}

function folderTopLevel(folders, folderId) {
  const path = getFolderPath(folders, folderId);
  return path[0] ?? "";
}

/**
 * Transparent, local-only related-note ranking. Each reason is human-readable
 * so users can understand why a note was suggested.
 */
export function getRelatedNotes(notes, noteId, folders = [], linkIndex, limit = 6) {
  const active = notes.filter((note) => !note.deletedAt);
  const current = active.find((note) => note.id === noteId);
  if (!current) return [];

  const currentTokens = tokensFor(current);
  const currentOutgoing = new Set(
    getOutgoingLinks(linkIndex, current.id)
      .filter((entry) => entry.status === "resolved")
      .map((entry) => entry.note.id),
  );
  const currentBacklinks = new Set(
    getBacklinks(linkIndex, current.id).map((entry) => entry.note.id),
  );
  const currentTopFolder = folderTopLevel(folders, current.folderId);

  const results = [];
  active.forEach((candidate) => {
    if (candidate.id === current.id) return;

    let score = 0;
    const reasons = [];
    const sharedTags = current.tags.filter((tag) => candidate.tags.includes(tag));
    if (sharedTags.length > 0) {
      score += Math.min(9, sharedTags.length * 4.5);
      reasons.push(
        `Shared tag${sharedTags.length === 1 ? "" : "s"} ${sharedTags
          .slice(0, 3)
          .map((tag) => `#${tag}`)
          .join(", ")}`,
      );
    }

    if (current.folderId && candidate.folderId === current.folderId) {
      score += 4;
      reasons.push("Same folder");
    } else if (currentTopFolder && folderTopLevel(folders, candidate.folderId) === currentTopFolder) {
      score += 1.5;
      reasons.push("Related folder");
    }

    const candidateOutgoing = new Set(
      getOutgoingLinks(linkIndex, candidate.id)
        .filter((entry) => entry.status === "resolved")
        .map((entry) => entry.note.id),
    );
    if (currentOutgoing.has(candidate.id)) {
      score += 6;
      reasons.push("You link to this note");
    }
    if (currentBacklinks.has(candidate.id)) {
      score += 6;
      reasons.push("This note links to you");
    }

    const sharedTargets = intersectValues(currentOutgoing, candidateOutgoing, 2);
    if (sharedTargets.length > 0) {
      score += sharedTargets.length * 3.5;
      const target = notes.find((note) => note.id === sharedTargets[0]);
      reasons.push(`Shared link${sharedTargets.length === 1 ? "" : "s"}${target ? ` to ${target.title}` : ""}`);
    }

    const candidateBacklinks = new Set(
      getBacklinks(linkIndex, candidate.id).map((entry) => entry.note.id),
    );
    const sharedSources = intersectValues(currentBacklinks, candidateBacklinks, 1);
    if (sharedSources.length > 0) {
      score += 2.5;
      reasons.push("Linked from a common note");
    }

    const titleOverlap = intersectValues(currentTokens.title, tokensFor(candidate).title, 3);
    if (titleOverlap.length > 0) {
      score += titleOverlap.length * 2.2;
      reasons.push(`Related title keyword${titleOverlap.length === 1 ? "" : "s"}: ${titleOverlap.join(", ")}`);
    }

    const contentOverlap = intersectSize(currentTokens.content, tokensFor(candidate).content);
    if (contentOverlap > 0) {
      score += Math.min(3.2, contentOverlap * 0.35);
      if (reasons.length < 3) {
        const shared = intersectValues(currentTokens.content, tokensFor(candidate).content, 2);
        reasons.push(`Related content: ${shared.join(", ")}`);
      }
    }

    if (score > 0) {
      results.push({
        note: candidate,
        score: Math.round(score * 10) / 10,
        reasons: reasons.slice(0, 3),
      });
    }
  });

  return results
    .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)
    .slice(0, limit);
}

export function clearRelatedCache() {
  // WeakMap entries expire with their note objects; kept for explicit test resets.
  return tokenCache;
}
