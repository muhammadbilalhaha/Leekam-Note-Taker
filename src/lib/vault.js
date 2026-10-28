import { sanitizeFilename } from "./backup.js";
import { cleanFolderName, getFolderPath, makeFolder } from "./folders.js";
import { makeId, makeNote, normalizeTag, NOTE_COLORS } from "./notes.js";
import { parseWikiLink, replaceWikiLinks } from "./links.js";
import { createZip } from "./zip.js";

export const VAULT_VERSION = 1;

function normalizeVaultPath(path) {
  return String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/");
}

function folderPathNames(folders, folderId) {
  return getFolderPath(folders, folderId).map((name) => cleanFolderName(name) || "Folder");
}

function folderPathKey(names) {
  return names.map((name) => name.toLowerCase()).join("/");
}

function yamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function yamlTags(tags) {
  return `[${tags.map((tag) => yamlString(tag)).join(", ")}]`;
}

export function buildVaultFiles(notes, folders = []) {
  const used = new Map();
  const files = [];

  notes
    .filter((note) => !note.deletedAt)
    .forEach((note) => {
      const folderNames = folderPathNames(folders, note.folderId);
      const folderSegments = folderNames.map((name) => sanitizeFilename(name, "Folder"));
      const base = sanitizeFilename(note.title.trim() || "Untitled note", "Untitled note");
      const keyBase = [...folderSegments, base].join("/").toLowerCase();
      let filename = `${base}.md`;
      let path = [...folderSegments, filename].join("/");
      let count = used.get(keyBase) ?? 0;
      if (count > 0) {
        const suffix = note.id.slice(0, 8);
        filename = `${base} (${suffix}).md`;
        path = [...folderSegments, filename].join("/");
        if (used.has(path.toLowerCase())) {
          filename = `${base} (${suffix}-${count + 1}).md`;
          path = [...folderSegments, filename].join("/");
        }
      }
      used.set(keyBase, count + 1);
      used.set(path.toLowerCase(), 1);

      const frontMatter = [
        "---",
        `leekam-id: ${yamlString(note.id)}`,
        `title: ${yamlString(note.title.trim() || "Untitled note")}`,
        `tags: ${yamlTags(note.tags)}`,
        `folder: ${yamlString(folderNames.join("/"))}`,
        `created: ${yamlString(new Date(note.createdAt).toISOString())}`,
        `updated: ${yamlString(new Date(note.updatedAt).toISOString())}`,
        `favorite: ${Boolean(note.favorite)}`,
        `pinned: ${Boolean(note.pinned)}`,
        `color: ${yamlString(note.color)}`,
        ...(note.dailyDate ? [`daily-date: ${yamlString(note.dailyDate)}`] : []),
        "---",
        "",
      ].join("\n");

      files.push({ path, content: `${frontMatter}${note.content}` });
    });

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function createVaultZip(files, date = new Date()) {
  return createZip(files, date);
}

export function getVaultFilename(date = new Date()) {
  return `leekam-vault-${date.toISOString().slice(0, 10)}.zip`;
}

function parseYamlValue(raw) {
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value);
    } catch {
      return value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
  }
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

export function parseFrontMatter(text) {
  const content = String(text ?? "");
  if (!/^---\r?\n/.test(content)) return { metadata: {}, content };
  const lines = content.split(/\r?\n/);
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (trimmed === "---" || trimmed === "...") {
      end = index;
      break;
    }
  }
  if (end === -1) return { metadata: {}, content };

  const metadata = {};
  for (let index = 1; index < end; index += 1) {
    const line = lines[index];
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    if (!key) continue;
    metadata[key] = parseYamlValue(line.slice(separator + 1));
  }
  return {
    metadata,
    content: lines.slice(end + 1).join("\n").replace(/^\r?\n/, ""),
  };
}

function cleanTags(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : [];
  const seen = new Set();
  return source
    .filter((tag) => typeof tag === "string")
    .map(normalizeTag)
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

function parseTimestamp(value, fallback) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function titleFromFilename(path) {
  const filename = path.split("/").pop() ?? "Untitled note";
  return filename.replace(/\.(md|markdown)$/i, "").replace(/[-_]+/g, " ").trim();
}

function stripLeadingHeading(content, fallbackTitle) {
  const lines = content.split(/\r?\n/);
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index += 1;
  if (index < lines.length) {
    const match = /^#\s+(.+?)\s*$/.exec(lines[index]);
    if (match) {
      return {
        title: match[1].trim() || fallbackTitle,
        content: [...lines.slice(0, index), ...lines.slice(index + 1)]
          .join("\n")
          .replace(/^\r?\n/, ""),
      };
    }
  }
  return { title: fallbackTitle, content };
}

export function parseVaultFile(file, now = Date.now()) {
  const path = normalizeVaultPath(file.path || file.name || "note.md");
  const extension = /\.(md|markdown)$/i.test(path);
  if (!extension) return { ok: false, error: `Skipped ${path}: not a Markdown file.` };

  const { metadata, content: rawContent } = parseFrontMatter(file.content ?? "");
  const fallbackTitle = titleFromFilename(path);
  const metadataTitle =
    typeof metadata.title === "string" && metadata.title.trim()
      ? metadata.title.trim()
      : "";
  const { title, content } = metadataTitle
    ? { title: metadataTitle, content: rawContent }
    : stripLeadingHeading(rawContent, fallbackTitle);
  const directories = path.split("/").slice(0, -1).filter((part) => part && part !== ".");
  const metadataFolder =
    typeof metadata.folder === "string"
      ? metadata.folder.split("/").map((part) => cleanFolderName(part)).filter(Boolean)
      : [];
  const folderSegments =
    directories.length > 0
      ? directories.map((part) => cleanFolderName(part) || "Folder")
      : metadataFolder;
  const id =
    typeof metadata["leekam-id"] === "string" && metadata["leekam-id"].trim()
      ? metadata["leekam-id"].trim()
      : typeof metadata.id === "string" && metadata.id.trim()
        ? metadata.id.trim()
        : null;
  const createdAt = parseTimestamp(metadata.created ?? metadata.createdat, now);
  const updatedAt = parseTimestamp(metadata.updated ?? metadata.updatedat, createdAt);
  const color = NOTE_COLORS.some((option) => option.id === metadata.color)
    ? metadata.color
    : undefined;

  return {
    ok: true,
    file: {
      path,
      id,
      title: title || fallbackTitle || "Untitled note",
      content,
      tags: cleanTags(metadata.tags),
      folderSegments,
      folderLabel: folderSegments.join("/"),
      createdAt,
      updatedAt,
      favorite: Boolean(metadata.favorite),
      pinned: Boolean(metadata.pinned),
      dailyDate:
        typeof metadata["daily-date"] === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(metadata["daily-date"])
          ? metadata["daily-date"]
          : typeof metadata.dailydate === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(metadata.dailydate)
            ? metadata.dailydate
            : null,
      color,
    },
  };
}

function buildExistingFolderMap(folders) {
  const map = new Map();
  folders.forEach((folder) => {
    const names = folderPathNames(folders, folder.id);
    map.set(folderPathKey(names), folder.id);
  });
  return map;
}

export function buildVaultImport(
  fileEntries,
  existingNotes = [],
  existingFolders = [],
  { mode = "merge", now = Date.now() } = {},
) {
  const merge = mode === "merge";
  const folders = merge ? [...existingFolders] : [];
  const folderMap = merge ? buildExistingFolderMap(existingFolders) : new Map();
  const newFolders = [];
  const importedNotes = [];
  const warnings = [];
  const skipped = [];
  const usedIds = new Set(merge ? existingNotes.map((note) => note.id) : []);
  const idMap = new Map();
  const duplicateIds = [];
  const seenPaths = new Set();
  const parsedFiles = [];

  fileEntries.forEach((entry) => {
    const path = normalizeVaultPath(entry.path || entry.name || "");
    if (seenPaths.has(path.toLowerCase())) {
      skipped.push(`${path}: duplicate file path.`);
      return;
    }
    seenPaths.add(path.toLowerCase());
    const parsed = parseVaultFile(entry, now);
    if (!parsed.ok) {
      skipped.push(parsed.error);
      return;
    }
    parsedFiles.push(parsed.file);
  });

  const ensureFolderPath = (segments) => {
    let parentId = null;
    const names = [];
    for (const segment of segments) {
      const name = cleanFolderName(segment) || "Folder";
      names.push(name);
      const key = folderPathKey(names);
      let folderId = folderMap.get(key);
      if (!folderId) {
        const folder = makeFolder({ name, parentId });
        folders.push(folder);
        newFolders.push(folder);
        folderMap.set(key, folder.id);
        folderId = folder.id;
      }
      parentId = folderId;
    }
    return parentId;
  };

  parsedFiles.forEach((file) => {
    let noteId = file.id;
    if (!noteId || usedIds.has(noteId)) {
      if (noteId) {
        duplicateIds.push(noteId);
        warnings.push(`Duplicate note ID ${noteId} was given a new stable ID.`);
      }
      noteId = makeId();
    }
    if (file.id && !idMap.has(file.id)) idMap.set(file.id, noteId);
    usedIds.add(noteId);
    const folderId = ensureFolderPath(file.folderSegments);
    const note = makeNote({
      id: noteId,
      title: file.title,
      content: file.content,
      tags: file.tags,
      folderId,
      dailyDate: file.dailyDate,
      favorite: file.favorite,
      pinned: file.pinned,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      ...(file.color ? { color: file.color } : {}),
    });
    importedNotes.push(note);
  });

  importedNotes.forEach((note) => {
    if (!note.content.includes("[[")) return;
    note.content = replaceWikiLinks(note.content, (link, match) => {
      if (!link.targetId || !idMap.has(link.targetId)) return match;
      const mapped = idMap.get(link.targetId);
      if (mapped === link.targetId) return match;
      return `[[${link.label}|${mapped}]]`;
    });
  });

  const allNotes = merge ? [...existingNotes, ...importedNotes] : importedNotes;
  const titleCounts = new Map();
  allNotes.forEach((note) => {
    const key = note.title.trim().toLowerCase();
    if (!key) return;
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  });
  const duplicateTitles = [...titleCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([title]) => title);
  if (duplicateTitles.length > 0) {
    warnings.push(
      `${duplicateTitles.length} duplicate note title${
        duplicateTitles.length === 1 ? "" : "s"
      } found. Use ID-qualified links such as [[Title|id]] to disambiguate.`,
    );
  }

  return {
    notes: allNotes,
    folders,
    importedNotes,
    importedFolders: newFolders,
    summary: {
      mode,
      files: parsedFiles.length,
      importedNotes: importedNotes.length,
      importedFolders: newFolders.length,
      duplicateIds: duplicateIds.length,
      duplicateTitles: duplicateTitles.length,
      skipped: skipped.length,
      warnings,
      skippedFiles: skipped,
      duplicateTitleNames: duplicateTitles.slice(0, 20),
    },
  };
}

export function readVaultFileList(fileList) {
  return Promise.all(
    Array.from(fileList).map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              path: file.webkitRelativePath || file.name,
              name: file.name,
              content: String(reader.result ?? ""),
            });
          reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
          reader.readAsText(file);
        }),
    ),
  );
}
