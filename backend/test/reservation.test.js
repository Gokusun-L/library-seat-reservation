/**
 * 预约接口单元测试（US-02 核心逻辑）
 * 覆盖：正常预约 / 座位冲突 / 重复预约 / 参数校验 / 时间校验 / 并发抢座 / 取消后可再约
 *
 * 运行：npm test
 */
process.env.DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { resetDatabase } = require('../src/db');
const seed = require('../src/db/seed');
const reservationDao = require('../src/dao/reservationDao');
const readingRoomDao = require('../src/dao/readingRoomDao');
const seatDao = require('../src/dao/seatDao');
const { createApp } = require('../src/app');
const { ERROR_CODE } = require('../src/constants/errorCode');
const time = require('../src/utils/time');

const app = createApp();

let tomorrow;
let roomId;
let seats; // 第一个阅览室的可用座位

before(() => {
  resetDatabase();
  seed.ensureSeedData();
  tomorrow = time.addDays(time.today(), 1);
  roomId = readingRoomDao.findByRoomNo('R101').id;
  seats = seatDao.findByRoom(roomId).filter((s) => s.status === 'ENABLED');
});

beforeEach(() => {
  // 每个用例用独立 user，避免「重复预约」规则互相污染（座位冲突则按座位取）。
});

/** 快捷预约请求 */
function book(payload) {
  return request(app)
    .post('/api/reservations')
    .send({ date: tomorrow, slot: 'MORNING', ...payload });
}

test('正常预约：返回预约详情，座位状态变为 RESERVED', async () => {
  const res = await book({ userId: 'stu-001', userName: '张三', roomId, seatId: seats[0].id });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.code, ERROR_CODE.OK);
  const data = res.body.data;
  assert.ok(data.reservationNo.startsWith(`R${tomorrow.replace(/-/g, '')}`));
  assert.strictEqual(data.status, 'PENDING');
  assert.strictEqual(data.seatNo, seats[0].seatNo);
  assert.strictEqual(data.slotLabel, '上午');
  assert.strictEqual(data.startTime, `${tomorrow} 08:00`);
  assert.strictEqual(data.endTime, `${tomorrow} 12:00`);

  // 座位图接口应显示该座位已被预约
  const seatRes = await request(app)
    .get(`/api/reading-rooms/${roomId}/seats`)
    .query({ date: tomorrow, slot: 'MORNING' });
  assert.strictEqual(seatRes.body.code, 0);
  const target = seatRes.body.data.seats.find((s) => s.seatId === seats[0].id);
  assert.strictEqual(target.status, 'RESERVED');
  assert.strictEqual(target.reservable, false);
});

test('座位已被预约：第二位用户预约同一座位 → 40901', async () => {
  const res = await book({ userId: 'stu-002', roomId, seatId: seats[0].id });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.SEAT_ALREADY_RESERVED);
  assert.match(res.body.message, /已被预约/);
});

test('重复预约：同一用户同一时段预约第二个座位 → 40902', async () => {
  const res = await book({ userId: 'stu-001', roomId, seatId: seats[1].id });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.DUPLICATE_RESERVATION);
});

test('同一用户不同时段可以各约一个座位', async () => {
  const res = await book({ userId: 'stu-001', roomId, seatId: seats[2].id, slot: 'AFTERNOON' });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.code, ERROR_CODE.OK);
});

test('参数校验：缺少 seatId → 40001', async () => {
  const res = await book({ userId: 'stu-003', roomId });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.code, ERROR_CODE.PARAM_MISSING);
});

test('参数校验：日期格式错误 → 40003', async () => {
  const res = await book({ userId: 'stu-003', roomId, seatId: seats[3].id, date: '2026/10/22' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.code, ERROR_CODE.DATE_FORMAT_INVALID);
});

test('参数校验：非法日期 2026-02-30 → 40003', async () => {
  const res = await book({ userId: 'stu-003', roomId, seatId: seats[3].id, date: '2026-02-30' });
  assert.strictEqual(res.body.code, ERROR_CODE.DATE_FORMAT_INVALID);
});

test('参数校验：时间段非法 → 40004', async () => {
  const res = await book({ userId: 'stu-003', roomId, seatId: seats[3].id, slot: 'NOON' });
  assert.strictEqual(res.body.code, ERROR_CODE.SLOT_INVALID);
});

test('资源校验：阅览室不存在 → 40401', async () => {
  const res = await book({ userId: 'stu-003', roomId: 9999, seatId: seats[3].id });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.code, ERROR_CODE.ROOM_NOT_FOUND);
});

test('资源校验：座位不存在 → 40402', async () => {
  const res = await book({ userId: 'stu-003', roomId, seatId: 999999 });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.code, ERROR_CODE.SEAT_NOT_FOUND);
});

test('资源校验：座位不属于该阅览室 → 40005', async () => {
  const otherRoomId = readingRoomDao.findByRoomNo('R302').id;
  const res = await book({ userId: 'stu-003', roomId: otherRoomId, seatId: seats[3].id });
  assert.strictEqual(res.body.code, ERROR_CODE.SEAT_ROOM_MISMATCH);
});

test('资源校验：停用座位不可预约 → 40903', async () => {
  const disabled = seatDao.findByRoom(roomId).find((s) => s.status === 'DISABLED');
  assert.ok(disabled, '演示数据应包含一个停用座位');
  const res = await book({ userId: 'stu-004', roomId, seatId: disabled.id });
  assert.strictEqual(res.body.code, ERROR_CODE.SEAT_DISABLED);
});

test('时间校验：预约昨天的时段 → 40905', async () => {
  const yesterday = time.addDays(time.today(), -1);
  const res = await book({ userId: 'stu-005', roomId, seatId: seats[4].id, date: yesterday });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.TIME_EXPIRED);
});

test('时间校验：超过 7 天不可预约 → 40002', async () => {
  const farDate = time.addDays(time.today(), 8);
  const res = await book({ userId: 'stu-005', roomId, seatId: seats[4].id, date: farDate });
  assert.strictEqual(res.body.code, ERROR_CODE.PARAM_INVALID);
});

test('并发抢同一座位：只有一个成功，另一个收到冲突码', async () => {
  const seatId = seats[5].id;
  const [r1, r2] = await Promise.all([
    book({ userId: 'stu-006', roomId, seatId }),
    book({ userId: 'stu-007', roomId, seatId }),
  ]);
  const codes = [r1.body.code, r2.body.code].sort();
  assert.strictEqual(codes[0], ERROR_CODE.OK, '应有一个请求成功');
  assert.ok(
    codes[1] === ERROR_CODE.SEAT_ALREADY_RESERVED || codes[1] === ERROR_CODE.SEAT_OCCUPIED_BY_OTHERS,
    `另一个请求应返回座位冲突，实际 ${codes[1]}`
  );
});

test('取消预约后，座位可被再次预约', async () => {
  const seatId = seats[6].id;
  const created = await book({ userId: 'stu-008', roomId, seatId });
  assert.strictEqual(created.status, 201);

  reservationDao.updateStatus(created.body.data.id, 'CANCELLED', {
    cancelledAt: time.now(),
  });

  // 同一用户、同一座位、同一时段都可以重新预约
  const again = await book({ userId: 'stu-008', roomId, seatId });
  assert.strictEqual(again.status, 201);
  assert.strictEqual(again.body.code, ERROR_CODE.OK);
});

test('我的预约列表：能查到刚创建的记录并带分页信息', async () => {
  const res = await request(app).get('/api/reservations').query({ userId: 'stu-001' });
  assert.strictEqual(res.body.code, 0);
  assert.ok(res.body.data.list.length >= 1);
  assert.strictEqual(res.body.data.pagination.total, res.body.data.list.length);
  const first = res.body.data.list[0];
  assert.ok(first.statusText);
  assert.ok(first.roomName);
});
