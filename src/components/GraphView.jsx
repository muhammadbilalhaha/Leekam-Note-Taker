import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Focus,
  Info,
  List,
  Menu,
  Minus,
  Network,
  Plus,
  Search,
  Unplug,
  X,
} from "lucide-react";
import { buildGraphData, getGraphNeighbors, getLocalGraph } from "../lib/graph";
import { getAccent } from "../lib/notes";

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function radialLayout(nodes, width, height) {
  const positions = new Map();
  if (nodes.length === 0) return positions;
  const groups = new Map();
  nodes.forEach((node) => {
    const key = node.folderName || "Unfiled";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  });
  const groupKeys = [...groups.keys()].sort();
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(120, Math.min(width, height) * 0.34);
  groupKeys.forEach((key, groupIndex) => {
    const groupAngle = (groupIndex / Math.max(1, groupKeys.length)) * Math.PI * 2 - Math.PI / 2;
    const groupX = cx + Math.cos(groupAngle) * outer;
    const groupY = cy + Math.sin(groupAngle) * outer;
    const groupNodes = groups.get(key);
    const inner = Math.min(90, 16 + groupNodes.length * 5);
    groupNodes.forEach((node, nodeIndex) => {
      const angle =
        (nodeIndex / Math.max(1, groupNodes.length)) * Math.PI * 2 +
        (hashString(node.id) % 50) / 50;
      const radius = groupNodes.length === 1 ? 0 : inner;
      positions.set(node.id, {
        x: groupX + Math.cos(angle) * radius,
        y: groupY + Math.sin(angle) * radius,
      });
    });
  });
  return positions;
}

function forceLayout(nodes, edges, width, height) {
  const positions = new Map();
  if (nodes.length === 0) return positions;
  if (nodes.length > 240) return radialLayout(nodes, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(110, Math.min(width, height) * 0.33);
  const items = nodes.map((node, index) => {
    const seed = hashString(node.id);
    const angle = (index / nodes.length) * Math.PI * 2 + ((seed % 100) / 100) * 0.8;
    const distance = radius * (0.4 + ((seed % 53) / 53) * 0.6);
    return {
      x: cx + Math.cos(angle) * distance,
      y: cy + Math.sin(angle) * distance,
      vx: 0,
      vy: 0,
    };
  });
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const links = edges
    .map((edge) => [indexById.get(edge.source), indexById.get(edge.target)])
    .filter(([source, target]) => source !== undefined && target !== undefined);
  const iterations = nodes.length > 120 ? 90 : 170;
  const desired = Math.min(145, Math.max(82, radius * 0.62));

  for (let step = 0; step < iterations; step += 1) {
    const alpha = 1 - step / iterations;
    for (let first = 0; first < items.length; first += 1) {
      for (let second = first + 1; second < items.length; second += 1) {
        const a = items[first];
        const b = items[second];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < 1) {
          dx = (hashString(nodes[first].id + nodes[second].id) % 10) - 5;
          dy = (hashString(nodes[second].id + nodes[first].id) % 10) - 5;
          distanceSquared = Math.max(1, dx * dx + dy * dy);
        }
        const distance = Math.sqrt(distanceSquared);
        const force = (1900 * alpha) / distanceSquared;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    links.forEach(([source, target]) => {
      const a = items[source];
      const b = items[target];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (distance - desired) * 0.013 * alpha;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    items.forEach((item) => {
      item.vx += (cx - item.x) * 0.0016 * alpha;
      item.vy += (cy - item.y) * 0.0016 * alpha;
      item.vx *= 0.84;
      item.vy *= 0.84;
      item.x += Math.max(-7, Math.min(7, item.vx));
      item.y += Math.max(-7, Math.min(7, item.vy));
      item.x = Math.max(36, Math.min(width - 36, item.x));
      item.y = Math.max(36, Math.min(height - 36, item.y));
    });
  }

  nodes.forEach((node, index) => {
    positions.set(node.id, { x: items[index].x, y: items[index].y });
  });
  return positions;
}

function getBounds(positions) {
  const points = [...positions.values()];
  if (points.length === 0) return null;
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

export default function GraphView({
  notes,
  folders,
  linkIndex,
  activeId,
  onOpenNote,
  onNewNote,
  onMenu,
}) {
  const [query, setQuery] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [localMode, setLocalMode] = useState(false);
  const [selectedId, setSelectedId] = useState(activeId ?? null);
  const [hoveredId, setHoveredId] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ width: 960, height: 620 });
  const [dragPositions, setDragPositions] = useState({});
  const [listOpen, setListOpen] = useState(false);

  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const suppressClickRef = useRef(false);

  const activeNotes = useMemo(() => notes.filter((note) => !note.deletedAt), [notes]);
  const tags = useMemo(() => {
    const set = new Set();
    activeNotes.forEach((note) => note.tags.forEach((tag) => set.add(tag)));
    return [...set].sort();
  }, [activeNotes]);

  const filteredGraph = useMemo(
    () => buildGraphData(notes, folders, linkIndex, { query, folderId: folderFilter, tag: tagFilter }),
    [notes, folders, linkIndex, query, folderFilter, tagFilter],
  );

  const graph = useMemo(() => {
    if (localMode && activeId && filteredGraph.nodes.some((node) => node.id === activeId)) {
      return getLocalGraph(filteredGraph, activeId, 1);
    }
    return filteredGraph;
  }, [filteredGraph, localMode, activeId]);

  const layout = useMemo(
    () => forceLayout(graph.nodes, graph.edges, size.width, size.height),
    [graph.nodes, graph.edges, size.width, size.height],
  );

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({
        width: Math.max(320, Math.round(rect.width)),
        height: Math.max(360, Math.round(rect.height)),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const fitView = () => {
    const bounds = getBounds(layout);
    if (!bounds) return;
    const padding = 100;
    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);
    const scale = Math.max(
      0.2,
      Math.min(1.5, Math.min((size.width - padding) / width, (size.height - padding) / height)),
    );
    setViewport({
      k: scale,
      x: (size.width - (bounds.minX + bounds.maxX) * scale) / 2,
      y: (size.height - (bounds.minY + bounds.maxY) * scale) / 2,
    });
  };

  useEffect(() => {
    fitView();
    setDragPositions({});
    // Layout changes are the only time the view should refit automatically.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, size.width, size.height]);

  useEffect(() => {
    setSelectedId((current) => {
      if (current && graph.nodes.some((node) => node.id === current)) return current;
      return graph.nodes.find((node) => node.id === activeId)?.id ?? graph.nodes[0]?.id ?? null;
    });
  }, [graph.nodes, activeId]);

  const selectedNode =
    graph.nodes.find((node) => node.id === selectedId) ??
    graph.nodes.find((node) => node.id === activeId) ??
    graph.nodes[0] ??
    null;
  const focusId = hoveredId;
  const neighborIds = useMemo(() => {
    if (!focusId) return new Set();
    return new Set(getGraphNeighbors(graph, focusId).map((node) => node.id));
  }, [graph, focusId]);
  const neighbors = selectedNode ? getGraphNeighbors(graph, selectedNode.id) : [];

  const getPosition = (id) => dragPositions[id] ?? layout.get(id) ?? { x: 0, y: 0 };

  const toGraphPoint = (clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const scaleX = size.width / rect.width;
    const scaleY = size.height / rect.height;
    return {
      x: ((clientX - rect.left) * scaleX - viewport.x) / viewport.k,
      y: ((clientY - rect.top) * scaleY - viewport.y) / viewport.k,
    };
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (event.clientX - rect.left) * (size.width / rect.width);
    const py = (event.clientY - rect.top) * (size.height / rect.height);
    const graphX = (px - viewport.x) / viewport.k;
    const graphY = (py - viewport.y) / viewport.k;
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    const k = Math.max(0.22, Math.min(2.6, viewport.k * factor));
    setViewport({ k, x: px - graphX * k, y: py - graphY * k });
  };

  const zoomBy = (factor) => {
    const k = Math.max(0.22, Math.min(2.6, viewport.k * factor));
    const ratio = k / viewport.k;
    setViewport({
      k,
      x: size.width / 2 - (size.width / 2 - viewport.x) * ratio,
      y: size.height / 2 - (size.height / 2 - viewport.y) * ratio,
    });
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest("[data-graph-node]")) return;
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handleNodePointerDown = (event, node) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const position = getPosition(node.id);
    dragRef.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    svgRef.current?.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleX = size.width / rect.width;
    const scaleY = size.height / rect.height;
    if (dragRef.current) {
      const drag = dragRef.current;
      const dx = ((event.clientX - drag.startX) * scaleX) / viewport.k;
      const dy = ((event.clientY - drag.startY) * scaleY) / viewport.k;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
      setDragPositions((current) => ({
        ...current,
        [drag.id]: { x: drag.originX + dx, y: drag.originY + dy },
      }));
      return;
    }
    if (panRef.current) {
      const pan = panRef.current;
      setViewport((current) => ({
        ...current,
        x: pan.originX + (event.clientX - pan.startX) * scaleX,
        y: pan.originY + (event.clientY - pan.startY) * scaleY,
      }));
    }
  };

  const handlePointerUp = () => {
    if (dragRef.current?.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
    panRef.current = null;
  };

  const handleNodeClick = (node) => {
    if (suppressClickRef.current) return;
    setSelectedId(node.id);
    onOpenNote(node.id);
  };

  const resetFilters = () => {
    setQuery("");
    setFolderFilter("");
    setTagFilter("");
  };

  const hasFilters = Boolean(query || folderFilter || tagFilter);
  const graphIsLarge = graph.nodes.length > 240;

  return (
    <section className="graph-pane" aria-label="Knowledge graph">
      <header className="graph-header">
        <button className="menu-button" type="button" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="graph-heading">
          <span className="eyebrow">Connections across your library</span>
          <h1>Knowledge graph</h1>
          <p>
            {graph.nodes.length} {graph.nodes.length === 1 ? "note" : "notes"} · {graph.edges.length}{" "}
            {graph.edges.length === 1 ? "link" : "links"} · {graph.isolated.length} isolated
          </p>
        </div>
        <div className="graph-header-actions">
          <button
            className={`graph-mode-button ${localMode ? "is-active" : ""}`}
            type="button"
            onClick={() => setLocalMode((value) => !value)}
            aria-pressed={localMode}
            disabled={!activeId}
            title={activeId ? "Focus on the current note" : "Open a note to focus the graph"}
          >
            <Focus size={15} />
            Local graph
          </button>
          <button
            className={`graph-mode-button ${listOpen ? "is-active" : ""}`}
            type="button"
            onClick={() => setListOpen((value) => !value)}
            aria-pressed={listOpen}
          >
            <List size={15} />
            Browse list
          </button>
        </div>
      </header>

      <div className="graph-controls" role="search" aria-label="Filter graph">
        <label className="graph-control graph-control-search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title…"
            aria-label="Filter graph by note title"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear title filter">
              <X size={13} />
            </button>
          )}
        </label>
        <select
          className="select-field graph-select"
          value={folderFilter}
          onChange={(event) => setFolderFilter(event.target.value)}
          aria-label="Filter graph by folder"
        >
          <option value="">All folders</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <select
          className="select-field graph-select"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          aria-label="Filter graph by tag"
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button className="graph-clear-button" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>

      {activeNotes.length === 0 ? (
        <div className="graph-empty">
          <span className="empty-list-icon">
            <Network size={23} />
          </span>
          <h2>Your graph begins with a note.</h2>
          <p>Create a note and link it to another with [[double brackets]].</p>
          <button className="soft-button" type="button" onClick={onNewNote}>
            <Plus size={15} />
            Write a note
          </button>
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className="graph-empty">
          <span className="empty-list-icon">
            <Search size={23} />
          </span>
          <h2>No notes match this view</h2>
          <p>Try a different title, folder, or tag filter.</p>
          <button className="soft-button" type="button" onClick={resetFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className={`graph-workspace ${listOpen ? "show-list" : ""}`}>
          <div className="graph-canvas-wrap" ref={containerRef}>
            <svg
              ref={svgRef}
              className="graph-canvas"
              viewBox={`0 0 ${size.width} ${size.height}`}
              role="img"
              aria-label={`Graph of ${graph.nodes.length} notes and ${graph.edges.length} internal links`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            >
              <rect
                data-graph-bg
                width={size.width}
                height={size.height}
                fill="transparent"
              />
              <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.k})`}>
                {graph.edges.map((edge) => {
                  const source = getPosition(edge.source);
                  const target = getPosition(edge.target);
                  const highlighted =
                    focusId &&
                    (edge.source === focusId || edge.target === focusId);
                  return (
                    <line
                      key={`${edge.source}-${edge.target}`}
                      className={`graph-edge ${highlighted ? "is-highlighted" : ""} ${
                        focusId && !highlighted ? "is-dim" : ""
                      }`}
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                    />
                  );
                })}
                {graph.nodes.map((node) => {
                  const position = getPosition(node.id);
                  const radius = 8 + Math.min(7, node.degree * 1.4);
                  const isFocus = node.id === focusId;
                  const isNeighbor = neighborIds.has(node.id);
                  const dim = Boolean(focusId) && !isFocus && !isNeighbor;
                  const showLabel =
                    graph.nodes.length <= 90 ||
                    isFocus ||
                    isNeighbor ||
                    node.id === selectedNode?.id;
                  return (
                    <g
                      key={node.id}
                      data-graph-node
                      className={`graph-node ${isFocus ? "is-focus" : ""} ${
                        isNeighbor ? "is-neighbor" : ""
                      } ${dim ? "is-dim" : ""} ${node.isolated ? "is-isolated" : ""}`}
                      transform={`translate(${position.x} ${position.y})`}
                      tabIndex={0}
                      role="button"
                      aria-label={`${node.title}${node.isolated ? ", isolated" : ""}`}
                      onPointerDown={(event) => handleNodePointerDown(event, node)}
                      onPointerEnter={() => setHoveredId(node.id)}
                      onPointerLeave={() => setHoveredId(null)}
                      onFocus={() => setHoveredId(node.id)}
                      onBlur={() => setHoveredId(null)}
                      onClick={() => handleNodeClick(node)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(node.id);
                          onOpenNote(node.id);
                        }
                      }}
                    >
                      <circle
                        r={radius}
                        fill={getAccent(node.color)}
                        className="graph-node-circle"
                      />
                      {node.isolated && <circle r={radius + 4} className="graph-node-isolated-ring" />}
                      {node.favorite && <circle r={3} cx={radius - 2} cy={-radius + 2} className="graph-node-favorite" />}
                      {showLabel && (
                        <text className="graph-node-label" x={radius + 6} y={4}>
                          {node.title.length > 30 ? `${node.title.slice(0, 28)}…` : node.title}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="graph-zoom-controls" role="group" aria-label="Graph zoom">
              <button type="button" onClick={() => zoomBy(1.18)} aria-label="Zoom in">
                <Plus size={16} />
              </button>
              <button type="button" onClick={() => zoomBy(0.85)} aria-label="Zoom out">
                <Minus size={16} />
              </button>
              <button type="button" onClick={fitView} aria-label="Fit graph to view">
                <Focus size={16} />
              </button>
            </div>

            <div className="graph-legend">
              <span>
                <i className="graph-legend-dot" /> Note
              </span>
              <span>
                <i className="graph-legend-ring" /> Isolated
              </span>
              <span className="graph-legend-hint">Scroll to zoom · drag to move</span>
            </div>

            {graphIsLarge && (
              <p className="graph-large-note">
                <Info size={13} />
                Large graph simplified for responsiveness.
              </p>
            )}
          </div>

          {listOpen && (
            <div className="graph-list-panel" aria-label="Browse graph notes">
              <div className="graph-list-heading">
                <h2>Notes in this view</h2>
                <span>{graph.nodes.length}</span>
              </div>
              <div className="graph-list-scroll">
                {[...graph.nodes]
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((node) => (
                    <button
                      key={node.id}
                      className={`graph-list-row ${node.id === selectedNode?.id ? "is-active" : ""}`}
                      type="button"
                      onClick={() => onOpenNote(node.id)}
                    >
                      <span
                        className="graph-list-dot"
                        style={{ background: getAccent(node.color) }}
                      />
                      <span>
                        <strong>{node.title}</strong>
                        <small>
                          {node.folderName || "Unfiled"} · {node.degree} connection
                          {node.degree === 1 ? "" : "s"}
                        </small>
                      </span>
                      {node.isolated && <Unplug size={12} />}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <aside className="graph-side" aria-label="Selected note details">
            {selectedNode ? (
              <>
                <span className="eyebrow">{selectedNode.isolated ? "Not yet connected" : "Selected note"}</span>
                <h2>{selectedNode.title}</h2>
                <p className="graph-side-folder">
                  {selectedNode.folderName || "Unfiled"}
                  {selectedNode.tags.length > 0
                    ? ` · ${selectedNode.tags.slice(0, 3).map((tag) => `#${tag}`).join(" ")}`
                    : ""}
                </p>
                <div className="graph-side-stats">
                  <div>
                    <strong>{selectedNode.outgoingCount}</strong>
                    <span>outgoing</span>
                  </div>
                  <div>
                    <strong>{selectedNode.backlinkCount}</strong>
                    <span>backlinks</span>
                  </div>
                  <div>
                    <strong>{selectedNode.degree}</strong>
                    <span>total</span>
                  </div>
                </div>
                <button
                  className="dialog-button dialog-button-primary graph-open-button"
                  type="button"
                  onClick={() => onOpenNote(selectedNode.id)}
                >
                  Open note
                  <ArrowRight size={14} />
                </button>

                <div className="graph-neighbors">
                  <div className="graph-neighbors-heading">
                    <span>Linked notes</span>
                    <span>{neighbors.length}</span>
                  </div>
                  {neighbors.length === 0 ? (
                    <p className="graph-side-empty">
                      This note has no resolved links yet. Open it and type <code>[[</code> to
                      connect it.
                    </p>
                  ) : (
                    neighbors.map((neighbor) => (
                      <button
                        key={neighbor.id}
                        className="graph-neighbor-row"
                        type="button"
                        onClick={() => onOpenNote(neighbor.id)}
                      >
                        <span
                          className="graph-list-dot"
                          style={{ background: getAccent(neighbor.color) }}
                        />
                        <span>{neighbor.title}</span>
                        <ArrowRight size={12} />
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="graph-side-empty">Select a note to inspect its connections.</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
