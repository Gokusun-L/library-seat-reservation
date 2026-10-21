# 接口文档 v1.0（第一棒交接版）

> 状态：5 个基础接口已实现并通过单元测试。第二棒在此文档上增量补充签到/取消/详情接口，**已有字段与错误码不得删改**（第三~五棒前端已按此对接）。
> 服务地址：`http://localhost:3000`；所有接口前缀 `/api`。
> 完整可复制示例见仓库 `scripts/smoke-test.http`。

## 0. 通用约定

### 0.1 响应结构

```json
// 成功
{ "code": 0, "message": "ok", "data": { } }
// 失败
{ "code": 40901, "message": "该座位已被预约，请选择其他座位" }
```

- `code === 0` 表示成功，其余为业务错误码（见第 6 节）。
- `message` 是可以**直接丢给用户看**的中文提示，前端无需自己维护一套文案。
- HTTP 状态码同时正确设置（200/201/400/404/409/500），但前端应以 `code` 为准。

### 0.2 身份约定

第一棒暂未接入登录，所有涉及用户的接口都通过 `userId` 显式传递（小程序阶段用 `wx.login` 换 openid 后填入）。
第二棒接入登录态后，`userId` 改为从 token 解析，接口路径与其余字段保持不变——前端只需把 `userId` 从 body/query 里删掉。

### 0.3 枚举

| 枚举 | 取值 | 含义 |
| --- | --- | --- |
| `slot` 时间段 | `MORNING` / `AFTERNOON` / `EVENING` | 上午 08:00-12:00 / 下午 14:00-18:00 / 晚上 19:00-22:00 |
| `status` 预约状态 | `PENDING` / `CHECKED_IN` / `COMPLETED` / `CANCELLED` / `EXPIRED` | 待签到 / 使用中 / 已完成 / 已取消 / 超时释放 |
| `status` 座位图三态 | `FREE` / `RESERVED` / `IN_USE` / `DISABLED` | 空闲（可约）/ 已预约待签到 / 使用中 / 停用 |
| `seatType` | `NORMAL` / `POWER` / `WINDOW` | 普通 / 带电源 / 靠窗 |

`GET /api/meta/slots` 与 `GET /api/meta/status` 可直接拉到上述枚举，前端不要硬编码。

### 0.4 时间格式

- 日期：`YYYY-MM-DD`（字符串比较即时间顺序）
- 日期时间：`YYYY-MM-DD HH:mm`
- 服务器按本地时区生成，前端直接透传字符串即可，不要传时间戳。

---

## 1. 阅览室列表（US-01a）

`GET /api/reading-rooms`

**Query**

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| keyword | 否 | 按名称/编号/楼栋模糊搜索 |
| building | 否 | 楼栋精确筛选 |
| status | 否 | `OPEN` / `CLOSED` |
| date | 否 | 统计口径日期，默认今天 |
| slot | 否 | 统计口径时段，默认当前时段 |

**响应 data**（数组）

```json
[
  {
    "id": 1,
    "roomNo": "R101",
    "name": "一楼综合阅览室",
    "building": "图书馆主馆",
    "floor": 1,
    "openTime": "08:00",
    "closeTime": "22:00",
    "rowCount": 5,
    "colCount": 8,
    "colGap": [4],
    "status": "OPEN",
    "description": "综合自习区，安静，禁止饮食",
    "totalSeats": 40,
    "enabledSeats": 39,
    "availableSeats": 39,
    "isOpen": true,
    "queryDate": "2026-10-21",
    "querySlot": "AFTERNOON"
  }
]
```

字段说明：`totalSeats` 座位总数，`enabledSeats` 未停用座位数，`availableSeats` 指定时段剩余可约数，`colGap` 座位图中需要留出过道的列号（前端渲染时在这些列后加间距），`isOpen` 是否开放（`status === 'OPEN'`）。

## 2. 座位布局（US-01b 静态骨架）

`GET /api/reading-rooms/:roomId/layout`

**响应 data**

```json
{
  "room": { "id": 1, "name": "一楼综合阅览室", "rowCount": 5, "colCount": 8, "...": "同列表字段" },
  "layout": { "rowCount": 5, "colCount": 8, "colGap": [4] },
  "seats": [
    { "seatId": 1, "seatNo": "A-01", "row": 1, "col": 1, "seatType": "POWER", "enabled": true }
  ]
}
```

用途：渲染网格骨架，数据静态可缓存；**不含占用状态**，占用状态走接口 3。

## 3. 座位状态（US-01b 动态状态）

`GET /api/reading-rooms/:roomId/seats?date=YYYY-MM-DD&slot=MORNING`

**Query**：`date`（默认今天）、`slot`（默认当前时段）均可选。

**响应 data**

```json
{
  "room": { "id": 1, "name": "一楼综合阅览室", "...": "..." },
  "date": "2026-10-21",
  "slot": "MORNING",
  "slotLabel": "上午",
  "slotWindow": { "startTime": "2026-10-21 08:00", "endTime": "2026-10-21 12:00" },
  "seats": [
    { "seatId": 1, "seatNo": "A-01", "row": 1, "col": 1, "seatType": "POWER", "status": "RESERVED", "reservable": false },
    { "seatId": 3, "seatNo": "A-03", "row": 1, "col": 3, "seatType": "NORMAL", "status": "FREE", "reservable": true }
  ],
  "summary": { "total": 40, "FREE": 37, "RESERVED": 1, "IN_USE": 1, "DISABLED": 1 }
}
```

三态配色建议（第三棒）：`FREE` 绿、`RESERVED` 黄、`IN_USE` 红、`DISABLED` 灰；只有 `reservable === true` 才允许点击预约。
`summary` 各状态之和恒等于 `total`（有单测保证），可直接用于顶部统计条。

## 4. 创建预约（US-02）

`POST /api/reservations`　`Content-Type: application/json`

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | 是 | 预约人标识（openid/学号） |
| userName | string | 否 | 姓名，仅用于列表展示 |
| roomId | number | 是 | 阅览室 ID |
| seatId | number | 是 | 座位 ID（不是座位号） |
| date | string | 是 | `YYYY-MM-DD` |
| slot | string | 是 | `MORNING` / `AFTERNOON` / `EVENING` |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{"userId":"202411701223","userName":"温佳鑫","roomId":1,"seatId":10,"date":"2026-10-22","slot":"MORNING"}'
```

**成功响应 `201`**

```json
{
  "code": 0,
  "message": "预约成功",
  "data": {
    "id": 3,
    "reservationNo": "R202610227035",
    "userId": "202411701223",
    "userName": "温佳鑫",
    "roomId": 1,
    "seatId": 10,
    "reserveDate": "2026-10-22",
    "slot": "MORNING",
    "startTime": "2026-10-22 08:00",
    "endTime": "2026-10-22 12:00",
    "status": "PENDING",
    "checkinTime": null,
    "cancelledAt": null,
    "createdAt": "2026-10-21 15:05:46",
    "updatedAt": "2026-10-21 15:05:46",
    "roomName": "一楼综合阅览室",
    "building": "图书馆主馆",
    "seatNo": "A-02",
    "statusText": "待签到",
    "slotLabel": "上午"
  }
}
```

`statusText` / `slotLabel` / `roomName` / `seatNo` 是后端补全的展示字段，前端拿到就能直接渲染预约成功页，不用再查一次。

**业务规则（与验收标准 US-02 一一对应）**

| 规则 | 违反时错误码 |
| --- | --- |
| 必填参数齐全 | 40001 |
| roomId/seatId 为正整数、日期真实存在、slot 合法 | 40002 / 40003 / 40004 |
| 阅览室存在且开放 | 40401 / 40904 |
| 座位存在且属于该阅览室 | 40402 / 40005 |
| 座位未停用 | 40903 |
| 时段落在阅览室开放时间内 | 40904 |
| 开始时间晚于当前时间 | 40905 |
| 最多提前 7 天预约 | 40002 |
| 座位该时段未被占用 | 40901（并发时 40906） |
| 同一用户同一时段仅一条有效预约 | 40902 |

## 5. 我的预约列表（US-03 前置能力）

`GET /api/reservations?userId=xxx&status=PENDING&page=1&pageSize=20`

**Query**：`userId` 必填；`status`、`dateFrom`、`dateTo` 可选；`page` 默认 1，`pageSize` 默认 20（上限 50）。

**响应 data**

```json
{
  "list": [ { "id": 3, "reservationNo": "R202610227035", "status": "PENDING", "statusText": "待签到", "seatNo": "A-02", "roomName": "一楼综合阅览室", "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

排序：预约日期倒序 → 开始时间倒序（最新在前）。

---

## 6. 错误码表

| code | HTTP | 场景 | message |
| --- | --- | --- | --- |
| 0 | 200/201 | 成功 | ok |
| 40001 | 400 | 必填参数缺失 | 缺少必填参数 |
| 40002 | 400 | 参数格式非法（如 roomId 非正整数、超过 7 天） | 参数格式不正确 |
| 40003 | 400 | 日期格式错误 | 日期格式应为 YYYY-MM-DD |
| 40004 | 400 | 时间段非法 | 时间段只能是 MORNING / AFTERNOON / EVENING |
| 40005 | 400 | 座位不属于该阅览室 | 该座位不属于指定阅览室 |
| 40101 | 401 | 未登录/身份无效（第二棒起启用） | 登录状态失效，请重新登录 |
| 40400 | 404 | 接口路径不存在 | 接口不存在 |
| 40401 | 404 | 阅览室不存在 | 阅览室不存在 |
| 40402 | 404 | 座位不存在 | 座位不存在 |
| 40403 | 404 | 预约记录不存在 | 预约记录不存在 |
| 40901 | 409 | 座位已被预约 | 该座位已被预约，请选择其他座位 |
| 40902 | 409 | 同一时段重复预约 | 同一时段只能预约一个座位 |
| 40903 | 409 | 座位停用 | 该座位已停用，暂时无法预约 |
| 40904 | 409 | 阅览室不开放该时段 | 该时段不在阅览室开放时间内 |
| 40905 | 409 | 预约开始时间已过 | 预约开始时间已过，无法预约该时段 |
| 40906 | 409 | 并发抢座失败（唯一约束兜底） | 手慢了，该座位刚刚被其他同学预约 |
| 50001 | 409 | 不在签到时间窗口（第二棒） | 不在签到时间窗口内 |
| 50002 | 409 | 无待签到预约（第二棒） | 您当前没有待签到的预约 |
| 50003 | 409 | 扫码座位不匹配（第二棒） | 座位号不匹配 |
| 50004 | 409 | 当前状态不可取消（第二棒） | 当前预约状态不允许取消 |
| 50000 | 500 | 未捕获异常 | 服务器开小差了，请稍后重试 |

前端建议：`409xx` 用 toast 提示并刷新座位图（说明数据已变化）；`4xxxxx` 提示即可；`50000` 提示「请稍后重试」。

## 7. 小程序调用示例（第三棒可直接抄）

```js
// utils/request.js
const BASE_URL = 'http://localhost:3000/api';

function request(path, { method = 'GET', data = {} } = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        const body = res.data || {};
        if (body.code === 0) return resolve(body.data);
        wx.showToast({ title: body.message || '请求失败', icon: 'none' });
        reject(body);
      },
      fail(err) {
        wx.showToast({ title: '网络异常', icon: 'none' });
        reject(err);
      },
    });
  });
}

// 页面里
request('/reading-rooms').then((rooms) => this.setData({ rooms }));
request(`/reading-rooms/${roomId}/seats?date=${date}&slot=${slot}`).then((d) => this.setData({ seats: d.seats, summary: d.summary }));
request('/reservations', {
  method: 'POST',
  data: { userId, userName, roomId, seatId, date, slot },
}).then((reservation) => wx.navigateTo({ url: `/pages/reserve/success?id=${reservation.id}` }));
```

注意：小程序正式版要求 `https` 且域名需备案；课堂演示用开发者工具勾选「不校验合法域名」即可。
