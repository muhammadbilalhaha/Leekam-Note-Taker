import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import {
  AlertCircle,
  ArrowLeft,
  Bold,
  Braces,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Columns2,
  Copy,
  Download,
  Eye,
  Feather,
  FileText,
  Folder,
  Heading2,
  History,
  Italic,
  Link as InternalLinkIcon,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  PencilLine,
  Pin,
  Plus,
  Quote,
  Star,
  Trash2,
  X,
} from "lucide-react";
import ConnectionsPanel from "./ConnectionsPanel";
import { flattenFolderTree, getFolderName } from "../lib/folders";
import {
  formatWikiLink,
  getLinkSuggestions,
  resolveLinkBody,
  transformWikiLinks,
} from "../lib/links";
import { formatDailyHeading, shiftDateKey } from "../lib/daily";
import { getMarkdownStats, noteToMarkdown, noteToPlainText, toggleTaskAtIndex } from "../lib/markdown";
import {
  NOTE_COLORS,
  formatEditedAt,
  normalizeTag,
} from "../lib/notes";

function EditorEmptyState({ onNewNote }) {
  return (
    <div className="editor-empty">
      <div className="empty-illustration" aria-hidden="true">
        <span className="paper-sheet paper-sheet-back" />
        <span className="paper-sheet paper-sheet-middle" />
        <span className="paper-sheet paper-sheet-front">
          <Feather size={25} strokeWidth={1.7} />
          <i />
          <i />
          <i className="short" />
        </span>
        <span className="illustration-sparkle">✦</span>
      </div>
      <span className="eyebrow">Ready when you are</span>
      <h2>Pick a note, or begin a new one.</h2>
      <p>
        A calm place for thoughts, lists, and ideas. Everything is saved automatically, right
        here in your browser.
      </p>
      <button className="primary-button" type="button" onClick={onNewNote}>
        <Plus size={17} />
        Start a new note
      </button>
      <p className="empty-hint">No account. No sync. Just your words.</p>
    </div>
  );
}

function TrashEmptyState({ trashCount, retentionLabel, onEmptyTrash }) {
  return (
    <div className="editor-empty editor-trash-empty">
      <span className="empty-list-icon">
        <Trash2 size={23} />
      </span>
      <span className="eyebrow">Recently deleted</span>
      <h2>Trash keeps your notes safe.</h2>
      <p>
        {retentionLabel}. Restore a note from the list, or delete it permanently when you are
        certain it is no longer needed.
      </p>
      {trashCount > 0 && (
        <button className="soft-button" type="button" onClick={onEmptyTrash}>
          Empty Trash
        </button>
      )}
    </div>
  );
}

function safeMarkdownUrl(url) {
  if (typeof url !== "string") return "";
  if (url.startsWith("leekam-note://")) return url;
  if (/^\s*(javascript|vbscript|data):/i.test(url)) return "";
  return url;
}

function MarkdownPreview({ content, onToggleTask, linkIndex, onOpenInternalLink }) {
  const transformed = useMemo(
    () => (linkIndex ? transformWikiLinks(content, linkIndex) : content),
    [content, linkIndex],
  );

  if (!content.trim()) {
    return (
      <div className="markdown-preview-empty">
        <FileText size={20} />
        <p>Nothing to preview yet. Start writing in Markdown.</p>
      </div>
    );
  }

  const components = {
    a: ({ node, href, children, ...props }) => {
      if (typeof href === "string" && href.startsWith("leekam-note://")) {
        const rawBody = decodeURIComponent(href.slice("leekam-note://".length));
        const resolution = linkIndex
          ? resolveLinkBody(linkIndex, rawBody)
          : { status: "missing" };
        const title =
          resolution.status === "resolved"
            ? `Open ${resolution.note.title}`
            : resolution.status === "trashed"
              ? "This note is in Trash"
              : resolution.status === "ambiguous"
                ? "This title matches more than one note"
                : "No matching note yet";
        return (
          <a
            {...props}
            href="#"
            className={`internal-link internal-link-${resolution.status}`}
            title={title}
            data-internal-link={rawBody}
            onClick={(event) => {
              event.preventDefault();
              onOpenInternalLink(rawBody);
            }}
          >
            {children}
          </a>
        );
      }
      return <a {...props} href={href} target="_blank" rel="noreferrer noopener" />;
    },
    input: ({ node, type, checked, disabled, ...props }) => {
      if (type === "checkbox") {
        return (
          <input
            {...props}
            type="checkbox"
            checked={Boolean(checked)}
            onChange={(event) => {
              const root = event.currentTarget.closest(".markdown-body");
              const boxes = root ? [...root.querySelectorAll('input[type="checkbox"]')] : [];
              const index = boxes.indexOf(event.currentTarget);
              if (index >= 0) onToggleTask(index);
            }}
            aria-label="Toggle task"
          />
        );
      }
      return <input {...props} type={type} />;
    },
  };

  return (
    <div className="markdown-body">
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
        urlTransform={safeMarkdownUrl}
      >
        {transformed}
      </Markdown>
    </div>
  );
}

function getCaretCoordinates(textarea, position) {
  if (!textarea) return { left: 16, top: 12 };
  const mirror = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  const properties = [
    "boxSizing",
    "width",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "textIndent",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
  ];
  properties.forEach((property) => {
    mirror.style[property] = style[property];
  });
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.wordWrap = "break-word";
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const left = textarea.offsetLeft + marker.offsetLeft;
  const top = textarea.offsetTop + marker.offsetTop - textarea.scrollTop + 24;
  document.body.removeChild(mirror);
  return { left: Math.max(12, left), top: Math.max(8, top) };
}

function getLineBounds(text, position) {
  const start = text.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
  const nextBreak = text.indexOf("\n", position);
  return { start, end: nextBreak === -1 ? text.length : nextBreak };
}

function getNextListPrefix(line) {
  const match = line.match(/^(\s*)([-*+]|\d+\.)(\s+)(\[[ xX]\]\s+)?/);
  if (!match) return null;

  const [, indent, marker, spacing, task] = match;
  const rest = line.slice(match[0].length);
  const nextMarker = /^\d+\.$/.test(marker)
    ? `${Number.parseInt(marker, 10) + 1}.`
    : marker;
  return {
    prefix: match[0],
    replacement: `${indent}${nextMarker}${spacing}${task ? "[ ] " : ""}`,
    rest,
  };
}

export default function NoteEditor({
  note,
  notes = [],
  folders = [],
  linkIndex,
  backlinks = [],
  outgoingLinks = [],
  brokenLinks = [],
  trashedLinks = [],
  relatedNotes = [],
  storageError,
  saveStatus = "saved",
  focusTitleTick,
  editorVisible,
  trashMode = false,
  trashCount = 0,
  retentionLabel = "",
  onBack,
  onNewNote,
  onUpdate,
  onTogglePin,
  onToggleFavorite,
  onDelete,
  onCopy,
  onExport,
  onEmptyTrash,
  onOpenNote,
  onOpenInternalLink,
  onOpenHistory,
  onOpenDailyDate,
  onOpenToday,
}) {
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const [viewMode, setViewMode] = useState("write");
  const [linkMenu, setLinkMenu] = useState({
    open: false,
    start: 0,
    end: 0,
    items: [],
    activeIndex: 0,
    left: 16,
    top: 12,
  });

  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const tagInputRef = useRef(null);
  const colorRef = useRef(null);
  const exportRef = useRef(null);
  const folderRef = useRef(null);

  const folderOptions = useMemo(() => flattenFolderTree(folders), [folders]);
  const folderName = getFolderName(folders, note?.folderId);

  useEffect(() => {
    setTagOpen(false);
    setTagDraft("");
    setColorOpen(false);
    setExportOpen(false);
    setFolderOpen(false);
    setViewMode("write");
    setLinkMenu((current) => ({ ...current, open: false }));
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [note?.id]);

  useEffect(() => {
    const resizeTitle = () => {
      const el = titleRef.current;
      if (!el) return;
      el.style.height = "0px";
      el.style.height = `${el.scrollHeight}px`;
    };

    resizeTitle();
    window.addEventListener("resize", resizeTitle);
    return () => window.removeEventListener("resize", resizeTitle);
  }, [note?.id, note?.title, editorVisible]);

  useEffect(() => {
    if (focusTitleTick > 0 && titleRef.current) {
      titleRef.current.focus();
      const end = titleRef.current.value.length;
      titleRef.current.setSelectionRange(end, end);
    }
  }, [focusTitleTick]);

  useEffect(() => {
    if (tagOpen) tagInputRef.current?.focus();
  }, [tagOpen]);

  useEffect(() => {
    if (!colorOpen && !exportOpen && !folderOpen) return undefined;

    const handlePointerDown = (event) => {
      if (colorOpen && !colorRef.current?.contains(event.target)) setColorOpen(false);
      if (exportOpen && !exportRef.current?.contains(event.target)) setExportOpen(false);
      if (folderOpen && !folderRef.current?.contains(event.target)) setFolderOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setColorOpen(false);
      setExportOpen(false);
      setFolderOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [colorOpen, exportOpen, folderOpen]);

  useEffect(() => {
    if (!linkMenu.open) return undefined;
    const handlePointerDown = (event) => {
      if (event.target.closest(".link-autocomplete")) return;
      if (event.target === bodyRef.current) return;
      setLinkMenu((current) => ({ ...current, open: false }));
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [linkMenu.open]);

  if (!note) {
    return (
      <section className="editor-pane editor-pane-empty" aria-label="Note editor">
        {trashMode ? (
          <TrashEmptyState
            trashCount={trashCount}
            retentionLabel={retentionLabel}
            onEmptyTrash={onEmptyTrash}
          />
        ) : (
          <EditorEmptyState onNewNote={onNewNote} />
        )}
      </section>
    );
  }

  const stats = getMarkdownStats(note.content);

  const commitTag = () => {
    const tag = normalizeTag(tagDraft);
    if (tag && !note.tags.includes(tag)) {
      onUpdate({ tags: [...note.tags, tag] });
    }
    setTagDraft("");
    setTagOpen(false);
  };

  const removeTag = (tag) => {
    onUpdate({ tags: note.tags.filter((item) => item !== tag) });
  };

  const setBodyContent = (content, selectionStart, selectionEnd) => {
    onUpdate({ content });
    window.requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (!body) return;
      body.focus();
      if (Number.isFinite(selectionStart) && Number.isFinite(selectionEnd)) {
        body.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  };

  const wrapSelection = (before, after = before, placeholder = "text") => {
    const body = bodyRef.current;
    if (!body) return;
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const selected = note.content.slice(start, end);
    const insert = `${before}${selected || placeholder}${after}`;
    const next = note.content.slice(0, start) + insert + note.content.slice(end);
    const innerStart = start + before.length;
    setBodyContent(next, innerStart, innerStart + (selected || placeholder).length);
  };

  const insertLink = () => {
    const body = bodyRef.current;
    if (!body) return;
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const selected = note.content.slice(start, end) || "link text";
    const insert = `[${selected}](https://)`;
    const next = note.content.slice(0, start) + insert + note.content.slice(end);
    const urlStart = start + selected.length + 3;
    setBodyContent(next, urlStart, urlStart + 8);
  };

  const closeLinkMenu = () => {
    setLinkMenu((current) => ({ ...current, open: false }));
  };

  const refreshLinkMenu = (value, cursor) => {
    const before = value.slice(0, cursor);
    const start = before.lastIndexOf("[[");
    if (start === -1) {
      closeLinkMenu();
      return;
    }
    const tail = before.slice(start + 2);
    if (tail.includes("]]") || tail.includes("\n") || tail.includes("|") || tail.length > 80) {
      closeLinkMenu();
      return;
    }
    const items = getLinkSuggestions(notes, tail, folders, 7);
    const position = getCaretCoordinates(bodyRef.current, cursor);
    setLinkMenu((current) => ({
      open: true,
      start,
      end: cursor,
      items,
      activeIndex:
        current.open && current.start === start
          ? Math.min(current.activeIndex, Math.max(0, items.length - 1))
          : 0,
      left: position.left,
      top: position.top,
    }));
  };

  const chooseLinkSuggestion = (item) => {
    if (!item) return;
    const link = formatWikiLink(item.note, item.duplicate);
    const next =
      note.content.slice(0, linkMenu.start) + link + note.content.slice(linkMenu.end);
    const cursor = linkMenu.start + link.length;
    closeLinkMenu();
    setBodyContent(next, cursor, cursor);
  };

  const insertInternalLink = () => {
    const body = bodyRef.current;
    if (!body) return;
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const selected = note.content.slice(start, end);
    const insert = selected ? `[[${selected}]]` : `[[]]`;
    const next = note.content.slice(0, start) + insert + note.content.slice(end);
    const cursor = selected ? start + 2 + selected.length : start + 2;
    setBodyContent(next, cursor, cursor);
    window.requestAnimationFrame(() => refreshLinkMenu(next, cursor));
  };

  const insertInternalLinkFor = (target) => {
    if (!target) return;
    const duplicate =
      notes.filter(
        (item) =>
          !item.deletedAt &&
          item.title.trim().toLowerCase() === target.title.trim().toLowerCase(),
      ).length > 1;
    const link = formatWikiLink(target, duplicate);
    const body = bodyRef.current;
    const start = body?.selectionStart ?? note.content.length;
    const end = body?.selectionEnd ?? note.content.length;
    const before = note.content.slice(0, start);
    const after = note.content.slice(end);
    const leading = before && !/\s$/.test(before) ? " " : "";
    const trailing = " ";
    const insert = `${leading}${link}${trailing}`;
    const next = before + insert + after;
    const cursor = start + insert.length;
    setBodyContent(next, cursor, cursor);
  };

  const insertCodeBlock = () => {
    const body = bodyRef.current;
    if (!body) return;
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const selected = note.content.slice(start, end) || "code";
    const insert = `\`\`\`\n${selected}\n\`\`\``;
    const next = note.content.slice(0, start) + insert + note.content.slice(end);
    setBodyContent(next, start + 4, start + 4 + selected.length);
  };

  const applyLinePrefix = (prefix) => {
    const body = bodyRef.current;
    if (!body) return;
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const first = getLineBounds(note.content, start);
    const last = getLineBounds(note.content, end);
    const block = note.content.slice(first.start, last.end);
    const lines = block.split("\n");
    const allPrefixed = lines.every((line) => !line.trim() || line.startsWith(prefix));
    const nextLines = lines.map((line) => {
      if (!line.trim()) return line;
      if (allPrefixed) return line.slice(prefix.length);
      return `${prefix}${line}`;
    });
    const replacement = nextLines.join("\n");
    const next = note.content.slice(0, first.start) + replacement + note.content.slice(last.end);
    const delta = replacement.length - block.length;
    setBodyContent(next, Math.max(first.start, start + (allPrefixed ? -prefix.length : prefix.length)), end + delta);
  };

  const handleBodyKeyDown = (event) => {
    const modifier = event.metaKey || event.ctrlKey;

    if (linkMenu.open) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setLinkMenu((current) => ({
          ...current,
          activeIndex:
            current.items.length === 0
              ? 0
              : (current.activeIndex + 1) % current.items.length,
        }));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setLinkMenu((current) => ({
          ...current,
          activeIndex:
            current.items.length === 0
              ? 0
              : (current.activeIndex - 1 + current.items.length) % current.items.length,
        }));
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        chooseLinkSuggestion(linkMenu.items[linkMenu.activeIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeLinkMenu();
        return;
      }
    }

    if (modifier && event.shiftKey && event.key.toLowerCase() === "l") {
      event.preventDefault();
      insertInternalLink();
      return;
    }

    if (modifier && event.key.toLowerCase() === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "bold text");
      return;
    }
    if (modifier && event.key.toLowerCase() === "i") {
      event.preventDefault();
      wrapSelection("_", "_", "italic text");
      return;
    }
    if (modifier && event.shiftKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      insertLink();
      return;
    }
    if (modifier && event.key.toLowerCase() === "e") {
      event.preventDefault();
      wrapSelection("`", "`", "code");
      return;
    }

    if (event.key !== "Enter" || event.shiftKey) return;

    const body = bodyRef.current;
    if (!body) return;
    const cursor = body.selectionStart;
    if (cursor !== body.selectionEnd) return;

    const { start } = getLineBounds(note.content, cursor);
    const line = note.content.slice(start, cursor);
    const list = getNextListPrefix(line);
    const quoteMatch = line.match(/^(\s*>\s?)(.*)$/);

    if (list) {
      event.preventDefault();
      if (!list.rest.trim()) {
        const next = note.content.slice(0, start) + note.content.slice(cursor);
        setBodyContent(next, start, start);
      } else {
        const insert = `\n${list.replacement}`;
        const next = note.content.slice(0, cursor) + insert + note.content.slice(cursor);
        setBodyContent(next, cursor + insert.length, cursor + insert.length);
      }
      return;
    }

    if (quoteMatch) {
      event.preventDefault();
      if (!quoteMatch[2].trim()) {
        const next = note.content.slice(0, start) + note.content.slice(cursor);
        setBodyContent(next, start, start);
      } else {
        const insert = `\n${quoteMatch[1]}`;
        const next = note.content.slice(0, cursor) + insert + note.content.slice(cursor);
        setBodyContent(next, cursor + insert.length, cursor + insert.length);
      }
    }
  };

  const viewModes = [
    { id: "write", label: "Write", icon: PencilLine },
    { id: "split", label: "Split", icon: Columns2 },
    { id: "preview", label: "Preview", icon: Eye },
  ];

  return (
    <section className="editor-pane" aria-label="Note editor">
      <div className="editor-toolbar">
        <div className="editor-toolbar-left">
          <button
            className="icon-button editor-back"
            type="button"
            onClick={onBack}
            aria-label="Back to notes"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="editor-meta">
            <span>{formatEditedAt(note.updatedAt)}</span>
            <span className="meta-dot" aria-hidden="true" />
            <span>{stats.readMinutes} min read</span>
          </div>
        </div>

        <div className="editor-actions">
          <button
            className={`icon-button ${note.pinned ? "is-active" : ""}`}
            type="button"
            onClick={onTogglePin}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
            title={note.pinned ? "Unpin note" : "Pin note"}
          >
            <Pin size={17} fill={note.pinned ? "currentColor" : "none"} />
          </button>
          <button
            className={`icon-button ${note.favorite ? "is-active" : ""}`}
            type="button"
            onClick={onToggleFavorite}
            aria-label={note.favorite ? "Remove from favorites" : "Add to favorites"}
            title={note.favorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={17} fill={note.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onOpenHistory}
            aria-label="Open version history"
            title="Version history"
          >
            <History size={17} />
          </button>

          <div className="color-picker" ref={colorRef}>
            <button
              className="color-trigger"
              type="button"
              onClick={() => setColorOpen((open) => !open)}
              aria-label="Change note colour"
              aria-expanded={colorOpen}
              title="Note colour"
            >
              <span
                className="color-trigger-dot"
                style={{ background: NOTE_COLORS.find((c) => c.id === note.color)?.value }}
              />
            </button>
            {colorOpen && (
              <div className="color-menu" role="dialog" aria-label="Choose note colour">
                <p>Note colour</p>
                <div className="color-grid">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color.id}
                      className={`color-swatch ${
                        note.color === color.id ? "is-selected" : ""
                      }`}
                      type="button"
                      style={{ "--swatch": color.value }}
                      onClick={() => {
                        onUpdate({ color: color.id }, false);
                        setColorOpen(false);
                      }}
                      aria-label={color.label}
                      aria-pressed={note.color === color.id}
                      title={color.label}
                    >
                      <span />
                      {note.color === color.id && <Check size={12} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="editor-menu-wrap" ref={exportRef}>
            <button
              className="icon-button"
              type="button"
              onClick={() => setExportOpen((open) => !open)}
              aria-label="Export note"
              aria-expanded={exportOpen}
              title="Export note"
            >
              <Download size={17} />
            </button>
            {exportOpen && (
              <div className="editor-popover export-menu" role="menu" aria-label="Export note">
                <p>Export note</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExport(noteToMarkdown(note, folderName), "md", "text/markdown");
                    setExportOpen(false);
                  }}
                >
                  <FileText size={15} />
                  <span>Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onExport(noteToPlainText(note, folderName), "txt", "text/plain");
                    setExportOpen(false);
                  }}
                >
                  <FileText size={15} />
                  <span>Plain text (.txt)</span>
                </button>
              </div>
            )}
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onCopy}
            aria-label="Copy note"
            title="Copy note"
          >
            <Copy size={17} />
          </button>
          <button
            className="icon-button icon-button-danger"
            type="button"
            onClick={onDelete}
            aria-label="Move note to Trash"
            title="Move to Trash"
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      <div className="editor-main">
        <textarea
          ref={titleRef}
          className="note-title-input"
          rows={1}
          value={note.title}
          placeholder="Untitled note"
          aria-label="Note title"
          maxLength={180}
          spellCheck="true"
          onChange={(event) => onUpdate({ title: event.target.value.replace(/\n/g, " ") })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              bodyRef.current?.focus();
            }
          }}
        />

        <div className="editor-tags">
          {note.tags.map((tag) => (
            <span className="editor-tag" key={tag}>
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </span>
          ))}

          {tagOpen ? (
            <input
              ref={tagInputRef}
              className="tag-entry"
              type="text"
              value={tagDraft}
              aria-label="New tag"
              placeholder="tag name"
              maxLength={28}
              onChange={(event) => setTagDraft(event.target.value)}
              onBlur={commitTag}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  commitTag();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setTagDraft("");
                  setTagOpen(false);
                }
              }}
            />
          ) : (
            <button className="add-tag-button" type="button" onClick={() => setTagOpen(true)}>
              <Plus size={12} strokeWidth={2.4} />
              Tag
            </button>
          )}

          <span className="tag-folder-divider" aria-hidden="true" />

          <div className="folder-picker" ref={folderRef}>
            <button
              className={`folder-chip ${note.folderId ? "has-folder" : ""}`}
              type="button"
              onClick={() => setFolderOpen((open) => !open)}
              aria-expanded={folderOpen}
              aria-label={`Move note to folder. Current folder: ${folderName || "No folder"}`}
            >
              <Folder size={12} />
              <span>{folderName || "No folder"}</span>
              <ChevronDown size={11} />
            </button>
            {folderOpen && (
              <div className="editor-popover folder-picker-menu" role="listbox" aria-label="Choose folder">
                <button
                  className={`folder-option ${!note.folderId ? "is-selected" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={!note.folderId}
                  onClick={() => {
                    onUpdate({ folderId: null }, false);
                    setFolderOpen(false);
                  }}
                >
                  <Folder size={14} />
                  <span>No folder</span>
                  {!note.folderId && <Check size={13} />}
                </button>
                {folderOptions.map(({ folder, depth }) => (
                  <button
                    key={folder.id}
                    className={`folder-option ${
                      note.folderId === folder.id ? "is-selected" : ""
                    }`}
                    type="button"
                    role="option"
                    aria-selected={note.folderId === folder.id}
                    onClick={() => {
                      onUpdate({ folderId: folder.id }, false);
                      setFolderOpen(false);
                    }}
                  >
                    <span
                      className="folder-option-indent"
                      style={{ width: `${depth * 13}px` }}
                    />
                    <Folder size={14} />
                    <span>{folder.name}</span>
                    {note.folderId === folder.id && <Check size={13} />}
                  </button>
                ))}
                {folderOptions.length === 0 && (
                  <p className="folder-picker-empty">Create a folder from the sidebar first.</p>
                )}
              </div>
            )}
          </div>
        </div>

        {note.dailyDate && (
          <div className="daily-note-bar">
            <button
              className="daily-nav-button"
              type="button"
              onClick={() => onOpenDailyDate(shiftDateKey(note.dailyDate, -1))}
              title="Previous daily note"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="daily-note-date">
              <CalendarDays size={14} />
              {formatDailyHeading(note.dailyDate)}
            </span>
            <button
              className="daily-nav-button"
              type="button"
              onClick={() => onOpenDailyDate(shiftDateKey(note.dailyDate, 1))}
              title="Next daily note"
            >
              Next
              <ChevronRight size={14} />
            </button>
            <button className="daily-today-button" type="button" onClick={onOpenToday}>
              Today
            </button>
          </div>
        )}

        <div className="markdown-toolbar">
          <div className="markdown-tools" role="toolbar" aria-label="Markdown formatting">
            <button
              className="format-button"
              type="button"
              onClick={() => applyLinePrefix("## ")}
              title="Heading"
              aria-label="Insert heading"
            >
              <Heading2 size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={() => wrapSelection("**", "**", "bold text")}
              title="Bold (Ctrl/⌘ B)"
              aria-label="Bold"
            >
              <Bold size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={() => wrapSelection("_", "_", "italic text")}
              title="Italic (Ctrl/⌘ I)"
              aria-label="Italic"
            >
              <Italic size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={insertLink}
              title="External link (Ctrl/⌘ Shift K)"
              aria-label="Insert external link"
            >
              <Link2 size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={insertInternalLink}
              title="Internal note link (Ctrl/⌘ Shift L)"
              aria-label="Insert internal note link"
            >
              <InternalLinkIcon size={15} />
            </button>
            <span className="format-divider" aria-hidden="true" />
            <button
              className="format-button"
              type="button"
              onClick={() => wrapSelection("`", "`", "code")}
              title="Inline code (Ctrl/⌘ E)"
              aria-label="Inline code"
            >
              <Code2 size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={insertCodeBlock}
              title="Code block"
              aria-label="Code block"
            >
              <Braces size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={() => applyLinePrefix("> ")}
              title="Quote"
              aria-label="Quote"
            >
              <Quote size={15} />
            </button>
            <span className="format-divider" aria-hidden="true" />
            <button
              className="format-button"
              type="button"
              onClick={() => applyLinePrefix("- ")}
              title="Bullet list"
              aria-label="Bullet list"
            >
              <List size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={() => applyLinePrefix("1. ")}
              title="Numbered list"
              aria-label="Numbered list"
            >
              <ListOrdered size={15} />
            </button>
            <button
              className="format-button"
              type="button"
              onClick={() => applyLinePrefix("- [ ] ")}
              title="Task list"
              aria-label="Task list"
            >
              <ListTodo size={15} />
            </button>
          </div>

          <div className="view-switcher" role="group" aria-label="Editor view">
            {viewModes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`view-switch ${viewMode === id ? "is-active" : ""}`}
                type="button"
                onClick={() => setViewMode(id)}
                aria-pressed={viewMode === id}
                title={`${label} view`}
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="editor-rule" />

        <div className={`editor-writing mode-${viewMode}`}>
          <div className="editor-write-pane">
            {linkMenu.open && (
              <div
                className="link-autocomplete"
                style={{ left: `${linkMenu.left}px`, top: `${linkMenu.top}px` }}
                role="listbox"
                aria-label="Internal link suggestions"
              >
                <div className="link-autocomplete-heading">
                  <span>Link to a note</span>
                  <kbd>↑↓</kbd>
                  <kbd>Enter</kbd>
                </div>
                {linkMenu.items.length === 0 ? (
                  <p className="link-autocomplete-empty">
                    No matching note. Keep typing to create a title link.
                  </p>
                ) : (
                  linkMenu.items.map((item, index) => (
                    <button
                      key={item.note.id}
                      className={`link-suggestion ${
                        index === linkMenu.activeIndex ? "is-active" : ""
                      }`}
                      type="button"
                      role="option"
                      aria-selected={index === linkMenu.activeIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() =>
                        setLinkMenu((current) => ({ ...current, activeIndex: index }))
                      }
                      onClick={() => chooseLinkSuggestion(item)}
                    >
                      <span className="link-suggestion-title">{item.note.title}</span>
                      <span className="link-suggestion-meta">
                        {item.folderName || "Unfiled"}
                        {item.duplicate ? " · duplicate title, ID link" : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <textarea
              ref={bodyRef}
              className="note-body-input"
              value={note.content}
              placeholder="Let the thoughts land here… Type [[ to link another note."
              aria-label="Note content in Markdown"
              spellCheck="true"
              onChange={(event) => {
                const value = event.target.value;
                const cursor = event.target.selectionStart;
                onUpdate({ content: value });
                refreshLinkMenu(value, cursor);
              }}
              onKeyDown={handleBodyKeyDown}
              onKeyUp={(event) => {
                if (event.key === "Escape") return;
                refreshLinkMenu(event.currentTarget.value, event.currentTarget.selectionStart);
              }}
              onClick={(event) =>
                refreshLinkMenu(event.currentTarget.value, event.currentTarget.selectionStart)
              }
              onScroll={() => closeLinkMenu()}
            />
          </div>
          {viewMode !== "write" && (
            <div className="editor-preview-pane">
              <MarkdownPreview
                content={note.content}
                linkIndex={linkIndex}
                onOpenInternalLink={onOpenInternalLink}
                onToggleTask={(index) =>
                  onUpdate({ content: toggleTaskAtIndex(note.content, index) })
                }
              />
            </div>
          )}
        </div>

        <ConnectionsPanel
          note={note}
          backlinks={backlinks}
          outgoing={outgoingLinks}
          broken={brokenLinks}
          trashed={trashedLinks}
          related={relatedNotes}
          folders={folders}
          onOpenNote={onOpenNote}
          onInsertLink={insertInternalLinkFor}
        />
      </div>

      <footer className="editor-footer">
        <div className="editor-stats">
          <span>
            {stats.words} {stats.words === 1 ? "word" : "words"}
          </span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{stats.characters.toLocaleString()} characters</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>Markdown</span>
        </div>
        <span
          className={`save-status ${
            storageError || saveStatus === "error"
              ? "has-error"
              : saveStatus === "saving"
                ? "is-saving"
                : ""
          }`}
          title={
            storageError || saveStatus === "error"
              ? "Browser storage could not save the latest change. Open Backup & storage for guidance."
              : saveStatus === "saving"
                ? "Saving to this browser"
                : "Saved in this browser"
          }
        >
          {storageError || saveStatus === "error" ? (
            <AlertCircle size={13} />
          ) : saveStatus === "saving" ? (
            <span className="save-spinner" aria-hidden="true" />
          ) : (
            <Check size={13} strokeWidth={2.5} />
          )}
          {storageError || saveStatus === "error"
            ? "Save failed"
            : saveStatus === "saving"
              ? "Saving…"
              : "Saved locally"}
        </span>
      </footer>
    </section>
  );
}
