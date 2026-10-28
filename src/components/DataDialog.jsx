import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  Bookmark,
  CalendarDays,
  Check,
  Database,
  Download,
  FileCheck2,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  LayoutTemplate,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BACKUP_REMINDER_OPTIONS,
  DEFAULT_DASHBOARD_SECTIONS,
  RETENTION_OPTIONS,
  STORAGE_WARNING_OPTIONS,
  VERSION_LIMIT_OPTIONS,
  validateBackup,
} from "../lib/backup";
import { DAILY_TITLE_FORMATS } from "../lib/daily";
import { flattenFolderTree } from "../lib/folders";
import { formatBytes, getStorageEstimate } from "../lib/storage";
import { buildVaultImport, readVaultFileList } from "../lib/vault";
import Modal from "./Modal";

function formatBackupDate(timestamp) {
  if (!timestamp) return "No backup exported yet";
  return `Last backup ${new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function countVersions(versions) {
  return Object.values(versions ?? {}).reduce((sum, list) => sum + list.length, 0);
}

const DASHBOARD_SECTION_LABELS = {
  daily: "Today's daily note",
  recentOpened: "Recently opened",
  recentlyEdited: "Recently edited",
  favorites: "Favorites",
  savedSearches: "Saved searches",
  brokenLinks: "Broken links",
  isolated: "Not yet connected",
};

export default function DataDialog({
  notes,
  folders,
  settings,
  knowledge,
  versions,
  trashCount,
  storageError,
  saveStatus,
  onClose,
  onExportBackup,
  onImportBackup,
  onRetentionChange,
  onSettingsChange,
  onEmptyTrash,
  onExportVault,
  onImportVault,
  onOpenTemplates,
}) {
  const fileRef = useRef(null);
  const vaultFileRef = useRef(null);
  const vaultFolderRef = useRef(null);
  const [importState, setImportState] = useState(null);
  const [importError, setImportError] = useState("");
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState(null);
  const [vaultFiles, setVaultFiles] = useState(null);
  const [vaultMode, setVaultMode] = useState("merge");
  const [vaultPreview, setVaultPreview] = useState(null);
  const [vaultError, setVaultError] = useState("");
  const [confirmingVault, setConfirmingVault] = useState(false);

  const folderOptions = useMemo(() => flattenFolderTree(folders), [folders]);
  const versionCount = useMemo(() => countVersions(versions), [versions]);
  const activeNotes = notes.filter((note) => !note.deletedAt);
  const storageWarning =
    storageEstimate?.percent != null &&
    storageEstimate.percent >= settings.storageWarningPercent;

  const refreshStorage = () => {
    getStorageEstimate()
      .then(setStorageEstimate)
      .catch(() =>
        setStorageEstimate({
          supported: false,
          usage: 0,
          quota: null,
          percent: null,
          localBytes: 0,
        }),
      );
  };

  useEffect(() => {
    refreshStorage();
  }, []);

  const chooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError("");
    setImportState(null);
    setConfirmingRestore(false);

    if (file.size > 10 * 1024 * 1024) {
      setImportError("That backup is larger than 10 MB and was not opened.");
      return;
    }

    try {
      const text = await file.text();
      const result = validateBackup(text);
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      setImportState({ fileName: file.name, ...result });
    } catch {
      setImportError("That file could not be read.");
    }
  };

  const restore = () => {
    if (!importState) return;
    onImportBackup(importState.data);
  };

  const rebuildVaultPreview = (files, mode) => {
    if (!files) return;
    const preview = buildVaultImport(files, notes, folders, { mode });
    setVaultPreview(preview);
  };

  const chooseVaultFiles = async (event) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    setVaultError("");
    setConfirmingVault(false);
    setVaultPreview(null);
    try {
      const entries = await readVaultFileList(selected);
      setVaultFiles(entries);
      rebuildVaultPreview(entries, vaultMode);
    } catch {
      setVaultError("Those Markdown files could not be read.");
    }
  };

  const changeVaultMode = (mode) => {
    setVaultMode(mode);
    setConfirmingVault(false);
    if (vaultFiles) rebuildVaultPreview(vaultFiles, mode);
  };

  const discardVault = () => {
    setVaultFiles(null);
    setVaultPreview(null);
    setVaultError("");
    setConfirmingVault(false);
  };

  const summary = importState?.summary;
  const vaultSummary = vaultPreview?.summary;

  return (
    <Modal
      title="Backup & settings"
      eyebrow="Your local library"
      description="Keep portable copies of your notes, understand browser storage, and shape how daily notes and the dashboard behave."
      onClose={onClose}
      width="wide"
    >
      <div className="data-dialog-body">
        <div className="data-summary data-summary-extended">
          <div>
            <strong>{activeNotes.length}</strong>
            <span>{activeNotes.length === 1 ? "note" : "notes"}</span>
          </div>
          <div>
            <strong>{folders.length}</strong>
            <span>{folders.length === 1 ? "folder" : "folders"}</span>
          </div>
          <div>
            <strong>{trashCount}</strong>
            <span>in Trash</span>
          </div>
          <div>
            <strong>{knowledge.templates.length}</strong>
            <span>{knowledge.templates.length === 1 ? "template" : "templates"}</span>
          </div>
          <div>
            <strong>{knowledge.savedSearches.length}</strong>
            <span>saved {knowledge.savedSearches.length === 1 ? "search" : "searches"}</span>
          </div>
          <div>
            <strong>{versionCount}</strong>
            <span>{versionCount === 1 ? "version" : "versions"}</span>
          </div>
        </div>

        {(storageError || saveStatus === "error") && (
          <div className="data-alert data-alert-strong" role="alert">
            <AlertCircle size={17} />
            <div>
              <strong>Leekam could not save the latest change.</strong>
              <p>
                Export a backup now, then free browser storage by emptying Trash, lowering version
                history, or clearing space in this browser. Until saving succeeds, the newest edit
                may exist only on this screen.
              </p>
            </div>
          </div>
        )}

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <HardDrive size={17} />
            </span>
            <div>
              <h3>Storage health</h3>
              <p>
                Leekam saves in this browser's local storage. Clearing site data or browser storage
                can remove notes permanently.
              </p>
            </div>
          </div>

          <div className="storage-health">
            <div className="storage-health-top">
              <span className={`storage-status storage-status-${saveStatus}`}>
                {saveStatus === "saving" ? (
                  <span className="save-spinner" aria-hidden="true" />
                ) : saveStatus === "error" || storageError ? (
                  <AlertCircle size={14} />
                ) : (
                  <Check size={14} />
                )}
                {saveStatus === "saving"
                  ? "Saving"
                  : saveStatus === "error" || storageError
                    ? "Save failed"
                    : "Saved"}
              </span>
              <button className="data-refresh-button" type="button" onClick={refreshStorage}>
                <RefreshCw size={13} />
                Refresh usage
              </button>
            </div>

            {storageEstimate?.percent != null ? (
              <div className="storage-meter-wrap">
                <div
                  className={`storage-meter ${storageWarning ? "is-warning" : ""}`}
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(storageEstimate.percent)}
                  aria-label="Browser storage used"
                >
                  <span style={{ width: `${Math.min(100, storageEstimate.percent)}%` }} />
                </div>
                <p>
                  {Math.round(storageEstimate.percent)}% of the browser storage quota used ·{" "}
                  {formatBytes(storageEstimate.usage)} of {formatBytes(storageEstimate.quota)}. Leekam
                  data uses {formatBytes(storageEstimate.localBytes)} of local storage.
                </p>
              </div>
            ) : (
              <p className="storage-health-copy">
                Leekam data uses {formatBytes(storageEstimate?.localBytes ?? 0)} of this browser's
                local storage. This browser does not expose a full quota estimate.
              </p>
            )}

            <label className="settings-row">
              <span>
                <strong>Warn me when browser storage reaches</strong>
                <small>Shown as guidance in the dashboard and settings.</small>
              </span>
              <select
                className="select-field"
                value={settings.storageWarningPercent}
                onChange={(event) =>
                  onSettingsChange({ storageWarningPercent: Number(event.target.value) })
                }
              >
                {STORAGE_WARNING_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}%
                  </option>
                ))}
              </select>
            </label>
            <p className="data-guidance">
              Browser storage is not a permanent archive. Export a JSON backup regularly, and keep a
              Markdown vault if you want readable files outside Leekam.
            </p>
          </div>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <Download size={17} />
            </span>
            <div>
              <h3>Export a JSON backup</h3>
              <p>
                One file with every note, folder, Trash item, setting, template, saved search, and
                version snapshot.
              </p>
            </div>
          </div>
          <div className="data-section-action">
            <span className="data-hint">{formatBackupDate(settings.lastBackupAt)}</span>
            <button
              className="dialog-button dialog-button-primary"
              type="button"
              onClick={onExportBackup}
            >
              <Download size={15} />
              Export backup
            </button>
          </div>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <Upload size={17} />
            </span>
            <div>
              <h3>Restore from backup</h3>
              <p>
                Open a Leekam JSON backup. The file is checked before anything is replaced.
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={chooseFile}
            tabIndex={-1}
            aria-hidden="true"
          />

          {!importState && (
            <div className="data-section-action">
              <span className="data-hint">
                Your current library is not changed until you confirm.
              </span>
              <button
                className="dialog-button"
                type="button"
                onClick={() => fileRef.current?.click()}
              >
                <FileCheck2 size={15} />
                Choose backup file
              </button>
            </div>
          )}

          {importError && (
            <div className="data-alert" role="alert">
              <AlertCircle size={16} />
              <span>{importError}</span>
            </div>
          )}

          {importState && (
            <div className="import-preview">
              <div className="import-preview-icon">
                <FileCheck2 size={20} />
              </div>
              <div className="import-preview-copy">
                <strong>{importState.fileName}</strong>
                <span>
                  {summary.notes} notes · {summary.folders} folders · {summary.trashed} in Trash ·{" "}
                  {summary.templates} templates · {summary.savedSearches} saved searches ·{" "}
                  {summary.versions} versions
                </span>
              </div>
              {!confirmingRestore ? (
                <div className="import-preview-actions">
                  <button
                    className="dialog-button"
                    type="button"
                    onClick={() => {
                      setImportState(null);
                      setImportError("");
                    }}
                  >
                    Discard
                  </button>
                  <button
                    className="dialog-button dialog-button-primary"
                    type="button"
                    onClick={() => setConfirmingRestore(true)}
                  >
                    Restore this backup
                  </button>
                </div>
              ) : (
                <div className="import-confirm">
                  <p>
                    This replaces all current notes, folders, Trash items, templates, saved
                    searches, settings, and version snapshots. Export a backup first if you might
                    need the current library.
                  </p>
                  <div className="dialog-actions dialog-actions-inline">
                    <button
                      className="dialog-button"
                      type="button"
                      onClick={() => setConfirmingRestore(false)}
                    >
                      Keep current notes
                    </button>
                    <button
                      className="dialog-button dialog-button-danger"
                      type="button"
                      onClick={restore}
                    >
                      Replace library
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <Archive size={17} />
            </span>
            <div>
              <h3>Portable Markdown vault</h3>
              <p>
                Export your active notes as a ZIP of Markdown files, or import Markdown from another
                editor. Folders, tags, favorites, and note IDs are kept in front matter.
              </p>
            </div>
          </div>

          <input
            ref={vaultFileRef}
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,text/markdown"
            multiple
            onChange={chooseVaultFiles}
            tabIndex={-1}
            aria-hidden="true"
          />
          <input
            ref={vaultFolderRef}
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,text/markdown"
            multiple
            webkitdirectory=""
            onChange={chooseVaultFiles}
            tabIndex={-1}
            aria-hidden="true"
          />

          <div className="vault-actions">
            <button className="dialog-button dialog-button-primary" type="button" onClick={onExportVault}>
              <Archive size={15} />
              Export Markdown vault (.zip)
            </button>
            <button
              className="dialog-button"
              type="button"
              onClick={() => vaultFileRef.current?.click()}
            >
              <FileText size={15} />
              Choose Markdown files
            </button>
            <button
              className="dialog-button"
              type="button"
              onClick={() => vaultFolderRef.current?.click()}
            >
              <FolderOpen size={15} />
              Choose a folder
            </button>
          </div>

          {vaultError && (
            <div className="data-alert" role="alert">
              <AlertCircle size={16} />
              <span>{vaultError}</span>
            </div>
          )}

          {vaultPreview && (
            <div className="vault-preview">
              <div className="vault-preview-heading">
                <div>
                  <strong>{vaultSummary.files} Markdown files ready</strong>
                  <span>
                    {vaultSummary.importedNotes} notes · {vaultSummary.importedFolders} new folders
                  </span>
                </div>
                <button className="data-refresh-button" type="button" onClick={discardVault}>
                  Discard
                </button>
              </div>

              <div className="vault-mode" role="radiogroup" aria-label="Vault import mode">
                <label className={vaultMode === "merge" ? "is-active" : ""}>
                  <input
                    type="radio"
                    name="vault-mode"
                    value="merge"
                    checked={vaultMode === "merge"}
                    onChange={() => changeVaultMode("merge")}
                  />
                  <span>
                    <strong>Merge into this library</strong>
                    <small>Keep current notes and add the Markdown files.</small>
                  </span>
                </label>
                <label className={vaultMode === "replace" ? "is-active" : ""}>
                  <input
                    type="radio"
                    name="vault-mode"
                    value="replace"
                    checked={vaultMode === "replace"}
                    onChange={() => changeVaultMode("replace")}
                  />
                  <span>
                    <strong>Replace notes and folders</strong>
                    <small>
                      Templates, saved searches, and settings stay; notes and folders are replaced.
                    </small>
                  </span>
                </label>
              </div>

              {vaultSummary.duplicateIds > 0 && (
                <p className="vault-warning">
                  <AlertCircle size={13} />
                  {vaultSummary.duplicateIds} duplicate note IDs will be given new stable IDs.
                </p>
              )}
              {vaultSummary.duplicateTitles > 0 && (
                <p className="vault-warning">
                  <AlertCircle size={13} />
                  {vaultSummary.duplicateTitles} duplicate titles found. Use [[Title|id]] links when
                  a title is shared.
                </p>
              )}
              {vaultSummary.skipped > 0 && (
                <p className="vault-warning">
                  <AlertCircle size={13} />
                  {vaultSummary.skipped} files will be skipped. {vaultSummary.skippedFiles[0]}
                </p>
              )}
              {vaultSummary.warnings.map((warning) => (
                <p className="vault-warning" key={warning}>
                  <AlertCircle size={13} />
                  {warning}
                </p>
              ))}

              {!confirmingVault ? (
                <div className="vault-confirm-actions">
                  <button
                    className="dialog-button dialog-button-primary"
                    type="button"
                    onClick={() => setConfirmingVault(true)}
                  >
                    {vaultMode === "merge" ? "Merge Markdown vault" : "Replace with Markdown vault"}
                  </button>
                </div>
              ) : (
                <div className="import-confirm">
                  <p>
                    {vaultMode === "merge"
                      ? "These notes and folders will be added to the current library. Existing notes are kept."
                      : "Current notes and folders will be replaced by this Markdown vault. Templates, saved searches, and settings are kept."}{" "}
                    Export a JSON backup first if you might need the current library.
                  </p>
                  <div className="dialog-actions dialog-actions-inline">
                    <button
                      className="dialog-button"
                      type="button"
                      onClick={() => setConfirmingVault(false)}
                    >
                      Keep current library
                    </button>
                    <button
                      className="dialog-button dialog-button-primary"
                      type="button"
                      onClick={() => onImportVault(vaultPreview)}
                    >
                      {vaultMode === "merge" ? "Merge vault" : "Replace library"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <Trash2 size={17} />
            </span>
            <div>
              <h3>Trash & retention</h3>
              <p>Choose how long deleted notes stay recoverable on this device.</p>
            </div>
          </div>
          <div className="data-section-action data-section-action-wrap">
            <label className="retention-control">
              <span>Remove Trash items</span>
              <select
                className="select-field"
                value={settings.trashRetentionDays}
                onChange={(event) => onRetentionChange(Number(event.target.value))}
              >
                {RETENTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="dialog-button dialog-button-danger-ghost"
              type="button"
              onClick={onEmptyTrash}
              disabled={trashCount === 0}
            >
              <Trash2 size={15} />
              Empty Trash
            </button>
          </div>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <CalendarDays size={17} />
            </span>
            <div>
              <h3>Daily notes</h3>
              <p>
                Today opens a note unique to the local calendar date. Previous and next links let
                you move through the days.
              </p>
            </div>
          </div>

          <div className="settings-grid">
            <label className="settings-row">
              <span>
                <strong>Daily note title</strong>
                <small>Dates use your local calendar.</small>
              </span>
              <select
                className="select-field"
                value={settings.dailyTitleFormat}
                onChange={(event) =>
                  onSettingsChange({ dailyTitleFormat: event.target.value })
                }
              >
                {DAILY_TITLE_FORMATS.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-row">
              <span>
                <strong>Daily template</strong>
                <small>Content and tags for new daily notes.</small>
              </span>
              <select
                className="select-field"
                value={settings.dailyTemplateId}
                onChange={(event) =>
                  onSettingsChange({ dailyTemplateId: event.target.value })
                }
              >
                {knowledge.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-row">
              <span>
                <strong>Daily folder</strong>
                <small>Where new daily notes are filed.</small>
              </span>
              <select
                className="select-field"
                value={settings.dailyFolderId ?? ""}
                onChange={(event) =>
                  onSettingsChange({ dailyFolderId: event.target.value || null })
                }
              >
                <option value="">No folder</option>
                {folderOptions.map(({ folder, depth }) => (
                  <option key={folder.id} value={folder.id}>
                    {`${"— ".repeat(depth)}${folder.name}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <History size={17} />
            </span>
            <div>
              <h3>Version history</h3>
              <p>
                Snapshots are saved before significant edits and at intervals. Older snapshots are
                pruned automatically.
              </p>
            </div>
          </div>
          <label className="settings-row">
            <span>
              <strong>Versions kept per note</strong>
              <small>Restoring a version preserves the current note first.</small>
            </span>
            <select
              className="select-field"
              value={settings.versionLimit}
              onChange={(event) =>
                onSettingsChange({ versionLimit: Number(event.target.value) })
              }
            >
              {VERSION_LIMIT_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value} versions
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <ShieldCheck size={17} />
            </span>
            <div>
              <h3>Backup reminders</h3>
              <p>Leekam can remind you when the library has gone a while without an export.</p>
            </div>
          </div>
          <label className="settings-row">
            <span>
              <strong>Remind me</strong>
              <small>Shown on the dashboard when a backup is due.</small>
            </span>
            <select
              className="select-field"
              value={settings.backupReminderDays}
              onChange={(event) =>
                onSettingsChange({ backupReminderDays: Number(event.target.value) })
              }
            >
              {BACKUP_REMINDER_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "Never" : `Every ${value} days`}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <SlidersHorizontal size={17} />
            </span>
            <div>
              <h3>Dashboard sections</h3>
              <p>Choose what appears on Home. All data stays available in the sidebar.</p>
            </div>
          </div>
          <div className="dashboard-section-toggles">
            {Object.keys(DEFAULT_DASHBOARD_SECTIONS).map((key) => (
              <label className="toggle-row" key={key}>
                <input
                  type="checkbox"
                  checked={settings.dashboardSections?.[key] !== false}
                  onChange={(event) =>
                    onSettingsChange({
                      dashboardSections: {
                        ...settings.dashboardSections,
                        [key]: event.target.checked,
                      },
                    })
                  }
                />
                <span>{DASHBOARD_SECTION_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="data-section">
          <div className="data-section-heading">
            <span className="data-section-icon">
              <LayoutTemplate size={17} />
            </span>
            <div>
              <h3>Templates & saved searches</h3>
              <p>
                Manage reusable starting points, or save a useful search from the note list.
              </p>
            </div>
          </div>
          <div className="data-section-action">
            <span className="data-hint">
              {knowledge.templates.length} templates · {knowledge.savedSearches.length} saved
              searches
            </span>
            <button className="dialog-button" type="button" onClick={onOpenTemplates}>
              <LayoutTemplate size={15} />
              Manage templates
            </button>
          </div>
          {knowledge.savedSearches.length > 0 && (
            <div className="saved-search-summary-list">
              {knowledge.savedSearches.map((search) => (
                <span key={search.id} className="saved-search-summary">
                  <Bookmark size={12} />
                  <strong>{search.name}</strong>
                  <code>{search.query}</code>
                </span>
              ))}
            </div>
          )}
        </section>

        <div className="data-local-note">
          <span className="data-local-icon">
            <ShieldCheck size={16} />
          </span>
          <p>
            Leekam has no server and no account. Export a backup before clearing browser storage,
            changing devices, or resetting your browser.
          </p>
          <span className="data-local-drive">
            <Database size={13} />
            localStorage
          </span>
        </div>

        <div className="data-footer">
          <Check size={14} />
          <span>
            {saveStatus === "saving"
              ? "Saving locally…"
              : storageError || saveStatus === "error"
                ? "A save failed. Export a backup and free browser storage."
                : "Everything is saved in this browser unless you export it."}
          </span>
        </div>
      </div>
    </Modal>
  );
}
