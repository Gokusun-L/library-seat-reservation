/**
 * 第二棒接口测试：座位二维码（US-04）、扫码签到（US-04）、取消预约（US-05）、预约详情（US-03）
 *
 * 时间处理：不 mock 时钟，直接插入「开始时间 = 现在 ± N 分钟」的预约，
 * 这样 -20 / -5 / +20 分钟等场景都能稳定覆盖，边界（±15 分钟）用 checkinService 的纯函数断言。
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
const seatDao = require('../src/dao/seatDao');
const readingRoomDao = require('../src/dao/readingRoomDao');
const reservationDao = require('../src/dao/reservationDao');
const checkinService = require('../src/service/checkinService');

const app = createApp();

let roomId;
let seatPool = [];
let seq = 0;

before(() => {
  resetDatabase();
  seed.ensureSeedData();
  roomId = readingRoomDao.findByRoomNo('R101').id;
  // 演示数据占用了本室前两个座位（today MORNING），测试从第 6 个可用座位开始取，互不干扰
  seatPool = seatDao.findByRoom(roomId).filter((s) => s.status === 'ENABLED').slice(5);
});

function nextSeat() {
  const seat = seatPool.shift();
  assert.ok(seat, '测试座位池已用尽');
  return seat;
}

/**
 * 直接落一条预约（绕过创建接口的时间校验，便于构造「已在窗口内 / 已超时」等场景）
 * @param {object} options
 * @param {number} [options.startOffsetMin] 开始时间相对现在的分钟数（负=已经过）
 */
function makeReservation({ userId, seat, startOffsetMin = 0, durationMin = 240, status = 'PENDING' }) {
  seq += 1;
  const start = new Date(Date.now() + startOffsetMin * 60 * 1000);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  return reservationDao.insert({
    reservationNo: `RT${Date.now()}${seq}`,
    userId,
    userName: '测试同学',
    roomId: roomId,
    seatId: seat.id,
    reserveDate: time.formatDate(start),
    slot: 'MORNING',
    startTime: time.formatDateTime(start),
    endTime: time.formatDateTime(end),
    status,
  });
}

function checkinBody(userId, seat) {
  return { userId, qrcode: seatDao.buildQrcode(roomId, seat.seatNo) };
}

// ---------- 二维码（US-04） ----------

test('座位二维码：返回二维码原文与 base64 图片', async () => {
  const seat = nextSeat();
  const res = await request(app).get(`/api/seats/${seat.id}/qrcode`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.code, ERROR_CODE.OK);
  const data = res.body.data;
  assert.strictEqual(data.seatId, seat.id);
  assert.strictEqual(data.seatNo, seat.seatNo);
  assert.strictEqual(data.qrcode, `LIBSEAT:ROOM:${roomId}:SEAT:${seat.seatNo}`);
  assert.match(data.dataUrl, /^data:image\/png;base64,/);
  assert.strictEqual(data.mimeType, 'image/png');
});

test('座位二维码：座位不存在 → 40402，seatId 非法 → 40002', async () => {
  const notFound = await request(app).get('/api/seats/999999/qrcode');
  assert.strictEqual(notFound.status, 404);
  assert.strictEqual(notFound.body.code, ERROR_CODE.SEAT_NOT_FOUND);

  const bad = await request(app).get('/api/seats/abc/qrcode');
  assert.strictEqual(bad.status, 400);
  assert.strictEqual(bad.body.code, ERROR_CODE.PARAM_INVALID);
});

// ---------- 扫码签到（US-04） ----------

test('扫码签到：窗口内签到成功，状态变 CHECKED_IN 并写入 checkinTime', async () => {
  const seat = nextSeat();
  makeReservation({ userId: 'stu-checkin-ok', seat, startOffsetMin: -5 });

  const res = await request(app).post('/api/reservations/checkin').send(checkinBody('stu-checkin-ok', seat));

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.code, ERROR_CODE.OK);
  const data = res.body.data;
  assert.strictEqual(data.status, 'CHECKED_IN');
  assert.strictEqual(data.statusText, '使用中');
  assert.ok(data.checkinTime, '应写入签到时间');
  assert.strictEqual(data.seatNo, seat.seatNo);
  assert.strictEqual(data.roomName, '一楼综合阅览室');
});

test('扫码签到：签到后座位图该座位变 IN_USE', async () => {
  const seat = nextSeat();
  const today = time.today();
  makeReservation({ userId: 'stu-checkin-view', seat, startOffsetMin: 0 });
  await request(app).post('/api/reservations/checkin').send(checkinBody('stu-checkin-view', seat));

  const res = await request(app)
    .get(`/api/reading-rooms/${roomId}/seats`)
    .query({ date: today, slot: 'MORNING' });

  const target = res.body.data.seats.find((s) => s.seatId === seat.id);
  assert.strictEqual(target.status, 'IN_USE');
  assert.strictEqual(target.reservable, false);
});

test('扫码签到：提前超过 15 分钟 → 50001', async () => {
  const seat = nextSeat();
  makeReservation({ userId: 'stu-early', seat, startOffsetMin: 20 });

  const res = await request(app).post('/api/reservations/checkin').send(checkinBody('stu-early', seat));
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.CHECKIN_TIME_INVALID);
});

test('扫码签到：迟到超过 15 分钟 → 50001', async () => {
  const seat = nextSeat();
  makeReservation({ userId: 'stu-late', seat, startOffsetMin: -20 });

  const res = await request(app).post('/api/reservations/checkin').send(checkinBody('stu-late', seat));
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.CHECKIN_TIME_INVALID);
});

test('签到窗口边界：恰好 -15 / +15 分钟可签到，-16 / +16 分钟拒绝', () => {
  const start = '2026-10-22 08:00';
  // 闭区间 [07:45, 08:15]
  assert.strictEqual(checkinService.isInCheckinWindow(start, '2026-10-22 07:45'), true);
  assert.strictEqual(checkinService.isInCheckinWindow(start, '2026-10-22 08:15'), true);
  assert.strictEqual(checkinService.isInCheckinWindow(start, '2026-10-22 08:00'), true);
  assert.strictEqual(checkinService.isInCheckinWindow(start, '2026-10-22 07:44'), false);
  assert.strictEqual(checkinService.isInCheckinWindow(start, '2026-10-22 08:16'), false);

  assert.deepStrictEqual(checkinService.checkinWindowOf(start), {
    start: '2026-10-22 07:45',
    end: '2026-10-22 08:15',
  });
});

test('扫码签到：该用户没有待签到预约 → 50002', async () => {
  const seat = nextSeat();
  const res = await request(app)
    .post('/api/reservations/checkin')
    .send(checkinBody('stu-no-reservation', seat));

  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.NO_PENDING_RESERVATION);
});

test('扫码签到：扫的座位与预约座位不一致 → 50003', async () => {
  const bookedSeat = nextSeat();
  const otherSeat = nextSeat();
  makeReservation({ userId: 'stu-wrong-seat', seat: bookedSeat, startOffsetMin: 0 });

  const res = await request(app)
    .post('/api/reservations/checkin')
    .send(checkinBody('stu-wrong-seat', otherSeat));

  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.body.code, ERROR_CODE.SEAT_NOT_MATCH);
});

test('扫码签到：重复签到同一座位 → 50005', async () => {
  const seat = nextSeat();
  const userId = 'stu-duplicate';
  makeReservation({ userId, seat, startOffsetMin: 0 });

  const first = await request(app).post('/api/reservations/checkin').send(checkinBody(userId, seat));
  assert.strictEqual(first.body.code, ERROR_CODE.OK);

  const second = await request(app).post('/api/reservations/checkin').send(checkinBody(userId, seat));
  assert.strictEqual(second.status, 409);
  assert.strictEqual(second.body.code, ERROR_CODE.CHECKIN_DUPLICATE);
});

test('扫码签到：二维码格式非法 → 40002，缺 userId → 40001，停用座位 → 40903', async () => {
  const badQrcode = await request(app)
    .post('/api/reservations/checkin')
    .send({ userId: 'stu-x', qrcode: 'HTTPS://EXAMPLE.COM/SEAT' });
  assert.strictEqual(badQrcode.status, 400);
  assert.strictEqual(badQrcode.body.code, ERROR_CODE.PARAM_INVALID);

  const noUser = await request(app)
    .post('/api/reservations/checkin')
    .send({ qrcode: seatDao.buildQrcode(roomId, 'A-01') });
  assert.strictEqual(noUser.status, 400);
  assert.strictEqual(noUser.body.code, ERROR_CODE.PARAM_MISSING);

  const disabled = seatDao.findByRoom(roomId).find((s) => s.status === 'DISABLED');
  assert.ok(disabled, '演示数据应包含一个停用座位');
  const disabledRes = await request(app)
    .post('/api/reservations/checkin')
    .send({ userId: 'stu-x', qrcode: disabled.qrcode });
  assert.strictEqual(disabledRes.status, 409);
  assert.strictEqual(disabledRes.body.code, ERROR_CODE.SEAT_DISABLED);
});

// ---------- 取消预约（US-05） ----------

test('取消预约：PENDING → CANCELLED，座位立即可以再约', async () => {
  const seat = nextSeat();
  const tomorrow = time.addDays(time.today(), 1);
  const userId = 'stu-cancel';

  const created = makeReservation({
    userId,
    seat,
    startOffsetMin: 0,
    status: 'PENDING',
  });
  // 用接口取消（同时验证再次预约走创建接口，证明唯一索引不挡历史记录）
  const res = await request(app)
    .post(`/api/reservations/${created.id}/cancel`)
    .send({ userId });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.code, ERROR_CODE.OK);
  assert.strictEqual(res.body.data.status, 'CANCELLED');
  assert.strictEqual(res.body.data.statusText, '已取消');
  assert.ok(res.body.data.cancelledAt);
  assert.strictEqual(res.body.data.seatReleased, true);

  const rebook = await request(app).post('/api/reservations').send({
    userId,
    userName: '测试同学',
    roomId,
    seatId: seat.id,
    date: tomorrow,
    slot: 'MORNING',
  });
  assert.strictEqual(rebook.status, 201);
  assert.strictEqual(rebook.body.code, ERROR_CODE.OK);
});

test('取消预约：非 PENDING 状态 → 50004，取消他人预约 → 40403', async () => {
  const seat = nextSeat();
  const checkedIn = makeReservation({
    userId: 'stu-cancel-checkedin',
    seat,
    startOffsetMin: -5,
    status: 'CHECKED_IN',
  });

  const notCancellable = await request(app)
    .post(`/api/reservations/${checkedIn.id}/cancel`)
    .send({ userId: 'stu-cancel-checkedin' });
  assert.strictEqual(notCancellable.status, 409);
  assert.strictEqual(notCancellable.body.code, ERROR_CODE.RESERVATION_NOT_CANCELLABLE);

  const otherSeat = nextSeat();
  const pending = makeReservation({ userId: 'stu-owner', seat: otherSeat, startOffsetMin: 0 });
  const notOwner = await request(app)
    .post(`/api/reservations/${pending.id}/cancel`)
    .send({ userId: 'stu-stranger' });
  assert.strictEqual(notOwner.status, 404);
  assert.strictEqual(notOwner.body.code, ERROR_CODE.RESERVATION_NOT_FOUND);
});

// ---------- 预约详情（US-03） ----------

test('预约详情：返回展示字段与可签到/可取消标记', async () => {
  const seat = nextSeat();
  const userId = 'stu-detail';
  const reservation = makeReservation({ userId, seat, startOffsetMin: 0 });

  const res = await request(app)
    .get(`/api/reservations/${reservation.id}`)
    .query({ userId });

  assert.strictEqual(res.status, 200);
  const data = res.body.data;
  assert.strictEqual(data.id, reservation.id);
  assert.strictEqual(data.seatNo, seat.seatNo);
  assert.strictEqual(data.roomName, '一楼综合阅览室');
  assert.strictEqual(data.statusText, '待签到');
  assert.strictEqual(data.canCheckin, true);
  assert.strictEqual(data.canCancel, true);
  assert.ok(data.checkinWindow.start < data.checkinWindow.end);

  const wrongUser = await request(app)
    .get(`/api/reservations/${reservation.id}`)
    .query({ userId: 'stu-stranger' });
  assert.strictEqual(wrongUser.status, 404);
  assert.strictEqual(wrongUser.body.code, ERROR_CODE.RESERVATION_NOT_FOUND);

  const missing = await request(app).get('/api/reservations/999999').query({ userId });
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(missing.body.code, ERROR_CODE.RESERVATION_NOT_FOUND);
});
