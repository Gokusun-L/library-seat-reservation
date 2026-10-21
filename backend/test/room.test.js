/**
 * 阅览室列表 / 座位布局 / 座位状态接口测试（US-01a、US-01b）
 */
process.env.DB_FILE = ':memory:';
process.env.NODE_ENV = 'test';

const { test, before } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { resetDatabase } = require('../src/db');
const seed = require('../src/db/seed');
const { createApp } = require('../src/app');
const { ERROR_CODE } = require('../src/constants/errorCode');
const time = require('../src/utils/time');

const app = createApp();
let roomId;

before(() => {
  resetDatabase();
  seed.ensureSeedData();
  roomId = 1;
});

test('阅览室列表：返回 3 个阅览室，含座位规模与剩余座位数', async () => {
  const res = await request(app).get('/api/reading-rooms');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.code, ERROR_CODE.OK);
  const list = res.body.data;
  assert.strictEqual(list.length, 3);

  const first = list[0];
  assert.ok(first.roomNo);
  assert.ok(first.totalSeats > 0);
  assert.ok(first.enabledSeats > 0);
  assert.ok(first.availableSeats >= 0);
  assert.ok(first.availableSeats <= first.enabledSeats);
  assert.strictEqual(first.isOpen, true);
});

test('阅览室列表：支持关键字与楼栋筛选', async () => {
  const res = await request(app).get('/api/reading-rooms').query({ keyword: '考研' });
  assert.strictEqual(res.body.data.length, 1);
  assert.match(res.body.data[0].name, /考研/);

  const byBuilding = await request(app)
    .get('/api/reading-rooms')
    .query({ building: '图书馆东区' });
  assert.strictEqual(byBuilding.body.data.length, 1);
});

test('座位布局：行列数与座位数一致，座位编号唯一', async () => {
  const res = await request(app).get(`/api/reading-rooms/${roomId}/layout`);
  assert.strictEqual(res.body.code, 0);
  const { layout, seats } = res.body.data;
  assert.strictEqual(layout.rowCount * layout.colCount, seats.length);
  assert.strictEqual(new Set(seats.map((s) => s.seatNo)).size, seats.length);
  // 行列坐标不重复
  assert.strictEqual(new Set(seats.map((s) => `${s.row}-${s.col}`)).size, seats.length);
});

test('座位状态：三态统计之和等于座位总数', async () => {
  const tomorrow = time.addDays(time.today(), 1);
  const res = await request(app)
    .get(`/api/reading-rooms/${roomId}/seats`)
    .query({ date: tomorrow, slot: 'AFTERNOON' });
  assert.strictEqual(res.body.code, 0);
  const { seats, summary, slotWindow } = res.body.data;
  const sum =
    summary.FREE + summary.RESERVED + summary.IN_USE + summary.DISABLED;
  assert.strictEqual(sum, seats.length);
  assert.strictEqual(summary.total, seats.length);
  assert.strictEqual(slotWindow.startTime, `${tomorrow} 14:00`);
});

test('座位状态：默认取今天与当前时段，非法日期报 40003', async () => {
  const def = await request(app).get(`/api/reading-rooms/${roomId}/seats`);
  assert.strictEqual(def.body.code, 0);
  assert.strictEqual(def.body.data.date, time.today());

  const bad = await request(app)
    .get(`/api/reading-rooms/${roomId}/seats`)
    .query({ date: '2026-13-01' });
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(bad.body.code, ERROR_CODE.DATE_FORMAT_INVALID);
});

test('座位状态：阅览室不存在 → 40401', async () => {
  const res = await request(app).get('/api/reading-rooms/9999/seats');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.code, ERROR_CODE.ROOM_NOT_FOUND);
});

test('健康检查与元数据接口可用', async () => {
  const health = await request(app).get('/api/health');
  assert.strictEqual(health.body.code, 0);

  const slots = await request(app).get('/api/meta/slots');
  assert.strictEqual(slots.body.data.length, 3);
  assert.deepStrictEqual(
    slots.body.data.map((s) => s.code),
    ['MORNING', 'AFTERNOON', 'EVENING']
  );
});
