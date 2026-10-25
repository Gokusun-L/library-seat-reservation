// 我的预约列表（US-03，第五棒）
// 依赖接口：GET /api/reservations?userId=&status=&page=&pageSize=
// 约定：后端已返回 statusText / slotLabel / seatNo / roomName，前端直接渲染，不自己拼文案。
const { request, isConflictError } = require('../../utils/request');
const { getStatusMeta } = require('../../utils/meta');
const { currentUser } = require('../../utils/user');

const PAGE_SIZE = 10;

// 筛选标签文案：code 一律取自 /meta/status（枚举唯一真源），这里只放中文映射，避免前后端起名不一致
const STATUS_LABEL = {
  PENDING: '待签到',
  CHECKED_IN: '使用中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  EXPIRED: '已超时释放',
};

Page({
  data: {
    userId: '',
    tabs: [],
    tabIndex: 0,
    list: [],
    page: 1,
    totalPages: 1,
    total: 0,
    loading: false,
    loadingMore: false,
    loadError: false,
  },

  onLoad() {
    const { userId } = currentUser();
    this.setData({ userId });
    this.initTabs();
  },

  onShow() {
    // 从详情页签到/取消返回后必须重拉：座位与预约状态都是实时的，不做本地缓存
    if (this.data.tabs.length) this.fetchList(true);
  },

  onPullDownRefresh() {
    this.fetchList(true).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    const { page, totalPages, loading, loadingMore } = this.data;
    if (loading || loadingMore || page >= totalPages) return;
    this.fetchList(false, page + 1);
  },

  initTabs() {
    getStatusMeta()
      .then((meta) => {
        const codes = Object.keys(meta.reservationStatus || {});
        const tabs = [{ code: '', label: '全部' }].concat(
          codes.map((code) => ({ code, label: STATUS_LABEL[code] || code }))
        );
        this.setData({ tabs });
        return this.fetchList(true);
      })
      .catch(() => this.setData({ loadError: true }));
  },

  fetchList(reset, pageNo) {
    const { tabs, tabIndex, userId } = this.data;
    if (!tabs.length) return Promise.resolve();
    const page = reset ? 1 : pageNo || 1;
    const status = tabs[tabIndex] ? tabs[tabIndex].code : '';

    this.setData(reset ? { loading: true, loadError: false } : { loadingMore: true });

    const query = [
      `userId=${encodeURIComponent(userId)}`,
      `page=${page}`,
      `pageSize=${PAGE_SIZE}`,
    ];
    if (status) query.push(`status=${status}`);

    return request(`/reservations?${query.join('&')}`)
      .then((data) => {
        const list = reset ? data.list : this.data.list.concat(data.list);
        this.setData({
          list,
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total,
          loading: false,
          loadingMore: false,
        });
      })
      .catch((err) => {
        this.setData({ loading: false, loadingMore: false, loadError: true });
        // 409xx 说明数据已变化，重新拉一次即可回到真实状态
        if (isConflictError(err) && reset) this.fetchList(true);
      });
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (index === this.data.tabIndex) return;
    this.setData({ tabIndex: index, list: [] });
    this.fetchList(true);
  },

  onRetry() {
    this.fetchList(true);
  },

  onTapItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },

  onGoRooms() {
    wx.reLaunch({ url: '/pages/rooms/rooms' });
  },
});
