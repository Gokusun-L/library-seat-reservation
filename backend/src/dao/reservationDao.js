/**
 * 预约记录 DAO
 * 第二棒要在此扩展：findById（已有）、updateStatus（已有）、findExpired（超时释放扫描）。
 */
const { getDb } = require('../db');
const { ACTIVE_RESERVATION_STATUS, CHECKIN_WINDOW_MINUTES } = require('../constants/business');

const ACTIVE_PLACEHOLDER = ACTIVE_RESERVATION_STATUS.map(() => '?').join(',');

function toEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    reservationNo: row.reservation_no,
    userId: row.user_id,
    userName: row.user_name,
    roomId: row.room_id,
    seatId: row.seat_id,
    reserveDate: row.reserve_date,
    slot: row.slot,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    checkinTime: row.checkin_time,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function insert(data) {
  const info = getDb()
    .prepare(
      `INSERT INTO reservation
         (reservation_no, user_id, user_name, room_id, seat_id,
          reserve_date, slot, start_time, end_time, status)
       VALUES
         (@reservationNo, @userId, @userName, @roomId, @seatId,
          @reserveDate, @slot, @startTime, @endTime, @status)`
    )
    .run({
      reservationNo: data.reservationNo,
      userId: data.userId,
      userName: data.userName || null,
      roomId: data.roomId,
      seatId: data.seatId,
      reserveDate: data.reserveDate,
      slot: data.slot,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status || 'PENDING',
    });
  return findById(info.lastInsertRowid);
}

function findById(id) {
  return toEntity(getDb().prepare('SELECT * FROM reservation WHERE id = ?').get(id));
}

function findByNo(reservationNo) {
  return toEntity(
    getDb().prepare('SELECT * FROM reservation WHERE reservation_no = ?').get(reservationNo)
  );
}

/** 某座位在某日期某时段的有效预约（PENDING / CHECKED_IN） */
function findActiveBySeat(seatId, reserveDate, slot) {
  return toEntity(
    getDb()
      .prepare(
        `SELECT * FROM reservation
          WHERE seat_id = ? AND reserve_date = ? AND slot = ?
            AND status IN (${ACTIVE_PLACEHOLDER})
          LIMIT 1`
      )
      .get(seatId, reserveDate, slot, ...ACTIVE_RESERVATION_STATUS)
  );
}

/** 某用户在某日期某时段的有效预约（重复预约校验） */
function findActiveByUser(userId, reserveDate, slot) {
  return toEntity(
    getDb()
      .prepare(
        `SELECT * FROM reservation
          WHERE user_id = ? AND reserve_date = ? AND slot = ?
            AND status IN (${ACTIVE_PLACEHOLDER})
          LIMIT 1`
      )
      .get(userId, reserveDate, slot, ...ACTIVE_RESERVATION_STATUS)
  );
}

/**
 * 某阅览室某时段全部有效预约（座位图状态查询用，一次查完避免 N+1）
 * @returns {Array<{seatId:number, status:string, userId:string}>}
 */
function findOccupiedByRoom(roomId, reserveDate, slot) {
  return getDb()
    .prepare(
      `SELECT seat_id AS seatId, status AS status, user_id AS userId
         FROM reservation
        WHERE room_id = ? AND reserve_date = ? AND slot = ?
          AND status IN (${ACTIVE_PLACEHOLDER})`
    )
    .all(roomId, reserveDate, slot, ...ACTIVE_RESERVATION_STATUS);
}

/** 我的预约列表（分页 + 状态筛选） */
function findByUser(userId, { status, dateFrom, dateTo, page = 1, pageSize = 20 } = {}) {
  const where = ['user_id = @userId'];
  const params = { userId, limit: pageSize, offset: (page - 1) * pageSize };
  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  if (dateFrom) {
    where.push('reserve_date >= @dateFrom');
    params.dateFrom = dateFrom;
  }
  if (dateTo) {
    where.push('reserve_date <= @dateTo');
    params.dateTo = dateTo;
  }
  const whereSql = where.join(' AND ');
  const total = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM reservation WHERE ${whereSql}`)
    .get(params).c;
  const list = getDb()
    .prepare(
      `SELECT * FROM reservation WHERE ${whereSql}
        ORDER BY reserve_date DESC, start_time DESC
        LIMIT @limit OFFSET @offset`
    )
    .all(params)
    .map(toEntity);
  return { list, total };
}

/** 更新状态（第二棒：签到 / 取消 / 超时释放共用） */
function updateStatus(id, status, extra = {}) {
  const sets = ['status = @status', "updated_at = datetime('now','localtime')"];
  const params = { id, status };
  if (extra.checkinTime !== undefined) {
    sets.push('checkin_time = @checkinTime');
    params.checkinTime = extra.checkinTime;
  }
  if (extra.cancelledAt !== undefined) {
    sets.push('cancelled_at = @cancelledAt');
    params.cancelledAt = extra.cancelledAt;
  }
  getDb()
    .prepare(`UPDATE reservation SET ${sets.join(', ')} WHERE id = @id`)
    .run(params);
  return findById(id);
}

/**
 * 条件更新状态（CAS）：只有当前状态等于 fromStatus 才更新
 * 用于签到 / 取消 / 超时释放 —— 先查后改在并发下会双写，这里用 WHERE status=? 兜底。
 * @returns {boolean} 是否真的改动了 1 行（false 表示状态已被别人改走）
 */
function updateStatusIf(id, fromStatus, toStatus, extra = {}) {
  const sets = ['status = @toStatus', "updated_at = datetime('now','localtime')"];
  const params = { id, fromStatus, toStatus };
  if (extra.checkinTime !== undefined) {
    sets.push('checkin_time = @checkinTime');
    params.checkinTime = extra.checkinTime;
  }
  if (extra.cancelledAt !== undefined) {
    sets.push('cancelled_at = @cancelledAt');
    params.cancelledAt = extra.cancelledAt;
  }
  const info = getDb()
    .prepare(`UPDATE reservation SET ${sets.join(', ')} WHERE id = @id AND status = @fromStatus`)
    .run(params);
  return info.changes === 1;
}

/** 某用户指定状态的全部预约（第二棒签到：找待签到 / 判断是否已签到） */
function findByUserStatus(userId, status) {
  return getDb()
    .prepare(
      `SELECT * FROM reservation
        WHERE user_id = ? AND status = ?
        ORDER BY start_time`
    )
    .all(userId, status)
    .map(toEntity);
}
/** 超时未签到扫描（第二棒 US-06 定时任务使用：开始时间 + 15 分钟仍未签到） */
function findExpiredPending(nowDateTime) {
  return getDb()
    .prepare(
      `SELECT * FROM reservation
        WHERE status = 'PENDING'
          AND datetime(start_time, '+${CHECKIN_WINDOW_MINUTES} minutes') <= datetime(?)
        ORDER BY start_time`
    )
    .all(nowDateTime)
    .map(toEntity);
}

/** 已过结束时间但仍是「使用中」的预约（US-06：签到后到点自动置为已完成） */
function findCheckedInFinished(nowDateTime) {
  return getDb()
    .prepare(
      `SELECT * FROM reservation
        WHERE status = 'CHECKED_IN'
          AND datetime(end_time) <= datetime(?)
        ORDER BY end_time`
    )
    .all(nowDateTime)
    .map(toEntity);
}

module.exports = {
  insert,
  findById,
  findByNo,
  findActiveBySeat,
  findActiveByUser,
  findOccupiedByRoom,
  findByUser,
  findByUserStatus,
  updateStatus,
  updateStatusIf,
  findExpiredPending,
  findCheckedInFinished,
  toEntity,
};
