/**
 * 签到与履约 Service（第二棒：US-04 二维码/扫码签到、US-05 取消预约、US-03 预约详情）
 *
 * 三条约定（交接文档 HANDOFF.md §3 的硬要求）：
 * 1. 状态流转只走 CAS（`reservationDao.updateStatusIf`）—— 先查后改在并发下会双写；
 * 2. 展示字段统一交给 `reservationService.decorate()` / `statusText()`，各接口不自己拼文案；
 * 3. 返回体只描述业务结果，HTTP 状态码由统一错误中间件按错误码推导。
 */
const QRCode = require('qrcode');
const seatDao = require('../dao/seatDao');
const roomDao = require('../dao/readingRoomDao');
const reservationDao = require('../dao/reservationDao');
const reservationService = require('./reservationService');
const { BizError } = require('../utils/BizError');
const { ERROR_CODE } = require('../constants/errorCode');
const { RESERVATION_STATUS, CHECKIN_WINDOW_MINUTES } = require('../constants/business');
const time = require('../utils/time');

/** 二维码内容格式：LIBSEAT:ROOM:{roomId}:SEAT:{seatNo}（与 seatDao.buildQrcode 保持一致） */
const QRCODE_PATTERN = /^LIBSEAT:ROOM:(\d+):SEAT:(.+)$/;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function toPositiveInt(value, label) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new BizError(ERROR_CODE.PARAM_INVALID, `${label} 必须是正整数`);
  }
  return num;
}

/**
 * 签到窗口：开始时间前后各 15 分钟，闭区间
 * 例：08:00 的预约 → 07:45 ~ 08:15 可签到
 */
function checkinWindowOf(startTime) {
  return {
    start: time.addMinutes(startTime, -CHECKIN_WINDOW_MINUTES),
    end: time.addMinutes(startTime, CHECKIN_WINDOW_MINUTES),
  };
}

/** 当前时间是否落在签到窗口内（nowStr 可注入，便于单元测试边界） */
function isInCheckinWindow(startTime, nowStr = time.now()) {
  const window = checkinWindowOf(startTime);
  return (
    time.compareDateTime(nowStr, window.start) >= 0 && time.compareDateTime(nowStr, window.end) <= 0
  );
}

/** 解析二维码内容（扫码结果是后端生成的原文，不接受任意字符串） */
function parseQrcode(content) {
  const matched = QRCODE_PATTERN.exec(String(content).trim());
  if (!matched) {
    throw new BizError(ERROR_CODE.PARAM_INVALID, '二维码内容无法识别，请扫描座位上的二维码');
  }
  const roomId = Number(matched[1]);
  const seatNo = matched[2].trim();
  if (!Number.isInteger(roomId) || roomId <= 0 || !seatNo) {
    throw new BizError(ERROR_CODE.PARAM_INVALID, '二维码内容无法识别，请扫描座位上的二维码');
  }
  return { roomId, seatNo };
}

/**
 * 座位二维码（US-04）
 * @returns {Promise<{seatId:number, seatNo:string, roomId:number, roomName:string|null,
 *                    qrcode:string, dataUrl:string, mimeType:string}>}
 */
async function getSeatQrcode(seatIdRaw) {
  const seatId = toPositiveInt(seatIdRaw, 'seatId');
  const seat = seatDao.findById(seatId);
  if (!seat) throw new BizError(ERROR_CODE.SEAT_NOT_FOUND);

  const room = roomDao.findById(seat.roomId);
  // 二维码图片由 qrcode 包生成（纯 JS，无需原生编译）；前端拿到 dataUrl 直接塞 <image src>
  const dataUrl = await QRCode.toDataURL(seat.qrcode, { margin: 1, width: 256 });

  return {
    seatId: seat.id,
    seatNo: seat.seatNo,
    roomId: seat.roomId,
    roomName: room ? room.name : null,
    qrcode: seat.qrcode,
    dataUrl,
    mimeType: 'image/png',
  };
}

/**
 * 扫码签到（US-04）
 * 校验顺序 = 错误码优先级：参数 → 二维码格式 → 座位存在/可用 → 有无待签到 → 座位是否匹配 → 是否在窗口 → CAS 落库
 */
function checkin(payload = {}) {
  const { userId, qrcode } = payload;
  if (isBlank(userId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少预约人标识 userId');
  if (isBlank(qrcode)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少二维码内容 qrcode');

  const { roomId, seatNo } = parseQrcode(qrcode);
  const seat = seatDao.findByRoomAndNo(roomId, seatNo);
  if (!seat) {
    throw new BizError(ERROR_CODE.SEAT_NOT_FOUND, `阅览室 ${roomId} 下不存在座位 ${seatNo}`);
  }
  if (seat.status !== 'ENABLED') throw new BizError(ERROR_CODE.SEAT_DISABLED, '该座位已停用，请勿签到');

  const now = time.now();
  const pendingList = reservationDao.findByUserStatus(userId, RESERVATION_STATUS.PENDING);

  // 没有任何待签到预约：区分「已经签过到」和「压根没预约」，前者给更精确的提示
  if (pendingList.length === 0) {
    const checkedInList = reservationDao.findByUserStatus(userId, RESERVATION_STATUS.CHECKED_IN);
    if (checkedInList.some((item) => item.seatId === seat.id)) {
      throw new BizError(ERROR_CODE.CHECKIN_DUPLICATE);
    }
    throw new BizError(ERROR_CODE.NO_PENDING_RESERVATION);
  }

  // 扫码座位必须与自己的某条待签到预约一致，否则是扫错了座位
  const sameSeatList = pendingList.filter((item) => item.seatId === seat.id);
  if (sameSeatList.length === 0) {
    throw new BizError(
      ERROR_CODE.SEAT_NOT_MATCH,
      `扫码座位 ${seat.seatNo} 与您预约的座位不一致`
    );
  }

  // 同座位可能有多条（不同日期/时段）：优先取窗口命中的那条，否则拿最早的一条去报「不在窗口」
  const target = sameSeatList.find((item) => isInCheckinWindow(item.startTime, now)) || sameSeatList[0];
  if (!isInCheckinWindow(target.startTime, now)) {
    const window = checkinWindowOf(target.startTime);
    throw new BizError(
      ERROR_CODE.CHECKIN_TIME_INVALID,
      `签到窗口为 ${window.start} 至 ${window.end}`
    );
  }

  const updated = reservationDao.updateStatusIf(
    target.id,
    RESERVATION_STATUS.PENDING,
    RESERVATION_STATUS.CHECKED_IN,
    { checkinTime: now }
  );
  if (!updated) {
    // 并发下被别的请求先签到了（同一用户同一座位重复扫码）
    throw new BizError(ERROR_CODE.CHECKIN_DUPLICATE);
  }

  return reservationService.decorate(reservationDao.findById(target.id));
}

/**
 * 取消预约（US-05）
 * 只有 PENDING 可取消；取消后座位因「部分唯一索引」立即恢复可约。
 */
function cancelReservation(idRaw, payload = {}) {
  const reservationId = toPositiveInt(idRaw, '预约 id');
  const { userId } = payload;
  if (isBlank(userId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少预约人标识 userId');

  const reservation = reservationDao.findById(reservationId);
  // 不存在和非本人都返回 40403：不向外暴露「这条预约是否存在」
  if (!reservation || reservation.userId !== userId) {
    throw new BizError(ERROR_CODE.RESERVATION_NOT_FOUND);
  }
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    throw new BizError(
      ERROR_CODE.RESERVATION_NOT_CANCELLABLE,
      `当前状态（${reservationService.statusText(reservation.status)}）不允许取消`
    );
  }

  const updated = reservationDao.updateStatusIf(
    reservationId,
    RESERVATION_STATUS.PENDING,
    RESERVATION_STATUS.CANCELLED,
    { cancelledAt: time.now() }
  );
  if (!updated) {
    throw new BizError(ERROR_CODE.RESERVATION_NOT_CANCELLABLE, '预约状态已变化，请刷新后重试');
  }

  return {
    ...reservationService.decorate(reservationDao.findById(reservationId)),
    seatReleased: true,
  };
}

/**
 * 预约详情（US-03）
 * 额外补三个前端要用、但后端算更准的字段：签到窗口、能否签到、能否取消。
 */
function getReservationDetail(idRaw, userId) {
  const reservationId = toPositiveInt(idRaw, '预约 id');
  if (isBlank(userId)) throw new BizError(ERROR_CODE.PARAM_MISSING, '缺少预约人标识 userId');

  const reservation = reservationDao.findById(reservationId);
  if (!reservation || reservation.userId !== userId) {
    throw new BizError(ERROR_CODE.RESERVATION_NOT_FOUND);
  }

  const isPending = reservation.status === RESERVATION_STATUS.PENDING;
  return {
    ...reservationService.decorate(reservation),
    checkinWindow: checkinWindowOf(reservation.startTime),
    canCheckin: isPending && isInCheckinWindow(reservation.startTime),
    canCancel: isPending,
  };
}

module.exports = {
  getSeatQrcode,
  checkin,
  cancelReservation,
  getReservationDetail,
  checkinWindowOf,
  isInCheckinWindow,
  parseQrcode,
};
