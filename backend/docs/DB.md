# 数据库设计说明（第一棒交接版）

数据库：SQLite 3（`better-sqlite3`），建表脚本：[`src/db/schema.sql`](../src/db/schema.sql)。
迁移到 MySQL 8：`INTEGER PRIMARY KEY AUTOINCREMENT` → `INT AUTO_INCREMENT PRIMARY KEY`，`TEXT` 时间字段 → `DATETIME`，其余语义一致（部分唯一索引 MySQL 不支持，需用触发器或事务 + `SELECT ... FOR UPDATE` 替代）。

## 1. 表关系

```
reading_room 1 ──── n seat 1 ──── n reservation
     1 ─────────────────────────── n
```

- `reading_room` 1 : n `seat`：一个阅览室按 `row_count × col_count` 生成座位；
- `seat` 1 : n `reservation`：同一座位在不同日期/时段可被反复预约；
- `reservation` 同时冗余 `room_id`，用于按阅览室批量查占用（座位图接口一次查询，避免 N+1）。

## 2. reading_room（阅览室）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| room_no | TEXT UNIQUE | 阅览室编号 R101/R201 |
| name | TEXT | 名称 |
| building | TEXT | 楼栋 |
| floor | INTEGER | 楼层 |
| open_time / close_time | TEXT `HH:mm` | 开放时间，用于校验预约时段是否合法 |
| row_count / col_count | INTEGER | 座位图行列数 |
| col_gap | TEXT(JSON) | 过道列号数组，如 `[4]`，前端渲染时留空 |
| status | TEXT | `OPEN` / `CLOSED` |
| description | TEXT | 简介 |
| created_at / updated_at | TEXT | 创建/更新时间 |

## 3. seat（座位）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键，即前端传的 `seatId` |
| room_id | INTEGER FK | 所属阅览室，级联删除 |
| seat_no | TEXT | 座位号 `A-01`，`UNIQUE(room_id, seat_no)` |
| row_index / col_index | INTEGER | 行列坐标，`UNIQUE(room_id, row_index, col_index)` |
| seat_type | TEXT | `NORMAL` / `POWER` / `WINDOW` |
| qrcode | TEXT UNIQUE | 二维码内容 `LIBSEAT:ROOM:{roomId}:SEAT:{seatNo}`，第二棒扫码签到按此解析 |
| status | TEXT | `ENABLED` / `DISABLED`（物理可用性，**不表示某时段是否被占**） |

两个 UNIQUE 约束保证「座位图不会出现两个座位占同一个格子」。

## 4. reservation（预约记录）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INTEGER PK | 自增主键 |
| reservation_no | TEXT UNIQUE | 预约单号 `R + yyyyMMdd + 4 位随机` |
| user_id | TEXT | 预约人（openid / 学号） |
| user_name | TEXT | 姓名（冗余，列表展示免联表） |
| room_id / seat_id | INTEGER FK | 阅览室 / 座位 |
| reserve_date | TEXT `YYYY-MM-DD` | 预约日期 |
| slot | TEXT | `MORNING` / `AFTERNOON` / `EVENING` |
| start_time / end_time | TEXT `YYYY-MM-DD HH:mm` | 由日期 + 时段推导后落库，便于签到窗口计算与排序 |
| status | TEXT + CHECK | 五态：`PENDING`/`CHECKED_IN`/`COMPLETED`/`CANCELLED`/`EXPIRED` |
| checkin_time | TEXT | 实际签到时间（第二棒写入） |
| cancelled_at | TEXT | 取消时间（第二棒写入） |
| created_at / updated_at | TEXT | 创建/更新时间 |

### 索引

| 名称 | 字段 | 用途 |
| --- | --- | --- |
| idx_reservation_user | user_id, reserve_date, slot | 我的预约、重复预约校验 |
| idx_reservation_seat | seat_id, reserve_date, slot, status | 查某座位某时段是否被占 |
| idx_reservation_room | room_id, reserve_date, slot, status | 座位图批量查占用 |
| idx_reservation_status | status | 超时释放定时任务扫描 |
| uk_reservation_seat_slot | **部分唯一**：seat_id, reserve_date, slot WHERE status IN ('PENDING','CHECKED_IN') | 防并发重复占同一座位 |
| uk_reservation_user_slot | **部分唯一**：user_id, reserve_date, slot WHERE status IN ('PENDING','CHECKED_IN') | 防同一用户同段重复预约 |

### 为什么用「部分唯一索引」而不是普通唯一索引

普通唯一索引会把已取消（CANCELLED）、已超时（EXPIRED）的历史记录也算进去，导致「取消后同一座位/同一时段再也约不上」。加上 `WHERE status IN ('PENDING','CHECKED_IN')` 后：

- 有效预约之间互斥 → 并发安全；
- 历史记录保留 → 可做违约统计（US-07）；
- 取消/超时后座位立即可被复用 → 符合验收标准 US-05。

## 5. 状态机（跨棒约定）

```
                 ┌──── 取消（US-05，第二棒） ────► CANCELLED
PENDING ─────────┤
（预约成功）      ├──── 扫码签到（US-04，第二棒）──► CHECKED_IN ──► COMPLETED
                 └──── 超时未到（US-06，第二棒）──► EXPIRED
```

- 只有 `PENDING` 允许 → `CHECKED_IN` / `CANCELLED` / `EXPIRED`；
- `CHECKED_IN` 只能 → `COMPLETED`；
- `CANCELLED` / `EXPIRED` / `COMPLETED` 为终态，不再占用座位。
