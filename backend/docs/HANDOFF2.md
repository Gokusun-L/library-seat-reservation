# 第二棒 → 第三棒 交接说明

> 交接人：成员 2（后端・签到与履约接口）
> 接收人：成员 3（前端・列表与座位图展示层）
> 交接内容：4 个履约接口 + 维护任务 + 接口文档初稿（v1.1）

## 1. 已完成（可直接用）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| 座位二维码 | `GET /api/seats/:seatId/qrcode` | 返回二维码原文 + base64 PNG，`qrcode` 规则 `LIBSEAT:ROOM:{roomId}:SEAT:{seatNo}` |
| 扫码签到 | `POST /api/reservations/checkin` | 传 `{userId, qrcode}`；错误码 50001/50002/50003/50005 |
| 签到时间校验 | `checkinService.checkinWindowOf/isInCheckinWindow` | 开始前后各 15 分钟，闭区间；窗口半径从 `/api/meta/status` 的 `checkinWindowMinutes` 取 |
| 取消预约 | `POST /api/reservations/:id/cancel` | 只有 `PENDING` 可取消，成功后座位立即恢复可约 |
| 预约详情 | `GET /api/reservations/:id?userId=` | 额外返回 `canCheckin` / `canCancel` / `checkinWindow` |
| 维护任务（US-06） | `src/service/maintenanceService.js` | 每 60 秒：超时未签到 → `EXPIRED`；过结束时间 → `COMPLETED`；全走 CAS |
| 单元测试 | `test/checkin.test.js`、`test/maintenance.test.js` | 41 例全绿（第一棒 24 + 第二棒 17） |
| 接口文档 | `docs/API.md` v1.1 | 第 6–9 节为第二棒新增；错误码表补 50005 |
| 冒烟脚本 | `scripts/smoke-test.http` | 新增二维码/签到/详情/取消 4 个请求，可直接点 |

## 2. 你（第三棒）要做的（24h，US-01a / US-01b）

| 顺序 | 页面/组件 | 建议文件 | 依赖接口 |
| --- | --- | --- | --- |
| 1 | 阅览室列表页 | `pages/rooms` | `GET /api/reading-rooms`（含 `availableSeats` / `isOpen`） |
| 2 | 座位图渲染组件 | `components/seat-map` | `GET /:roomId/layout`（静态骨架）+ `GET /:roomId/seats`（动态状态） |
| 3 | 三态配色 | 同上 | `status`: FREE 绿 / RESERVED 黄 / IN_USE 红 / DISABLED 灰 |
| 4 | 座位信息弹窗 | 同上 | 座位字段 + `reservable` |
| 5 | 空座位筛选 | `pages/rooms` | 前端按 `status === 'FREE'` 过滤即可 |
| 6 | 响应式适配 | 全局样式 | `colGap` 表示过道列（在该列后加间距） |

## 3. 已经给你留好的东西

- **枚举别硬编码**：`GET /api/meta/slots`（时段）、`GET /api/meta/status`（预约状态 / 座位三态 / 座位类型 / 签到窗口分钟数）。
- **座位图三态不用自己算**：`GET /:roomId/seats` 直接给 `status` + `reservable` + `summary`，`summary` 各状态之和恒等于 `total`（有单测保证），可直接做顶部统计条。
- **布局与状态分离**：`layout` 接口是静态骨架（可缓存），`seats` 接口是动态状态（切时段要重新拉）。
- **错误提示**：`{ code, message }` 里的 `message` 是可以直接 toast 的中文；`409xx` 提示后建议刷新座位图（说明数据已变）。
- **签到/取消按钮的可用性**：详情接口已给 `canCheckin` / `canCancel`，别在前端重算时间窗口。

## 4. 必须遵守的约定（否则会破坏第四、五棒）

1. **不要改后端字段名**：`seatId`、`roomId`、`reserveDate`、`slot`、`status`、`reservationNo`、`statusText`、`canCheckin`、`canCancel`、`checkinWindow` 已按文档对接。
2. **座位状态不落库**：前端也不要把它当真相缓存——切日期/时段必须重新请求 `seats` 接口。
3. **时间一律用后端的字符串**（`YYYY-MM-DD` / `YYYY-MM-DD HH:mm`），不要在前端转时间戳再传回。
4. **扫码结果原样透传**：扫到什么就把字符串给 `checkin` 接口，前端不解析 `LIBSEAT:...`。
5. 任何接口/字段变更先改 `docs/API.md` 再改代码，并在 PR/提交里 @ 下游。

## 5. 已知缺口（有意留给后面几棒，别当 Bug）

| 缺口 | 归属 | 说明 |
| --- | --- | --- |
| 未接微信登录，`userId` 仍由前端传 | 后续棒次 | 接口路径与其余字段不会变，接登录后只是把 `userId` 从 body/query 删掉 |
| 二维码无签名，理论上可复制 | 后续棒次/风险 R2 | 若要防作弊，需加 HMAC 或动态短 token（服务端与座位贴纸都要改） |
| 无后台管理接口（F4） | 不在本 Sprint | Sprint Backlog 未纳入 |
| 候补队列 `waitlist` | 不在本 Sprint | 需求里没有，不要自行加复杂度 |
| `main` 分支保护未开 | 第一棒（需 admin 权限） | `Settings → Branches`：要求 PR 合并 + 1 approval + 状态检查 |

## 6. 自检清单（第三棒提交前对照 DoD）

- [ ] `npm test` 全绿（41 例），`npm run lint` 无告警
- [ ] 三种座位颜色在真机/模拟器上肉眼可区分，`DISABLED` 不可点击
- [ ] 切日期/时段后座位图会重新拉数据，不出现「昨天的红色还在」
- [ ] 网络异常/接口报错有 toast，不会白屏
- [ ] `docs/API.md` 若新增了前端约定（如分页参数），已同步
- [ ] 实测链路：列表 → 进房间 → 看到三态 → 切时段状态变化
