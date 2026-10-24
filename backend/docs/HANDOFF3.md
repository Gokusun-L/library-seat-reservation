# 第三棒 → 第四棒 交接说明

> 交接人：成员 3（前端・列表与座位图展示层）
> 接收人：成员 4（前端・预约与签到交互层）
> 交接内容：阅览室列表页 + 座位图组件（能看、还不能订）

## 1. 已完成（可直接用）

| 项 | 位置 | 说明 |
| --- | --- | --- |
| 阅览室列表页 | `miniprogram/pages/rooms` | 搜索 / 楼栋筛选 / 空位数 / 开放状态 / 下拉刷新 |
| 座位图渲染组件 | `miniprogram/components/seat-map` | 按行列 + 过道 `colGap` 渲染，点座位触发 `bind:select` |
| 三态配色 | `miniprogram/app.wxss` | FREE 绿 / RESERVED 黄 / IN_USE 红 / DISABLED 灰（CSS 变量统一维护） |
| 座位信息弹窗 | `miniprogram/pages/seat` | 点座位弹窗显示座位号/类型/状态，DISABLED 不可点 |
| 空座位筛选 | `miniprogram/pages/seat` | 「只看空位」开关，非空位淡化 |
| 请求封装 / 枚举缓存 | `miniprogram/utils/` | `request.js` 统一请求、`meta.js` 拉 `/api/meta/*` |

## 2. 你（第四棒）要做的（25h，US-02 / US-04 前端）

| 顺序 | 页面/组件 | 建议文件 | 依赖接口 |
| --- | --- | --- | --- |
| 1 | 座位图前端页面（可预约） | `miniprogram/pages/reserve` | 复用 `components/seat-map`；`POST /api/reservations` |
| 2 | 时间段选择器 | 同上 | 枚举走 `GET /api/meta/slots`，不要硬编码 |
| 3 | 预约状态实时更新 | 同上 | 预约成功后重新拉 `/seats` |
| 4 | 前端扫码功能 | `miniprogram/pages/checkin` | `wx.scanCode` → `POST /api/reservations/checkin` |
| 5 | 座位不匹配处理 | 同上 | 对接错误码 `50003`（座位号不匹配） |
| 6 | 签到页面 UI | 同上 | 错误码 `50001/50002/50005` 直接 toast |

## 3. 已经给你留好的东西

- **座位图组件可复用**：`components/seat-map` 接收 `layout` + `seats`，点击返回 `{ seatId }`，你接到后走预约流程即可。
- **预约按钮已占位**：`pages/seat/seat.js` 的 `onReserve` 目前只弹 toast，把里面换成调 `POST /api/reservations` 就行。
- **接口约定**：`POST /api/reservations` 入参 `{ userId, userName, roomId, seatId, date, slot }`；扫码签到 `POST /api/reservations/checkin` 入参 `{ userId, qrcode }`（扫码结果原样透传，不要解析 `LIBSEAT:...`）。
- **预约详情**：`GET /api/reservations/:id?userId=` 已返回 `canCheckin / canCancel`，别在前端重算签到窗口。

## 4. 必须遵守的约定

1. 后端字段名不得改动：`seatId` / `roomId` / `reserveDate` / `slot` / `status` / `reservationNo` / `statusText` / `canCheckin` / `canCancel` / `checkinWindow`。
2. 座位状态不落库、不缓存：切日期/时段必须重新请求 `/seats`。
3. 时间一律透传后端字符串（`YYYY-MM-DD` / `YYYY-MM-DD HH:mm`），不要在前端转时间戳。
4. 枚举走 `/api/meta/*`，不硬编码（时段、座位三态、座位类型、签到窗口分钟数）。
5. `409xx` 错误提示后刷新座位图（数据已变化）；`500xx` 直接 toast。

## 5. 已知缺口（有意留给后面棒次，别当 Bug）

| 缺口 | 归属 | 说明 |
| --- | --- | --- |
| 预约按钮未接后端 | 第四棒 | 见第 3 节，改成调 `POST /api/reservations` |
| 未接微信登录，`userId` 仍由前端传 | 后续棒次 | 接口路径与字段不会变，接登录后删掉 body/query 里的 `userId` |
| 无后台管理接口（F4） | 不在本 Sprint | — |
| 候补队列 `waitlist` | 不在本 Sprint | 需求里没有，不要自行加复杂度 |

## 6. 自检清单（第四棒提交前对照）

- [ ] 选座 → 预约成功 → 座位图变黄（RESERVED）
- [ ] 同一时段重复预约报错 `40902` 并提示
- [ ] 扫码签到成功 → 状态变 `CHECKED_IN`
- [ ] 扫码座位与预约不一致报错 `50003`
- [ ] 后端 `npm test` 全绿（41 例），前端无编译报错