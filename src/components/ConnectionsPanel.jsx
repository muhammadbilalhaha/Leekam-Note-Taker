import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Link2,
  Network,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

function ConnectionRow({ title, meta, note, folderName, onOpenNote, action }) {
  return (
    <div className="connection-row">
      <button
        className="connection-main"
        type="button"
        onClick={() => onOpenNote(note.id)}
        title={`Open ${title}`}
      >
        <span className="connection-title">{title}</span>
        <span className="connection-meta">
          {folderName && <span>{folderName}</span>}
          {meta && <span>{meta}</span>}
        </span>
      </button>
      {action}
      <ArrowUpRight size={13} className="connection-arrow" aria-hidden="true" />
    </div>
  );
}

export default function ConnectionsPanel({
  note,
  backlinks = [],
  outgoing = [],
  broken = [],
  trashed = [],
  related = [],
  folders = [],
  onOpenNote,
  onInsertLink,
}) {
  const [open, setOpen] = useState(false);
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.name]));
  const unresolved = [...broken, ...trashed];
  const resolvedOutgoing = outgoing.filter((entry) => entry.status === "resolved");
  const total =
    backlinks.length + resolvedOutgoing.length + related.length + unresolved.length;

  return (
    <section className={`connections-panel ${open ? "is-open" : ""}`}>
      <button
        className="connections-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="connections-toggle-icon">
          <Network size={15} />
        </span>
        <span className="connections-toggle-copy">
          <strong>Links &amp; related notes</strong>
          <span>
            {backlinks.length} backlink{backlinks.length === 1 ? "" : "s"} ·{" "}
            {resolvedOutgoing.length} link{resolvedOutgoing.length === 1 ? "" : "s"} ·{" "}
            {related.length} related · {unresolved.length} unresolved
          </span>
        </span>
        <span className="connections-badges">
          {total > 0 && <span className="connections-count">{total}</span>}
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {open && (
        <div className="connections-body">
          {total === 0 && (
            <p className="connections-empty">
              No connections yet. Type <code>[[</code> while writing to link another note, or add a
              shared tag to discover related notes.
            </p>
          )}

          {backlinks.length > 0 && (
            <div className="connection-group">
              <div className="connection-group-heading">
                <CornerDownRight size={13} />
                <span>Backlinks</span>
                <span className="connection-group-count">{backlinks.length}</span>
              </div>
              {backlinks.map((entry) => (
                <ConnectionRow
                  key={`${entry.note.id}-${entry.link.raw}`}
                  title={entry.note.title.trim() || "Untitled note"}
                  meta={`links to “${entry.link.label}”`}
                  note={entry.note}
                  folderName={folderNames.get(entry.note.folderId) ?? ""}
                  onOpenNote={onOpenNote}
                />
              ))}
            </div>
          )}

          {resolvedOutgoing.length > 0 && (
            <div className="connection-group">
              <div className="connection-group-heading">
                <Link2 size={13} />
                <span>Links in this note</span>
                <span className="connection-group-count">{resolvedOutgoing.length}</span>
              </div>
              {resolvedOutgoing.map((entry) => (
                <ConnectionRow
                  key={`${entry.note.id}-${entry.link.raw}`}
                  title={entry.note.title.trim() || "Untitled note"}
                  meta="opens this note"
                  note={entry.note}
                  folderName={folderNames.get(entry.note.folderId) ?? ""}
                  onOpenNote={onOpenNote}
                />
              ))}
            </div>
          )}

          {related.length > 0 && (
            <div className="connection-group">
              <div className="connection-group-heading">
                <Sparkles size={13} />
                <span>Related notes</span>
                <span className="connection-group-count">{related.length}</span>
              </div>
              {related.map((entry) => (
                <ConnectionRow
                  key={entry.note.id}
                  title={entry.note.title.trim() || "Untitled note"}
                  meta={entry.reasons.join(" · ")}
                  note={entry.note}
                  folderName={folderNames.get(entry.note.folderId) ?? ""}
                  onOpenNote={onOpenNote}
                  action={
                    <button
                      className="connection-insert"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onInsertLink(entry.note);
                      }}
                      aria-label={`Insert link to ${entry.note.title}`}
                      title="Insert internal link"
                    >
                      <Plus size={13} />
                    </button>
                  }
                />
              ))}
            </div>
          )}

          {unresolved.length > 0 && (
            <div className="connection-group connection-group-broken">
              <div className="connection-group-heading">
                <AlertTriangle size={13} />
                <span>Unresolved links</span>
                <span className="connection-group-count">{unresolved.length}</span>
              </div>
              {unresolved.map((entry) => (
                <div className="connection-broken-row" key={`${entry.link.raw}-${entry.status}`}>
                  <span className="connection-broken-icon">
                    {entry.status === "trashed" ? <Trash2 size={13} /> : <AlertTriangle size={13} />}
                  </span>
                  <span>
                    <strong>[[{entry.link.label}]]</strong>
                    <small>{entry.reason}</small>
                  </span>
                </div>
              ))}
            </div>
          )}

          {note.dailyDate && (
            <p className="connections-footnote">
              Daily note for {note.dailyDate}. Internal links and related notes update as you write.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
