/**
 * 业务常量：时间段、预约状态、座位状态、座位类型
 * 说明：前端（第三/四棒）与后端共用同一套枚举值，避免出现「后端起名 MORNING，前端传 morning」的问题。
 */

/** 时间段枚举（小程序「上午/下午/晚上」三段固定时段） */
const SLOTS = {
  MORNING: { code: 'MORNING', label: '上午', start: '08:00', end: '12:00' },
  AFTERNOON: { code: 'AFTERNOON', label: '下午', start: '14:00', end: '18:00' },
  EVENING: { code: 'EVENING', label: '晚上', start: '19:00', end: '22:00' },
};

const SLOT_CODES = Object.keys(SLOTS);

/** 预约状态 */
const RESERVATION_STATUS = {
  PENDING: 'PENDING', // 待签到（预约成功后的初始态）
  CHECKED_IN: 'CHECKED_IN', // 使用中（签到成功后）
  COMPLETED: 'COMPLETED', // 已完成
  CANCELLED: 'CANCELLED', // 已取消
  EXPIRED: 'EXPIRED', // 超时未到，系统自动释放
};

/** 座位在某个时段对外展示的三种状态（座位图三态配色用） */
const SEAT_VIEW_STATUS = {
  FREE: 'FREE', // 空闲，可预约（绿）
  RESERVED: 'RESERVED', // 已预约，待签到（黄）
  IN_USE: 'IN_USE', // 使用中，已签到（红）
  DISABLED: 'DISABLED', // 停用/不可用（灰）
};

/** 座位物理类型 */
const SEAT_TYPE = {
  NORMAL: 'NORMAL',
  POWER: 'POWER',
  WINDOW: 'WINDOW',
};

/** 阅览室状态 */
const ROOM_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
};

/** 「有效」预约：会占用座位的状态（取消/超时/完成都不再占用） */
const ACTIVE_RESERVATION_STATUS = [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CHECKED_IN];

module.exports = {
  SLOTS,
  SLOT_CODES,
  RESERVATION_STATUS,
  SEAT_VIEW_STATUS,
  SEAT_TYPE,
  ROOM_STATUS,
  ACTIVE_RESERVATION_STATUS,
};
