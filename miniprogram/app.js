// 小程序入口。
// 说明：第一/二棒后端尚未接入微信登录，所有涉及用户的接口都通过 userId 显式传递。
// 这里先放一个固定的演示 userId，等登录态接入后（后续棒次）再换成 wx.login 换 openid 的逻辑。
App({
  globalData: {
    // 演示用 userId，与 seed.js 里的 demo-stu-001/002 区分开，避免误撞已有预约
    userId: 'demo-stu-003',
  },
});