/**
 * 预约 Service（US-02 选择座位并预约 + 重复预约校验）
 *
 * 校验顺序是刻意设计的 —— 先校验「能不能约」（参数 / 资源存在 / 时间合法），
 * 再校验「有没有被别人占」（冲突类），最后才写库，这样用户拿到的提示总是最该先解决的那个问题。
 *
 * 并发安全：先查后插在极端并发下会同时通过检查，因此数据库层还加了两个部分唯一索引
 * （座位 × 日期 × 时段、用户 × 日期 × 时段），写库时若违反唯一约束，转成 40901/40902 返回。
 */
const roomDao = require('../dao/readingRoomDao');
const seatDao = require('../dao/seatDao');
const reservationDao = require('../dao/reservationDao');
const { BizError } = require('../utils/BizError');
const { ERROR_CODE } = require('../constants/errorCode');
const {
  SLOT_CODES,
  SLOTS,
  RESERVATION_STATUS,
  ROOM_STATUS,
} = require('../constants/business');
const time = require('../utils/time');

/** 单次预约最大可提前天数（图书馆惯例：只开放未来 7 天） */
const MAX_ADVANCE_DAYS = 7;

/** 生成预约单号：R + 日期 + 4 位随机数，例如 R202610210137 */
function generateReservationNo(date) {
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `R${date.replace(/-/g, '')}${rand}`;
}

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

/**
 * 创建预约
 * @param {object} payload
 * @param {string} payload.userId      预约人标识（小程序 openid / 学号）
 * @param {string} [payload.userName]  预约人姓名
 * @param {number} payload.roomId      阅览室 ID
 * @param {number} payload.seatId      座位 ID
 * @param {string} payload.date        预约日期 YYYY-MM-DD
 * @param {string} payload.slot        MORNING / AFTERNOON / EVENING
 * @returns {object} 预约详情（含座位号、阅览室名，前端可直接展示成功页）
 */
function createReservation(payload = {}) {
  const { userId, userName, roomId, seatId, date, slot } = payload;

  // ---------- 1. 参数校验 ----------
  if (isBlank(userId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少预约人标识 userId');
  if (isBlank(roomId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少阅览室 ID roomId');
  if (isBlank(seatId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少座位 ID seatId');
  if (isBlank(date)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少预约日期 date');
  if (isBlank(slot)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少时间段 slot');

  const roomIdNum = Number(roomId);
  const seatIdNum = Number(seatId);
  if (!Number.isInteger(roomIdNum) || roomIdNum <= 0) {
    throw new BizError(ERROR_CODE.PARAM_INVALID, 'roomId 必须是正整数');
  }
  if (!Number.isInteger(seatIdNum) || seatIdNum <= 0) {
    throw new BizError(ERROR_CODE.PARAM_INVALID, 'seatId 必须是正整数');
  }
  if (!time.isValidDate(date)) throw new BizError(ERROR_CODE.DATE_FORMAT_INVALID);
  if (!SLOT_CODES.includes(slot)) throw new BizError(ERROR_CODE.SLOT_INVALID);

  // ---------- 2. 资源校验 ----------
  const room = roomDao.findById(roomIdNum);
  if (!room) throw new BizError(ERROR_CODE.ROOM_NOT_FOUND);
  if (room.status !== ROOM_STATUS.OPEN) {
    throw new BizError(ERROR_CODE.ROOM_CLOSED, '该阅览室暂停开放');
  }

  const seat = seatDao.findById(seatIdNum);
  if (!seat) throw new BizError(ERROR_CODE.SEAT_NOT_FOUND);
  // 座位必须属于该阅览室，防止前端传错或恶意构造
  if (seat.roomId !== roomIdNum) throw new BizError(ERROR_CODE.SEAT_ROOM_MISMATCH);
  if (seat.status !== 'ENABLED') throw new BizError(ERROR_CODE.SEAT_DISABLED);

  // ---------- 3. 时间校验 ----------
  const window = time.buildSlotWindow(date, slot);
  // ① 时段必须在阅览室开放时间内（如某室 09:00 才开门，则不能约 MORNING 08:00 场）
  if (SLOTS[slot].start < room.openTime || SLOTS[slot].end > room.closeTime) {
    throw new BizError(
      ERROR_CODE.ROOM_CLOSED,
      `该时段不在阅览室开放时间内（${room.openTime}-${room.closeTime}）`
    );
  }
  // ② 不能约过去的时段（验收标准 US-02-5：开始时间必须晚于当前时间）
  if (time.compareDateTime(window.startTime, time.now()) <= 0) {
    throw new BizError(ERROR_CODE.TIME_EXPIRED);
  }
  // ③ 只能预约未来 MAX_ADVANCE_DAYS 天内
  if (time.diffDays(date) > MAX_ADVANCE_DAYS) {
    throw new BizError(
      ERROR_CODE.PARAM_INVALID,
      `最多只能提前 ${MAX_ADVANCE_DAYS} 天预约`
    );
  }

  // ---------- 4. 冲突校验 ----------
  // ① 座位是否已被别人占用（验收标准 US-02-2）
  const seatConflict = reservationDao.findActiveBySeat(seatIdNum, date, slot);
  if (seatConflict) throw new BizError(ERROR_CODE.SEAT_ALREADY_RESERVED);

  // ② 同一用户同一时段是否已有预约（验收标准 US-02-3：重复预约校验）
  const userConflict = reservationDao.findActiveByUser(userId, date, slot);
  if (userConflict) throw new BizError(ERROR_CODE.DUPLICATE_RESERVATION);

  // ---------- 5. 落库（唯一索引兜底并发） ----------
  try {
    const created = reservationDao.insert({
      reservationNo: generateReservationNo(date),
      userId,
      userName,
      roomId: roomIdNum,
      seatId: seatIdNum,
      reserveDate: date,
      slot,
      startTime: window.startTime,
      endTime: window.endTime,
      status: RESERVATION_STATUS.PENDING,
    });
    return decorate(created, room, seat);
  } catch (err) {
    if (String(err.code).startsWith('SQLITE_CONSTRAINT') || /UNIQUE constraint failed/.test(err.message)) {
      // 区分是「座位被抢」还是「自己重复下单」，给出不同提示
      if (/reservation\.seat_id/.test(err.message)) {
        throw new BizError(ERROR_CODE.SEAT_OCCUPIED_BY_OTHERS);
      }
      if (/reservation\.user_id/.test(err.message)) {
        throw new BizError(ERROR_CODE.DUPLICATE_RESERVATION);
      }
      throw new BizError(ERROR_CODE.SEAT_ALREADY_RESERVED);
    }
    throw err;
  }
}

/** 补全展示字段（座位号 / 阅览室名 / 状态文案） */
function decorate(reservation, room, seat) {
  const r = room || roomDao.findById(reservation.roomId);
  const s = seat || seatDao.findById(reservation.seatId);
  return {
    ...reservation,
    roomName: r ? r.name : null,
    building: r ? r.building : null,
    seatNo: s ? s.seatNo : null,
    statusText: statusText(reservation.status),
    slotLabel: SLOTS[reservation.slot].label,
  };
}

function statusText(status) {
  return (
    {
      PENDING: '待签到',
      CHECKED_IN: '使用中',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
      EXPIRED: '已超时释放',
    }[status] || status
  );
}

/** 我的预约列表（US-03 的前置能力，第二棒补详情接口） */
function listMyReservations(userId, query = {}) {
  if (isBlank(userId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少 userId');
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 50);
  if (query.status && !Object.values(RESERVATION_STATUS).includes(query.status)) {
    throw new BizError(ERROR_CODE.PARAM_INVALID, 'status 取值非法');
  }
  const { list, total } = reservationDao.findByUser(userId, {
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    page,
    pageSize,
  });
  return {
    list: list.map((r) => decorate(r)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  };
}

module.exports = {
  createReservation,
  listMyReservations,
  decorate,
  statusText,
  MAX_ADVANCE_DAYS,
};
