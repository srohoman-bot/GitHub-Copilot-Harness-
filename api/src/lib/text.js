'use strict';

const CTRL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return Array.from(value.replace(CTRL, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
}

// Aggressive normalisation used only for matching, never stored.
function fold(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\u200B-\u200D._\-*]+/g, '');
}

const URL_LIKE = [
  /https?:\/\//i,
  /\bwww\./i,
  /[a-z0-9-]{2,}\.(com|net|org|io|jp|co|xyz|ru|cn|info|biz|me|app|dev|ly|gg|to|cc|tk|top|site|online|shop)\b/i,
  /[\w.+-]+@[\w-]+\.[\w.]+/,
  /(^|\s)@\w{3,}/,
  /\d[\d\s().-]{8,}\d/
];

const NG_WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'killyourself', 'kys',
  '死ね', 'しね', 'シネ', '殺す', '殺してやる', 'ころす', 'コロス', 'ちんこ', 'ちんぽ', 'まんこ', 'おっぱい', 'セックス', 'レイプ'
];

function isRejected(text) {
  if (!text) return false;
  if (URL_LIKE.some((re) => re.test(text))) return true;
  const folded = fold(text);
  if (NG_WORDS.some((w) => folded.includes(fold(w)))) return true;
  if (/(.)\1{11,}/u.test(folded)) return true;
  return false;
}

module.exports = { clean, isRejected };
