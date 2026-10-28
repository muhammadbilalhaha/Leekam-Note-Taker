import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Clock3,
  FileText,
  LayoutTemplate,
  Menu,
  PencilLine,
  Plus,
  Search,
  ShieldAlert,
  Star,
  Unplug,
} from "lucide-react";
import { formatCardDate } from "../lib/notes";
import { getRecentNotes } from "../lib/knowledge";
import { formatDailyHeading, formatDailyTitle } from "../lib/daily";

function SectionCard({ title, eyebrow, count, action, onAction, children, className = "" }) {
  return (
    <section className={`dashboard-card ${className}`}>
      <div className="dashboard-card-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>
            {title}
            {typeof count === "number" && <span className="dashboard-count">{count}</span>}
          </h2>
        </div>
        {action && (
          <button className="dashboard-link" type="button" onClick={onAction}>
            {action}
            <ArrowRight size={13} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function NoteRow({ note, folderName, meta, onOpenNote, icon: Icon = FileText }) {
  return (
    <button className="dashboard-note-row" type="button" onClick={() => onOpenNote(note.id)}>
      <span className="dashboard-note-icon">
        <Icon size={14} />
      </span>
      <span className="dashboard-note-copy">
        <strong>{note.title.trim() || "Untitled note"}</strong>
        <span>
          {folderName ? `${folderName} · ` : ""}
          {meta}
        </span>
      </span>
      <ArrowRight size={13} className="dashboard-row-arrow" aria-hidden="true" />
    </button>
  );
}

function EmptyCard({ children }) {
  return <p className="dashboard-empty">{children}</p>;
}

export default function Dashboard({
  notes,
  folders,
  recent,
  savedSearches,
  settings,
  linkIndex,
  todayKey,
  todayNote,
  backupReminder,
  onOpenNote,
  onOpenDaily,
  onFilterChange,
  onNewNote,
  onNewFromTemplate,
  onMenu,
  onOpenData,
  onApplySavedSearch,
  onOpenSearch,
}) {
  const activeNotes = notes.filter((note) => !note.deletedAt);
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
  const sections = settings.dashboardSections ?? {};
  const recentNotes = getRecentNotes(recent, notes, 5);
  const recentlyEdited = [...activeNotes]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);
  const favorites = activeNotes.filter((note) => note.favorite).slice(0, 6);
  const brokenNotes = activeNotes
    .map((note) => ({ note, links: linkIndex?.broken.get(note.id) ?? [] }))
    .filter((entry) => entry.links.length > 0)
    .sort((a, b) => b.links.length - a.links.length)
    .slice(0, 5);
  const isolatedNotes = activeNotes
    .filter((note) => !linkIndex?.linkedNoteIds.has(note.id))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const dailyTitle = todayNote
    ? todayNote.title.trim() || "Today"
    : formatDailyTitle(todayKey, settings.dailyTitleFormat);

  return (
    <section className="dashboard-pane" aria-label="Home dashboard">
      <header className="dashboard-header">
        <button className="menu-button" type="button" onClick={onMenu} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <div className="dashboard-heading">
          <span className="eyebrow">Your knowledge, at a glance</span>
          <h1>Home</h1>
          <p>
            {activeNotes.length === 0
              ? "A quiet place to begin."
              : `${activeNotes.length} ${
                  activeNotes.length === 1 ? "note" : "notes"
                } kept locally, with ${linkIndex?.backlinks.size ?? 0} linked ${
                  (linkIndex?.backlinks.size ?? 0) === 1 ? "note" : "notes"
                }.`}
          </p>
        </div>
        <div className="dashboard-header-actions">
          <button className="dashboard-search-button" type="button" onClick={onOpenSearch}>
            <Search size={15} />
            Search library
          </button>
          <button className="dialog-button dialog-button-primary" type="button" onClick={onNewNote}>
            <Plus size={15} />
            New note
          </button>
        </div>
      </header>

      {backupReminder?.due && (
        <div className="dashboard-backup-banner" role="status">
          <span className="dashboard-banner-icon">
            <ShieldAlert size={18} />
          </span>
          <div>
            <strong>Keep a copy outside this browser</strong>
            <p>{backupReminder.message} Browser data can be cleared unexpectedly.</p>
          </div>
          <button className="dialog-button" type="button" onClick={onOpenData}>
            Open backup
          </button>
        </div>
      )}

      {activeNotes.length === 0 ? (
        <div className="dashboard-welcome">
          <div className="dashboard-welcome-art" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className="eyebrow">Start anywhere</span>
          <h2>Your first note is a small beginning.</h2>
          <p>
            Capture a thought, open today's daily note, or start from a template. Everything stays
            in this browser.
          </p>
          <div className="dashboard-welcome-actions">
            <button className="dialog-button dialog-button-primary" type="button" onClick={onNewNote}>
              <Plus size={15} />
              Write a note
            </button>
            <button className="dialog-button" type="button" onClick={onOpenDaily}>
              <CalendarDays size={15} />
              Open today
            </button>
            <button className="dialog-button" type="button" onClick={onNewFromTemplate}>
              <LayoutTemplate size={15} />
              Use a template
            </button>
          </div>
        </div>
      ) : (
        <div className="dashboard-grid">
          {sections.daily !== false && (
            <section className="dashboard-daily">
              <span className="dashboard-daily-icon">
                <CalendarDays size={20} />
              </span>
              <div>
                <span className="eyebrow">Today</span>
                <h2>{formatDailyHeading(todayKey)}</h2>
                <p>
                  {todayNote
                    ? "Today's note is ready. Pick up where you left off."
                    : "A fresh page for focus, notes, and reflection."}
                </p>
              </div>
              <button className="dialog-button dialog-button-primary" type="button" onClick={onOpenDaily}>
                {todayNote ? "Open today's note" : "Create today's note"}
                <ArrowRight size={14} />
              </button>
            </section>
          )}

          <div className="dashboard-quick-actions">
            <button className="dashboard-quick" type="button" onClick={onNewNote}>
              <span>
                <Plus size={17} />
              </span>
              <strong>New note</strong>
              <small>Start from a blank page</small>
            </button>
            <button className="dashboard-quick" type="button" onClick={onNewFromTemplate}>
              <span>
                <LayoutTemplate size={17} />
              </span>
              <strong>From template</strong>
              <small>Use a little structure</small>
            </button>
            <button
              className="dashboard-quick"
              type="button"
              onClick={() => onFilterChange({ type: "graph" })}
            >
              <span>
                <Unplug size={17} />
              </span>
              <strong>Knowledge graph</strong>
              <small>See how notes connect</small>
            </button>
          </div>

          {sections.recentOpened !== false && (
            <SectionCard
              title="Recently opened"
              eyebrow="Pick up where you left off"
              count={recentNotes.length}
              action="All notes"
              onAction={() => onFilterChange({ type: "all" })}
            >
              {recentNotes.length === 0 ? (
                <EmptyCard>Notes you open will appear here.</EmptyCard>
              ) : (
                <div className="dashboard-note-list">
                  {recentNotes.map((entry) => (
                    <NoteRow
                      key={entry.note.id}
                      note={entry.note}
                      folderName={folderNames.get(entry.note.folderId) ?? ""}
                      meta={`opened ${formatCardDate(entry.openedAt)}`}
                      onOpenNote={onOpenNote}
                      icon={Clock3}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {sections.recentlyEdited !== false && (
            <SectionCard
              title="Recently edited"
              eyebrow="Fresh words"
              count={recentlyEdited.length}
              action="All notes"
              onAction={() => onFilterChange({ type: "all" })}
            >
              <div className="dashboard-note-list">
                {recentlyEdited.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    folderName={folderNames.get(note.folderId) ?? ""}
                    meta={`edited ${formatCardDate(note.updatedAt)}`}
                    onOpenNote={onOpenNote}
                    icon={PencilLine}
                  />
                ))}
              </div>
            </SectionCard>
          )}

          {sections.favorites !== false && (
            <SectionCard
              title="Favorites"
              eyebrow="Kept for the long term"
              count={favorites.length}
              action="View favorites"
              onAction={() => onFilterChange({ type: "favorites" })}
            >
              {favorites.length === 0 ? (
                <EmptyCard>
                  Star a note from its editor to keep it close here. Favorites are separate from
                  pinned notes.
                </EmptyCard>
              ) : (
                <div className="dashboard-note-list">
                  {favorites.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      folderName={folderNames.get(note.folderId) ?? ""}
                      meta={note.tags.slice(0, 2).map((tag) => `#${tag}`).join(" ") || "favorite"}
                      onOpenNote={onOpenNote}
                      icon={Star}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {sections.savedSearches !== false && (
            <SectionCard
              title="Saved searches"
              eyebrow="Return to a useful question"
              count={savedSearches.length}
              action="Manage"
              onAction={onOpenData}
            >
              {savedSearches.length === 0 ? (
                <EmptyCard>
                  Search with filters like <code>tag:work</code> or <code>has:links</code>, then
                  save it for later.
                </EmptyCard>
              ) : (
                <div className="dashboard-saved-list">
                  {savedSearches.slice(0, 6).map((search) => (
                    <button
                      key={search.id}
                      className="dashboard-saved-row"
                      type="button"
                      onClick={() => onApplySavedSearch(search)}
                    >
                      <span className="dashboard-note-icon">
                        <Bookmark size={14} />
                      </span>
                      <span className="dashboard-note-copy">
                        <strong>{search.name}</strong>
                        <span>{search.query}</span>
                      </span>
                      <ArrowRight size={13} className="dashboard-row-arrow" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {sections.brokenLinks !== false && (
            <SectionCard
              title="Broken links"
              eyebrow="Connections that need attention"
              count={brokenNotes.length}
              action="Open graph"
              onAction={() => onFilterChange({ type: "graph" })}
              className={brokenNotes.length > 0 ? "dashboard-card-warning" : ""}
            >
              {brokenNotes.length === 0 ? (
                <EmptyCard>Every internal link currently points to a note.</EmptyCard>
              ) : (
                <div className="dashboard-note-list">
                  {brokenNotes.map((entry) => (
                    <NoteRow
                      key={entry.note.id}
                      note={entry.note}
                      folderName={folderNames.get(entry.note.folderId) ?? ""}
                      meta={`${entry.links.length} unresolved ${
                        entry.links.length === 1 ? "link" : "links"
                      }`}
                      onOpenNote={onOpenNote}
                      icon={AlertTriangle}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {sections.isolated !== false && (
            <SectionCard
              title="Not yet connected"
              eyebrow="Notes waiting for a thread"
              count={isolatedNotes.length}
              action="Explore graph"
              onAction={() => onFilterChange({ type: "graph" })}
            >
              {isolatedNotes.length === 0 ? (
                <EmptyCard>Every note has at least one internal connection.</EmptyCard>
              ) : (
                <div className="dashboard-note-list">
                  {isolatedNotes.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      folderName={folderNames.get(note.folderId) ?? ""}
                      meta={note.tags.slice(0, 2).map((tag) => `#${tag}`).join(" ") || "no links yet"}
                      onOpenNote={onOpenNote}
                      icon={Unplug}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      )}

      <footer className="dashboard-footer">
        <span>Daily note: {dailyTitle}</span>
        <button className="dashboard-link" type="button" onClick={onOpenData}>
          Configure dashboard
          <ArrowRight size={13} />
        </button>
      </footer>
    </section>
  );
}
