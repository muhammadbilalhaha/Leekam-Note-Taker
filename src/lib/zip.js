const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      ((date.getHours() & 0x1f) << 11) |
      ((date.getMinutes() & 0x3f) << 5) |
      ((date.getSeconds() & 0x3e) >> 1),
    date:
      (((year - 1980) & 0x7f) << 9) |
      (((date.getMonth() + 1) & 0x0f) << 5) |
      (date.getDate() & 0x1f),
  };
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

/**
 * Builds a store-only ZIP archive. Avoiding compression keeps this dependency
 * free and is fast for Markdown vaults, which are already small text files.
 */
export function createZip(files, date = new Date()) {
  const encoder = new TextEncoder();
  const entries = files.map((file) => {
    const nameBytes = encoder.encode(String(file.path ?? "").replace(/\\/g, "/"));
    const dataBytes = encoder.encode(String(file.content ?? ""));
    return {
      nameBytes,
      dataBytes,
      crc: crc32(dataBytes),
      offset: 0,
    };
  });

  const { time, date: dosDate } = dosDateTime(date);
  let localSize = 0;
  entries.forEach((entry) => {
    localSize += 30 + entry.nameBytes.length + entry.dataBytes.length;
  });
  let centralSize = 0;
  entries.forEach((entry) => {
    centralSize += 46 + entry.nameBytes.length;
  });

  const output = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(output.buffer);
  let offset = 0;

  entries.forEach((entry) => {
    entry.offset = offset;
    writeUint32(view, offset, 0x04034b50);
    writeUint16(view, offset + 4, 20);
    writeUint16(view, offset + 6, 0x0800);
    writeUint16(view, offset + 8, 0);
    writeUint16(view, offset + 10, time);
    writeUint16(view, offset + 12, dosDate);
    writeUint32(view, offset + 14, entry.crc);
    writeUint32(view, offset + 18, entry.dataBytes.length);
    writeUint32(view, offset + 22, entry.dataBytes.length);
    writeUint16(view, offset + 26, entry.nameBytes.length);
    writeUint16(view, offset + 28, 0);
    output.set(entry.nameBytes, offset + 30);
    output.set(entry.dataBytes, offset + 30 + entry.nameBytes.length);
    offset += 30 + entry.nameBytes.length + entry.dataBytes.length;
  });

  const centralOffset = offset;
  entries.forEach((entry) => {
    writeUint32(view, offset, 0x02014b50);
    writeUint16(view, offset + 4, 20);
    writeUint16(view, offset + 6, 20);
    writeUint16(view, offset + 8, 0x0800);
    writeUint16(view, offset + 10, 0);
    writeUint16(view, offset + 12, time);
    writeUint16(view, offset + 14, dosDate);
    writeUint32(view, offset + 16, entry.crc);
    writeUint32(view, offset + 20, entry.dataBytes.length);
    writeUint32(view, offset + 24, entry.dataBytes.length);
    writeUint16(view, offset + 28, entry.nameBytes.length);
    writeUint16(view, offset + 30, 0);
    writeUint16(view, offset + 32, 0);
    writeUint16(view, offset + 34, 0);
    writeUint16(view, offset + 36, 0);
    writeUint32(view, offset + 38, 0);
    writeUint32(view, offset + 42, entry.offset);
    output.set(entry.nameBytes, offset + 46);
    offset += 46 + entry.nameBytes.length;
  });

  writeUint32(view, offset, 0x06054b50);
  writeUint16(view, offset + 4, 0);
  writeUint16(view, offset + 6, 0);
  writeUint16(view, offset + 8, entries.length);
  writeUint16(view, offset + 10, entries.length);
  writeUint32(view, offset + 12, offset - centralOffset);
  writeUint32(view, offset + 16, centralOffset);
  writeUint16(view, offset + 20, 0);

  return output;
}

export function downloadBytes(filename, bytes, mimeType = "application/zip") {
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
