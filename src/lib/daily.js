import { makeNote } from "./notes.js";

const DATE_LOCALE = "en-US";

export const DAILY_TITLE_FORMATS = [
  { id: "iso", label: "2026-10-28", description: "ISO date" },
  { id: "short", label: "Oct 28, 2026", description: "Short date" },
  { id: "long", label: "October 28, 2026", description: "Long date" },
  { id: "weekday", label: "Wednesday, October 28, 2026", description: "Weekday and date" },
];

export function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function parseLocalDateKey(dateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ""));
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function shiftDateKey(dateKey, days) {
  const date = parseLocalDateKey(dateKey);
  if (!date) return dateKey;
  date.setDate(date.getDate() + days);
  return getLocalDateKey(date);
}

export function formatDailyTitle(dateKey, formatId = "iso") {
  const date = parseLocalDateKey(dateKey);
  if (!date) return dateKey;
  switch (formatId) {
    case "short":
      return date.toLocaleDateString(DATE_LOCALE, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    case "long":
      return date.toLocaleDateString(DATE_LOCALE, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "weekday":
      return date.toLocaleDateString(DATE_LOCALE, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    case "iso":
    default:
      return dateKey;
  }
}

export function getDailyContext(dateKey) {
  const date = parseLocalDateKey(dateKey) ?? new Date();
  return {
    date,
    dateKey,
    weekday: date.toLocaleDateString(DATE_LOCALE, { weekday: "long" }),
    month: date.toLocaleDateString(DATE_LOCALE, { month: "long" }),
    year: String(date.getFullYear()),
  };
}

export function findDailyNote(notes, dateKey) {
  return (
    notes
      .filter((note) => note.dailyDate === dateKey)
      .sort((a, b) => a.createdAt - b.createdAt)[0] ?? null
  );
}

export function makeDailyNote({ dateKey, title, content = "", tags = [], folderId = null, color }) {
  return makeNote({
    title,
    content,
    tags,
    folderId,
    dailyDate: dateKey,
    ...(color ? { color } : {}),
  });
}

export function getAdjacentDailyDate(note, direction) {
  if (!note?.dailyDate) return null;
  return shiftDateKey(note.dailyDate, direction);
}

export function formatDailyHeading(dateKey) {
  const date = parseLocalDateKey(dateKey);
  if (!date) return dateKey;
  return date.toLocaleDateString(DATE_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
