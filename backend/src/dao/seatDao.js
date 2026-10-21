/**
 * 座位 DAO
 * 座位布局（行/列/座位号）是静态数据；「某时段是否被占用」属于预约记录，由 reservationDao 查询后合并。
 */
const { getDb } = require('../db');

function toEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    seatNo: row.seat_no,
    rowIndex: row.row_index,
    colIndex: row.col_index,
    seatType: row.seat_type,
    qrcode: row.qrcode, // 仅内部使用，不给前端（前端凭座位 ID 走签到接口）
    status: row.status,
  };
}

function findByRoom(roomId) {
  return getDb()
    .prepare('SELECT * FROM seat WHERE room_id = ? ORDER BY row_index, col_index')
    .all(roomId)
    .map(toEntity);
}

function findById(id) {
  return toEntity(getDb().prepare('SELECT * FROM seat WHERE id = ?').get(id));
}

function countByRoom(roomId) {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'ENABLED' THEN 1 ELSE 0 END) AS enabled
         FROM seat WHERE room_id = ?`
    )
    .get(roomId);
  return { total: row.total || 0, enabled: row.enabled || 0 };
}

/**
 * 批量入库（初始化演示数据用）
 * @param {number} roomId
 * @param {Array<{seatNo:string,rowIndex:number,colIndex:number,seatType?:string,qrcode:string,status?:string}>} seats
 */
function bulkInsert(roomId, seats) {
  const conn = getDb();
  const stmt = conn.prepare(
    `INSERT INTO seat (room_id, seat_no, row_index, col_index, seat_type, qrcode, status)
     VALUES (@roomId, @seatNo, @rowIndex, @colIndex, @seatType, @qrcode, @status)`
  );
  const insertMany = conn.transaction((list) => {
    for (const s of list) {
      stmt.run({
        roomId,
        seatNo: s.seatNo,
        rowIndex: s.rowIndex,
        colIndex: s.colIndex,
        seatType: s.seatType || 'NORMAL',
        qrcode: s.qrcode,
        status: s.status || 'ENABLED',
      });
    }
  });
  insertMany(seats);
  return seats.length;
}

/** 二维码内容规则（第二棒扫码签到按此规则解析） */
function buildQrcode(roomId, seatNo) {
  return `LIBSEAT:ROOM:${roomId}:SEAT:${seatNo}`;
}

module.exports = { findByRoom, findById, countByRoom, bulkInsert, buildQrcode, toEntity };
