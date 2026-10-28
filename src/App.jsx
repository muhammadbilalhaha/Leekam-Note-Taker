import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "./components/ConfirmDialog";
import Dashboard from "./components/Dashboard";
import DataDialog from "./components/DataDialog";
import FolderDialog from "./components/FolderDialog";
import GraphView from "./components/GraphView";
import NoteEditor from "./components/NoteEditor";
import NoteList from "./components/NoteList";
import Sidebar from "./components/Sidebar";
import TemplatePickerDialog from "./components/TemplatePickerDialog";
import TextPromptDialog from "./components/TextPromptDialog";
import Toast from "./components/Toast";
import VersionHistoryDialog from "./components/VersionHistoryDialog";
import {
  FOLDERS_KEY,
  getFolderDescendantIds,
  getFolderNoteCounts,
  loadFolders,
  makeFolder,
  parseFolders,
  removeFolder,
  saveFolders,
} from "./lib/folders";
import {
  SETTINGS_KEY,
  buildBackup,
  downloadFile,
  getBackupFilename,
  getRetentionLabel,
  loadSettings,
  parseSettings,
  purgeExpiredTrash,
  sanitizeFilename,
  saveSettings,
} from "./lib/backup";
import {
  NOTE_COLORS,
  STORAGE_KEY,
  THEME_KEY,
  copyToClipboard,
  excerpt,
  getFilterTitle,
  getGlobalSearchResults,
  getTagSummary,
  getVisibleNotes,
  isMacPlatform,
  loadNotes,
  makeId,
  makeNote,
  parseNotes,
  saveNotes,
} from "./lib/notes";
import {
  KNOWLEDGE_KEY,
  addRecentNote,
  loadKnowledge,
  makeSavedSearch,
  parseKnowledge,
  pruneRecent,
  saveKnowledge,
} from "./lib/knowledge";
import {
  VERSIONS_KEY,
  addVersion,
  loadVersions,
  parseVersions,
  pruneVersions,
  removeVersionsForNotes,
  saveVersions,
  shouldSnapshot,
} from "./lib/versions";
import {
  buildLinkIndex,
  getBacklinks,
  getBrokenLinks,
  getOutgoingLinks,
  getTrashedLinks,
  resolveLinkBody,
  updateLinksForRenamedNote,
} from "./lib/links";
import { getRelatedNotes } from "./lib/related";
import {
  DAILY_TEMPLATE_ID,
  createNoteFromTemplate,
  makeTemplate,
  renderTemplateText,
} from "./lib/templates";
import {
  findDailyNote,
  formatDailyTitle,
  getLocalDateKey,
  makeDailyNote,
  parseLocalDateKey,
  shiftDateKey,
} from "./lib/daily";
import { getBackupReminder } from "./lib/storage";
import { buildVaultFiles, createVaultZip, getVaultFilename } from "./lib/vault";
import { downloadBytes } from "./lib/zip";

const EMPTY_SEARCH_RESULTS = { notes: [], folders: [], tags: [], views: [], total: 0 };
const SPECIAL_FILTERS = new Set(["dashboard", "graph"]);

function getInitialActiveId(notes, recent = []) {
  const active = notes.filter((note) => !note.deletedAt);
  const activeIds = new Set(active.map((note) => note.id));
  const recentId = recent.find((entry) => activeIds.has(entry.noteId))?.noteId;
  if (recentId) return recentId;
  return [...active].sort((a, b) => b.updatedAt - a.updatedAt)[0]?.id ?? null;
}

function getCreatedNoteColor(notes) {
  return NOTE_COLORS[notes.length % NOTE_COLORS.length].id;
}

export default function App() {
  const [initialWorkspace] = useState(() => ({
    notes: loadNotes(),
    folders: loadFolders(),
    settings: loadSettings(),
    knowledge: loadKnowledge(),
    versions: loadVersions(),
  }));
  const [notes, setNotes] = useState(initialWorkspace.notes);
  const [folders, setFolders] = useState(initialWorkspace.folders);
  const [settings, setSettings] = useState(initialWorkspace.settings);
  const [knowledge, setKnowledge] = useState(initialWorkspace.knowledge);
  const [versions, setVersions] = useState(initialWorkspace.versions);
  const [activeId, setActiveId] = useState(() =>
    getInitialActiveId(initialWorkspace.notes, initialWorkspace.knowledge.recent),
  );
  const [filter, setFilter] = useState({ type: "all" });
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const [theme, setTheme] = useState(() =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [toast, setToast] = useState(null);
  const [focusTitleTick, setFocusTitleTick] = useState(0);
  const [saveState, setSaveState] = useState({ status: "saved", at: null, errors: {} });
  const [dataOpen, setDataOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [searchDialog, setSearchDialog] = useState(null);
  const [todayKey, setTodayKey] = useState(() => getLocalDateKey(new Date()));

  const searchRef = useRef(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const lastPersistedRef = useRef({});
  const saveErrorsRef = useRef({});
  const saveTimerRef = useRef(null);
  const isMac = useMemo(() => isMacPlatform(), []);
  const isTrash = filter.type === "trash";
  const isDashboard = filter.type === "dashboard";
  const isGraph = filter.type === "graph";
  const isSpecial = isDashboard || isGraph;
  const storageError = Object.values(saveState.errors).some(Boolean);

  const activeNotes = useMemo(() => notes.filter((note) => !note.deletedAt), [notes]);
  const trashedNotes = useMemo(() => notes.filter((note) => note.deletedAt), [notes]);
  const linkIndex = useMemo(() => buildLinkIndex(notes), [notes]);
  const folderIds = useMemo(
    () =>
      filter.type === "folder"
        ? getFolderDescendantIds(folders, filter.folderId)
        : null,
    [filter, folders],
  );
  const visibleNotes = useMemo(
    () => getVisibleNotes(notes, filter, isTrash ? query : "", folderIds),
    [notes, filter, isTrash, query, folderIds],
  );
  const searchResults = useMemo(
    () =>
      isTrash
        ? EMPTY_SEARCH_RESULTS
        : getGlobalSearchResults(notes, query, folders, { linkIndex }),
    [notes, query, folders, isTrash, linkIndex],
  );
  const tags = useMemo(() => getTagSummary(activeNotes), [activeNotes]);
  const folderCounts = useMemo(() => getFolderNoteCounts(folders, notes), [folders, notes]);
  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeId) ?? null,
    [notes, activeId],
  );
  const pinnedCount = useMemo(
    () => activeNotes.filter((note) => note.pinned).length,
    [activeNotes],
  );
  const favoriteCount = useMemo(
    () => activeNotes.filter((note) => note.favorite).length,
    [activeNotes],
  );
  const filterTitle = getFilterTitle(filter, folders);
  const retentionLabel = getRetentionLabel(settings.trashRetentionDays);
  const backlinks = useMemo(() => getBacklinks(linkIndex, activeId), [linkIndex, activeId]);
  const outgoingLinks = useMemo(
    () => getOutgoingLinks(linkIndex, activeId),
    [linkIndex, activeId],
  );
  const brokenLinks = useMemo(() => getBrokenLinks(linkIndex, activeId), [linkIndex, activeId]);
  const trashedLinks = useMemo(() => getTrashedLinks(linkIndex, activeId), [linkIndex, activeId]);
  const relatedNotes = useMemo(
    () =>
      activeNote
        ? getRelatedNotes(notes, activeNote.id, folders, linkIndex)
        : [],
    [notes, activeNote, folders, linkIndex],
  );
  const todayNote = useMemo(() => findDailyNote(notes, todayKey), [notes, todayKey]);
  const backupReminder = useMemo(
    () => getBackupReminder(settings, notes),
    [settings, notes],
  );

  useEffect(() => {
    const previous = lastPersistedRef.current;
    const changed = [];
    if (previous.notes !== notes) changed.push("notes");
    if (previous.folders !== folders) changed.push("folders");
    if (previous.settings !== settings) changed.push("settings");
    if (previous.knowledge !== knowledge) changed.push("knowledge");
    if (previous.versions !== versions) changed.push("versions");
    if (changed.length === 0) return;

    setSaveState((current) => ({ ...current, status: "saving" }));
    const errors = { ...saveErrorsRef.current };
    if (changed.includes("notes")) errors.notes = !saveNotes(notes);
    if (changed.includes("folders")) errors.folders = !saveFolders(folders);
    if (changed.includes("settings")) errors.settings = !saveSettings(settings);
    if (changed.includes("knowledge")) errors.knowledge = !saveKnowledge(knowledge);
    if (changed.includes("versions")) errors.versions = !saveVersions(versions);
    saveErrorsRef.current = errors;
    const failed = Object.values(errors).some(Boolean);
    lastPersistedRef.current = { notes, folders, settings, knowledge, versions };
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      setSaveState({ status: failed ? "error" : "saved", at: Date.now(), errors });
    }, 220);
  }, [notes, folders, settings, knowledge, versions]);

  useEffect(
    () => () => {
      window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    setVersions((current) => pruneVersions(current, notes, settings.versionLimit));
  }, [notes.length, settings.versionLimit]);

  useEffect(() => {
    setKnowledge((current) => {
      const recent = pruneRecent(current.recent, notes);
      return recent.length === current.recent.length ? current : { ...current, recent };
    });
  }, [notes.length]);

  useEffect(() => {
    if (!settings.trashRetentionDays) return;
    setNotes((current) => {
      const next = purgeExpiredTrash(current, settings.trashRetentionDays);
      return next.length === current.length ? current : next;
    });
  }, [settings.trashRetentionDays]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // A theme preference is not critical if storage is unavailable.
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0c1512" : "#17352b");
  }, [theme]);

  useEffect(() => {
    document.title = activeNote?.title.trim()
      ? `${activeNote.title.trim()} — Leekam`
      : "Leekam — Notes, kept close";
  }, [activeNote?.title]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTodayKey(getLocalDateKey(new Date()));
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.newValue == null) return;
      if (event.key === STORAGE_KEY) {
        const nextNotes = parseNotes(event.newValue);
        if (nextNotes) setNotes(nextNotes);
      } else if (event.key === FOLDERS_KEY) {
        const nextFolders = parseFolders(event.newValue);
        if (nextFolders) setFolders(nextFolders);
      } else if (event.key === SETTINGS_KEY) {
        const nextSettings = parseSettings(event.newValue);
        if (nextSettings) setSettings(nextSettings);
      } else if (event.key === KNOWLEDGE_KEY) {
        const nextKnowledge = parseKnowledge(event.newValue);
        if (nextKnowledge) setKnowledge(nextKnowledge);
      } else if (event.key === VERSIONS_KEY) {
        const nextVersions = parseVersions(event.newValue);
        if (nextVersions) setVersions(nextVersions);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (isTrash) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (isSpecial) return;
    if (activeId && visibleNotes.some((note) => note.id === activeId)) return;
    setActiveId(visibleNotes[0]?.id ?? null);
  }, [activeId, visibleNotes, isTrash, isSpecial]);

  const dismissToast = useCallback(() => setToast(null), []);

  const recordRecent = useCallback((id) => {
    setKnowledge((current) => ({
      ...current,
      recent: addRecentNote(current.recent, id),
    }));
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const note = notesRef.current.find((item) => item.id === activeId);
    if (!note || note.deletedAt) return;
    setKnowledge((current) => {
      if (current.recent[0]?.noteId === activeId) return current;
      return {
        ...current,
        recent: addRecentNote(current.recent, activeId),
      };
    });
  }, [activeId]);

  const handleFilterChange = useCallback(
    (nextFilter) => {
      setFilter(nextFilter);
      setQuery("");
      setSidebarOpen(false);
      setMobileEditorOpen(false);

      if (nextFilter.type === "trash") {
        setActiveId(null);
        return;
      }
      if (SPECIAL_FILTERS.has(nextFilter.type)) return;

      const nextFolderIds =
        nextFilter.type === "folder"
          ? getFolderDescendantIds(folders, nextFilter.folderId)
          : null;
      const matches = getVisibleNotes(notes, nextFilter, "", nextFolderIds);
      setActiveId((current) =>
        matches.some((note) => note.id === current) ? current : (matches[0]?.id ?? null),
      );
    },
    [notes, folders],
  );

  const handleQueryChange = useCallback((value) => {
    setQuery(value);
  }, []);

  const handleOpenNote = useCallback(
    (id) => {
      const note = notesRef.current.find((item) => item.id === id);
      if (!note) {
        setToast({ id: makeId(), kind: "error", message: "That note could not be found" });
        return;
      }
      if (note.deletedAt) {
        setToast({
          id: makeId(),
          kind: "info",
          message: "That note is in Trash. Restore it to open the link.",
        });
        return;
      }
      setFilter({ type: "all" });
      setQuery("");
      setActiveId(id);
      setMobileEditorOpen(true);
      setSidebarOpen(false);
      recordRecent(id);
    },
    [recordRecent],
  );

  const handleSelectNote = useCallback(
    (id) => {
      setActiveId(id);
      setMobileEditorOpen(true);
      setSidebarOpen(false);
      recordRecent(id);
    },
    [recordRecent],
  );

  const handleSearchNoteSelect = useCallback(
    (id) => {
      handleOpenNote(id);
    },
    [handleOpenNote],
  );

  const handleOpenInternalLink = useCallback(
    (rawBody) => {
      const resolution = resolveLinkBody(linkIndex, rawBody);
      if (resolution.status === "resolved") {
        handleOpenNote(resolution.note.id);
        return;
      }
      const label = resolution.link.label;
      if (resolution.status === "trashed") {
        setToast({
          id: makeId(),
          kind: "info",
          message: `“${label}” is in Trash. Restore it to follow this link.`,
        });
      } else if (resolution.status === "ambiguous") {
        setToast({
          id: makeId(),
          kind: "info",
          message: `“${label}” matches more than one note. Use [[${label}|id]] to disambiguate.`,
        });
      } else {
        setToast({
          id: makeId(),
          kind: "info",
          message: `No note titled “${label}” yet.`,
        });
      }
    },
    [linkIndex, handleOpenNote],
  );

  const handleNewNote = useCallback(() => {
    const nextFilter =
      ["trash", "pinned", "favorites", "graph", "dashboard"].includes(filter.type)
        ? { type: "all" }
        : filter;
    const newNote = makeNote({
      tags: filter.type === "tag" ? [filter.tag] : [],
      folderId: filter.type === "folder" ? filter.folderId : null,
      color: getCreatedNoteColor(activeNotes),
    });

    setNotes((current) => [newNote, ...current]);
    setFilter(nextFilter);
    setQuery("");
    setActiveId(newNote.id);
    setMobileEditorOpen(true);
    setSidebarOpen(false);
    setFocusTitleTick((tick) => tick + 1);
    recordRecent(newNote.id);
  }, [filter, activeNotes, recordRecent]);

  const handleOpenDailyDate = useCallback(
    (dateKey) => {
      const existing = findDailyNote(notes, dateKey);
      if (existing) {
        if (existing.deletedAt) {
          setNotes((current) =>
            current.map((note) =>
              note.id === existing.id ? { ...note, deletedAt: null } : note,
            ),
          );
          setToast({
            id: makeId(),
            kind: "info",
            message: "Daily note restored from Trash",
          });
        }
        setFilter({ type: "all" });
        setQuery("");
        setActiveId(existing.id);
        setMobileEditorOpen(true);
        setSidebarOpen(false);
        recordRecent(existing.id);
        return;
      }

      const template =
        knowledge.templates.find((item) => item.id === settings.dailyTemplateId) ??
        knowledge.templates.find((item) => item.id === DAILY_TEMPLATE_ID) ??
        null;
      const date = parseLocalDateKey(dateKey) ?? new Date();
      const title = formatDailyTitle(dateKey, settings.dailyTitleFormat);
      const preferredFolder =
        settings.dailyFolderId &&
        folders.some((folder) => folder.id === settings.dailyFolderId)
          ? settings.dailyFolderId
          : template?.defaultFolderId &&
              folders.some((folder) => folder.id === template.defaultFolderId)
            ? template.defaultFolderId
            : null;
      const folderId = preferredFolder;
      const note = makeDailyNote({
        dateKey,
        title,
        content: template
          ? renderTemplateText(template.content, { date, dateKey, title })
          : "",
        tags: template?.defaultTags ?? [],
        folderId,
        color: getCreatedNoteColor(activeNotes),
      });

      setNotes((current) => [note, ...current]);
      setFilter({ type: "all" });
      setQuery("");
      setActiveId(note.id);
      setMobileEditorOpen(true);
      setSidebarOpen(false);
      recordRecent(note.id);
      setToast({
        id: makeId(),
        kind: "success",
        message: `Daily note for ${dateKey} created`,
      });
    },
    [notes, knowledge, settings, folders, activeNotes, recordRecent],
  );

  const handleOpenToday = useCallback(() => {
    handleOpenDailyDate(todayKey);
  }, [handleOpenDailyDate, todayKey]);

  const handleUseTemplate = useCallback(
    (template) => {
      const note = createNoteFromTemplate(template, {
        date: new Date(),
        dateKey: getLocalDateKey(new Date()),
        color: getCreatedNoteColor(activeNotes),
      });
      if (!note) return;
      if (note.folderId && !folders.some((folder) => folder.id === note.folderId)) {
        note.folderId = null;
      }
      setNotes((current) => [note, ...current]);
      setFilter({ type: "all" });
      setQuery("");
      setActiveId(note.id);
      setMobileEditorOpen(true);
      setTemplateDialogOpen(false);
      setSidebarOpen(false);
      recordRecent(note.id);
      setToast({
        id: makeId(),
        kind: "success",
        message: `Note created from “${template.name}”`,
      });
    },
    [activeNotes, folders, recordRecent],
  );

  const handleSaveTemplate = useCallback((templateData) => {
    setKnowledge((current) => {
      const existing = templateData.id
        ? current.templates.find((template) => template.id === templateData.id)
        : null;
      if (existing) {
        return {
          ...current,
          templates: current.templates.map((template) =>
            template.id === existing.id
              ? {
                  ...template,
                  ...templateData,
                  id: template.id,
                  builtin: template.builtin,
                  updatedAt: Date.now(),
                }
              : template,
          ),
        };
      }
      const template = makeTemplate({ ...templateData, builtin: false });
      return { ...current, templates: [...current.templates, template] };
    });
    setToast({
      id: makeId(),
      kind: "success",
      message: templateData.id ? "Template updated" : "Template created",
    });
  }, []);

  const handleDuplicateTemplate = useCallback((template) => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = template;
    const copy = makeTemplate({
      ...rest,
      name: `${template.name} copy`,
      builtin: false,
    });
    setKnowledge((current) => ({
      ...current,
      templates: [...current.templates, copy],
    }));
    setToast({ id: makeId(), kind: "success", message: "Template duplicated" });
  }, []);

  const handleDeleteTemplate = useCallback(
    (template) => {
      const remaining = knowledge.templates.filter((item) => item.id !== template.id);
      setKnowledge((current) => ({
        ...current,
        templates: remaining,
      }));
      if (settings.dailyTemplateId === template.id) {
        const fallback =
          remaining.find((item) => item.id === DAILY_TEMPLATE_ID) ?? remaining[0] ?? null;
        setSettings((current) => ({
          ...current,
          dailyTemplateId: fallback?.id ?? "",
        }));
      }
      setToast({ id: makeId(), kind: "info", message: "Template deleted" });
    },
    [knowledge.templates, settings.dailyTemplateId],
  );

  const handleUpdateNote = useCallback(
    (patch, touch = true) => {
      if (!activeId) return;
      const currentNote = notesRef.current.find((note) => note.id === activeId);
      if (!currentNote) return;
      const contentChanged =
        patch.content !== undefined && patch.content !== currentNote.content;
      const titleChanged = patch.title !== undefined && patch.title !== currentNote.title;

      if (
        (contentChanged || titleChanged) &&
        shouldSnapshot(currentNote, versions, Date.now())
      ) {
        setVersions((current) =>
          addVersion(current, currentNote, { limit: settings.versionLimit }),
        );
      }

      setSaveState((current) => ({ ...current, status: "saving" }));
      setNotes((current) => {
        let next = current;
        if (titleChanged) {
          next = updateLinksForRenamedNote(
            current,
            activeId,
            currentNote.title,
            patch.title,
          );
        }
        return next.map((note) =>
          note.id === activeId
            ? {
                ...note,
                ...patch,
                updatedAt: touch ? Date.now() : note.updatedAt,
              }
            : note,
        );
      });
    },
    [activeId, versions, settings.versionLimit],
  );

  const handleTogglePin = useCallback(() => {
    if (!activeId) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === activeId ? { ...note, pinned: !note.pinned } : note,
      ),
    );
  }, [activeId]);

  const handleToggleFavorite = useCallback(() => {
    if (!activeId) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === activeId ? { ...note, favorite: !note.favorite } : note,
      ),
    );
  }, [activeId]);

  const handleDelete = useCallback(() => {
    if (!activeNote || activeNote.deletedAt) return;

    const index = visibleNotes.findIndex((note) => note.id === activeNote.id);
    const remaining = visibleNotes.filter((note) => note.id !== activeNote.id);
    const nextId = remaining[Math.min(Math.max(index, 0), remaining.length - 1)]?.id ?? null;

    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id ? { ...note, deletedAt: Date.now() } : note,
      ),
    );
    setActiveId(nextId);
    if (!nextId) setMobileEditorOpen(false);
    setToast({
      id: makeId(),
      kind: "deleted",
      note: activeNote,
      message: `“${excerpt(activeNote.title.trim() || "Untitled note", 34)}” moved to Trash`,
    });
  }, [activeNote, visibleNotes]);

  const handleUndoDelete = useCallback(() => {
    if (toast?.kind !== "deleted" || !toast.note) return;

    const restored = toast.note;
    setNotes((current) =>
      current.map((note) =>
        note.id === restored.id ? { ...note, deletedAt: null } : note,
      ),
    );
    setFilter({ type: "all" });
    setQuery("");
    setActiveId(restored.id);
    setMobileEditorOpen(true);
    recordRecent(restored.id);
    setToast({
      id: makeId(),
      kind: "info",
      message: "Note restored from Trash",
    });
  }, [toast, recordRecent]);

  const handleRestoreNote = useCallback(
    (noteId) => {
      const note = notes.find((item) => item.id === noteId);
      if (!note) return;
      setNotes((current) =>
        current.map((item) =>
          item.id === noteId ? { ...item, deletedAt: null } : item,
        ),
      );
      setToast({
        id: makeId(),
        kind: "info",
        message: `“${excerpt(note.title.trim() || "Untitled note", 34)}” restored`,
      });
    },
    [notes],
  );

  const handlePermanentDelete = useCallback(
    (note) => {
      setConfirmDialog({
        title: "Delete this note forever?",
        message: `“${excerpt(note.title.trim() || "Untitled note", 54)}” will be removed from Trash permanently, along with its version history. This cannot be undone.`,
        confirmLabel: "Delete forever",
        icon: "trash",
        tone: "danger",
        onConfirm: () => {
          setNotes((current) => current.filter((item) => item.id !== note.id));
          setVersions((current) => removeVersionsForNotes(current, [note.id]));
          setActiveId((current) => (current === note.id ? null : current));
          setToast({
            id: makeId(),
            kind: "info",
            message: "Note permanently deleted",
          });
        },
      });
    },
    [],
  );

  const requestEmptyTrash = useCallback(() => {
    const deleted = notes.filter((note) => note.deletedAt);
    const count = deleted.length;
    if (count === 0) return;

    setConfirmDialog({
      title: "Empty Trash?",
      message: `${count} ${count === 1 ? "note" : "notes"} will be permanently deleted, along with their version history. This cannot be undone.`,
      confirmLabel: "Empty Trash",
      icon: "trash",
      tone: "danger",
      onConfirm: () => {
        const deletedIds = deleted.map((note) => note.id);
        setNotes((current) => current.filter((note) => !note.deletedAt));
        setVersions((current) => removeVersionsForNotes(current, deletedIds));
        setToast({
          id: makeId(),
          kind: "info",
          message: count === 1 ? "Trash emptied · 1 note deleted" : `Trash emptied · ${count} notes deleted`,
        });
      },
    });
  }, [notes]);

  const handleCopy = useCallback(async () => {
    if (!activeNote) return;

    const title = activeNote.title.trim() || "Untitled note";
    const text = `${title}\n\n${activeNote.content}`.trim();
    const copied = await copyToClipboard(text);

    setToast({
      id: makeId(),
      kind: copied ? "success" : "error",
      message: copied ? "Note copied to clipboard" : "Could not copy this note",
    });
  }, [activeNote]);

  const handleExportNote = useCallback(
    (content, extension, mimeType) => {
      if (!activeNote) return;
      const base = sanitizeFilename(activeNote.title.trim() || "Untitled note", "Untitled note");
      downloadFile(`${base}.${extension}`, content, mimeType);
      setToast({
        id: makeId(),
        kind: "success",
        message: `Note exported as .${extension}`,
      });
    },
    [activeNote],
  );

  const handleToggleTheme = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const handleOpenCreateFolder = useCallback((parentId = null) => {
    setFolderDialog({ mode: "create", parentId, folder: null });
    setSidebarOpen(false);
  }, []);

  const handleOpenRenameFolder = useCallback((folder) => {
    setFolderDialog({ mode: "rename", parentId: folder.parentId, folder });
    setSidebarOpen(false);
  }, []);

  const handleFolderSubmit = useCallback(
    (name) => {
      if (!folderDialog) return;

      if (folderDialog.mode === "rename" && folderDialog.folder) {
        const target = folderDialog.folder;
        setFolders((current) =>
          current.map((folder) =>
            folder.id === target.id ? { ...folder, name } : folder,
          ),
        );
        setFolderDialog(null);
        setToast({ id: makeId(), kind: "info", message: "Folder renamed" });
        return;
      }

      const folder = makeFolder({ name, parentId: folderDialog.parentId ?? null });
      setFolders((current) => [...current, folder]);
      setFolderDialog(null);
      setFilter({ type: "folder", folderId: folder.id });
      setQuery("");
      setActiveId(null);
      setMobileEditorOpen(false);
      setToast({ id: makeId(), kind: "info", message: "Folder created" });
    },
    [folderDialog],
  );

  const handleDeleteFolder = useCallback(
    (folder) => {
      setConfirmDialog({
        title: "Delete this folder?",
        message:
          "The folder will be removed. Notes directly inside it move to its parent folder, and subfolders move up one level. No notes are deleted.",
        confirmLabel: "Delete folder",
        icon: "trash",
        tone: "danger",
        onConfirm: () => {
          const result = removeFolder(folders, notes, folder.id);
          setFolders(result.folders);
          setNotes(result.notes);
          if (filter.type === "folder" && filter.folderId === folder.id) {
            setFilter({ type: "all" });
            setQuery("");
          }
          setToast({ id: makeId(), kind: "info", message: "Folder deleted" });
        },
      });
    },
    [folders, notes, filter],
  );

  const handleExportBackup = useCallback(() => {
    const backup = buildBackup(notes, folders, settings, knowledge, versions);
    downloadFile(
      getBackupFilename(),
      JSON.stringify(backup, null, 2),
      "application/json",
    );
    setSettings((current) => ({ ...current, lastBackupAt: Date.now() }));
    setToast({
      id: makeId(),
      kind: "success",
      message: "Backup downloaded",
    });
  }, [notes, folders, settings, knowledge, versions]);

  const handleImportBackup = useCallback((data) => {
    const importedNotes = purgeExpiredTrash(data.notes, data.settings.trashRetentionDays);
    const importedKnowledge = {
      ...data.knowledge,
      recent: pruneRecent(data.knowledge.recent, importedNotes),
    };
    const importedVersions = pruneVersions(
      data.versions ?? {},
      importedNotes,
      data.settings.versionLimit,
    );
    setNotes(importedNotes);
    setFolders(data.folders);
    setSettings(data.settings);
    setKnowledge(importedKnowledge);
    setVersions(importedVersions);
    setFilter({ type: "all" });
    setQuery("");
    setActiveId(getInitialActiveId(importedNotes, importedKnowledge.recent));
    setMobileEditorOpen(false);
    setDataOpen(false);
    setToast({
      id: makeId(),
      kind: "success",
      message: "Backup restored",
    });
  }, []);

  const handleRetentionChange = useCallback((trashRetentionDays) => {
    setSettings((current) => ({ ...current, trashRetentionDays }));
  }, []);

  const handleSettingsPatch = useCallback((patch) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  const handleExportVault = useCallback(() => {
    const files = buildVaultFiles(notes, folders);
    const bytes = createVaultZip(files);
    downloadBytes(getVaultFilename(), bytes, "application/zip");
    setToast({
      id: makeId(),
      kind: "success",
      message: `${files.length} Markdown ${files.length === 1 ? "file" : "files"} exported`,
    });
  }, [notes, folders]);

  const handleImportVault = useCallback(
    (result) => {
      setNotes(result.notes);
      setFolders(result.folders);
      setVersions((current) => pruneVersions(current, result.notes, settings.versionLimit));
      setKnowledge((current) => ({
        ...current,
        recent: pruneRecent(current.recent, result.notes),
      }));
      setFilter({ type: "all" });
      setQuery("");
      setActiveId(getInitialActiveId(result.notes, knowledge.recent));
      setMobileEditorOpen(false);
      setDataOpen(false);
      setToast({
        id: makeId(),
        kind: "success",
        message: `Markdown vault imported · ${result.summary.importedNotes} ${
          result.summary.importedNotes === 1 ? "note" : "notes"
        }`,
      });
    },
    [settings.versionLimit, knowledge.recent],
  );

  const handleSaveCurrentVersion = useCallback(() => {
    if (!activeNote) return;
    setVersions((current) =>
      addVersion(current, activeNote, {
        limit: settings.versionLimit,
        force: true,
      }),
    );
    setToast({ id: makeId(), kind: "success", message: "Current version saved" });
  }, [activeNote, settings.versionLimit]);

  const handleRestoreVersion = useCallback(
    (version) => {
      if (!activeNote) return;
      setVersions((current) =>
        addVersion(current, activeNote, {
          limit: settings.versionLimit,
          force: true,
        }),
      );
      setNotes((current) => {
        const withUpdatedLinks =
          version.title !== activeNote.title
            ? updateLinksForRenamedNote(
                current,
                activeNote.id,
                activeNote.title,
                version.title,
              )
            : current;
        return withUpdatedLinks.map((note) =>
          note.id === activeNote.id
            ? {
                ...note,
                title: version.title,
                content: version.content,
                tags: version.tags,
                folderId:
                  version.folderId && folders.some((folder) => folder.id === version.folderId)
                    ? version.folderId
                    : null,
                color: version.color,
                pinned: version.pinned,
                favorite: version.favorite,
                updatedAt: Date.now(),
              }
            : note,
        );
      });
      setVersionDialogOpen(false);
      setToast({ id: makeId(), kind: "success", message: "Version restored" });
    },
    [activeNote, settings.versionLimit, folders],
  );

  const handleOpenSaveSearch = useCallback(() => {
    if (!query.trim()) return;
    setSearchDialog({ mode: "create", query: query.trim(), search: null });
  }, [query]);

  const handleOpenEditSavedSearch = useCallback((search) => {
    setSearchDialog({ mode: "edit", query: search.query, search });
  }, []);

  const handleSearchDialogSubmit = useCallback(
    (name) => {
      if (!searchDialog) return;
      if (searchDialog.mode === "edit" && searchDialog.search) {
        const target = searchDialog.search;
        setKnowledge((current) => ({
          ...current,
          savedSearches: current.savedSearches.map((search) =>
            search.id === target.id ? { ...search, name, updatedAt: Date.now() } : search,
          ),
        }));
        setToast({ id: makeId(), kind: "success", message: "Saved search renamed" });
      } else {
        const saved = makeSavedSearch({ name, query: searchDialog.query });
        setKnowledge((current) => ({
          ...current,
          savedSearches: [...current.savedSearches, saved],
        }));
        setToast({ id: makeId(), kind: "success", message: "Search saved" });
      }
      setSearchDialog(null);
    },
    [searchDialog],
  );

  const handleApplySavedSearch = useCallback((search) => {
    setFilter({ type: "all" });
    setQuery(search.query);
    setSidebarOpen(false);
    setMobileEditorOpen(false);
    window.setTimeout(() => searchRef.current?.focus(), 40);
  }, []);

  const handleDeleteSavedSearch = useCallback((search) => {
    setConfirmDialog({
      title: "Delete this saved search?",
      message: `“${search.name}” will be removed. Your notes are not affected.`,
      confirmLabel: "Delete search",
      icon: "trash",
      tone: "danger",
      onConfirm: () => {
        setKnowledge((current) => ({
          ...current,
          savedSearches: current.savedSearches.filter((item) => item.id !== search.id),
        }));
        setToast({ id: makeId(), kind: "info", message: "Saved search deleted" });
      },
    });
  }, []);

  const handleOpenData = useCallback(() => {
    setSidebarOpen(false);
    setDataOpen(true);
  }, []);

  const handleOpenTemplates = useCallback(() => {
    setSidebarOpen(false);
    setDataOpen(false);
    setTemplateDialogOpen(true);
  }, []);

  const handleOpenSearchFromDashboard = useCallback(() => {
    setFilter({ type: "all" });
    window.setTimeout(() => {
      searchRef.current?.focus();
      searchRef.current?.select();
    }, 40);
  }, []);

  const handleEmptyTrashFromDialog = useCallback(() => {
    setDataOpen(false);
    requestEmptyTrash();
  }, [requestEmptyTrash]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const modifier = event.metaKey || event.ctrlKey;
      const dialogOpen =
        dataOpen ||
        folderDialog ||
        confirmDialog ||
        templateDialogOpen ||
        versionDialogOpen ||
        searchDialog;

      if (modifier && event.key.toLowerCase() === "k" && !dialogOpen) {
        event.preventDefault();
        setSidebarOpen(false);
        setMobileEditorOpen(false);
        window.setTimeout(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        }, 40);
        return;
      }

      if (modifier && event.shiftKey && event.key.toLowerCase() === "d" && !dialogOpen) {
        event.preventDefault();
        handleOpenToday();
        return;
      }

      if (modifier && event.shiftKey && event.key.toLowerCase() === "g" && !dialogOpen) {
        event.preventDefault();
        handleFilterChange({ type: "graph" });
        return;
      }

      if (event.key === "Escape") {
        if (sidebarOpen) {
          setSidebarOpen(false);
        } else if (mobileEditorOpen) {
          setMobileEditorOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    sidebarOpen,
    mobileEditorOpen,
    dataOpen,
    folderDialog,
    confirmDialog,
    templateDialogOpen,
    versionDialogOpen,
    searchDialog,
    handleOpenToday,
    handleFilterChange,
  ]);

  return (
    <div className={`app-shell ${mobileEditorOpen ? "show-editor" : ""}`}>
      <Sidebar
        filter={filter}
        tags={tags}
        folders={folders}
        folderCounts={folderCounts}
        noteCount={activeNotes.length}
        pinnedCount={pinnedCount}
        favoriteCount={favoriteCount}
        trashCount={trashedNotes.length}
        savedSearches={knowledge.savedSearches}
        open={sidebarOpen}
        theme={theme}
        isMac={isMac}
        onClose={() => setSidebarOpen(false)}
        onFilterChange={handleFilterChange}
        onNewNote={handleNewNote}
        onOpenTemplates={handleOpenTemplates}
        onOpenToday={handleOpenToday}
        onToggleTheme={handleToggleTheme}
        onOpenData={handleOpenData}
        onCreateFolder={handleOpenCreateFolder}
        onRenameFolder={handleOpenRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onApplySavedSearch={handleApplySavedSearch}
        onEditSavedSearch={handleOpenEditSavedSearch}
        onDeleteSavedSearch={handleDeleteSavedSearch}
      />

      {sidebarOpen && (
        <button
          className="sidebar-scrim"
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className={`workspace ${isSpecial ? "workspace-special" : ""}`}>
        {isDashboard ? (
          <Dashboard
            notes={notes}
            folders={folders}
            recent={knowledge.recent}
            savedSearches={knowledge.savedSearches}
            settings={settings}
            linkIndex={linkIndex}
            todayKey={todayKey}
            todayNote={todayNote}
            backupReminder={backupReminder}
            onOpenNote={handleOpenNote}
            onOpenDaily={handleOpenToday}
            onFilterChange={handleFilterChange}
            onNewNote={handleNewNote}
            onNewFromTemplate={handleOpenTemplates}
            onMenu={() => setSidebarOpen(true)}
            onOpenData={handleOpenData}
            onApplySavedSearch={handleApplySavedSearch}
            onOpenSearch={handleOpenSearchFromDashboard}
          />
        ) : isGraph ? (
          <GraphView
            notes={notes}
            folders={folders}
            linkIndex={linkIndex}
            activeId={activeId}
            onOpenNote={handleOpenNote}
            onNewNote={handleNewNote}
            onMenu={() => setSidebarOpen(true)}
          />
        ) : (
          <>
            <NoteList
              notes={visibleNotes}
              searchResults={searchResults}
              totalCount={activeNotes.length}
              filterTitle={filterTitle}
              filter={filter}
              query={query}
              activeId={activeId}
              isMac={isMac}
              searchRef={searchRef}
              folders={folders}
              trashCount={trashedNotes.length}
              retentionLabel={retentionLabel}
              onQueryChange={handleQueryChange}
              onSelect={handleSelectNote}
              onSearchNoteSelect={handleSearchNoteSelect}
              onNewNote={handleNewNote}
              onMenu={() => setSidebarOpen(true)}
              onFilterChange={handleFilterChange}
              onRestore={handleRestoreNote}
              onPermanentDelete={handlePermanentDelete}
              onEmptyTrash={requestEmptyTrash}
              onSaveSearch={handleOpenSaveSearch}
            />

            <NoteEditor
              note={activeNote}
              notes={activeNotes}
              folders={folders}
              linkIndex={linkIndex}
              backlinks={backlinks}
              outgoingLinks={outgoingLinks}
              brokenLinks={brokenLinks}
              trashedLinks={trashedLinks}
              relatedNotes={relatedNotes}
              storageError={storageError}
              saveStatus={saveState.status}
              focusTitleTick={focusTitleTick}
              editorVisible={mobileEditorOpen}
              trashMode={isTrash}
              trashCount={trashedNotes.length}
              retentionLabel={retentionLabel}
              onBack={() => setMobileEditorOpen(false)}
              onNewNote={handleNewNote}
              onUpdate={handleUpdateNote}
              onTogglePin={handleTogglePin}
              onToggleFavorite={handleToggleFavorite}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onExport={handleExportNote}
              onEmptyTrash={requestEmptyTrash}
              onOpenNote={handleOpenNote}
              onOpenInternalLink={handleOpenInternalLink}
              onOpenHistory={() => setVersionDialogOpen(true)}
              onOpenDailyDate={handleOpenDailyDate}
              onOpenToday={handleOpenToday}
            />
          </>
        )}
      </main>

      {dataOpen && (
        <DataDialog
          notes={notes}
          folders={folders}
          settings={settings}
          knowledge={knowledge}
          versions={versions}
          trashCount={trashedNotes.length}
          storageError={storageError}
          saveStatus={saveState.status}
          onClose={() => setDataOpen(false)}
          onExportBackup={handleExportBackup}
          onImportBackup={handleImportBackup}
          onRetentionChange={handleRetentionChange}
          onSettingsChange={handleSettingsPatch}
          onEmptyTrash={handleEmptyTrashFromDialog}
          onExportVault={handleExportVault}
          onImportVault={handleImportVault}
          onOpenTemplates={handleOpenTemplates}
        />
      )}

      {folderDialog && (
        <FolderDialog
          mode={folderDialog.mode}
          folder={folderDialog.folder}
          parentId={folderDialog.parentId}
          folders={folders}
          onSubmit={handleFolderSubmit}
          onClose={() => setFolderDialog(null)}
        />
      )}

      {templateDialogOpen && (
        <TemplatePickerDialog
          templates={knowledge.templates}
          folders={folders}
          onUse={handleUseTemplate}
          onSave={handleSaveTemplate}
          onDuplicate={handleDuplicateTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setTemplateDialogOpen(false)}
        />
      )}

      {versionDialogOpen && activeNote && (
        <VersionHistoryDialog
          note={activeNote}
          versions={versions[activeNote.id] ?? []}
          versionLimit={settings.versionLimit}
          onRestore={handleRestoreVersion}
          onSaveCurrent={handleSaveCurrentVersion}
          onClose={() => setVersionDialogOpen(false)}
        />
      )}

      {searchDialog && (
        <TextPromptDialog
          title={searchDialog.mode === "edit" ? "Rename saved search" : "Save this search"}
          eyebrow="A useful question, kept close"
          description={
            searchDialog.mode === "edit"
              ? "Give this saved search a clearer name. Its query stays the same."
              : `Save “${searchDialog.query}” so you can return to it from the sidebar and dashboard.`
          }
          label="Name"
          initialValue={searchDialog.search?.name ?? ""}
          placeholder="e.g. Networking notes to revisit"
          submitLabel={searchDialog.mode === "edit" ? "Rename search" : "Save search"}
          onSubmit={handleSearchDialogSubmit}
          onClose={() => setSearchDialog(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onClose={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog.onConfirm;
            setConfirmDialog(null);
            action?.();
          }}
        />
      )}

      <Toast toast={toast} onUndo={handleUndoDelete} onDismiss={dismissToast} />
    </div>
  );
}
