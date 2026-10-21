/**
 * 手动初始化数据库：npm run init:db
 * 会删表重建并灌入演示数据，慎用（有数据时先备份 data/library.db）
 */
const { resetDatabase, resolveDbFile } = require('../src/db');
const seed = require('../src/db/seed');

resetDatabase();
const result = seed.ensureSeedData();
console.log('数据库已重置：', resolveDbFile());
console.log('演示数据：', result.skipped ? '已存在，跳过' : `已创建 ${result.rooms.length} 个阅览室`);
