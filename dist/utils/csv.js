"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCsv = toCsv;
function escapeCsvCell(value) {
    const str = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
function toCsv(headers, rows) {
    const lines = [headers.map(escapeCsvCell).join(",")];
    for (const row of rows) {
        lines.push(row.map(escapeCsvCell).join(","));
    }
    // BOM برای نمایش درست حروف فارسی در Excel
    return "\uFEFF" + lines.join("\r\n");
}
