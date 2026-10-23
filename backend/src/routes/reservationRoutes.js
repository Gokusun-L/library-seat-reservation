/**
 * 预约相关路由
 *   第一棒：POST /api/reservations（US-02 创建预约）、GET /api/reservations（US-03 我的预约列表）
 *   第二棒：POST /api/reservations/checkin（US-04 扫码签到）
 *           GET  /api/reservations/:id（US-03 预约详情）
 *           POST /api/reservations/:id/cancel（US-05 取消预约）
 *
 * 路由顺序注意：/checkin 是固定路径，必须写在 /:id 之前，否则会被 :id 吞掉。
 */
const express = require('express');
const reservationService = require('../service/reservationService');
const checkinService = require('../service/checkinService');
const { ok } = require('../utils/response');

const router = express.Router();

router.post('/', (req, res) => {
  const data = reservationService.createReservation(req.body || {});
  res.status(201).json(ok(data, '预约成功'));
});

router.get('/', (req, res) => {
  const data = reservationService.listMyReservations(req.query.userId, {
    status: req.query.status,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    page: req.query.page,
    pageSize: req.query.pageSize,
  });
  res.json(ok(data));
});

// 扫码签到（US-04）
router.post('/checkin', (req, res) => {
  const data = checkinService.checkin(req.body || {});
  res.json(ok(data, '签到成功'));
});

// 预约详情（US-03）
router.get('/:id', (req, res) => {
  const data = checkinService.getReservationDetail(req.params.id, req.query.userId);
  res.json(ok(data));
});

// 取消预约（US-05）
router.post('/:id/cancel', (req, res) => {
  const data = checkinService.cancelReservation(req.params.id, req.body || {});
  res.json(ok(data, '取消成功'));
});

module.exports = router;
