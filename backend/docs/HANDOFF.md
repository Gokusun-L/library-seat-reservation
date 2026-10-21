# 第一棒 → 第二棒 交接说明

> 交接人：成员 1（后端·数据与预约地基）
> 接收人：成员 2（后端·签到与履约接口）
> 交接内容：三张表结构 + 5 个基础接口 + 接口约定（字段与错误码）

## 1. 已完成（可直接用）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| 三张表 DDL | `src/db/schema.sql` | reading_room / seat / reservation，含索引与两个部分唯一索引 |
| 实体与 DAO | `src/dao/*.js` | 数据库行 → 对外实体的字段映射（下划线转驼峰）已统一在这里 |
| 座位布局数据结构 | `src/db/seed.js` + `GET /:roomId/layout` | 行列 + 座位号 + 座位类型 + 过道列 `colGap` |
| 座位状态查询 | `GET /:roomId/seats` | 三态（FREE/RESERVED/IN_USE）+ 停用，已合并预约占用 |
| 阅览室列表 | `GET /api/reading-rooms` | 含剩余座位数 / 开放状态 |
| 预约创建 | `POST /api/reservations` | 参数→资源→时间→冲突四段校验，返回详情含展示字段 |
| 重复预约校验 | `reservationService.createReservation` 第 4 段 | 服务层给友好码 + 唯一索引兜底并发 |
| 单元测试 | `test/*.test.js` | 24 个用例全绿，`npm test` |
| 接口约定 | `docs/API.md` + `src/constants/errorCode.js` | 字段、枚举、错误码、小程序调用示例 |

## 2. 你要做的 5 个接口（按顺序实现即可）

| 顺序 | 接口 | 建议路由 | 对应故事 / 错误码 |
| --- | --- | --- | --- |
| 1 | 二维码生成 | `GET /api/seats/:seatId/qrcode` | US-04，返回 `qrcode` 内容 + 小程序码图片 |
| 2 | 扫码签到 | `POST /api/reservations/checkin` | US-04，失败码 50001/50002/50003 |
| 3 | 签到时间校验 | Service 内部方法 | 开始前 15 分钟 ~ 开始后 15 分钟 |
| 4 | 取消预约 | `POST /api/reservations/:id/cancel` | US-05，失败码 50004 / 40403 |
| 5 | 预约详情 | `GET /api/reservations/:id` | US-03，失败码 40403 |

### 已经给你留好的东西

- `reservationDao.updateStatus(id, status, extra)`：支持 `checkinTime` / `cancelledAt` 附加字段，签到和取消都直接用。
- `reservationDao.findExpiredPending(now)`：返回「开始 15 分钟后仍未签到」的 PENDING 预约，US-06 定时任务直接遍历它改成 `EXPIRED` 即可（建议每 1 分钟跑一次，`setInterval` + try/catch）。
- `seatDao.buildQrcode(roomId, seatNo)`：二维码内容规则 `LIBSEAT:ROOM:{roomId}:SEAT:{seatNo}`，座位表 `qrcode` 字段已按此生成，扫码后按该规则反解即可。
- `utils/time.js`：`now()` / `compareDateTime(a,b)` / `addDays()` / `buildSlotWindow()`，签到窗口计算不用自己写日期运算。
- `constants/errorCode.js` 的 5xxxx 段：50001~50004 已定义好错误码和默认文案，直接 `throw new BizError(ERROR_CODE.CHECKIN_TIME_INVALID)`。

### 加接口的固定姿势（照抄就不会破坏分层）

```js
// 1) src/service/checkinService.js —— 业务规则，抛 BizError
// 2) src/routes/reservationRoutes.js —— 只取参、调 service、res.json(ok(data))

router.post('/:id/cancel', (req, res) => {
  const data = checkinService.cancelReservation(Number(req.params.id), req.body || {});
  res.json(ok(data, '取消成功'));
});
```

## 3. 必须遵守的约定（否则会破坏第三~五棒前端）

1. **不要改已有字段名**：`seatId`、`roomId`、`reserveDate`、`slot`、`status`、`reservationNo`、`statusText` 等已被前端（第三棒起）按文档对接。
2. **不要改已有错误码编号**：只在 5xxxx 段追加。
3. **状态文案统一用 `statusText()`**（`src/service/reservationService.js` 已导出），不要各接口自己拼「待签到/未签到」两套说法。
4. **状态流转必须走状态机**（见 `docs/DB.md` 第 5 节）：只允许 PENDING→CHECKED_IN/CANCELLED/EXPIRED、CHECKED_IN→COMPLETED，非法流转抛 50004。
5. **所有写操作必须带 `updated_at`**：`reservationDao.updateStatus` 已处理，别自己手写 UPDATE。

## 4. 已知缺口（有意留给后面几棒，别当 Bug）

| 缺口 | 归属 | 说明 |
| --- | --- | --- |
| 未接登录，`userId` 由前端传 | 第二棒可选 | 若要接微信登录，在这里补 `middleware/auth.js` 并把 userId 改为从 token 取 |
| 无「已完成」自动落库 | 第二棒 | 时段结束后把 CHECKED_IN → COMPLETED，可与超时释放合并成一个定时任务 |
| 无二维码图片，只有二维码内容 | 第二棒 | 用 `qrcode` npm 包转成 base64 图片即可；小程序码需 access_token，属风险 R1，备选普通二维码 |
| 无后台管理接口（F4） | 不在本 Sprint | Sprint Backlog 未纳入，下个 Sprint 再做 |
| `waitlist` / 候补队列 | 不在本 Sprint | 需求里没有，不要自行加复杂度 |

## 5. 自检清单（第二棒提交 PR 前对照 DoD）

- [ ] `npm test` 全绿，新增签到/取消用例不少于 6 个（时间窗口边界、状态非法、座位不匹配、重复签到、详情不存在）
- [ ] `npm run lint` 无告警
- [ ] `docs/API.md` 已补充新接口的请求/响应/错误码
- [ ] 状态流转非法时返回 50004，而不是静默成功
- [ ] 实测过一次完整链路：预约 → 座位图变 RESERVED → 签到 → 变 IN_USE → 详情查询
