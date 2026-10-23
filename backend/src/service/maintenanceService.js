/**
 * 履约维护任务（US-06：超时自动释放 + 到点自动完成）
 *
 * 两件事都走 CAS（updateStatusIf），所以即使多进程/多实例同时跑也不会重复改：
 *   ① PENDING 且已过「开始 + 15 分钟」→ EXPIRED（座位重新可约）
 *   ② CHECKED_IN 且已过结束时间 → COMPLETED（释放座位同时保留使用记录）
 *
 * 说明：定时器只在 server.js 里启动；测试环境（NODE_ENV=test）不启动，直接调 runOnce()。
 */
const reservationDao = require('../dao/reservationDao');
const { RESERVATION_STATUS } = require('../constants/business');
const time = require('../utils/time');

/** 默认扫描间隔：1 分钟（与 HANDOFF.md 建议一致） */
const DEFAULT_INTERVAL_MS = 60 * 1000;

/**
 * 跑一次扫描
 * @param {string} [now] 'YYYY-MM-DD HH:mm'，默认服务器当前时间；测试可注入
 * @returns {{expired:number, completed:number}} 本次实际改动的条数
 */
function runOnce(now = time.now()) {
  let expired = 0;
  for (const reservation of reservationDao.findExpiredPending(now)) {
    const changed = reservationDao.updateStatusIf(
      reservation.id,
      RESERVATION_STATUS.PENDING,
      RESERVATION_STATUS.EXPIRED
    );
    if (changed) expired += 1;
  }

  let completed = 0;
  for (const reservation of reservationDao.findCheckedInFinished(now)) {
    const changed = reservationDao.updateStatusIf(
      reservation.id,
      RESERVATION_STATUS.CHECKED_IN,
      RESERVATION_STATUS.COMPLETED
    );
    if (changed) completed += 1;
  }

  if (expired || completed) {
    console.log(`[maintenance] 超时释放 ${expired} 条，自动完成 ${completed} 条（${now}）`);
  }
  return { expired, completed };
}

/**
 * 启动定时扫描（由 server.js 调用）
 * @returns {NodeJS.Timeout|null} 测试环境返回 null
 */
function startScheduler({ intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (process.env.NODE_ENV === 'test') return null;

  try {
    runOnce();
  } catch (err) {
    console.error('[maintenance] 启动首跑失败：', err);
  }

  const timer = setInterval(() => {
    try {
      runOnce();
    } catch (err) {
      // 单次失败不能让定时器挂掉，下个周期继续
      console.error('[maintenance] 定时扫描失败：', err);
    }
  }, intervalMs);

  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { runOnce, startScheduler, DEFAULT_INTERVAL_MS };
