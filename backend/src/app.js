/**
 * Express 应用装配（与启动分离，方便单元测试直接 require app 而不用监听端口）
 */
const express = require('express');
const roomRoutes = require('./routes/roomRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const metaRoutes = require('./routes/metaRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  // 简易访问日志：排查联调问题足够，生产可换 morgan / winston
  if (process.env.NODE_ENV !== 'test') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(
          `[${new Date().toLocaleTimeString('zh-CN')}] ${req.method} ${req.originalUrl} ` +
            `→ ${res.statusCode} (${Date.now() - start}ms)`
        );
      });
      next();
    });
  }

  app.use('/api', metaRoutes);
  app.use('/api/reading-rooms', roomRoutes);
  app.use('/api/reservations', reservationRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
