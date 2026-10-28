import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock3, History, RotateCcw } from "lucide-react";
import { diffLines, getVersionWordCount } from "../lib/versions";
import Modal from "./Modal";

function formatVersionDate(timestamp) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VersionHistoryDialog({
  note,
  versions = [],
  versionLimit,
  onRestore,
  onSaveCurrent,
  onClose,
}) {
  const [selectedId, setSelectedId] = useState(versions[0]?.id ?? null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (versions.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!versions.some((version) => version.id === selectedId)) {
      setSelectedId(versions[0].id);
    }
  }, [versions, selectedId]);

  const selected = versions.find((version) => version.id === selectedId) ?? null;
  const diff = useMemo(
    () => (selected ? diffLines(selected.content, note.content) : []),
    [selected, note.content],
  );
  const changedLines = diff.filter((line) => line.type !== "same").length;

  return (
    <Modal
      title="Version history"
      eyebrow="A local safety net"
      description={`Snapshots of “${note.title.trim() || "Untitled note"}” are kept on this device. Restoring a version first preserves the current note in history.`}
      onClose={onClose}
      width="wide"
    >
      <div className="version-dialog">
        <div className="version-toolbar">
          <span className="version-limit-note">
            <History size={14} />
            Up to {versionLimit} versions are kept per note
          </span>
          <button className="dialog-button" type="button" onClick={onSaveCurrent}>
            <Clock3 size={15} />
            Save current version
          </button>
        </div>

        {versions.length === 0 ? (
          <div className="version-empty">
            <span className="empty-list-icon">
              <History size={22} />
            </span>
            <h3>No earlier versions yet</h3>
            <p>
              Leekam saves a snapshot before significant edits and at sensible intervals. You can
              also save the current version now.
            </p>
            <button className="soft-button" type="button" onClick={onSaveCurrent}>
              Save current version
            </button>
          </div>
        ) : (
          <div className="version-layout">
            <div className="version-list" role="listbox" aria-label="Saved versions">
              {versions.map((version) => (
                <button
                  key={version.id}
                  className={`version-item ${version.id === selectedId ? "is-active" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={version.id === selectedId}
                  onClick={() => {
                    setSelectedId(version.id);
                    setConfirming(false);
                  }}
                >
                  <span className="version-item-top">
                    <strong>{formatVersionDate(version.createdAt)}</strong>
                    <span>{getVersionWordCount(version)} words</span>
                  </span>
                  <span className="version-item-title">
                    {version.title.trim() || "Untitled note"}
                  </span>
                </button>
              ))}
            </div>

            <div className="version-detail">
              {selected && (
                <>
                  <div className="version-detail-heading">
                    <div>
                      <span className="eyebrow">Comparing with current note</span>
                      <h3>{formatVersionDate(selected.createdAt)}</h3>
                    </div>
                    <span className="version-diff-count">
                      {changedLines === 0
                        ? "No text changes"
                        : `${changedLines} changed ${changedLines === 1 ? "line" : "lines"}`}
                    </span>
                  </div>

                  {confirming ? (
                    <div className="version-confirm" role="alert">
                      <AlertCircle size={17} />
                      <div>
                        <strong>Restore this version?</strong>
                        <p>
                          The current note will be saved to history first. This replaces the
                          title, Markdown content, tags, folder, and note settings with this
                          snapshot.
                        </p>
                        <div className="dialog-actions dialog-actions-inline">
                          <button
                            className="dialog-button"
                            type="button"
                            onClick={() => setConfirming(false)}
                          >
                            Keep current note
                          </button>
                          <button
                            className="dialog-button dialog-button-primary"
                            type="button"
                            onClick={() => onRestore(selected)}
                          >
                            <RotateCcw size={15} />
                            Restore version
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="dialog-button dialog-button-primary version-restore-button"
                      type="button"
                      onClick={() => setConfirming(true)}
                    >
                      <RotateCcw size={15} />
                      Restore this version
                    </button>
                  )}

                  <div className="version-diff" aria-label="Version comparison">
                    {diff.map((line, index) => (
                      <div
                        key={`${line.type}-${index}`}
                        className={`version-diff-line version-diff-${line.type}`}
                      >
                        <span className="version-diff-marker" aria-hidden="true">
                          {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                        </span>
                        <code>{line.text || " "}</code>
                      </div>
                    ))}
                  </div>
                  {changedLines === 0 && (
                    <p className="version-same-note">
                      <Check size={14} />
                      This version matches the current note.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
