/**
 * 阅览室 DAO
 * 只做 SQL，不含业务判断；Service 层负责组合与校验。
 * 字段映射：数据库 row_count/col_count → 对外 rowCount/colCount（前端不必感知下划线）
 */
const { getDb } = require('../db');

/** 数据库行 → 对外实体对象 */
function toEntity(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomNo: row.room_no,
    name: row.name,
    building: row.building,
    floor: row.floor,
    openTime: row.open_time,
    closeTime: row.close_time,
    rowCount: row.row_count,
    colCount: row.col_count,
    colGap: JSON.parse(row.col_gap || '[]'),
    status: row.status,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findAll({ keyword, building, status } = {}) {
  const where = [];
  const params = {};
  if (keyword) {
    where.push('(name LIKE @kw OR room_no LIKE @kw OR building LIKE @kw)');
    params.kw = `%${keyword}%`;
  }
  if (building) {
    where.push('building = @building');
    params.building = building;
  }
  if (status) {
    where.push('status = @status');
    params.status = status;
  }
  const sql = `SELECT * FROM reading_room ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY floor, room_no`;
  return getDb().prepare(sql).all(params).map(toEntity);
}

function findById(id) {
  return toEntity(getDb().prepare('SELECT * FROM reading_room WHERE id = ?').get(id));
}

function findByRoomNo(roomNo) {
  return toEntity(getDb().prepare('SELECT * FROM reading_room WHERE room_no = ?').get(roomNo));
}

/** 批量统计各阅览室的座位总数 / 可用座位数（不区分时段，用于列表页展示规模） */
function countSeats(roomIds = []) {
  if (!roomIds.length) return {};
  const holes = roomIds.map(() => '?').join(',');
  const rows = getDb()
    .prepare(
      `SELECT room_id,
              COUNT(*)                                            AS total,
              SUM(CASE WHEN status = 'ENABLED' THEN 1 ELSE 0 END) AS enabled
         FROM seat
        WHERE room_id IN (${holes})
        GROUP BY room_id`
    )
    .all(...roomIds);
  return rows.reduce((acc, r) => {
    acc[r.room_id] = { total: r.total, enabled: r.enabled };
    return acc;
  }, {});
}

module.exports = { findAll, findById, findByRoomNo, countSeats, toEntity };
