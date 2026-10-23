# 五棒接力分工与工时清单

> 适用：实验三「五棒接力」开发（图书馆座位预约系统）。
> 作用：本表是 **PingCode 建 Task、填工时、指派负责人** 的唯一口径来源；也是实验报告「分工与工作量」章节的底稿。
> 配套文档：[COLLAB.md](COLLAB.md)（协作流程）、[../backend/docs/HANDOFF.md](../backend/docs/HANDOFF.md)（第一棒交接）、[../backend/docs/HANDOFF2.md](../backend/docs/HANDOFF2.md)（第二棒交接）、[../backend/docs/API.md](../backend/docs/API.md)（接口契约）。

## 1. 总览

| 棒次 | 成员 | 角色定位 | 写代码/文档 | 写报告 | 合计 | 交接给下一棒 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 成员 1 | 后端・数据与预约地基 | 25h | 6.5h | **31.5h** | 三张表结构 + 5 个基础接口 + 接口约定（字段与错误码） |
| 2 | 成员 2 | 后端・签到与履约接口 | 27h | 4.5h | **31.5h** | 后端接口全部可调通 + 接口文档初稿 |
| 3 | 成员 3 | 前端・列表与座位图展示层 | 24h | 7.5h | **31.5h** | 阅览室列表页 + 座位图组件（能看、还不能订） |
| 4 | 成员 4 | 前端・预约与签到交互层 | 25h | 6.5h | **31.5h** | 可走通「选座 → 签到」主流程的小程序 |
| 5 | 成员 5 | 前端・详情收口＋交付与报告整合 | 21.5h | 10h | **31.5h** | 可演示系统 + 完整实验报告 |
| — | — | **合计** | **122.5h** | **35h** | **157.5h** | — |

## 2. 逐棒拆解

### 2.1 第一棒（成员 1）｜后端・数据与预约地基 — 31.5h

负责整个系统的数据底座和预约主流程的服务端实现。

| 类别 | 任务 | 工时 | 落地位置 |
| --- | --- | --- | --- |
| 数据库 | 预约记录表建表 SQL + 实体类 + DAO | 3h | `src/db/schema.sql`、`src/dao/*.js` |
| 后端 | 座位布局数据结构 | 4h | `src/db/seed.js`、`GET /api/reading-rooms/:roomId/layout` |
| 后端 | 座位状态查询接口 | 3h | `GET /api/reading-rooms/:roomId/seats` |
| 后端 | 阅览室列表接口 | 4h | `GET /api/reading-rooms` |
| 后端 | 预约接口设计 | 6h | `POST /api/reservations`、`src/service/reservationService.js` |
| 后端 | 重复预约校验 | 2h | Service 第 4 段校验 + 两个部分唯一索引 |
| 测试 | 预约接口单元测试 | 3h | `test/reservation.test.js`、`test/room.test.js`（24 例） |
| **小计** | | **25h** | |
| 报告 | 案例背景与 Epic 描述 | 2h | 实验报告第一章 |
| 报告 | Feature 清单 F1–F4 | 2h | 实验报告第二章 |
| 报告 | Task 分解 US-02 | 2.5h | 实验报告任务分解章节 |
| **小计** | | **6.5h** | |

### 2.2 第二棒（成员 2）｜后端・签到与履约接口 — 31.5h

接着第一棒的表结构，把「签到 — 取消 — 查询」这条履约链路做完。

| 类别 | 任务 | 工时 | 落地位置 |
| --- | --- | --- | --- |
| 后端 | 二维码生成接口 | 6h | `GET /api/seats/:seatId/qrcode`、`src/routes/seatRoutes.js` |
| 后端 | 扫码签到接口 | 5h | `POST /api/reservations/checkin` |
| 后端 | 签到时间校验 | 3h | `checkinService.checkinWindowOf/isInCheckinWindow`（开始前后各 15 分钟） |
| 后端 | 取消预约接口 | 6h | `POST /api/reservations/:id/cancel`（US-05） |
| 后端 | 预约详情接口 | 4h | `GET /api/reservations/:id`（US-03） |
| 测试 | 签到接口单元测试 | 3h | `test/checkin.test.js`、`test/maintenance.test.js`（17 例） |
| **小计** | | **27h** | |
| 报告 | Planning Poker 估算记录表 | 2.5h | 实验报告估算章节 |
| 报告 | 团队速率计算 | 1.5h | 实验报告速率章节 |
| 报告 | 团队承诺书与签字 | 0.5h | 实验报告附录 |
| **小计** | | **4.5h** | |

> 附：US-06（超时释放 + 自动完成）的定时任务由第二棒一并实现，落在 `src/service/maintenanceService.js`，工时计入上表「扫码签到接口 / 签到时间校验」两项。

### 2.3 第三棒（成员 3）｜前端・列表与座位图展示层 — 31.5h

在后端接口调通的基础上做小程序展示层。

| 类别 | 任务 | 工时 | 落地位置（预期） |
| --- | --- | --- | --- |
| 前端 | 座位图渲染组件 | 6h | `miniprogram/components/seat-map` |
| 前端 | 座位状态三态配色 | 3h | 同上（FREE 绿 / RESERVED 黄 / IN_USE 红 / DISABLED 灰） |
| 前端 | 座位信息弹窗 | 3h | 同上 |
| 前端 | 空座位筛选 | 2h | `miniprogram/pages/rooms` |
| 前端 | 响应式适配 | 2h | 全局样式 |
| 前端 | 阅览室列表页 | 8h | `miniprogram/pages/rooms` |
| **小计** | | **24h** | |
| 报告 | 用户故事 US-01～US-04 | 2.5h | 实验报告需求章节 |
| 报告 | 验收标准 US-04 + US-05 | 2.5h | 实验报告验收标准章节 |
| 报告 | Task 分解 US-01b | 2.5h | 实验报告任务分解章节 |
| **小计** | | **7.5h** | |

### 2.4 第四棒（成员 4）｜前端・预约与签到交互层 — 31.5h

把第三棒的静态座位图变成可交互的预约页面。

| 类别 | 任务 | 工时 | 落地位置（预期） |
| --- | --- | --- | --- |
| 前端 | 座位图前端页面 | 8h | `miniprogram/pages/reserve` |
| 前端 | 时间段选择器 | 4h | 同上（枚举走 `/api/meta/slots`） |
| 前端 | 预约状态实时更新 | 3h | 同上 |
| 前端 | 前端扫码功能 | 4h | `miniprogram/pages/checkin` |
| 前端 | 座位不匹配处理 | 3h | 同上（对接 50003） |
| 前端 | 签到页面 UI | 3h | 同上 |
| **小计** | | **25h** | |
| 报告 | 用户故事 US-05～US-07 | 2h | 实验报告需求章节 |
| 报告 | INVEST 检验表 | 2h | 实验报告需求质量章节 |
| 报告 | 验收标准 US-02 | 1.5h | 实验报告验收标准章节 |
| 报告 | 风险与依赖清单 | 1h | 实验报告风险章节 |
| **小计** | | **6.5h** | |

### 2.5 第五棒（成员 5）｜前端・详情收口＋交付与报告整合 — 31.5h

收尾前端细节并把全部交付物归齐。

| 类别 | 任务 | 工时 | 落地位置（预期） |
| --- | --- | --- | --- |
| 前端 | 取消预约按钮 + 二次确认 + 状态刷新 | 10h | `miniprogram/pages/detail`（对接 50004） |
| 前端 | 我的预约列表与详情页 | 10h | `miniprogram/pages/my-reservations` |
| 文档 | 接口文档定稿 | 1.5h | `backend/docs/API.md` |
| **小计** | | **21.5h** | |
| 报告 | 团队 DoD 8 条 | 2h | 实验报告过程管理章节 |
| 报告 | 估算分歧与收敛记录 | 1.5h | 实验报告估算章节 |
| 报告 | Task 分解 US-04 | 2.5h | 实验报告任务分解章节 |
| 报告 | Sprint 目标与 Sprint Backlog | 2h | 实验报告迭代计划章节 |
| 报告 | 报告整合与格式统一导出 | 2h | 最终交付物 |
| **小计** | | **10h** | |

## 3. 棒次 ↔ 代码模块 ↔ 接口 映射（对账用）

| 棒次 | 后端模块 | 接口 | 测试 |
| --- | --- | --- | --- |
| 1 | `db/`、`dao/`、`service/reservationService.js`、`service/readingRoomService.js`、`routes/roomRoutes.js`、`routes/metaRoutes.js` | `GET /api/reading-rooms`、`GET /:roomId/layout`、`GET /:roomId/seats`、`POST /api/reservations`、`GET /api/reservations`、`/api/health`、`/api/meta/*` | `test/reservation.test.js`、`test/room.test.js`（24） |
| 2 | `service/checkinService.js`、`service/maintenanceService.js`、`routes/seatRoutes.js`、`routes/reservationRoutes.js`（追加） | `GET /api/seats/:seatId/qrcode`、`POST /api/reservations/checkin`、`GET /api/reservations/:id`、`POST /api/reservations/:id/cancel` | `test/checkin.test.js`、`test/maintenance.test.js`（17） |
| 3 | 小程序 `pages/rooms`、`components/seat-map` | 消费 1/2 棒的只读接口 | — |
| 4 | 小程序 `pages/reserve`、`pages/checkin`、`utils/request.js` | 消费创建预约 + 签到接口 | — |
| 5 | 小程序 `pages/my-reservations`、`pages/detail`；`docs/API.md` 定稿 | 消费列表 / 详情 / 取消接口 | — |

## 4. 工时口径说明（写报告时照抄这段）

1. 每棒 **31.5h**，五棒合计 **157.5h**，其中写代码与接口文档 **122.5h**、写实验报告 **35h**。
2. 该工时是 **Task 级预估的理想工时**，用于 PingCode 登记与速率校准；**与故事点（Story Point）不是同一套单位**，不要互相换算后混算（实验二已约定 1 故事点 ≈ 8 理想小时，仅用于把速率从小时折算为点）。
3. 每棒内部工时拆分到 Task（见第 2 节表格），在 PingCode 里对应一条 Task 记录 + 一个负责人 + 一个预估工时；实际工时在完成时回填，用于计算团队真实速率。
4. 报告工时按章节计入，便于老师核对「代码量与文档量是否匹配」。

## 5. 与实验一 / 实验二成果的衔接

| 实验 | 产出 | 在实验三里的用途 |
| --- | --- | --- |
| 实验一 | Epic / Feature / User Story / 故事地图 / MoSCoW / 验收标准 | 作为 Product Backlog 的需求来源；US-01a/01b/02…07 的验收标准直接对应本仓库接口的错误码规则 |
| 实验二 | 团队 DoD、Planning Poker 估算、Task 分解、团队速率、Sprint Goal 与 Sprint Backlog | 作为 Sprint 计划与「完成」判定标准；本表第 2 节的工时即实验二 Task 分解在真实项目上的落地 |
| 实验三 | 本仓库代码 + 本表 + COLLAB.md 过程证据 | 交付可演示系统 + 完整实验报告 |

> 注：实验一/二的报告案例背景为「高校学工平台」，实验三的项目背景为「图书馆座位预约系统」；**方法（需求分解、估算、DoD、速率）复用，业务需求不与实验一/二混用**，PingCode 里的用户故事统一使用本项目的 US-01a～US-07 编号。
