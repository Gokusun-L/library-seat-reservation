/**
 * 维护任务测试（US-06）：超时未签到自动释放 + 到点自动完成
 * 直接调 maintenanceService.runOnce()，不起定时器（NODE_ENV=test 时 startScheduler 返回 null）
 */
process.env.DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { resetDatabase } = require('../src/db');
const seed = require('../src/db/seed');
const { createApp } = require('../src/app');
const time = require('../src/utils/time');
const seatDao = require('../src/dao/seatDao');
const readingRoomDao = require('../src/dao/readingRoomDao');
const reservationDao = require('../src/dao/reservationDao');
const maintenanceService = require('../src/service/maintenanceService');

const app = createApp();

let roomId;
let seatPool = [];
let seq = 0;

before(() => {
  resetDatabase();
  seed.ensureSeedData();
  roomId = readingRoomDao.findByRoomNo('R101').id;
  seatPool = seatDao.findByRoom(roomId).filter((s) => s.status === 'ENABLED').slice(20);
});

function nextSeat() {
  const seat = seatPool.shift();
  assert.ok(seat, '测试座位池已用尽');
  return seat;
}

function makeReservation({ userId, seat, startOffsetMin, durationMin = 240, status = 'PENDING' }) {
  seq += 1;
  const start = new Date(Date.now() + startOffsetMin * 60 * 1000);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return reservationDao.insert({
    reservationNo: `RM${Date.now()}${seq}`,
    userId,
    roomId,
    seatId: seat.id,
    reserveDate: time.formatDate(start),
    slot: 'MORNING',
    startTime: time.formatDateTime(start),
    endTime: time.formatDateTime(end),
    status,
  });
}

test('维护任务：开始 15 分钟后仍未签到 → EXPIRED，座位恢复 FREE', async () => {
  const seat = nextSeat();
  const reservation = makeReservation({ userId: 'stu-expire', seat, startOffsetMin: -20 });

  const result = maintenanceService.runOnce();
  assert.ok(result.expired >= 1, `应至少释放 1 条，实际 ${JSON.stringify(result)}`);

  const updated = reservationDao.findById(reservation.id);
  assert.strictEqual(updated.status, 'EXPIRED');

  const seats = await request(app)
    .get(`/api/reading-rooms/${roomId}/seats`)
    .query({ date: time.formatDate(new Date()), slot: 'MORNING' });
  const target = seats.body.data.seats.find((s) => s.seatId === seat.id);
  assert.strictEqual(target.status, 'FREE');
});

test('维护任务：签到后已过结束时间 → COMPLETED', async () => {
  const seat = nextSeat();
  // 5 小时前开始、时长 4 小时 → 结束于 1 小时前
  const reservation = makeReservation({
    userId: 'stu-complete',
    seat,
    startOffsetMin: -300,
    status: 'CHECKED_IN',
  });

  maintenanceService.runOnce();

  const updated = reservationDao.findById(reservation.id);
  assert.strictEqual(updated.status, 'COMPLETED');
});

test('维护任务：未到期的预约不受影响，重复扫描幂等', async () => {
  const futureSeat = nextSeat();
  const runningSeat = nextSeat();
  const future = makeReservation({ userId: 'stu-future', seat: futureSeat, startOffsetMin: 60 });
  const running = makeReservation({
    userId: 'stu-running',
    seat: runningSeat,
    startOffsetMin: -30,
    status: 'CHECKED_IN',
  });

  const first = maintenanceService.runOnce();
  const second = maintenanceService.runOnce();

  assert.deepStrictEqual(first, { expired: 0, completed: 0 });
  assert.deepStrictEqual(second, { expired: 0, completed: 0 });
  assert.strictEqual(reservationDao.findById(future.id).status, 'PENDING');
  assert.strictEqual(reservationDao.findById(running.id).status, 'CHECKED_IN');
});
