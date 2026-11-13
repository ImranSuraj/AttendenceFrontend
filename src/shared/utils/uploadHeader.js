import { unzipSync } from "fflate";

// Checks the FIRST ROW of a CSV / .xlsx file against the upload template before anything is sent, with the same rules and wording as the server
// (Common/Uploads): a template read by position needs the same columns in the same order; a template read by name needs every required column,
// no unknown column and no column twice. The server checks again; this only saves the user a round trip.
// The same file lives in EmployeeConnect.Mobile/src/shared/utils/uploadHeader.js - keep the two identical.

const decoder = new TextDecoder("utf-8");
const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

function csvFirstRow(bytes) {
  const text = decoder.decode(bytes.subarray(0, 65536)).replace(/^﻿/, "");
  const line = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== "");
  if (line === undefined) return [];
  const cells = [];
  let cell = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) { if (c === '"') { if (line[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
    else if (c === '"') quoted = true;
    else if (c === ",") { cells.push(cell); cell = ""; }
    else cell += c;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
}

const unescapeXml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const columnIndex = (ref) => [...ref.replace(/\d+/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function xlsxFirstRow(bytes) {
  let files;
  try { files = unzipSync(bytes, { filter: (f) => f.name === "xl/worksheets/sheet1.xml" || f.name === "xl/sharedStrings.xml" }); }
  catch { throw new Error("The file is not a valid .xlsx workbook."); }
  const sheet = files["xl/worksheets/sheet1.xml"];
  if (!sheet) throw new Error("The workbook has no sheet named Sheet1.");
  const shared = files["xl/sharedStrings.xml"]
    ? [...decoder.decode(files["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)]
        .map((m) => unescapeXml([...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")))
    : [];
  const xml = decoder.decode(sheet);
  const row = /<row\b[^>]*>([\s\S]*?)<\/row>/.exec(xml);
  if (!row) return [];
  const cells = [];
  for (const m of row[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = /\br="([A-Z]+\d+)"/.exec(m[1])?.[1];
    const type = /\bt="(\w+)"/.exec(m[1])?.[1];
    const inner = m[2] ?? "";
    let value = "";
    if (type === "s") value = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1])] ?? "";
    else if (type === "inlineStr") value = unescapeXml([...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
    else value = unescapeXml(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? "");
    cells[ref ? columnIndex(ref) : cells.length] = value.trim();
  }
  return Array.from(cells, (c) => c ?? "");
}

/**
 * Returns "" when the first row of the file matches the template, otherwise the message to show.
 *   bytes: Uint8Array of the whole file   ext: ".csv" | ".xlsx"
 *   template: { name, columns, optional = [], anyOrder = false }
 */
export function checkUploadHeader(bytes, ext, { name, columns, optional = [], anyOrder = false }) {
  let header;
  try { header = ext === ".xlsx" ? xlsxFirstRow(bytes) : csvFirstRow(bytes); }
  catch (e) { return e.message; }
  while (header.length && header[header.length - 1] === "") header.pop();
  if (header.length === 0) return "The file is empty.";

  const all = [...columns, ...optional];
  const list = all.join(", ");
  const required = columns.length;

  if (!anyOrder) {
    if (header.length !== required) return `The file has ${header.length} columns but the ${name} template has ${required}: ${list}.`;
    const at = columns.findIndex((c, i) => !same(header[i], c));
    return at < 0 ? "" : `Column ${at + 1} should be '${columns[at]}' but is '${header[at]}' (template: ${list}).`;
  }
  if (header.length < required || header.length > all.length) {
    const extra = all.length > required ? ` (and up to ${all.length - required} optional)` : "";
    return `The file has ${header.length} columns but the ${name} template needs ${required}${extra}: ${list}.`;
  }
  const unknown = header.find((h) => !all.some((a) => same(h, a)));
  if (unknown !== undefined) return `The column '${unknown}' is not in the ${name} template (template: ${list}).`;
  if (new Set(header.map((h) => h.toLowerCase())).size !== header.length) return `A column of the ${name} template is in the file twice (template: ${list}).`;
  const missing = columns.filter((c) => !header.some((h) => same(h, c)));
  return missing.length ? `The ${name} template column(s) missing: ${missing.join(", ")} (template: ${list}).` : "";
}
