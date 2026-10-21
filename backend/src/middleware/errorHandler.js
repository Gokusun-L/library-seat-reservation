/**
 * 全局错误处理 & 404 兜底
 * 目标：任何异常都不会把堆栈直接吐给前端，前端永远只处理 { code, message } 这一种结构。
 */
const { BizError } = require('../utils/BizError');
const { ERROR_CODE, ERROR_MESSAGE, httpStatusOf } = require('../constants/errorCode');
const { fail } = require('../utils/response');

/** 未匹配到任何路由 */
function notFoundHandler(req, res) {
  res.status(404).json(fail(ERROR_CODE.ROUTE_NOT_FOUND, `接口 ${req.method} ${req.path} 不存在`));
}

/** 统一异常出口（Express 通过 4 个参数识别错误中间件，next 不可省） */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof BizError) {
    const message = err.message || ERROR_MESSAGE[err.code] || '请求处理失败';
    return res.status(httpStatusOf(err.code)).json(fail(err.code, message));
  }
  // JSON 解析失败等框架级错误
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json(fail(ERROR_CODE.PARAM_INVALID, '请求体不是合法的 JSON'));
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error('[UNHANDLED]', err);
  }
  return res
    .status(500)
    .json(fail(ERROR_CODE.INTERNAL_ERROR, ERROR_MESSAGE[ERROR_CODE.INTERNAL_ERROR]));
}

module.exports = { notFoundHandler, errorHandler };
