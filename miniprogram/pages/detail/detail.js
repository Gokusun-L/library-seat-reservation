// 预约详情页（US-03 / US-05，第五棒）
// 依赖接口：
//   GET  /api/reservations/:id?userId=   详情，含 canCheckin / canCancel / checkinWindow
//   POST /api/reservations/:id/cancel    取消预约（body: { userId }）
// 约定：签到窗口与按钮可用性一律用后端返回的 canCheckin / canCancel，前端不自己算时间。
const { request, isConflictError } = require('../../utils/request');
const { currentUser } = require('../../utils/user');

// 顶部状态提示文案：只用后端返回的状态与计算字段判断，不在前端重算签到窗口
function hintOf(detail) {
  if (!detail) return '';
  const win = detail.checkinWindow || {};
  if (detail.canCheckin) {
    return `现在可以签到，请在 ${win.start} - ${win.end} 之间扫座位二维码`;
  }
  switch (detail.status) {
    case 'PENDING':
      return win.start ? `尚未到签到时间，请在 ${win.start} 之后到馆扫码` : '请在签到窗口内到馆扫码';
    case 'CHECKED_IN':
      return '已签到，祝学习顺利';
    case 'COMPLETED':
      return '本次使用已完成';
    case 'CANCELLED':
      return '该预约已取消，座位已释放给其他同学';
    case 'EXPIRED':
      return '超时未签到，座位已被系统自动释放';
    default:
      return '';
  }
}

Page({
  data: {
    id: null,
    userId: '',
    detail: null,
    hint: '',
    loading: false,
    loadError: false,
    submitting: false,
  },

  onLoad(options) {
    const { userId } = currentUser();
    this.setData({ id: Number(options.id), userId });
  },

  onShow() {
    // 从扫码签到页返回后需要刷新（签到会改变 status / canCheckin / canCancel）
    if (this.data.id) this.fetchDetail();
  },

  onPullDownRefresh() {
    this.fetchDetail().then(() => wx.stopPullDownRefresh());
  },

  fetchDetail() {
    const { id, userId } = this.data;
    if (!id) return Promise.resolve();
    this.setData({ loading: true, loadError: false });
    return request(`/reservations/${id}?userId=${encodeURIComponent(userId)}`)
      .then((detail) => this.setData({ detail, hint: hintOf(detail), loading: false }))
      .catch(() => this.setData({ loading: false, loadError: true }));
  },

  onRetry() {
    this.fetchDetail();
  },

  // 签到：跳扫码页（第四棒已实现扫码与 50003 二次确认）
  onCheckin() {
    wx.navigateTo({ url: '/pages/checkin/checkin' });
  },

  // 取消预约：先二次确认，再调接口
  onCancel() {
    const { detail, submitting } = this.data;
    if (!detail || !detail.canCancel || submitting) return;
    wx.showModal({
      title: '取消预约',
      content: `确定取消 ${detail.reserveDate} ${detail.slotLabel}\n${detail.roomName} ${detail.seatNo} 的预约吗？\n取消后座位将立即释放给其他同学。`,
      confirmText: '确认取消',
      confirmColor: '#ff3b30',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) this.doCancel();
      },
    });
  },

  doCancel() {
    const { id, userId } = this.data;
    this.setData({ submitting: true });
    wx.showLoading({ title: '取消中…', mask: true });

    request(`/reservations/${id}/cancel`, { method: 'POST', data: { userId } })
      .then(() => {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({ title: '已取消', icon: 'success' });
        // 取消成功后重拉详情：拿到 CANCELLED 状态，按钮全部收起，座位已释放
        this.fetchDetail();
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        // 50004 当前状态不可取消 / 409xx 数据已变：重拉详情，让页面回到真实状态而不是停在旧数据上
        if (err && (err.code === 50004 || isConflictError(err))) this.fetchDetail();
      });
  },
});
