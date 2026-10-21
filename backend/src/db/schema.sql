-- =========================================================
-- 高校图书馆座位预约系统 - 数据库建表脚本（SQLite 3）
-- 实验三 · 第一棒交付物（Task T4：预约数据库表）
-- 三张核心表：reading_room（阅览室）、seat（座位）、reservation（预约记录）
-- 说明：SQLite 方言；迁移到 MySQL 时把 TEXT 时间字段换成 DATETIME、
--       AUTOINCREMENT 换成 AUTO_INCREMENT 即可，约束语义一致。
-- =========================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- 1. 阅览室表
-- ---------------------------------------------------------
DROP TABLE IF EXISTS reservation;
DROP TABLE IF EXISTS seat;
DROP TABLE IF EXISTS reading_room;

CREATE TABLE reading_room (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    room_no      TEXT    NOT NULL UNIQUE,              -- 阅览室编号，如 'R101'
    name         TEXT    NOT NULL,                     -- 阅览室名称
    building     TEXT    NOT NULL,                     -- 所在楼栋
    floor        INTEGER NOT NULL DEFAULT 1,           -- 楼层
    open_time    TEXT    NOT NULL DEFAULT '08:00',     -- 开馆时间 HH:mm
    close_time   TEXT    NOT NULL DEFAULT '22:00',     -- 闭馆时间 HH:mm
    row_count    INTEGER NOT NULL,                     -- 座位布局行数
    col_count    INTEGER NOT NULL,                     -- 座位布局列数
    col_gap      TEXT    NOT NULL DEFAULT '[]',        -- 过道列（JSON 数组，如 [4,8]），用于座位图渲染
    status       TEXT    NOT NULL DEFAULT 'OPEN',      -- OPEN 开放 / CLOSED 关闭
    description  TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
);

-- ---------------------------------------------------------
-- 2. 座位表
-- ---------------------------------------------------------
CREATE TABLE seat (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id     INTEGER NOT NULL,                      -- 所属阅览室
    seat_no     TEXT    NOT NULL,                      -- 座位号，如 'A-12'
    row_index   INTEGER NOT NULL,                      -- 行号（从 1 开始）
    col_index   INTEGER NOT NULL,                      -- 列号（从 1 开始）
    seat_type   TEXT    NOT NULL DEFAULT 'NORMAL',     -- NORMAL 普通 / POWER 带电源 / WINDOW 靠窗
    qrcode      TEXT    NOT NULL UNIQUE,               -- 座位二维码内容（第二棒扫码签到使用）
    status      TEXT    NOT NULL DEFAULT 'ENABLED',    -- ENABLED 可用 / DISABLED 停用
    created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (room_id) REFERENCES reading_room (id) ON DELETE CASCADE,
    UNIQUE (room_id, seat_no),
    UNIQUE (room_id, row_index, col_index)
);

CREATE INDEX idx_seat_room ON seat (room_id);

-- ---------------------------------------------------------
-- 3. 预约记录表
-- ---------------------------------------------------------
CREATE TABLE reservation (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    reservation_no TEXT    NOT NULL UNIQUE,            -- 预约单号，如 'R20261021001'
    user_id        TEXT    NOT NULL,                   -- 预约人（小程序 openid / 学号）
    user_name      TEXT,                               -- 预约人姓名（冗余，便于列表展示）
    room_id        INTEGER NOT NULL,
    seat_id        INTEGER NOT NULL,
    reserve_date   TEXT    NOT NULL,                   -- 预约日期 YYYY-MM-DD
    slot           TEXT    NOT NULL,                   -- 时间段 MORNING / AFTERNOON / EVENING
    start_time     TEXT    NOT NULL,                   -- 预约开始时间 YYYY-MM-DD HH:mm
    end_time       TEXT    NOT NULL,                   -- 预约结束时间 YYYY-MM-DD HH:mm
    status         TEXT    NOT NULL DEFAULT 'PENDING', -- PENDING 待签到 / CHECKED_IN 使用中 / COMPLETED 已完成 / CANCELLED 已取消 / EXPIRED 超时释放
    checkin_time   TEXT,                               -- 实际签到时间（第二棒）
    cancelled_at   TEXT,                               -- 取消时间（第二棒）
    created_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at     TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (room_id) REFERENCES reading_room (id),
    FOREIGN KEY (seat_id) REFERENCES seat (id),
    CHECK (status IN ('PENDING', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED'))
);

-- 查询索引：按用户查“我的预约”、按座位查某时段占用情况
CREATE INDEX idx_reservation_user     ON reservation (user_id, reserve_date, slot);
CREATE INDEX idx_reservation_seat     ON reservation (seat_id, reserve_date, slot, status);
CREATE INDEX idx_reservation_room     ON reservation (room_id, reserve_date, slot, status);
CREATE INDEX idx_reservation_status   ON reservation (status);

-- 业务唯一约束（防并发双写，服务层校验的兜底）：
--   ① 一个座位在同一日期同一时段只能有一条“有效”预约
CREATE UNIQUE INDEX uk_reservation_seat_slot
    ON reservation (seat_id, reserve_date, slot)
    WHERE status IN ('PENDING', 'CHECKED_IN');

--   ② 一个用户在同一日期同一时段只能有一条“有效”预约（重复预约校验）
CREATE UNIQUE INDEX uk_reservation_user_slot
    ON reservation (user_id, reserve_date, slot)
    WHERE status IN ('PENDING', 'CHECKED_IN');
