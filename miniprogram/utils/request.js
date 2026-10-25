// 统一请求封装（源自 backend/docs/API.md 第 11 节的示例，稍作增强）。
// 约定：所有接口响应 { code, message, data }；code===0 成功，message 可直接 toast。
const BASE_URL = 'http://localhost:3000/api';

/**
 * 判断是否为「数据已变化」类冲突错误（409xx）。
 * API.md 第 10 节：409xx 说明座位/预约状态已被别人改过，调用方应当刷新数据；
 * 5xxxxx 只提示、不刷新；400xx 提示即可。
 * 封装只负责识别，刷新哪一份数据由页面决定（列表页刷列表、座位页刷座位图）。
 */
function isConflictError(err) {
  const code = err && err.code;
  return typeof code === 'number' && code >= 40900 && code < 41000;
}

function request(path, { method = 'GET', data = {} } = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        const body = res.data || {};
        if (body.code === 0) return resolve(body.data);
        // 409xx：数据已变化（如座位刚被抢），提示后由调用方决定是否刷新
        wx.showToast({ title: body.message || '请求失败', icon: 'none' });
        reject(body);
      },
      fail(err) {
        wx.showToast({ title: '网络异常，请检查后端是否启动', icon: 'none' });
        reject(err);
      },
    });
  });
}

module.exports = { request, isConflictError, BASE_URL };
