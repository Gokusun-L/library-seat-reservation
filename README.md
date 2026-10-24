# 高校图书馆座位预约系统 · 后端服务

实验三（敏捷开发接力）后端交付物：**第一棒** 数据底座 + 预约主流程，**第二棒** 签到 / 取消 / 详情 / 超时释放。

- 项目背景：广东海洋大学图书馆座位预约微信小程序，学生预约座位、到馆扫码签到、超时自动释放。
- 已完成范围：三张表结构、9 个接口、预约与重复预约校验、签到与履约链路、接口约定（字段 + 错误码）、单元测试（41 例）。
- 下一棒：前端展示层（阅览室列表 + 座位图），见 [docs/HANDOFF2.md](backend/docs/HANDOFF2.md)。
- 分工与工时：见 [docs/ROLES.md](docs/ROLES.md)。

## 技术栈

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 运行时 | Node.js ≥ 20 | 组内成员本机都有，`npm i` 即可跑；20/22/24 均已验证（better-sqlite3 12 提供预编译二进制，无需本地编译） |
| Web 框架 | Express 4 | 路由/中间件模型简单，接第二棒成本低 |
| 数据库 | SQLite（better-sqlite3） | 免安装服务、单文件可随仓库/演示拷贝；SQL 与 MySQL 高度兼容，后续换 MySQL 只需改连接层 |
| 测试 | node:test + supertest | Node 内置测试运行器，零额外框架配置 |
| 二维码 | qrcode ^1.5.4 | 纯 JS 生成座位二维码 PNG（base64），无原生编译依赖 |
| 规范 | ESLint（eslint:recommended） | 满足团队 DoD 第 2 条「通过 ESLint 检查、无告警」 |

## 快速开始

```bash
cd backend
npm install          # 安装依赖
npm start            # 启动服务，默认 http://localhost:3000
npm test             # 运行单元测试（41 个用例）
npm run lint         # 代码规范检查
npm run init:db      # 重置数据库并重新灌入演示数据（会清空现有预约）
```

首次启动会自动建表并写入演示数据：3 个阅览室、124 个座位、2 条今天的演示预约（让座位图三态都有颜色）。
服务启动后还会挂一个**每 60 秒**的履约维护任务：超时未签到 → `EXPIRED`，过结束时间 → `COMPLETED`（US-06）。

自定义端口：`PORT=8080 npm start`（Windows PowerShell：`$env:PORT=8080; npm start`）。

## 目录结构

```
backend/
├─ src/
│  ├─ app.js                    # Express 装配（与启动分离，便于测试）
│  ├─ server.js                 # 入口：建表 → 灌种子数据 → 监听端口
│  ├─ constants/
│  │  ├─ business.js            # 时间段 / 预约状态 / 座位三态 / 座位类型枚举
│  │  └─ errorCode.js           # 全局错误码表 + 默认文案 + 业务码→HTTP 状态码
│  ├─ db/
│  │  ├─ schema.sql             # 三张表建表脚本（含索引与唯一约束）
│  │  ├─ index.js               # 连接、建表、重置
│  │  └─ seed.js                # 演示数据（阅览室/座位/演示预约）
│  ├─ dao/                      # 只写 SQL，不含业务判断
│  │  ├─ readingRoomDao.js
│  │  ├─ seatDao.js             # 含 findByRoomAndNo / buildQrcode（扫码签到用）
│  │  └─ reservationDao.js      # 含 updateStatus / updateStatusIf(CAS) / findExpiredPending / findCheckedInFinished
│  ├─ service/                  # 业务规则、参数与冲突校验
│  │  ├─ readingRoomService.js
│  │  ├─ reservationService.js
│  │  ├─ checkinService.js       # 第二棒：二维码 / 签到 / 取消 / 详情
│  │  └─ maintenanceService.js   # 第二棒：超时释放 + 自动完成（US-06）
│  ├─ routes/
│  │  ├─ roomRoutes.js
│  │  ├─ seatRoutes.js           # 第二棒：座位二维码
│  │  ├─ reservationRoutes.js
│  │  └─ metaRoutes.js
│  ├─ middleware/errorHandler.js # 统一异常出口 + 404 兜底
│  └─ utils/                    # BizError / response / time
├─ test/
│  ├─ reservation.test.js       # 预约接口 17 个用例
│  ├─ room.test.js              # 阅览室与座位图 7 个用例
│  ├─ checkin.test.js           # 第二棒：二维码/签到/取消/详情 14 个用例
│  └─ maintenance.test.js       # 第二棒：维护任务 3 个用例
├─ scripts/init-db.js
└─ docs/                        # API.md / DB.md / HANDOFF.md / HANDOFF2.md
```

分层原则：**route 只负责取参 → service 负责规则 → dao 只碰 SQL**。任何人加接口都按这个顺序落文件，第二棒不需要理解别人的代码也能加功能。

## 接口总览（9 个接口：第一棒 5 + 第二棒 4）

| # | 方法 | 路径 | 说明 | 对应故事 |
| --- | --- | --- | --- | --- |
| 1 | GET | `/api/reading-rooms` | 阅览室列表（含剩余座位数） | US-01a |
| 2 | GET | `/api/reading-rooms/:roomId/layout` | 座位布局（静态骨架） | US-01b |
| 3 | GET | `/api/reading-rooms/:roomId/seats` | 座位状态（空闲/已预约/使用中/停用） | US-01b |
| 4 | POST | `/api/reservations` | 创建预约（含冲突与重复预约校验） | US-02 |
| 5 | GET | `/api/reservations` | 我的预约列表 | US-03 |
| 6 | GET | `/api/seats/:seatId/qrcode` | 座位二维码（原文 + base64 图片） | US-04 |
| 7 | POST | `/api/reservations/checkin` | 扫码签到（前后 15 分钟窗口校验） | US-04 |
| 8 | GET | `/api/reservations/:id` | 预约详情（含 `canCheckin` / `canCancel`） | US-03 |
| 9 | POST | `/api/reservations/:id/cancel` | 取消预约（立即释放座位） | US-05 |

辅助接口：`GET /api/health`、`GET /api/meta/slots`、`GET /api/meta/status`（给前端取枚举，避免硬编码）。

字段级说明与错误码见 [backend/docs/API.md](backend/docs/API.md)，表结构见 [backend/docs/DB.md](backend/docs/DB.md)。

## 关键设计说明

1. **座位实时状态不落库**：`seat.status` 只表示「可用/停用」这种物理属性；「某时段空闲还是被占」由 `reservation` 表按日期+时段实时推算。避免双写导致状态不一致（这是座位系统最常见的一类脏数据）。
2. **重复预约两道防线**：Service 层先查再报友好错误码（用户能看到「同一时段只能预约一个座位」），数据库再加两个**部分唯一索引**兜底并发（同一座位、同一用户，在 PENDING/CHECKED_IN 状态下唯一）。只靠先查后插，两个人同时点会一起通过检查。
3. **取消/超时后座位可再约**：唯一索引带 `WHERE status IN ('PENDING','CHECKED_IN')`，所以 CANCELLED / EXPIRED 的历史记录不会挡住新预约——既保留完整预约历史，又不影响座位复用。
4. **状态枚举前后端共用一份**：`constants/business.js` 是唯一真源，`/api/meta/*` 直接吐给前端，杜绝「后端起名 MORNING、前端传 morning」。
5. **错误码分段管理**：4xxxx = 参数/资源/冲突（第一棒），5xxxx = 签到/取消/详情（第二棒）。追加不改号，前端判断逻辑不会被后续接力打断。
6. **状态流转一律 CAS**：签到、取消、超时释放都用 `UPDATE ... WHERE id=? AND status=?`（`reservationDao.updateStatusIf`），命中 0 行即视为非法流转并报 50004/50005。只靠 Service 先查后改，并发下会出现「同一预约被签到两次」。
7. **履约维护走定时任务而非懒触发**：`maintenanceService` 每 60 秒扫一遍（`NODE_ENV=test` 时不自启），所以「超时释放」不依赖任何人访问接口；多实例同时跑也安全，因为每一步都是 CAS。
8. **签到窗口单一来源**：`CHECKIN_WINDOW_MINUTES` 在 `constants/business.js`，签到校验、超时扫描、`/api/meta/status` 三处都读它，避免「代码里 15 分钟、文档里 10 分钟」。

## 测试情况

```
# tests 41   # pass 41   # fail 0
```

覆盖：正常预约、座位冲突、重复预约、必填/格式/非法值校验、资源不存在、座位归属校验、停用座位、过去时段、超出提前期、并发抢座（Promise.all）、取消后可再约、列表分页、座位三态统计守恒、阅览室筛选、健康检查；第二棒新增：二维码内容与图片、签到成功与座位图联动、提前/迟到与 ±15 分钟窗口边界、无待签到、座位不匹配、重复签到、停用座位签到、二维码格式非法、取消成功且座位可再约、非 PENDING 取消、越权访问、详情计算字段、超时释放、自动完成、维护任务幂等。

## 团队协作

GitHub 存代码 + PingCode 管需求/任务/缺陷的完整流程，见 [docs/COLLAB.md](docs/COLLAB.md)；五棒分工与工时见 [docs/ROLES.md](docs/ROLES.md)。
# 第三棒实验报告草稿（成员 3 · 前端列表与座位图展示层）

> 说明：本稿按后端已实现的接口与业务规则编写，字段/错误码与 `backend/docs/API.md` 一致。
> 提交前请替换【】里的占位内容（编号、人名、日期、点数），并确认与团队前两棒格式对齐。

---

## 一、用户故事 US-01 ~ US-04

### US-01a 阅览室列表
作为【学生】，我想【浏览图书馆所有阅览室并看到每个阅览室的剩余空位数】，以便【快速选择要去的学习区域】。

### US-01b 座位分布图
作为【学生】，我想【查看某阅览室的座位分布图并看到每个座位的占用状态】，以便【找到空座位的位置】。

### US-02 预约座位
作为【学生】，我想【预约指定日期和时段的某个座位】，以便【到馆后能有确定的座位可用】。

### US-03 我的预约
作为【学生】，我想【查看我的预约列表和预约详情】，以便【确认预约的时间、地点和当前状态（能否签到/取消）】。

### US-04 扫码签到
作为【学生】，我想【在到馆后扫描座位上的二维码完成签到】，以便【开始使用已预约的座位】。

---

## 二、验收标准 US-04 + US-05

> 格式：Given（给定）/ When（当）/ Then（那么）。以下验收标准均已在后端实现并通过单元测试，前端由第四棒对接。

### US-04 扫码签到

- **AC-01**：给定我已预约某座位，当我在「开始前 15 分钟 至 开始后 15 分钟」内提交正确的签到码，那么签到成功，预约状态变为 `CHECKED_IN`（使用中）。
- **AC-02**：给定当前不在签到时间窗口内，当我提交签到码，那么系统返回错误码 `50001`，提示「不在签到时间窗口内」。
- **AC-03**：给定我扫码的座位与预约座位不一致，当我提交签到，那么系统返回 `50003`，提示「座位号不匹配」。
- **AC-04**：给定该预约已经签到，当我再次扫码，那么系统返回 `50005`，提示「该预约已签到，请勿重复扫码」。
- **AC-05**：给定我当前没有待签到的预约，当我扫码，那么系统返回 `50002`，提示「您当前没有待签到的预约」。
- **AC-06**：给定签到码格式非法，那么系统返回参数错误（`400xx`）。

### US-05 取消预约

- **AC-01**：给定我的预约状态为 `PENDING`（待签到），当我取消，那么取消成功，状态变为 `CANCELLED`，该座位在同一时段**立即可被他人重新预约**。
- **AC-02**：给定我的预约状态为 `CHECKED_IN` / `COMPLETED` / `CANCELLED` / `EXPIRED`，当我取消，那么系统返回 `50004`，提示「当前预约状态不允许取消」。
- **AC-03**：给定我取消的不是自己名下的预约，那么系统返回 `40403`（预约记录不存在，防越权）。
- **AC-04**：给定并发下该预约已被他人先签到/先取消，那么取消失败并返回 `50004`（CAS 兜底）。

---

## 三、Task 分解 US-01b（座位分布图）

| 子任务 | 内容 | 依赖接口/说明 | 估算工时 |
| --- | --- | --- | --- |
| T1 | 拉取并缓存座位布局静态骨架 | `GET /api/reading-rooms/:roomId/layout`（行列、colGap 过道列） | 2h |
| T2 | 渲染行列网格，处理过道间距 | 按 `colGap` 在对应列后留空 | 2h |
| T3 | 座位状态三态配色 | `status`: FREE 绿 / RESERVED 黄 / IN_USE 红 / DISABLED 灰 | 1h |
| T4 | 座位信息弹窗 | 点座位显示座位号/类型/状态；DISABLED 不可点 | 1h |
| T5 | 空座位筛选 | 前端按 `status === 'FREE'` 过滤/淡化 | 0.5h |
| T6 | 响应式适配 | 全部使用 rpx，多机型不错位 | 0.5h |
| — | **合计** | 对应第三棒座位图相关工时 | **7h** |

> 备注：US-01b 的实际编码总量为 6（渲染组件）+3（配色）+3（弹窗）+2（筛选）+2（适配）= 16h，上表为按任务拆分后的工时估算，请按团队 Planning Poker 的点数口径调整。

---

## 附：给第四棒的交接说明（可直接粘贴）

> 前端代码在仓库 `miniprogram/` 目录，微信开发者工具直接导入即可。
> 后端地址默认 `http://localhost:3000`（见 `miniprogram/utils/request.js` 的 BASE_URL）。
> 已完成：阅览室列表页、座位图组件、三态配色、座位信息弹窗、空位筛选。
> 未做（留给第四棒）：预约按钮目前仅 toast 占位、扫码签到、取消预约、我的预约列表/详情页。
> 约定：枚举走 `/api/meta/*` 不要硬编码；座位状态切日期/时段必须重新请求；时间一律透传后端字符串。  
