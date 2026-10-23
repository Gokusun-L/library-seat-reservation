/**
 * 元数据路由：给前端提供枚举与健康检查，避免前端硬编码时间段/状态文案
 *   GET /api/health
 *   GET /api/meta/slots
 *   GET /api/meta/status
 */
const express = require('express');
const {
  SLOTS,
  RESERVATION_STATUS,
  SEAT_VIEW_STATUS,
  SEAT_TYPE,
  CHECKIN_WINDOW_MINUTES,
} = require('../constants/business');
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
      // 签到窗口：开始前后各 N 分钟（第二棒 US-04），前端提示文案不用写死 15
      checkinWindowMinutes: CHECKIN_WINDOW_MINUTES,
    })
  );
});

module.exports = router;
