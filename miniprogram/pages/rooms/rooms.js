const { request } = require('../../utils/request');

// 阅览室列表页（US-01a）
// 依赖接口：GET /api/reading-rooms?keyword=&building=&status=
Page({
  data: {
    rooms: [],
    keyword: '',
    buildingIndex: 0,
    buildings: ['全部楼栋', '图书馆主馆', '图书馆东区'],
    loading: false,
    loadError: false,
  },

  onLoad() {
    this.fetchRooms();
  },

  onPullDownRefresh() {
    this.fetchRooms().finally(() => wx.stopPullDownRefresh());
  },

  fetchRooms() {
    this.setData({ loading: true, loadError: false });
    const { keyword, buildings, buildingIndex } = this.data;
    const query = [];
    if (keyword) query.push(`keyword=${encodeURIComponent(keyword)}`);
    const building = buildings[buildingIndex];
    if (building && building !== '全部楼栋') {
      query.push(`building=${encodeURIComponent(building)}`);
    }
    const qs = query.length ? `?${query.join('&')}` : '';
    return request(`/reading-rooms${qs}`)
      .then((rooms) => this.setData({ rooms, loading: false }))
      .catch(() => this.setData({ loading: false, loadError: true }));
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    this.fetchRooms();
  },

  onClearKeyword() {
    this.setData({ keyword: '' });
    this.fetchRooms();
  },

  onBuildingChange(e) {
    this.setData({ buildingIndex: Number(e.currentTarget.dataset.index) });
    this.fetchRooms();
  },

  onTapRoom(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/seat/seat?roomId=${id}` });
  },

  // 第四棒：跳转扫码签到页
  goCheckin() {
    wx.navigateTo({
      url: '/pages/checkin/checkin'
    })
  },

  // 第五棒：我的预约列表入口
  goMyReservations() {
    wx.navigateTo({
      url: '/pages/my-reservations/my-reservations'
    })
  },
});
