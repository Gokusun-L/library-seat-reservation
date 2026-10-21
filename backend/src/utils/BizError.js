/**
 * 业务异常：Service 层只负责「抛」，由统一错误中间件转成标准响应体。
 * 好处：Service 不需要关心 HTTP，也不需要到处 if/else 拼 res。
 *
 * 默认文案统一取自 errorCode.js，保证「同一个错误码，任何接口提示都一致」。
 */
const { ERROR_MESSAGE } = require('../constants/errorCode');

class BizError extends Error {
  /**
   * @param {number} code 业务错误码（见 constants/errorCode.js）
   * @param {string} [message] 自定义提示；不传则用该错误码的标准文案
   * @param {object} [detail] 附加信息（调试用，非必要不返回给前端）
   */
  constructor(code, message, detail) {
    super(message || ERROR_MESSAGE[code] || `业务错误 ${code}`);
    this.name = 'BizError';
    this.code = code;
    this.detail = detail;
  }
}

module.exports = { BizError };
