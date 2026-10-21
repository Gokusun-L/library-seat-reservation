/**
 * 预约相关路由（US-02 创建预约、US-03 我的预约列表）
 *   POST /api/reservations        创建预约
 *   GET  /api/reservations        我的预约列表 ?userId=&status=&page=&pageSize=
 *
 * 第二棒在此文件追加：
 *   GET  /api/reservations/:id    预约详情
 *   POST /api/reservations/:id/cancel  取消预约
 *   POST /api/checkin             扫码签到
 */
const express = require('express');
const reservationService = require('../service/reservationService');
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

module.exports = router;
