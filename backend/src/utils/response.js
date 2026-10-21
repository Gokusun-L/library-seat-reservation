/**
 * 统一响应体
 *  成功：{ code: 0, message: 'ok', data: ... }
 *  失败：{ code: 4xxxx, message: '给用户看的提示' }
 * 小程序端统一取 res.data.code 判断即可，不需要依赖 HTTP 状态码（但状态码也是正确的）。
 */
function ok(data = null, message = 'ok') {
  return { code: 0, message, data };
}

function fail(code, message) {
  return { code, message };
}

module.exports = { ok, fail };
