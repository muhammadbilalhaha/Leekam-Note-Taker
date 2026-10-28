export const FOLDERS_KEY = "leekam.folders.v1";

function createFolderId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `folder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function makeFolder({ name, parentId = null } = {}) {
  return {
    id: createFolderId(),
    name: cleanFolderName(name) || "Untitled folder",
    parentId: typeof parentId === "string" ? parentId : null,
    createdAt: Date.now(),
  };
}

export function cleanFolderName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}

export function parseFolders(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return null;

    const seen = new Set();
    const folders = [];

    parsed.forEach((folder) => {
      if (!folder || typeof folder !== "object" || typeof folder.id !== "string") return;
      if (!folder.id || seen.has(folder.id)) return;

      const name = cleanFolderName(folder.name);
      if (!name) return;

      const createdAt = Number(folder.createdAt);
      seen.add(folder.id);
      folders.push({
        id: folder.id,
        name,
        parentId: typeof folder.parentId === "string" ? folder.parentId : null,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
      });
    });

    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    folders.forEach((folder) => {
      if (folder.parentId === folder.id || !byId.has(folder.parentId)) {
        folder.parentId = null;
      }
    });

    // Break any cycles in imported data so the tree can always render.
    folders.forEach((folder) => {
      const ancestry = new Set([folder.id]);
      let parentId = folder.parentId;

      while (parentId) {
        if (ancestry.has(parentId)) {
          folder.parentId = null;
          break;
        }
        ancestry.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
    });

    return folders;
  } catch {
    return null;
  }
}

export function loadFolders() {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (raw === null) return [];
    return parseFolders(raw) ?? [];
  } catch {
    return [];
  }
}

export function saveFolders(folders) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  } catch {
    return false;
  }
}

export function buildFolderTree(folders) {
  const nodes = new Map(
    folders.map((folder) => [folder.id, { folder, children: [] }]),
  );
  const roots = [];

  folders.forEach((folder) => {
    const node = nodes.get(folder.id);
    const parent = folder.parentId ? nodes.get(folder.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const sortNodes = (items) => {
    items.sort((a, b) => a.folder.name.localeCompare(b.folder.name));
    items.forEach((item) => sortNodes(item.children));
  };
  sortNodes(roots);

  return roots;
}

export function flattenFolderTree(folders) {
  const rows = [];
  const walk = (nodes, depth) => {
    nodes.forEach((node) => {
      rows.push({ folder: node.folder, depth });
      walk(node.children, depth + 1);
    });
  };
  walk(buildFolderTree(folders), 0);
  return rows;
}

export function getFolderDescendantIds(folders, folderId) {
  const ids = new Set();
  if (!folderId) return ids;

  const children = new Map();
  folders.forEach((folder) => {
    if (!folder.parentId) return;
    if (!children.has(folder.parentId)) children.set(folder.parentId, []);
    children.get(folder.parentId).push(folder.id);
  });

  const queue = [folderId];
  while (queue.length > 0) {
    const id = queue.shift();
    if (ids.has(id)) continue;
    ids.add(id);
    queue.push(...(children.get(id) ?? []));
  }

  return ids;
}

export function getFolderNoteCounts(folders, notes) {
  const counts = new Map();
  const byId = new Map(folders.map((folder) => [folder.id, folder]));

  notes.forEach((note) => {
    if (note.deletedAt || !note.folderId || !byId.has(note.folderId)) return;

    const seen = new Set();
    let folderId = note.folderId;
    while (folderId && !seen.has(folderId)) {
      seen.add(folderId);
      counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      folderId = byId.get(folderId)?.parentId ?? null;
    }
  });

  return counts;
}

export function getFolderPath(folders, folderId) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path = [];
  const seen = new Set();
  let current = byId.get(folderId);

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : null;
  }

  return path;
}

export function removeFolder(folders, notes, folderId) {
  const target = folders.find((folder) => folder.id === folderId);
  if (!target) return { folders, notes };

  const parentId = target.parentId ?? null;
  return {
    folders: folders
      .filter((folder) => folder.id !== folderId)
      .map((folder) =>
        folder.parentId === folderId ? { ...folder, parentId } : folder,
      ),
    notes: notes.map((note) =>
      note.folderId === folderId ? { ...note, folderId: parentId } : note,
    ),
  };
}

export function getFolderName(folders, folderId) {
  return folders.find((folder) => folder.id === folderId)?.name ?? "";
}
