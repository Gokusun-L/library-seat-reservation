/**
 * 阅览室与座位展示 Service（US-01a 阅览室列表 / US-01b 座位分布图）
 *
 * 设计要点：
 * 1. 座位「静态信息」来自 seat 表，「某时段占用情况」来自 reservation 表，两者在 Service 层合并，
 *    座位表本身不存实时状态 —— 避免出现「座位表 status 与预约记录不一致」的经典脏数据问题。
 * 2. 三态口径：FREE（无有效预约） / RESERVED（PENDING） / IN_USE（CHECKED_IN），
 *    停用座位统一给 DISABLED，前端按 status 上色即可。
 */
const roomDao = require('../dao/readingRoomDao');
const seatDao = require('../dao/seatDao');
const reservationDao = require('../dao/reservationDao');
const { BizError } = require('../utils/BizError');
const { ERROR_CODE } = require('../constants/errorCode');
const { SLOT_CODES, SLOTS, SEAT_VIEW_STATUS, ROOM_STATUS } = require('../constants/business');
const time = require('../utils/time');

/** 校验并补全查询参数（date 缺省今天，slot 缺省当前时段） */
function normalizeQuery({ date, slot } = {}) {
  const reserveDate = date || time.today();
  if (!time.isValidDate(reserveDate)) throw new BizError(ERROR_CODE.DATE_FORMAT_INVALID);
  const slotCode = slot || currentSlot();
  if (!SLOT_CODES.includes(slotCode)) throw new BizError(ERROR_CODE.SLOT_INVALID);
  return { date: reserveDate, slot: slotCode };
}

/** 当前时段：按时间段开始时间就近判断，用于列表页默认值 */
function currentSlot() {
  const hour = new Date().getHours();
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'EVENING';
}

function assertRoomExists(roomId) {
  const room = roomDao.findById(roomId);
  if (!room) throw new BizError(ERROR_CODE.ROOM_NOT_FOUND);
  return room;
}

/**
 * 阅览室列表（US-01a）
 * 返回每个阅览室的座位规模、当前时段剩余座位数、开放状态，供前端卡片展示。
 */
function listRooms(query = {}) {
  const rooms = roomDao.findAll({
    keyword: query.keyword,
    building: query.building,
    status: query.status,
  });
  const { date, slot } = normalizeQuery(query);
  const seatStats = roomDao.countSeats(rooms.map((r) => r.id));

  return rooms.map((room) => {
    const stats = seatStats[room.id] || { total: 0, enabled: 0 };
    const occupied = reservationDao.findOccupiedByRoom(room.id, date, slot).length;
    const availableSeats = Math.max(stats.enabled - occupied, 0);
    return {
      ...room,
      totalSeats: stats.total,
      enabledSeats: stats.enabled,
      availableSeats,
      isOpen: room.status === ROOM_STATUS.OPEN,
      queryDate: date,
      querySlot: slot,
    };
  });
}

/**
 * 座位布局（US-01b 静态骨架）
 * 前端据此渲染 rows × cols 的网格，不包含占用状态，可缓存。
 */
function getLayout(roomId) {
  const room = assertRoomExists(roomId);
  const seats = seatDao.findByRoom(roomId);
  return {
    room,
    layout: {
      rowCount: room.rowCount,
      colCount: room.colCount,
      colGap: room.colGap,
    },
    seats: seats.map((s) => ({
      seatId: s.id,
      seatNo: s.seatNo,
      row: s.rowIndex,
      col: s.colIndex,
      seatType: s.seatType,
      enabled: s.status === 'ENABLED',
    })),
  };
}

/**
 * 座位状态查询（US-01b 动态状态）
 * @returns {{ room, date, slot, slotWindow, seats: Array, summary: object }}
 */
function getSeatStatus(roomId, query = {}) {
  const room = assertRoomExists(roomId);
  const { date, slot } = normalizeQuery(query);
  const seats = seatDao.findByRoom(roomId);
  const occupiedList = reservationDao.findOccupiedByRoom(roomId, date, slot);
  const occupiedMap = new Map(occupiedList.map((o) => [o.seatId, o.status]));

  const summary = {
    total: seats.length,
    [SEAT_VIEW_STATUS.FREE]: 0,
    [SEAT_VIEW_STATUS.RESERVED]: 0,
    [SEAT_VIEW_STATUS.IN_USE]: 0,
    [SEAT_VIEW_STATUS.DISABLED]: 0,
  };

  const list = seats.map((s) => {
    let status;
    if (s.status !== 'ENABLED') status = SEAT_VIEW_STATUS.DISABLED;
    else if (occupiedMap.get(s.id) === 'CHECKED_IN') status = SEAT_VIEW_STATUS.IN_USE;
    else if (occupiedMap.get(s.id) === 'PENDING') status = SEAT_VIEW_STATUS.RESERVED;
    else status = SEAT_VIEW_STATUS.FREE;

    summary[status] += 1;
    return {
      seatId: s.id,
      seatNo: s.seatNo,
      row: s.rowIndex,
      col: s.colIndex,
      seatType: s.seatType,
      status, // FREE / RESERVED / IN_USE / DISABLED
      reservable: status === SEAT_VIEW_STATUS.FREE,
    };
  });

  return {
    room,
    date,
    slot,
    slotLabel: SLOTS[slot].label,
    slotWindow: time.buildSlotWindow(date, slot),
    seats: list,
    summary,
  };
}

module.exports = {
  listRooms,
  getLayout,
  getSeatStatus,
  normalizeQuery,
  currentSlot,
  assertRoomExists,
};
