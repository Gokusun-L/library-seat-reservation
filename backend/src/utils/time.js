/**
 * 时间工具
 * 约定：日期统一 'YYYY-MM-DD'，日期时间统一 'YYYY-MM-DD HH:mm'（字符串可直接比较大小，
 *      避免各端时区/时间戳换算不一致带来的坑）。数据库里也直接存这两种格式。
 */
const { SLOTS } = require('../constants/business');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

const pad = (n) => String(n).padStart(2, '0');

function formatDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(d = new Date()) {
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function today() {
  return formatDate(new Date());
}

function now() {
  return formatDateTime(new Date());
}

/** 校验 YYYY-MM-DD 且是真实存在的日期（排除 2026-02-30 这类） */
function isValidDate(str) {
  if (typeof str !== 'string' || !DATE_RE.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isValidDateTime(str) {
  if (typeof str !== 'string' || !DATETIME_RE.test(str)) return false;
  return isValidDate(str.slice(0, 10));
}

/** 日期 + 时间段 → 预约起止时间 */
function buildSlotWindow(date, slotCode) {
  const slot = SLOTS[slotCode];
  if (!slot) return null;
  return { startTime: `${date} ${slot.start}`, endTime: `${date} ${slot.end}` };
}

/** dayOffset 天后的日期（第二棒：签到时间窗口计算会用到） */
function addDays(dateStr, dayOffset) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + dayOffset);
  return formatDate(dt);
}

/** 距今天数差：dateStr 相对 todayIso（负数=过去） */
function diffDays(dateStr, todayIso = today()) {
  const toUtc = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dateStr) - toUtc(todayIso)) / 86400000);
}

/** 字符串形式日期时间比较：a < b 返回负数 */
function compareDateTime(a, b) {
  return a === b ? 0 : a < b ? -1 : 1;
}

module.exports = {
  formatDate,
  formatDateTime,
  today,
  now,
  isValidDate,
  isValidDateTime,
  buildSlotWindow,
  addDays,
  diffDays,
  compareDateTime,
};
