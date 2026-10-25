const { request, isConflictError } = require('../../utils/request');
const { getSlots } = require('../../utils/meta');
const { currentUser } = require('../../utils/user');

// 座位展示状态 → 中文（与 constants/business.js 的 SEAT_VIEW_STATUS 对应）
const STATUS_TEXT = {
  FREE: '空闲（可预约）',
  RESERVED: '已预约（待签到）',
  IN_USE: '使用中',
  DISABLED: '停用',
};

const TYPE_TEXT = {
  NORMAL: '普通',
  POWER: '带电源',
  WINDOW: '靠窗',
};

// 座位图页（US-01b + US-02 提交预约）
// 依赖接口：
//   GET /api/reading-rooms/:roomId/layout  静态骨架（行列、colGap）
//   GET /api/reading-rooms/:roomId/seats?date=&slot=  动态状态（三态 + summary）
//   POST /api/reservations                 创建预约（第四棒占位，第五棒接上）
Page({
  data: {
    roomId: null,
    room: null,
    layout: null,
    slots: [],
    slotIndex: 0,
    date: '',
    seats: [],
    summary: null,
    onlyFree: false,
    loading: false,
    selectedSeat: null, // 座位信息弹窗数据
    submitting: false, // 预约请求进行中，防重复点击
  },

  onLoad(options) {
    const roomId = Number(options.roomId);
    this.setData({ roomId, date: this.today() });
    this.init();
  },

  today() {
    const d = new Date();
    const p = (n) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  // 当前时段默认值：与后端 readingRoomService.currentSlot 保持一致
  currentSlotCode() {
    const h = new Date().getHours();
    if (h < 12) return 'MORNING';
    if (h < 18) return 'AFTERNOON';
    return 'EVENING';
  },

  async init() {
    try {
      const slots = await getSlots();
      const cur = this.currentSlotCode();
      const slotIndex = Math.max(
        0,
        slots.findIndex((s) => s.code === cur)
      );
      this.setData({ slots, slotIndex });
      await Promise.all([this.fetchLayout(), this.fetchSeats()]);
    } catch (e) {
      // 网络/枚举拉取失败时 request 已 toast，这里仅兜底
      this.setData({ loading: false });
    }
  },

  fetchLayout() {
    return request(`/reading-rooms/${this.data.roomId}/layout`).then((d) => {
      this.setData({ room: d.room, layout: d.layout });
    });
  },

  // 座位状态不落库、不缓存：切日期/时段必须重新请求（交接约定第 2 条）
  fetchSeats() {
    this.setData({ loading: true });
    const { roomId, date, slots, slotIndex } = this.data;
    const slot = slots[slotIndex].code;
    return request(`/reading-rooms/${roomId}/seats?date=${date}&slot=${slot}`)
      .then((d) => this.setData({ seats: d.seats, summary: d.summary, loading: false }))
      .catch(() => this.setData({ loading: false }));
  },

  onDateChange(e) {
    this.setData({ date: e.detail.value });
    this.fetchSeats();
  },

  onSlotChange(e) {
    this.setData({ slotIndex: Number(e.currentTarget.dataset.index) });
    this.fetchSeats();
  },

  onToggleOnlyFree(e) {
    this.setData({ onlyFree: e.detail.value });
  },

  // 组件点击座位回调：DISABLED 在组件内已拦截
  onSelectSeat(e) {
    const seatId = e.detail.seatId;
    const seat = this.data.seats.find((s) => s.seatId === seatId);
    if (!seat) return;
    this.setData({
      selectedSeat: Object.assign({}, seat, {
        statusText: STATUS_TEXT[seat.status] || seat.status,
        typeText: TYPE_TEXT[seat.seatType] || seat.seatType,
      }),
    });
  },

  onClosePopup() {
    this.setData({ selectedSeat: null });
  },

  // 提交预约（US-02）：第五棒把第四棒留下的占位接上真实接口
  onReserve() {
    const seat = this.data.selectedSeat;
    if (!seat || !seat.reservable || this.data.submitting) return;

    const { roomId, date, slots, slotIndex } = this.data;
    const slot = slots[slotIndex].code;
    const { userId, userName } = currentUser();

    this.setData({ submitting: true });
    wx.showLoading({ title: '预约中…', mask: true });

    request('/reservations', {
      method: 'POST',
      data: {
        userId,
        userName,
        roomId,
        seatId: seat.seatId, // 注意：是座位 ID，不是座位号
        date,
        slot,
      },
    })
      .then((res) => {
        wx.hideLoading();
        this.setData({ submitting: false, selectedSeat: null });
        // 后端已补全展示字段，直接用来拼成功提示，不用再查一次
        wx.showModal({
          title: '预约成功',
          content: `${res.roomName} ${res.seatNo}\n${res.reserveDate} ${res.slotLabel}`,
          confirmText: '查看预约',
          cancelText: '继续选座',
          success: (m) => {
            if (m.confirm) {
              wx.navigateTo({ url: '/pages/my-reservations/my-reservations' });
            }
          },
        });
        // 预约成功后座位状态变了，立即重拉座位图
        this.fetchSeats();
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ submitting: false });
        // 409xx（座位刚被抢 / 时段重复预约）：数据已变化，刷新座位图
        if (isConflictError(err)) this.fetchSeats();
      });
  },

  onGoMyReservations() {
    wx.navigateTo({ url: '/pages/my-reservations/my-reservations' });
  },
});
