# 接口文档 v1.1（第二棒交接版）

> 状态：第一棒 5 个基础接口 + 第二棒 4 个履约接口（二维码 / 扫码签到 / 预约详情 / 取消预约）已实现并通过单元测试（41 例）。
> **已有字段与错误码不得删改**（第三~五棒前端已按此对接）；新增能力只在 5xxxx 错误码段追加、在本文档末尾追加章节。
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

> 状态流转（第二棒起全部走 CAS，非法流转直接报错）：`PENDING` --签到--> `CHECKED_IN` --到点--> `COMPLETED`；`PENDING` --取消--> `CANCELLED`；`PENDING` --超时未签到--> `EXPIRED`。

`GET /api/meta/slots` 与 `GET /api/meta/status` 可直接拉到上述枚举，前端不要硬编码。
`GET /api/meta/status` 额外返回 `checkinWindowMinutes`（签到窗口半径，当前 15），前端提示文案不必写死。

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

**Query**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | 是 | 预约人标识（openid/学号），缺失报 `40001` |
| status | string | 否 | `PENDING` / `CHECKED_IN` / `COMPLETED` / `CANCELLED` / `EXPIRED`；不传表示全部，取值非法报 `40002` |
| dateFrom | string | 否 | `YYYY-MM-DD`，预约日期下界（含） |
| dateTo | string | 否 | `YYYY-MM-DD`，预约日期上界（含） |
| page | number | 否 | 默认 1 |
| pageSize | number | 否 | 默认 20，上限 50（超过按 50 处理） |

**响应 data**

```json
{
  "list": [ { "id": 3, "reservationNo": "R202610227035", "status": "PENDING", "statusText": "待签到", "seatNo": "A-02", "roomName": "一楼综合阅览室", "...": "..." } ],
  "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

- 列表项字段与「4. 创建预约」的 `data` 完全一致（两者都经 `reservationService.decorate()` 补全 `roomName` / `building` / `seatNo` / `statusText` / `slotLabel`），前端直接渲染，不再二次拼文案。
- 无数据时 `list` 为 `[]`、`total` 为 `0`、`totalPages` 为 `0`（不是 `null`）。

排序：预约日期倒序 → 开始时间倒序（最新在前）。

**错误**：`40001` 缺 userId；`40002` status 取值非法、page/pageSize 非数字。

**对应前端页面（第五棒）**：`miniprogram/pages/my-reservations`；触底加载用 `pagination.totalPages` 判断是否还有下一页。

---

## 6. 座位二维码（US-04）

`GET /api/seats/:seatId/qrcode`

**响应 data**

```json
{
  "seatId": 10,
  "seatNo": "A-02",
  "roomId": 1,
  "roomName": "一楼综合阅览室",
  "qrcode": "LIBSEAT:ROOM:1:SEAT:A-02",
  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
  "mimeType": "image/png"
}
```

- `qrcode` 是二维码里的**原文**，座位表里按 `LIBSEAT:ROOM:{roomId}:SEAT:{seatNo}` 生成，签到接口按此规则反解。
- `dataUrl` 是 base64 图片（256×256 PNG），小程序 `<image src="{{dataUrl}}">` 直接渲染；不需要图片时只用 `qrcode` 字段即可。
- 用途：打印/贴到座位桌角，或在小程序里给「该座位二维码」页面用。

**错误**：`40002` seatId 非正整数；`40402` 座位不存在。

## 7. 扫码签到（US-04）

`POST /api/reservations/checkin`　`Content-Type: application/json`

**Body**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | string | 是 | 预约人标识（openid/学号） |
| qrcode | string | 是 | 扫到的二维码原文，如 `LIBSEAT:ROOM:1:SEAT:A-02` |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/reservations/checkin \
  -H "Content-Type: application/json" \
  -d '{"userId":"202411701223","qrcode":"LIBSEAT:ROOM:1:SEAT:A-02"}'
```

**成功响应 `200`**（`data` 为预约详情，含展示字段）

```json
{
  "code": 0,
  "message": "签到成功",
  "data": {
    "id": 3,
    "reservationNo": "R202610227035",
    "status": "CHECKED_IN",
    "statusText": "使用中",
    "checkinTime": "2026-10-22 08:03",
    "seatNo": "A-02",
    "roomName": "一楼综合阅览室",
    "slotLabel": "上午",
    "...": "..."
  }
}
```

**业务规则（与验收标准 US-04 一一对应，校验顺序即错误码优先级）**

| 顺序 | 规则 | 违反时错误码 |
| --- | --- | --- |
| 1 | `userId`、`qrcode` 必填 | 40001 |
| 2 | 二维码格式必须是 `LIBSEAT:ROOM:{roomId}:SEAT:{seatNo}` | 40002 |
| 3 | 二维码指向的座位存在且未停用 | 40402 / 40903 |
| 4 | 该用户已有**该座位**的 `CHECKED_IN` 预约（重复扫码） | 50005 |
| 5 | 该用户存在待签到（`PENDING`）预约 | 50002 |
| 6 | 扫码座位 = 自己预约的座位 | 50003 |
| 7 | 当前时间在 `[开始时间 - 15 分钟, 开始时间 + 15 分钟]` 内 | 50001 |
| 8 | 并发下状态已被别人改走 | 50005 |

> 签到成功后座位图里该座位立即变 `IN_USE`（座位状态由预约记录实时推算，不是另存一份状态）。

## 8. 预约详情（US-03）

`GET /api/reservations/:id?userId=xxx`

**响应 data**：预约完整字段 + 展示字段（`roomName`/`seatNo`/`statusText`/`slotLabel`）+ 以下三个计算字段：

```json
{
  "id": 3,
  "status": "PENDING",
  "statusText": "待签到",
  "canCheckin": true,
  "canCancel": true,
  "checkinWindow": { "start": "2026-10-22 07:45", "end": "2026-10-22 08:15" },
  "...": "..."
}
```

- `canCheckin`：`PENDING` 且当前时间在签到窗口内 —— 前端用它决定「我要签到」按钮是否可点。
- `canCancel`：`PENDING`（其他状态都不能取消）。
- `checkinWindow`：签到窗口的起止时间，用于页面提示「请在 07:45–08:15 之间签到」。

**错误**：`40002` id 非正整数或缺 userId；`40403` 预约不存在**或不属于该 userId**（不暴露存在性）。

## 9. 取消预约（US-05）

`POST /api/reservations/:id/cancel`　`Content-Type: application/json`

**Body**：`{ "userId": "202411701223" }`（必填，用于校验预约归属）

**成功响应 `200`**

```json
{
  "code": 0,
  "message": "取消成功",
  "data": {
    "id": 3,
    "status": "CANCELLED",
    "statusText": "已取消",
    "cancelledAt": "2026-10-22 07:20",
    "seatReleased": true,
    "...": "..."
  }
}
```

**业务规则**

| 规则 | 违反时错误码 |
| --- | --- |
| userId 必填、id 为正整数 | 40001 / 40002 |
| 预约存在且属于该用户 | 40403 |
| 当前状态必须是 `PENDING`（`CHECKED_IN` 已使用、`CANCELLED`/`EXPIRED`/`COMPLETED` 为终态） | 50004 |
| 并发下状态已变化（被别人先签到/先取消） | 50004 |

> 取消后该座位同一时段**立即可以被任何人重新预约**（部分唯一索引只约束 `PENDING`/`CHECKED_IN`，历史记录保留）。PENDING 期间随时可取消，包含开始后 15 分钟宽限期内。

---

## 10. 错误码表

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
| 50001 | 409 | 不在签到时间窗口 | 不在签到时间窗口内（开始前 15 分钟至开始后 15 分钟） |
| 50002 | 409 | 无待签到预约 | 您当前没有待签到的预约 |
| 50003 | 409 | 扫码座位与预约座位不一致 | 座位号不匹配 |
| 50004 | 409 | 当前状态不可取消 | 当前预约状态不允许取消 |
| 50005 | 409 | 重复签到（同一座位已签到） | 该预约已签到，请勿重复扫码 |
| 50000 | 500 | 未捕获异常 | 服务器开小差了，请稍后重试 |

前端建议：`409xx` 用 toast 提示并刷新座位图（说明数据已变化）；`4xxxxx` 提示即可；`50000` 提示「请稍后重试」。

## 11. 小程序调用示例（第三棒可直接抄）

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

// 扫码签到（第二棒）：扫到的结果直接透传给后端，前端不解析二维码内容
wx.scanCode({
  success({ result }) {
    request('/reservations/checkin', { method: 'POST', data: { userId, qrcode: result } })
      .then((reservation) => wx.redirectTo({ url: `/pages/detail/index?id=${reservation.id}` }));
  },
});

// 预约详情（第二棒）：canCheckin / canCancel 直接用，别在前端重算窗口
request(`/reservations/${id}?userId=${userId}`)
  .then((detail) => this.setData({ detail }));

// 取消预约（第二棒）
request(`/reservations/${id}/cancel`, { method: 'POST', data: { userId } })
  .then(() => wx.showToast({ title: '已取消', icon: 'success' }));
```

注意：小程序正式版要求 `https` 且域名需备案；课堂演示用开发者工具勾选「不校验合法域名」即可。
