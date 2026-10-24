const { request } = require('../../utils/request');
const { getSlots } = require('../../utils/meta');

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

// 座位图页（US-01b）
// 依赖接口：
//   GET /api/reading-rooms/:roomId/layout  静态骨架（行列、colGap）
//   GET /api/reading-rooms/:roomId/seats?date=&slot=  动态状态（三态 + summary）
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

  // 预约动作：第三棒不做，留给第四棒。这里先占位提示。
  onReserve() {
    wx.showToast({ title: '预约功能将在下一阶段开放', icon: 'none' });
  },
});