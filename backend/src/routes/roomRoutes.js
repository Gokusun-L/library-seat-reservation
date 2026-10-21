/**
 * 阅览室 / 座位相关路由（US-01a、US-01b）
 *   GET /api/reading-rooms                 阅览室列表
 *   GET /api/reading-rooms/:roomId/layout  座位布局（静态骨架）
 *   GET /api/reading-rooms/:roomId/seats   座位状态（含三态）
 */
const express = require('express');
const roomService = require('../service/readingRoomService');
const { ok } = require('../utils/response');

const router = express.Router();

router.get('/', (req, res) => {
  const data = roomService.listRooms({
    keyword: req.query.keyword,
    building: req.query.building,
    status: req.query.status,
    date: req.query.date,
    slot: req.query.slot,
  });
  res.json(ok(data));
});

router.get('/:roomId/layout', (req, res) => {
  res.json(ok(roomService.getLayout(Number(req.params.roomId))));
});

router.get('/:roomId/seats', (req, res) => {
  const data = roomService.getSeatStatus(Number(req.params.roomId), {
    date: req.query.date,
    slot: req.query.slot,
  });
  res.json(ok(data));
});

module.exports = router;
