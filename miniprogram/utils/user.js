// 当前登录用户（第五棒收口）
// 第一棒约定：小程序阶段未接 wx.login，所有涉及用户的接口用 userId 显式传递。
// 接入登录后只改本文件：把 DEMO_* 换成 wx.login 换回的 openid / 学号即可，
// 页面里不要再各自写死 userId（第四棒的 checkin 页已统一到这里）。
const DEMO_USER_ID = '202411701223';
const DEMO_USER_NAME = '温佳鑫';

function currentUser() {
  return { userId: DEMO_USER_ID, userName: DEMO_USER_NAME };
}

module.exports = { DEMO_USER_ID, DEMO_USER_NAME, currentUser };
