/**
 * 数据库连接与初始化
 * - 开发/演示使用 SQLite 单文件库（data/library.db），无需安装 MySQL 即可跑通；
 * - 建表脚本即 src/db/schema.sql，迁移到 MySQL 时表结构语义一致；
 * - initDatabase() 幂等：表已存在则复用，不清数据；对外提供 resetDatabase() 供测试用。
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.resolve(__dirname, '../..');

/** 允许通过环境变量指定库文件（测试用 :memory:） */
function resolveDbFile() {
  if (process.env.DB_FILE) return process.env.DB_FILE;
  const dataDir = path.join(ROOT, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, 'library.db');
}

let db = null;

/** 获取单例连接（首次调用时创建并开启外键约束） */
function getDb() {
  if (db) return db;
  const file = resolveDbFile();
  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/** 建表（幂等） */
function initDatabase() {
  const conn = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  // schema.sql 内含 DROP TABLE，仅在显式重置时使用；此处只建不删
  const createOnly = schema.replace(/^DROP TABLE IF EXISTS .*;$/gm, '');
  // 把 CREATE TABLE 改成 IF NOT EXISTS，保证重复启动不报错
  const idempotent = createOnly
    .replace(/CREATE TABLE (\w+)/g, 'CREATE TABLE IF NOT EXISTS $1')
    .replace(/CREATE INDEX (\w+)/g, 'CREATE INDEX IF NOT EXISTS $1')
    .replace(/CREATE UNIQUE INDEX (\w+)/g, 'CREATE UNIQUE INDEX IF NOT EXISTS $1');
  conn.exec(idempotent);
  return conn;
}

/** 重置数据库：删表重建（仅测试 / 初始化演示数据时使用） */
function resetDatabase() {
  const conn = getDb();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  conn.exec(schema);
  return conn;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, initDatabase, resetDatabase, closeDb, resolveDbFile };
