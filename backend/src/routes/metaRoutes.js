/**
 * 元数据路由：给前端提供枚举与健康检查，避免前端硬编码时间段/状态文案
 *   GET /api/health
 *   GET /api/meta/slots
 *   GET /api/meta/status
 */
const express = require('express');
const { SLOTS, RESERVATION_STATUS, SEAT_VIEW_STATUS, SEAT_TYPE } = require('../constants/business');
const { ok } = require('../utils/response');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json(ok({ status: 'UP', time: new Date().toISOString() }));
});

router.get('/meta/slots', (req, res) => {
  res.json(
    ok(
      Object.values(SLOTS).map((s) => ({
        code: s.code,
        label: s.label,
        start: s.start,
        end: s.end,
      }))
    )
  );
});

router.get('/meta/status', (req, res) => {
  res.json(
    ok({
      reservationStatus: RESERVATION_STATUS,
      seatViewStatus: SEAT_VIEW_STATUS,
      seatType: SEAT_TYPE,
    })
  );
});

module.exports = router;
