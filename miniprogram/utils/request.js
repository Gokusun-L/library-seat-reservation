// 统一请求封装（源自 backend/docs/API.md 第 11 节的示例，稍作增强）。
// 约定：所有接口响应 { code, message, data }；code===0 成功，message 可直接 toast。
const BASE_URL = 'http://localhost:3000/api';

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

module.exports = { request, BASE_URL };