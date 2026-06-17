'use strict';

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(str) {
  return String(str).replace(ANSI_REGEX, '');
}

function charWidth(code) {
  if (code >= 0x1100 && (
    code <= 0x115F ||
    (code >= 0x2E80 && code <= 0x303E) ||
    (code >= 0x3041 && code <= 0x33FF) ||
    (code >= 0x3400 && code <= 0x4DBF) ||
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0xA000 && code <= 0xA4CF) ||
    (code >= 0xAC00 && code <= 0xD7A3) ||
    (code >= 0xF900 && code <= 0xFAFF) ||
    (code >= 0xFE10 && code <= 0xFE19) ||
    (code >= 0xFE30 && code <= 0xFE6F) ||
    (code >= 0xFF00 && code <= 0xFF60) ||
    (code >= 0xFFE0 && code <= 0xFFE6) ||
    (code >= 0x1F000 && code <= 0x1FAFF) ||
    (code >= 0x20000 && code <= 0x2FA1F)
  )) {
    return 2;
  }
  return 1;
}

function stringWidth(str) {
  const s = stripAnsi(str);
  let width = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0);
    width += charWidth(code);
  }
  return width;
}

function padEndVisual(str, targetWidth, padChar = ' ') {
  const s = String(str);
  const diff = targetWidth - stringWidth(s);
  if (diff <= 0) return s;
  return s + padChar.repeat(diff);
}

function padStartVisual(str, targetWidth, padChar = ' ') {
  const s = String(str);
  const diff = targetWidth - stringWidth(s);
  if (diff <= 0) return s;
  return padChar.repeat(diff) + s;
}

function centerVisual(str, targetWidth, padChar = ' ') {
  const s = String(str);
  const diff = targetWidth - stringWidth(s);
  if (diff <= 0) return s;
  const left = Math.floor(diff / 2);
  const right = diff - left;
  return padChar.repeat(left) + s + padChar.repeat(right);
}

function truncateVisual(str, targetWidth, suffix = '..') {
  const s = String(str);
  if (stringWidth(s) <= targetWidth) return s;
  let width = 0;
  let result = '';
  for (const ch of s) {
    const w = charWidth(ch.codePointAt(0));
    if (width + w > targetWidth) break;
    result += ch;
    width += w;
  }
  const suffixWidth = stringWidth(suffix);
  if (targetWidth <= suffixWidth) return suffix.slice(0, targetWidth);
  while (stringWidth(result) > targetWidth - suffixWidth) {
    result = result.slice(0, -1);
  }
  return result + suffix;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateLocal(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatDateTimeLocal(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function displayDateTime(isoLike) {
  if (!isoLike) return '';
  return String(isoLike).slice(0, 19).replace('T', ' ');
}

function displayDate(isoLike) {
  if (!isoLike) return '';
  return String(isoLike).slice(0, 10);
}

function parseDateLocal(str) {
  if (!str) return new Date(NaN);
  const s = String(str).replace(/[-/]/g, '');
  if (/^\d{8}$/.test(s)) {
    const y = Number(s.slice(0, 4));
    const m = Number(s.slice(4, 6)) - 1;
    const d = Number(s.slice(6, 8));
    return new Date(y, m, d, 0, 0, 0, 0);
  }
  return new Date(str);
}

module.exports = {
  stripAnsi,
  stringWidth,
  charWidth,
  padEndVisual,
  padStartVisual,
  centerVisual,
  truncateVisual,
  formatDateLocal,
  formatDateTimeLocal,
  displayDateTime,
  displayDate,
  parseDateLocal
};
