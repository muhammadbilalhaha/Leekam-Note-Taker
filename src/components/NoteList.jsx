import { useMemo } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  BookmarkPlus,
  FileText,
  Folder,
  Menu,
  Pin,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  excerpt,
  formatCardDate,
  getAccent,
  getMatchSnippet,
} from "../lib/notes";
import { markdownToPlainText } from "../lib/markdown";

function Highlight({ text, query }) {
  const term = query.trim();
  if (!term || !text) return text;

  const lowerText = text.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const pieces = [];
  let cursor = 0;
  let index = lowerText.indexOf(lowerTerm);
  let key = 0;

  while (index !== -1) {
    if (index > cursor) pieces.push(text.slice(cursor, index));
    pieces.push(
      <mark className="search-highlight" key={`match-${key}`}>
        {text.slice(index, index + term.length)}
      </mark>,
    );
    key += 1;
    cursor = index + term.length;
    index = lowerText.indexOf(lowerTerm, cursor);
  }

  if (cursor === 0) return text;
  if (cursor < text.length) pieces.push(text.slice(cursor));
  return pieces;
}

function NoteCard({ note, active, onSelect, query = "", preview, folderName = "" }) {
  const previewText = preview ?? excerpt(markdownToPlainText(note.content), 135);
  const tags = note.tags.slice(0, 3);
  const extraTags = note.tags.length - tags.length;

  return (
    <button
      className={`note-card ${active ? "is-active" : ""}`}
      type="button"
      onClick={() => onSelect(note.id)}
      aria-current={active ? "true" : undefined}
      style={{ "--note-accent": getAccent(note.color) }}
    >
      <span className="note-card-stripe" aria-hidden="true" />
      <div className="note-card-top">
        <span className="note-card-date" title={new Date(note.updatedAt).toLocaleString()}>
          {formatCardDate(note.updatedAt)}
        </span>
        <span className="note-card-flags">
          {note.favorite && (
            <span className="note-card-favorite" title="Favorite">
              <Star size={13} fill="currentColor" />
            </span>
          )}
          {note.pinned && (
            <span className="note-card-pin" title="Pinned">
              <Pin size={13} fill="currentColor" />
            </span>
          )}
        </span>
      </div>
      <h2 className="note-card-title">
        <Highlight text={note.title.trim() || "Untitled note"} query={query} />
      </h2>
      <p className="note-card-preview">
        {previewText ? <Highlight text={previewText} query={query} /> : "No additional text yet."}
      </p>
      {(folderName || tags.length > 0) && (
        <div className="note-card-tags">
          {folderName && (
            <span className="mini-tag mini-folder-tag">
              <Folder size={9} />
              <Highlight text={folderName} query={query} />
            </span>
          )}
          {tags.map((tag) => (
            <span className="mini-tag" key={tag}>
              <Highlight text={`#${tag}`} query={query} />
            </span>
          ))}
          {extraTags > 0 && <span className="mini-tag mini-tag-more">+{extraTags}</span>}
        </div>
      )}
    </button>
  );
}

function SearchResultRow({ title, meta, query, icon: Icon, tone = "neutral", onClick }) {
  return (
    <button className={`search-result-row search-result-row-${tone}`} type="button" onClick={onClick}>
      <span className={`search-result-icon search-result-icon-${tone}`}>
        <Icon size={15} />
      </span>
      <span className="search-result-copy">
        <span className="search-result-title">
          <Highlight text={title} query={query} />
        </span>
        <span className="search-result-meta">{meta}</span>
      </span>
      <ArrowUpRight size={14} className="search-result-arrow" aria-hidden="true" />
    </button>
  );
}

function GlobalSearchResults({
  results,
  query,
  activeId,
  folders,
  onSelectNote,
  onFilterChange,
  onClearSearch,
}) {
  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );
  const highlightTerm = results.term ?? query.trim();

  if (results.total === 0) {
    return (
      <div className="empty-list search-empty">
        <span className="empty-list-icon">
          <SearchX size={23} />
        </span>
        <h2>No matches for “{query.trim()}”</h2>
        <p>Search looks through note titles, content, tags, folders, and library views.</p>
        <button className="soft-button" type="button" onClick={onClearSearch}>
          Clear search
        </button>
      </div>
    );
  }

  return (
    <div className="search-results">
      {results.notes.length > 0 && (
        <section className="search-group" aria-label="Matching notes">
          <div className="search-group-header">
            <span>Notes</span>
            <span className="search-group-count">{results.notes.length}</span>
          </div>
          <div className="notes-stack search-note-stack">
            {results.notes.map((result) => (
              <NoteCard
                key={result.note.id}
                note={result.note}
                active={result.note.id === activeId}
                preview={result.snippet}
                query={highlightTerm}
                folderName={folderNames.get(result.note.folderId) ?? ""}
                onSelect={onSelectNote}
              />
            ))}
          </div>
        </section>
      )}

      {results.folders?.length > 0 && (
        <section className="search-group" aria-label="Matching folders">
          <div className="search-group-header">
            <span>Folders</span>
            <span className="search-group-count">{results.folders.length}</span>
          </div>
          <div className="search-rows">
            {results.folders.map((folder) => (
              <SearchResultRow
                key={folder.id}
                title={folder.name}
                meta={`Folder · ${folder.count} ${folder.count === 1 ? "note" : "notes"}`}
                query={highlightTerm}
                icon={Folder}
                tone="folder"
                onClick={() => onFilterChange({ type: "folder", folderId: folder.id })}
              />
            ))}
          </div>
        </section>
      )}

      {results.tags.length > 0 && (
        <section className="search-group" aria-label="Matching tags">
          <div className="search-group-header">
            <span>Tags</span>
            <span className="search-group-count">{results.tags.length}</span>
          </div>
          <div className="search-rows">
            {results.tags.map((tag) => (
              <SearchResultRow
                key={tag.name}
                title={`#${tag.name}`}
                meta={`Tag · ${tag.count} ${tag.count === 1 ? "note" : "notes"}`}
                query={highlightTerm}
                icon={Tag}
                tone="tag"
                onClick={() => onFilterChange({ type: "tag", tag: tag.name })}
              />
            ))}
          </div>
        </section>
      )}

      {results.views.length > 0 && (
        <section className="search-group" aria-label="Matching views">
          <div className="search-group-header">
            <span>Views</span>
            <span className="search-group-count">{results.views.length}</span>
          </div>
          <div className="search-rows">
            {results.views.map((view) => (
              <SearchResultRow
                key={view.id}
                title={view.title}
                meta={`View · ${view.description}`}
                query={highlightTerm}
                icon={view.id === "pinned" ? Pin : view.id === "trash" ? Trash2 : FileText}
                tone="view"
                onClick={() => onFilterChange({ type: view.id })}
              />
            ))}
          </div>
        </section>
      )}

      <p className="list-end-note search-end-note">
        <span />
        {results.total} {results.total === 1 ? "match" : "matches"} across your library
        <span />
      </p>
    </div>
  );
}

function TrashCard({ note, folderName, query, onRestore, onPermanentDelete }) {
  const plain = markdownToPlainText(note.content);
  const preview = query.trim()
    ? getMatchSnippet(plain, query, 54) || excerpt(plain, 120)
    : excerpt(plain, 120);

  return (
    <article
      className="trash-card"
      style={{ "--note-accent": getAccent(note.color) }}
    >
      <span className="trash-card-stripe" aria-hidden="true" />
      <div className="trash-card-top">
        <span>
          <Trash2 size={11} />
          Deleted {formatCardDate(note.deletedAt)}
        </span>
        {folderName && (
          <span className="mini-tag mini-folder-tag">
            <Folder size={9} />
            {folderName}
          </span>
        )}
      </div>
      <h2>
        <Highlight text={note.title.trim() || "Untitled note"} query={query} />
      </h2>
      <p>
        {preview ? <Highlight text={preview} query={query} /> : "No additional text."}
      </p>
      <div className="trash-card-actions">
        <button
          className="trash-action trash-action-restore"
          type="button"
          onClick={() => onRestore(note.id)}
        >
          <RotateCcw size={13} />
          Restore
        </button>
        <button
          className="trash-action trash-action-delete"
          type="button"
          onClick={() => onPermanentDelete(note)}
        >
          <Trash2 size={13} />
          Delete forever
        </button>
      </div>
    </article>
  );
}

export default function NoteList({
  notes,
  searchResults,
  totalCount,
  filterTitle,
  filter,
  query,
  activeId,
  isMac,
  searchRef,
  folders,
  trashCount,
  retentionLabel,
  onQueryChange,
  onSelect,
  onSearchNoteSelect,
  onNewNote,
  onMenu,
  onFilterChange,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  onSaveSearch,
}) {
  const isTrash = filter.type === "trash";
  const isSearching = !isTrash && query.trim().length > 0;
  const isTrashSearching = isTrash && query.trim().length > 0;
  const folderNames = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder.name])),
    [folders],
  );

  const displayedCount = isTrash ? notes.length : isSearching ? searchResults.total : notes.length;
  const countNoun = isTrash ? "trashed note" : isSearching ? "result" : "note";
  const countLabel = `${displayedCount} ${
    displayedCount === 1 ? countNoun : `${countNoun}s`
  }`;

  let emptyState = null;
  if (isTrash) {
    emptyState = (
      <>
        <span className="empty-list-icon">
          <Trash2 size={22} />
        </span>
        <h2>{isTrashSearching ? "No matches in Trash" : "Trash is empty"}</h2>
        <p>
          {isTrashSearching
            ? `Nothing in Trash matches “${query.trim()}”.`
            : "Notes you delete will wait here so you can restore them."}
        </p>
        {isTrashSearching ? (
          <button className="soft-button" type="button" onClick={() => onQueryChange("")}>
            Clear Trash search
          </button>
        ) : (
          <button
            className="soft-button"
            type="button"
            onClick={() => onFilterChange({ type: "all" })}
          >
            Back to all notes
          </button>
        )}
      </>
    );
  } else if (!isSearching && notes.length === 0) {
    if (filter.type === "pinned") {
      emptyState = (
        <>
          <span className="empty-list-icon">
            <Pin size={22} />
          </span>
          <h2>No pinned notes</h2>
          <p>Pin the notes you want to keep within easy reach.</p>
          <button
            className="soft-button"
            type="button"
            onClick={() => onFilterChange({ type: "all" })}
          >
            See all notes
          </button>
        </>
      );
    } else if (filter.type === "favorites") {
      emptyState = (
        <>
          <span className="empty-list-icon">
            <Star size={22} />
          </span>
          <h2>No favorite notes yet</h2>
          <p>Star a note from its editor to keep it close. Favorites stay separate from pinned notes.</p>
          <button
            className="soft-button"
            type="button"
            onClick={() => onFilterChange({ type: "all" })}
          >
            See all notes
          </button>
        </>
      );
    } else if (filter.type === "tag") {
      emptyState = (
        <>
          <span className="empty-list-icon">
            <span className="hash-mark">#</span>
          </span>
          <h2>No notes tagged #{filter.tag}</h2>
          <p>Add this tag to a note and it will show up here.</p>
          <button
            className="soft-button"
            type="button"
            onClick={() => onFilterChange({ type: "all" })}
          >
            See all notes
          </button>
        </>
      );
    } else if (filter.type === "folder") {
      emptyState = (
        <>
          <span className="empty-list-icon">
            <Folder size={22} />
          </span>
          <h2>This folder is empty</h2>
          <p>Add a note here, or move an existing note into this folder from its editor.</p>
          <button className="soft-button" type="button" onClick={onNewNote}>
            Write a note here
          </button>
        </>
      );
    } else if (totalCount === 0) {
      emptyState = (
        <>
          <span className="empty-list-icon">
            <Plus size={23} />
          </span>
          <h2>A blank page is waiting</h2>
          <p>Capture a thought, a list, or something you don't want to forget.</p>
          <button className="soft-button" type="button" onClick={onNewNote}>
            Write your first note
          </button>
        </>
      );
    }
  }

  const openFirstResult = () => {
    if (searchResults.notes.length > 0) {
      onSearchNoteSelect(searchResults.notes[0].note.id);
      return;
    }
    if (searchResults.folders?.length > 0) {
      onFilterChange({ type: "folder", folderId: searchResults.folders[0].id });
      return;
    }
    if (searchResults.tags.length > 0) {
      onFilterChange({ type: "tag", tag: searchResults.tags[0].name });
      return;
    }
    if (searchResults.views.length > 0) {
      onFilterChange({ type: searchResults.views[0].id });
    }
  };

  const heading = isTrash
    ? isTrashSearching
      ? "Search Trash"
      : "Trash"
    : isSearching
      ? "Search"
      : filterTitle;

  return (
    <section
      className={`list-pane ${isTrash ? "list-pane-trash" : ""}`}
      aria-label={isTrash ? "Trash" : isSearching ? "Search results" : "Notes list"}
    >
      <header className="list-header">
        <div className="list-title-row">
          <button className="menu-button" type="button" onClick={onMenu} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="list-heading">
            <span className="eyebrow">
              {isTrash
                ? isTrashSearching
                  ? "Searching deleted notes"
                  : "Recently deleted"
                : isSearching
                  ? "Across your library"
                  : "Your library"}
            </span>
            <h1>{heading}</h1>
          </div>
          {!isTrash && (
            <button className="list-new-button" type="button" onClick={onNewNote} aria-label="New note">
              <Plus size={19} strokeWidth={2.4} />
            </button>
          )}
        </div>

        <div className="search-field" role="search">
          <Search size={17} className="search-icon" aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                onQueryChange("");
              } else if (
                event.key === "Enter" &&
                isSearching &&
                searchResults.total > 0
              ) {
                event.preventDefault();
                openFirstResult();
              }
            }}
            placeholder={isTrash ? "Search Trash…" : "Search, or try tag:work…"}
            aria-label={
              isTrash ? "Search trashed notes" : "Search notes, tags, folders, and views"
            }
            title={
              isTrash
                ? "Search deleted notes"
                : "Filters: tag:name folder:name is:pinned is:favorite is:isolated updated:7d has:links has:backlinks in:trash"
            }
            autoComplete="off"
            spellCheck="false"
          />
          {query ? (
            <button
              className="search-clear"
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          ) : (
            <kbd className="search-shortcut">{isMac ? "⌘" : "Ctrl"} K</kbd>
          )}
        </div>

        {!isTrash && (searchResults.filterChips?.length > 0 || searchResults.invalidFilters?.length > 0) && (
          <div className="search-filter-row" aria-label="Active search filters">
            {searchResults.filterChips?.map((chip) => (
              <span className={`search-filter-chip search-filter-chip-${chip.kind}`} key={`${chip.kind}-${chip.label}`}>
                {chip.label}
              </span>
            ))}
            {searchResults.invalidFilters?.map((filterText) => (
              <span className="search-filter-chip search-filter-chip-invalid" key={filterText}>
                <AlertCircle size={11} />
                {filterText}
              </span>
            ))}
          </div>
        )}

        <div className="list-meta">
          <span>{countLabel}</span>
          <span className="list-meta-sort">
            {isTrash ? (
              <>
                <Trash2 size={11} />
                {retentionLabel}
              </>
            ) : isSearching ? (
              <>
                <Search size={11} />
                All sections
              </>
            ) : (
              <>
                <Pin size={11} />
                Pinned first
              </>
            )}
          </span>
          {isSearching && onSaveSearch && (
            <button className="search-save-button" type="button" onClick={onSaveSearch}>
              <BookmarkPlus size={12} />
              Save search
            </button>
          )}
        </div>

        {isTrash && trashCount > 0 && (
          <button className="trash-empty-button" type="button" onClick={onEmptyTrash}>
            <Trash2 size={13} />
            Empty Trash
          </button>
        )}
      </header>

      <div className="notes-scroll">
        {isTrash ? (
          notes.length > 0 ? (
            <div className="trash-stack">
              {notes.map((note) => (
                <TrashCard
                  key={note.id}
                  note={note}
                  folderName={folderNames.get(note.folderId) ?? ""}
                  query={query}
                  onRestore={onRestore}
                  onPermanentDelete={onPermanentDelete}
                />
              ))}
              <p className="list-end-note">
                <span />
                {notes.length === 1 ? "One note in Trash" : "Deleted notes are kept locally"}
                <span />
              </p>
            </div>
          ) : (
            <div className="empty-list">{emptyState}</div>
          )
        ) : isSearching ? (
          <GlobalSearchResults
            results={searchResults}
            query={query}
            activeId={activeId}
            folders={folders}
            onSelectNote={onSearchNoteSelect}
            onFilterChange={onFilterChange}
            onClearSearch={() => onQueryChange("")}
          />
        ) : notes.length > 0 ? (
          <div className="notes-stack">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                active={note.id === activeId}
                folderName={folderNames.get(note.folderId) ?? ""}
                onSelect={onSelect}
              />
            ))}
            <p className="list-end-note">
              <span />
              {notes.length === 1 ? "One note, safely kept" : "All notes are saved locally"}
              <span />
            </p>
          </div>
        ) : (
          <div className="empty-list">{emptyState}</div>
        )}
      </div>
    </section>
  );
}
