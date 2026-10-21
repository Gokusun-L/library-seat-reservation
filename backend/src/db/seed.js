/**
 * 演示数据初始化（幂等）
 * 3 个阅览室 + 按行列自动生成座位 + 2 条演示预约记录
 * 目的：第三棒做座位图时，直接 run 就能看到「空闲 / 已预约 / 使用中 / 停用」四种颜色，无需自己造数据。
 */
const { getDb } = require('./index');
const seatDao = require('../dao/seatDao');
const reservationDao = require('../dao/reservationDao');
const { SLOTS } = require('../constants/business');
const time = require('../utils/time');

const ROOMS = [
  {
    roomNo: 'R101',
    name: '一楼综合阅览室',
    building: '图书馆主馆',
    floor: 1,
    openTime: '08:00',
    closeTime: '22:00',
    rowCount: 5,
    colCount: 8,
    colGap: [4],
    description: '综合自习区，安静，禁止饮食',
    disabledSeats: ['C-03'],
  },
  {
    roomNo: 'R201',
    name: '二楼考研自习室',
    building: '图书馆主馆',
    floor: 2,
    openTime: '07:00',
    closeTime: '23:00',
    rowCount: 6,
    colCount: 10,
    colGap: [5],
    description: '考研专用自习区，可长期占座（需每日签到）',
    disabledSeats: ['A-10', 'F-01'],
  },
  {
    roomNo: 'R302',
    name: '三楼电子阅览室',
    building: '图书馆东区',
    floor: 3,
    openTime: '09:00',
    closeTime: '21:00',
    rowCount: 4,
    colCount: 6,
    colGap: [3],
    description: '配备电源与网络接口，可带笔记本电脑',
    disabledSeats: [],
  },
];

const ROW_LETTER = 'ABCDEFGHIJ';

function buildSeats(room, roomId) {
  const seats = [];
  for (let r = 1; r <= room.rowCount; r += 1) {
    for (let c = 1; c <= room.colCount; c += 1) {
      const seatNo = `${ROW_LETTER[r - 1]}-${String(c).padStart(2, '0')}`;
      let seatType = 'NORMAL';
      if (c === room.colCount) seatType = 'WINDOW'; // 最后一列靠窗
      if (c === 1) seatType = 'POWER'; // 第一列靠墙有插座
      seats.push({
        seatNo,
        rowIndex: r,
        colIndex: c,
        seatType,
        qrcode: seatDao.buildQrcode(roomId, seatNo),
        status: room.disabledSeats.includes(seatNo) ? 'DISABLED' : 'ENABLED',
      });
    }
  }
  return seats;
}

function ensureSeedData() {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) AS c FROM reading_room').get().c;
  if (existing > 0) return { skipped: true };

  const insertRoom = db.prepare(
    `INSERT INTO reading_room
       (room_no, name, building, floor, open_time, close_time, row_count, col_count, col_gap, status, description)
     VALUES
       (@roomNo, @name, @building, @floor, @openTime, @closeTime, @rowCount, @colCount, @colGap, 'OPEN', @description)`
  );

  const created = [];
  const tx = db.transaction(() => {
    for (const room of ROOMS) {
      const info = insertRoom.run({
        roomNo: room.roomNo,
        name: room.name,
        building: room.building,
        floor: room.floor,
        openTime: room.openTime,
        closeTime: room.closeTime,
        rowCount: room.rowCount,
        colCount: room.colCount,
        colGap: JSON.stringify(room.colGap),
        description: room.description,
      });
      const roomId = info.lastInsertRowid;
      seatDao.bulkInsert(roomId, buildSeats(room, roomId));
      created.push({ roomId, roomNo: room.roomNo });
    }
  });
  tx();

  createDemoReservations(created);
  return { skipped: false, rooms: created };
}

/** 造 2 条今天的演示预约，让座位图三态都有颜色 */
function createDemoReservations(created) {
  const primary = created[0];
  if (!primary) return;
  const seats = seatDao.findByRoom(primary.roomId).filter((s) => s.status === 'ENABLED');
  if (seats.length < 3) return;

  const today = time.today();
  const slot = SLOTS.MORNING.code;
  const window = time.buildSlotWindow(today, slot);

  reservationDao.insert({
    reservationNo: `R${today.replace(/-/g, '')}0001`,
    userId: 'demo-stu-001',
    userName: '演示同学A',
    roomId: primary.roomId,
    seatId: seats[0].id,
    reserveDate: today,
    slot,
    startTime: window.startTime,
    endTime: window.endTime,
    status: 'PENDING',
  });
  reservationDao.insert({
    reservationNo: `R${today.replace(/-/g, '')}0002`,
    userId: 'demo-stu-002',
    userName: '演示同学B',
    roomId: primary.roomId,
    seatId: seats[1].id,
    reserveDate: today,
    slot,
    startTime: window.startTime,
    endTime: window.endTime,
    status: 'CHECKED_IN',
  });
}

module.exports = { ensureSeedData, ROOMS, buildSeats };
