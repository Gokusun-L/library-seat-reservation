/**
 * 服务入口：初始化数据库 → 启动 HTTP 服务
 * 启动方式：npm start（默认 3000 端口，可用 PORT 覆盖）
 */
const { createApp } = require('./app');
const { initDatabase, resolveDbFile } = require('./db');
const seed = require('./db/seed');
const maintenanceService = require('./service/maintenanceService');

const PORT = Number(process.env.PORT) || 3000;

initDatabase();
// 首次启动自动灌入演示数据（阅览室 + 座位），已有数据则跳过
seed.ensureSeedData();

const app = createApp();

const server = app.listen(PORT, () => {
  console.log('==============================================');
  console.log(' 图书馆座位预约系统 - 后端服务已启动');
  console.log(` 接口地址：http://localhost:${PORT}/api`);
  console.log(` 数据库文件：${resolveDbFile()}`);
  console.log(' 健康检查：GET /api/health');
  console.log('==============================================');
});

// US-06：每 60 秒扫描一次，超时未签到 → EXPIRED，已过结束时间 → COMPLETED
const maintenanceTimer = maintenanceService.startScheduler();

// 优雅退出：关闭 HTTP 连接，避免端口占用导致下次启动失败
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n收到 ${sig}，正在关闭服务...`);
    if (maintenanceTimer) clearInterval(maintenanceTimer);
    server.close(() => process.exit(0));
  });
}
