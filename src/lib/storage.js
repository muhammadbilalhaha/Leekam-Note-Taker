export const STORAGE_KEYS = {
  notes: "leekam.notes.v1",
  folders: "leekam.folders.v1",
  settings: "leekam.settings.v1",
  knowledge: "leekam.knowledge.v1",
  versions: "leekam.versions.v1",
  theme: "leekam.theme",
};

export function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function isStorageAvailable(storage = getStorage()) {
  if (!storage) return false;
  try {
    const key = "leekam.storage-test";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function isQuotaError(error) {
  if (!error) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

export function writeJson(key, value, storage = getStorage()) {
  if (!storage) {
    return { ok: false, error: "Browser storage is unavailable.", quota: false };
  }
  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true, error: null, quota: false };
  } catch (error) {
    return {
      ok: false,
      error: isQuotaError(error)
        ? "Browser storage is full. Export a backup and remove some data."
        : "This change could not be saved to browser storage.",
      quota: isQuotaError(error),
    };
  }
}

export function readJson(key, storage = getStorage()) {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function backupCorruptRaw(key, raw, storage = getStorage()) {
  if (!raw || !storage) return false;
  try {
    storage.setItem(`leekam.corrupt.${key}.${Date.now()}`, raw);
    return true;
  } catch {
    return false;
  }
}

export function getLocalStorageBytes(storage = getStorage()) {
  if (!storage) return 0;
  try {
    let bytes = 0;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;
      const value = storage.getItem(key) ?? "";
      bytes += (key.length + value.length) * 2;
    }
    return bytes;
  } catch {
    return 0;
  }
}

export async function getStorageEstimate(storage = getStorage()) {
  const localBytes = getLocalStorageBytes(storage);
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return {
      supported: false,
      usage: localBytes,
      quota: null,
      percent: null,
      localBytes,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = Number(estimate.usage) || 0;
    const quota = Number(estimate.quota) || 0;
    return {
      supported: true,
      usage,
      quota,
      percent: quota > 0 ? Math.min(100, (usage / quota) * 100) : null,
      localBytes,
    };
  } catch {
    return {
      supported: false,
      usage: localBytes,
      quota: null,
      percent: null,
      localBytes,
    };
  }
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getBackupReminder(settings, notes, now = Date.now()) {
  const activeCount = notes.filter((note) => !note.deletedAt).length;
  const reminderDays = Number(settings?.backupReminderDays);
  if (activeCount === 0 || !reminderDays) return null;
  if (!settings?.lastBackupAt) {
    return {
      due: true,
      days: null,
      message: "You have not exported a backup yet. Keep a copy of your library somewhere safe.",
    };
  }
  const days = Math.floor((now - settings.lastBackupAt) / (24 * 60 * 60 * 1000));
  if (days < reminderDays) return null;
  return {
    due: true,
    days,
    message: `It has been ${days} day${days === 1 ? "" : "s"} since your last backup.`,
  };
}
