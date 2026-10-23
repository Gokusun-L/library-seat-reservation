/**
 * 座位相关路由（第二棒：US-04 座位二维码）
 *   GET /api/seats/:seatId/qrcode  座位二维码内容 + base64 图片
 *
 * 说明：座位表里的 qrcode 字段本来不对外暴露（见 seatDao 注释），
 * 只有这个接口按座位 ID 主动取，避免座位图接口把全馆二维码一次性吐给前端。
 */
const express = require('express');
const checkinService = require('../service/checkinService');
const { ok } = require('../utils/response');

const router = express.Router();

// 生成二维码图片是异步的（qrcode 包），Express 4 不会自动捕获 async 异常，这里显式 next(err)
router.get('/:seatId/qrcode', (req, res, next) => {
  checkinService
    .getSeatQrcode(req.params.seatId)
    .then((data) => res.json(ok(data)))
    .catch(next);
});

module.exports = router;
