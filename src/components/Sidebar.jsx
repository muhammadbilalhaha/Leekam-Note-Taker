import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Feather,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  HardDrive,
  House,
  LayoutTemplate,
  Moon,
  MoreHorizontal,
  Network,
  Pencil,
  Pin,
  Plus,
  Settings2,
  Star,
  Sun,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { buildFolderTree } from "../lib/folders";

function FolderRow({
  node,
  depth,
  filter,
  counts,
  collapsed,
  onToggleCollapse,
  onFilterChange,
  menuFolderId,
  onMenuToggle,
  menuRef,
  onAddSubfolder,
  onRename,
  onDelete,
}) {
  const { folder, children } = node;
  const hasChildren = children.length > 0;
  const isCollapsed = collapsed.has(folder.id);
  const isActive = filter.type === "folder" && filter.folderId === folder.id;
  const count = counts.get(folder.id) ?? 0;
  const menuOpen = menuFolderId === folder.id;
  const moreRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const anchor = moreRef.current?.getBoundingClientRect();
    if (anchor) {
      const width = 168;
      const height = 112;
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(anchor.right - width, window.innerWidth - width - margin),
      );
      const spaceBelow = window.innerHeight - anchor.bottom - margin;
      const top =
        spaceBelow >= height
          ? anchor.bottom + 4
          : Math.max(margin, anchor.top - height - 4);
      setMenuPosition({ left: Math.round(left), top: Math.round(top) });
    }

    const closeMenu = () => onMenuToggle(null);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuOpen, onMenuToggle]);

  return (
    <div className="folder-node">
      <div
        className={`folder-row ${isActive ? "is-active" : ""}`}
        style={{ "--folder-depth": depth }}
      >
        {hasChildren ? (
          <button
            className="folder-chevron"
            type="button"
            onClick={() => onToggleCollapse(folder.id)}
            aria-label={isCollapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
        ) : (
          <span className="folder-chevron folder-chevron-empty" aria-hidden="true" />
        )}

        <button
          className="folder-main"
          type="button"
          onClick={() => onFilterChange({ type: "folder", folderId: folder.id })}
          aria-current={isActive ? "page" : undefined}
          title={folder.name}
        >
          {hasChildren && !isCollapsed ? (
            <FolderOpen size={15} />
          ) : (
            <Folder size={15} />
          )}
          <span className="folder-name">{folder.name}</span>
          <span className="nav-count">{count}</span>
        </button>

        <button
          ref={moreRef}
          className="folder-more"
          type="button"
          data-folder-menu-trigger={folder.id}
          onClick={() => onMenuToggle(folder.id)}
          aria-label={`Folder options for ${folder.name}`}
          aria-expanded={menuOpen}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {menuOpen &&
        menuPosition &&
        createPortal(
          <div
            className="folder-menu"
            ref={menuRef}
            style={{ left: menuPosition.left, top: menuPosition.top }}
            role="menu"
            aria-label={`Options for ${folder.name}`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAddSubfolder(folder.id);
                onMenuToggle(null);
              }}
            >
              <FolderPlus size={14} />
              New subfolder
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onRename(folder);
                onMenuToggle(null);
              }}
            >
              <Pencil size={14} />
              Rename
            </button>
            <button
              className="is-danger"
              type="button"
              role="menuitem"
              onClick={() => {
                onDelete(folder);
                onMenuToggle(null);
              }}
            >
              <Trash2 size={14} />
              Delete folder
            </button>
          </div>,
          document.body,
        )}

      {hasChildren && !isCollapsed && (
        <div className="folder-children">
          {children.map((child) => (
            <FolderRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              filter={filter}
              counts={counts}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onFilterChange={onFilterChange}
              menuFolderId={menuFolderId}
              onMenuToggle={onMenuToggle}
              menuRef={menuRef}
              onAddSubfolder={onAddSubfolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  filter,
  tags,
  folders,
  folderCounts,
  noteCount,
  pinnedCount,
  favoriteCount,
  trashCount,
  savedSearches = [],
  open,
  theme,
  isMac = false,
  onClose,
  onFilterChange,
  onNewNote,
  onOpenTemplates,
  onOpenToday,
  onToggleTheme,
  onOpenData,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onApplySavedSearch,
  onEditSavedSearch,
  onDeleteSavedSearch,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [folderMenuId, setFolderMenuId] = useState(null);
  const menuRef = useRef(null);
  const tree = buildFolderTree(folders);

  useEffect(() => {
    if (!folderMenuId) return undefined;

    const handlePointerDown = (event) => {
      if (event.target.closest("[data-folder-menu-trigger]")) return;
      if (!menuRef.current?.contains(event.target)) setFolderMenuId(null);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setFolderMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [folderMenuId]);

  useEffect(() => {
    if (!open) setFolderMenuId(null);
  }, [open]);

  useEffect(() => {
    setFolderMenuId(null);
  }, [filter]);

  const toggleCollapse = (folderId) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const toggleMenu = (folderId) => {
    setFolderMenuId((current) => (current === folderId ? null : folderId));
  };

  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="Library navigation">
      <div className="sidebar-inner">
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <Feather size={19} strokeWidth={2.1} />
          </div>
          <div className="brand-copy">
            <span className="brand-name">Leekam</span>
            <span className="brand-tagline">Notes, kept close</span>
          </div>
          <button className="sidebar-close" type="button" onClick={onClose} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <button className="new-note-button" type="button" onClick={onNewNote}>
          <span className="new-note-icon">
            <Plus size={17} strokeWidth={2.5} />
          </span>
          <span>New note</span>
        </button>
        <button className="template-start-button" type="button" onClick={onOpenTemplates}>
          <LayoutTemplate size={15} />
          <span>Start from a template</span>
        </button>

        <nav className="sidebar-nav" aria-label="Knowledge navigation">
          <p className="nav-label">Home</p>
          <button
            className={`nav-item ${filter.type === "dashboard" ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange({ type: "dashboard" })}
          >
            <House size={17} />
            <span>Home</span>
          </button>
          <button className="nav-item" type="button" onClick={onOpenToday}>
            <CalendarDays size={17} />
            <span>Today</span>
            <span className="nav-shortcut">{isMac ? "⌘⇧D" : "Ctrl+Shift+D"}</span>
          </button>

          <p className="nav-label nav-label-spaced">Library</p>
          <button
            className={`nav-item ${filter.type === "all" ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange({ type: "all" })}
          >
            <FileText size={17} />
            <span>All notes</span>
            <span className="nav-count">{noteCount}</span>
          </button>
          <button
            className={`nav-item ${filter.type === "pinned" ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange({ type: "pinned" })}
          >
            <Pin size={17} />
            <span>Pinned</span>
            <span className="nav-count">{pinnedCount}</span>
          </button>
          <button
            className={`nav-item ${filter.type === "favorites" ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange({ type: "favorites" })}
          >
            <Star size={17} />
            <span>Favorites</span>
            <span className="nav-count">{favoriteCount}</span>
          </button>
          <button
            className={`nav-item ${filter.type === "graph" ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange({ type: "graph" })}
          >
            <Network size={17} />
            <span>Graph</span>
            <span className="nav-shortcut">{isMac ? "⌘⇧G" : "Ctrl+Shift+G"}</span>
          </button>
          <button
            className={`nav-item ${filter.type === "trash" ? "is-active" : ""}`}
            type="button"
            onClick={() => onFilterChange({ type: "trash" })}
          >
            <Trash2 size={17} />
            <span>Trash</span>
            <span className="nav-count">{trashCount}</span>
          </button>
        </nav>

        <div className="sidebar-scroll">
          {savedSearches.length > 0 && (
            <section className="sidebar-saved-searches" aria-label="Saved searches">
              <p className="nav-label">Saved searches</p>
              <div className="saved-search-list">
                {savedSearches.map((search) => (
                  <div className="saved-search-row" key={search.id}>
                    <button
                      className="saved-search-main"
                      type="button"
                      onClick={() => onApplySavedSearch(search)}
                      title={search.query}
                    >
                      <Bookmark size={14} />
                      <span>{search.name}</span>
                    </button>
                    <button
                      className="saved-search-action"
                      type="button"
                      onClick={() => onEditSavedSearch(search)}
                      aria-label={`Rename saved search ${search.name}`}
                      title="Rename saved search"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="saved-search-action saved-search-delete"
                      type="button"
                      onClick={() => onDeleteSavedSearch(search)}
                      aria-label={`Delete saved search ${search.name}`}
                      title="Delete saved search"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="sidebar-folders" aria-label="Folders">
            <div className="sidebar-section-heading">
              <p className="nav-label">Folders</p>
              <button
                className="section-add"
                type="button"
                onClick={() => onCreateFolder(null)}
                aria-label="Create folder"
                title="Create folder"
              >
                <Plus size={14} />
              </button>
            </div>

            {tree.length > 0 ? (
              <div className="folder-tree">
                {tree.map((node) => (
                  <FolderRow
                    key={node.folder.id}
                    node={node}
                    depth={0}
                    filter={filter}
                    counts={folderCounts}
                    collapsed={collapsed}
                    onToggleCollapse={toggleCollapse}
                    onFilterChange={onFilterChange}
                    menuFolderId={folderMenuId}
                    onMenuToggle={toggleMenu}
                    menuRef={menuRef}
                    onAddSubfolder={onCreateFolder}
                    onRename={onRenameFolder}
                    onDelete={onDeleteFolder}
                  />
                ))}
              </div>
            ) : (
              <button
                className="sidebar-empty-folder"
                type="button"
                onClick={() => onCreateFolder(null)}
              >
                <FolderPlus size={15} />
                <span>Create your first folder</span>
              </button>
            )}
          </section>

          <div className="sidebar-tags">
            <p className="nav-label">Tags</p>
            {tags.length > 0 ? (
              <div className="sidebar-tag-list">
                {tags.map((tag) => (
                  <button
                    className={`tag-nav-item ${
                      filter.type === "tag" && filter.tag === tag.name ? "is-active" : ""
                    }`}
                    type="button"
                    key={tag.name}
                    onClick={() => onFilterChange({ type: "tag", tag: tag.name })}
                  >
                    <Tag size={14} />
                    <span className="tag-name">{tag.name}</span>
                    <span className="nav-count">{tag.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="sidebar-empty-tags">Tags you add will appear here.</p>
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="local-badge">
            <span className="local-badge-icon">
              <HardDrive size={16} />
            </span>
            <span>
              <strong>Stored on this device</strong>
              <small>Private, local, and yours</small>
            </span>
          </div>
          <div className="sidebar-tool-row">
            <button className="theme-button" type="button" onClick={onOpenData}>
              <Settings2 size={16} />
              <span>Backup</span>
            </button>
            <button className="theme-button" type="button" onClick={onToggleTheme}>
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
