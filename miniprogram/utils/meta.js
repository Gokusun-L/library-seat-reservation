// 枚举元数据缓存：约定「枚举不要硬编码」，统一从 /meta/* 拉取后缓存复用。
const { request } = require('./request');

let slotsCache = null;
let statusCache = null;

// 时间段枚举：[{ code, label, start, end }]
function getSlots(force = false) {
  if (!force && slotsCache) return Promise.resolve(slotsCache);
  return request('/meta/slots').then((slots) => {
    slotsCache = slots;
    return slots;
  });
}

// 状态/类型枚举：reservationStatus / seatViewStatus / seatType / checkinWindowMinutes
function getStatusMeta(force = false) {
  if (!force && statusCache) return Promise.resolve(statusCache);
  return request('/meta/status').then((meta) => {
    statusCache = meta;
    return meta;
  });
}

module.exports = { getSlots, getStatusMeta };