import assert from "node:assert/strict";
import test from "node:test";
import { buildGraphData, getGraphNeighbors, getLocalGraph } from "../src/lib/graph.js";
import { buildLinkIndex } from "../src/lib/links.js";
import { getRelatedNotes } from "../src/lib/related.js";

function note(id, title, content = "", extra = {}) {
  return {
    id,
    title,
    content,
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

const folders = [
  { id: "network", name: "Network", parentId: null, createdAt: 1 },
  { id: "ccna", name: "CCNA", parentId: "network", createdAt: 2 },
  { id: "personal", name: "Personal", parentId: null, createdAt: 3 },
];

const notes = [
  note("routing", "Routing basics", "Static routes and OSPF. [[Subnetting]]", {
    tags: ["networking"],
    folderId: "ccna",
  }),
  note("subnetting", "Subnetting", "Masks and CIDR.", {
    tags: ["networking"],
    folderId: "ccna",
  }),
  note("switching", "Switching", "VLANs and trunks.", {
    tags: ["networking"],
    folderId: "network",
  }),
  note("reading", "Reading list", "Books.", { tags: ["personal"], folderId: "personal" }),
  note("trashed", "Deleted routing", "[[Subnetting]]", {
    tags: ["networking"],
    folderId: "ccna",
    deletedAt: 5,
  }),
];

test("related notes explain shared tags, folders, and links", () => {
  const index = buildLinkIndex(notes);
  const related = getRelatedNotes(notes, "routing", folders, index);
  const ids = related.map((item) => item.note.id);
  assert.ok(ids.includes("subnetting"));
  assert.ok(ids.includes("switching"));
  assert.ok(!ids.includes("routing"));
  assert.ok(!ids.includes("trashed"));
  const subnetting = related.find((item) => item.note.id === "subnetting");
  assert.ok(subnetting.reasons.some((reason) => /tag|folder|link/i.test(reason)));
});

test("graph data derives unique edges and marks isolated notes", () => {
  const index = buildLinkIndex(notes);
  const graph = buildGraphData(notes, folders, index);
  assert.deepEqual(
    graph.nodes.map((node) => node.id).sort(),
    ["reading", "routing", "subnetting", "switching"],
  );
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.edges[0].source, "routing");
  assert.equal(graph.edges[0].target, "subnetting");
  assert.deepEqual(graph.isolated.map((node) => node.id).sort(), ["reading", "switching"]);
  assert.equal(getGraphNeighbors(graph, "routing").length, 1);
});

test("graph filters and local graph focus on the selected neighborhood", () => {
  const index = buildLinkIndex(notes);
  const graph = buildGraphData(notes, folders, index, { query: "routing" });
  assert.deepEqual(graph.nodes.map((node) => node.id), ["routing"]);
  const nested = buildGraphData(notes, folders, index, { folderId: "network" });
  assert.deepEqual(nested.nodes.map((node) => node.id).sort(), [
    "routing",
    "subnetting",
    "switching",
  ]);
  const full = buildGraphData(notes, folders, index);
  const local = getLocalGraph(full, "routing", 1);
  assert.deepEqual(local.nodes.map((node) => node.id).sort(), ["routing", "subnetting"]);
  assert.equal(local.edges.length, 1);
});
