import { getFolderDescendantIds } from "./folders.js";
import { getBacklinks, getOutgoingLinks, normalizeTitle } from "./links.js";

function folderNameMap(folders) {
  return new Map(folders.map((folder) => [folder.id, folder.name]));
}

export function buildGraphData(notes, folders = [], linkIndex, filters = {}) {
  const active = notes.filter((note) => !note.deletedAt);
  const names = folderNameMap(folders);
  const query = normalizeTitle(filters.query ?? "");
  const tag = (filters.tag ?? "").trim().toLowerCase();
  const folderId = filters.folderId ?? "";
  const folderIds = folderId ? getFolderDescendantIds(folders, folderId) : null;

  const nodes = active
    .filter((note) => {
      if (query && !normalizeTitle(note.title).includes(query)) return false;
      if (tag && !note.tags.includes(tag)) return false;
      if (folderIds && !folderIds.has(note.folderId)) return false;
      return true;
    })
    .map((note) => ({
      id: note.id,
      title: note.title.trim() || "Untitled note",
      folderId: note.folderId,
      folderName: names.get(note.folderId) ?? "",
      tags: [...note.tags],
      color: note.color,
      pinned: note.pinned,
      favorite: note.favorite,
      updatedAt: note.updatedAt,
    }));

  const visible = new Set(nodes.map((node) => node.id));
  const edgeSeen = new Set();
  const edges = [];
  const degree = new Map(nodes.map((node) => [node.id, 0]));

  active.forEach((note) => {
    if (!visible.has(note.id)) return;
    getOutgoingLinks(linkIndex, note.id).forEach((entry) => {
      if (entry.status !== "resolved") return;
      const targetId = entry.note.id;
      if (targetId === note.id || !visible.has(targetId)) return;
      const key = `${note.id}\u0000${targetId}`;
      if (edgeSeen.has(key)) return;
      edgeSeen.add(key);
      edges.push({ source: note.id, target: targetId });
      degree.set(note.id, (degree.get(note.id) ?? 0) + 1);
      degree.set(targetId, (degree.get(targetId) ?? 0) + 1);
    });
  });

  const graphNodes = nodes.map((node) => ({
    ...node,
    degree: degree.get(node.id) ?? 0,
    isolated: (degree.get(node.id) ?? 0) === 0,
    backlinkCount: getBacklinks(linkIndex, node.id).length,
    outgoingCount: getOutgoingLinks(linkIndex, node.id).filter(
      (entry) => entry.status === "resolved",
    ).length,
  }));

  return {
    nodes: graphNodes,
    edges,
    isolated: graphNodes.filter((node) => node.isolated),
    connected: graphNodes.filter((node) => !node.isolated),
  };
}

export function getGraphNeighbors(graph, noteId) {
  const ids = new Set();
  graph.edges.forEach((edge) => {
    if (edge.source === noteId) ids.add(edge.target);
    if (edge.target === noteId) ids.add(edge.source);
  });
  return graph.nodes.filter((node) => ids.has(node.id));
}

export function getLocalGraph(graph, noteId, depth = 1) {
  if (!noteId) return { nodes: [], edges: [], isolated: [], connected: [] };
  const selected = graph.nodes.find((node) => node.id === noteId);
  if (!selected) return { nodes: [], edges: [], isolated: [], connected: [] };

  const ids = new Set([noteId]);
  let frontier = new Set([noteId]);
  for (let level = 0; level < depth; level += 1) {
    const next = new Set();
    graph.edges.forEach((edge) => {
      if (frontier.has(edge.source) && !ids.has(edge.target)) next.add(edge.target);
      if (frontier.has(edge.target) && !ids.has(edge.source)) next.add(edge.source);
    });
    next.forEach((id) => ids.add(id));
    frontier = next;
  }

  const nodes = graph.nodes.filter((node) => ids.has(node.id));
  const visible = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter(
    (edge) => visible.has(edge.source) && visible.has(edge.target),
  );
  return {
    nodes,
    edges,
    isolated: nodes.filter((node) => node.isolated),
    connected: nodes.filter((node) => !node.isolated),
  };
}

export function getGraphNeighborTitles(graph, noteId) {
  return getGraphNeighbors(graph, noteId).map((node) => node.title);
}
