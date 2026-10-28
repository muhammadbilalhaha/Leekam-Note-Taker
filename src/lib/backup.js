import { parseFolders } from "./folders.js";
import { defaultKnowledge, parseKnowledge } from "./knowledge.js";
import { parseNotes } from "./notes.js";
import { parseVersions } from "./versions.js";

export const SETTINGS_KEY = "leekam.settings.v1";
export const BACKUP_FORMAT = "leekam-backup";
export const BACKUP_VERSION = 2;

export const RETENTION_OPTIONS = [
  { value: 7, label: "After 7 days" },
  { value: 30, label: "After 30 days" },
  { value: 90, label: "After 90 days" },
  { value: 0, label: "Never automatically" },
];

export const VERSION_LIMIT_OPTIONS = [5, 10, 20, 50];
export const STORAGE_WARNING_OPTIONS = [70, 80, 90];
export const BACKUP_REMINDER_OPTIONS = [7, 14, 30, 0];
export const DAILY_TITLE_FORMAT_IDS = ["iso", "short", "long", "weekday"];

export const DEFAULT_DASHBOARD_SECTIONS = {
  daily: true,
  recentOpened: true,
  recentlyEdited: true,
  favorites: true,
  savedSearches: true,
  brokenLinks: true,
  isolated: true,
};

export const DEFAULT_SETTINGS = {
  trashRetentionDays: 30,
  lastBackupAt: null,
  versionLimit: 20,
  storageWarningPercent: 80,
  backupReminderDays: 14,
  dailyTitleFormat: "iso",
  dailyTemplateId: "template-daily",
  dailyFolderId: null,
  dashboardSections: { ...DEFAULT_DASHBOARD_SECTIONS },
};

function parseDashboardSections(value) {
  const sections = { ...DEFAULT_DASHBOARD_SECTIONS };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    Object.keys(sections).forEach((key) => {
      if (typeof value[key] === "boolean") sections[key] = value[key];
    });
  }
  return sections;
}

export function parseSettings(raw) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ...DEFAULT_SETTINGS,
        dashboardSections: { ...DEFAULT_DASHBOARD_SECTIONS },
      };
    }

    const retention = Number(parsed.trashRetentionDays);
    const validRetention = RETENTION_OPTIONS.some((option) => option.value === retention)
      ? retention
      : DEFAULT_SETTINGS.trashRetentionDays;
    const lastBackupAt = Number(parsed.lastBackupAt);
    const versionLimit = Number(parsed.versionLimit);
    const storageWarningPercent = Number(parsed.storageWarningPercent);
    const backupReminderDays = Number(parsed.backupReminderDays);

    return {
      trashRetentionDays: validRetention,
      lastBackupAt: Number.isFinite(lastBackupAt) && lastBackupAt > 0 ? lastBackupAt : null,
      versionLimit: VERSION_LIMIT_OPTIONS.includes(versionLimit)
        ? versionLimit
        : DEFAULT_SETTINGS.versionLimit,
      storageWarningPercent: STORAGE_WARNING_OPTIONS.includes(storageWarningPercent)
        ? storageWarningPercent
        : DEFAULT_SETTINGS.storageWarningPercent,
      backupReminderDays: BACKUP_REMINDER_OPTIONS.includes(backupReminderDays)
        ? backupReminderDays
        : DEFAULT_SETTINGS.backupReminderDays,
      dailyTitleFormat: DAILY_TITLE_FORMAT_IDS.includes(parsed.dailyTitleFormat)
        ? parsed.dailyTitleFormat
        : DEFAULT_SETTINGS.dailyTitleFormat,
      dailyTemplateId:
        typeof parsed.dailyTemplateId === "string" && parsed.dailyTemplateId
          ? parsed.dailyTemplateId
          : DEFAULT_SETTINGS.dailyTemplateId,
      dailyFolderId:
        typeof parsed.dailyFolderId === "string" && parsed.dailyFolderId
          ? parsed.dailyFolderId
          : null,
      dashboardSections: parseDashboardSections(parsed.dashboardSections),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      dashboardSections: { ...DEFAULT_DASHBOARD_SECTIONS },
    };
  }
}

function emptySettings() {
  return {
    ...DEFAULT_SETTINGS,
    dashboardSections: { ...DEFAULT_DASHBOARD_SECTIONS },
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw === null ? emptySettings() : parseSettings(raw);
  } catch {
    return emptySettings();
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function buildBackup(notes, folders, settings, knowledge, versions) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notes,
    folders,
    settings: parseSettings(settings),
    knowledge: parseKnowledge(knowledge) ?? defaultKnowledge(),
    versions: parseVersions(versions) ?? {},
  };
}

export function validateBackup(rawText) {
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }

  const legacyNotes = Array.isArray(parsed);
  const sourceNotes = legacyNotes ? parsed : parsed?.notes;
  if (!Array.isArray(sourceNotes)) {
    return { ok: false, error: "This file does not contain a notes list." };
  }

  const parsedNotes = parseNotes(JSON.stringify(sourceNotes));
  if (!parsedNotes) {
    return { ok: false, error: "The notes in this file could not be read." };
  }

  const seen = new Set();
  const notes = parsedNotes.filter((note) => {
    if (seen.has(note.id)) return false;
    seen.add(note.id);
    return true;
  });

  const folders = legacyNotes ? [] : (parseFolders(parsed?.folders ?? []) ?? []);
  const folderIds = new Set(folders.map((folder) => folder.id));
  notes.forEach((note) => {
    if (note.folderId && !folderIds.has(note.folderId)) note.folderId = null;
  });

  const settings = legacyNotes
    ? parseSettings(DEFAULT_SETTINGS)
    : parseSettings(parsed?.settings ?? DEFAULT_SETTINGS);
  const knowledge = legacyNotes
    ? defaultKnowledge()
    : (parseKnowledge(parsed?.knowledge) ?? defaultKnowledge());
  const versions = legacyNotes ? {} : (parseVersions(parsed?.versions) ?? {});

  return {
    ok: true,
    data: { notes, folders, settings, knowledge, versions },
    summary: {
      notes: notes.length,
      folders: folders.length,
      trashed: notes.filter((note) => note.deletedAt).length,
      templates: knowledge.templates.length,
      savedSearches: knowledge.savedSearches.length,
      versions: Object.values(versions).reduce((sum, list) => sum + list.length, 0),
    },
  };
}

export function purgeExpiredTrash(notes, retentionDays, now = Date.now()) {
  if (!retentionDays) return notes;
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  return notes.filter((note) => !note.deletedAt || note.deletedAt >= cutoff);
}

export function getRetentionLabel(days) {
  const option = RETENTION_OPTIONS.find((item) => item.value === days);
  if (!option || days === 0) return "Kept until you empty Trash";
  return `Auto-deletes after ${days} days`;
}

export function sanitizeFilename(value, fallback = "note") {
  const cleaned = (value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

export function getBackupFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `leekam-backup-${stamp}.json`;
}

export function downloadFile(filename, content, mimeType = "text/plain") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
