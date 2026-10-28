export function markdownToPlainText(markdown) {
  if (typeof markdown !== "string" || !markdown) return "";

  return markdown
    .replace(/```[^\n]*\n?/g, "")
    .replace(/~~~[^\n]*\n?/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/`/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getMarkdownStats(content) {
  const plain = markdownToPlainText(content);
  const words = plain ? plain.split(/\s+/).length : 0;
  return {
    words,
    characters: plain.length,
    readMinutes: Math.max(1, Math.ceil(words / 200)),
  };
}

export function noteToMarkdown(note, folderName = "") {
  const lines = [`# ${note.title.trim() || "Untitled note"}`, ""];
  if (folderName) lines.push(`Folder: ${folderName}`);
  if (note.tags.length > 0) lines.push(`Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
  if (folderName || note.tags.length > 0) lines.push("");
  if (note.content) lines.push(note.content);
  return `${lines.join("\n").trim()}\n`;
}

export function noteToPlainText(note, folderName = "") {
  const lines = [note.title.trim() || "Untitled note"];
  if (folderName) lines.push(`Folder: ${folderName}`);
  if (note.tags.length > 0) lines.push(`Tags: ${note.tags.map((tag) => `#${tag}`).join(" ")}`);
  const plain = markdownToPlainText(note.content);
  if (plain) lines.push("", plain);
  return `${lines.join("\n").trim()}\n`;
}

export function toggleTaskAtIndex(content, index) {
  let seen = 0;
  let toggled = false;

  const next = content.replace(/^(\s*[-*+]\s+)\[([ xX])\]/gm, (match, prefix, state) => {
    if (seen !== index) {
      seen += 1;
      return match;
    }
    seen += 1;
    toggled = true;
    return `${prefix}[${state === " " ? "x" : " "}]`;
  });

  return toggled ? next : content;
}
