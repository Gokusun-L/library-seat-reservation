// 座位图渲染组件（第三棒：座位图渲染 + 三态配色 + 座位信息点击）
// 入参：
//   layout  { rowCount, colCount, colGap }  静态骨架（来自 /layout 接口）
//   seats   [{ seatId, seatNo, row, col, seatType, status, reservable }]  动态状态（来自 /seats 接口）
//   onlyFree boolean  是否「只看空位」
// 出参：
//   bind:select  { seatId }  点击可点座位时触发
Component({
  properties: {
    layout: { type: Object, value: null },
    seats: { type: Array, value: [] },
    onlyFree: { type: Boolean, value: false },
  },

  data: {
    rows: [], // 渲染用二维结构：[{ rowIndex, cells: [{...seat, dimmed} | {gap} | {empty}] }]
  },

  observers: {
    'layout, seats, onlyFree'() {
      this.buildGrid();
    },
  },

  methods: {
    buildGrid() {
      const { layout, seats, onlyFree } = this.data;
      if (!layout || !layout.rowCount || !layout.colCount) {
        this.setData({ rows: [] });
        return;
      }

      const colGap = Array.isArray(layout.colGap) ? layout.colGap : [];
      // 生成最终列序列：在「过道列」之后插入一个过道占位（gap），让座位图中间断开
      const cols = [];
      for (let c = 1; c <= layout.colCount; c += 1) {
        cols.push(c);
        if (colGap.indexOf(c) !== -1) cols.push(null);
      }

      // seat 按 "row-col" 建索引，O(1) 查找
      const seatMap = {};
      (seats || []).forEach((s) => {
        seatMap[`${s.row}-${s.col}`] = s;
      });

      const rows = [];
      for (let r = 1; r <= layout.rowCount; r += 1) {
        const cells = cols.map((c, idx) => {
          if (c === null) return { key: `gap-${idx}`, gap: true };
          const seat = seatMap[`${r}-${c}`];
          if (!seat) return { key: `empty-${idx}`, empty: true };
          // 只看空位：非 FREE 座位淡化保留（保持网格形状不变形）
          const dimmed = onlyFree && seat.status !== 'FREE';
          return Object.assign({ key: `s-${seat.seatId}` }, seat, { dimmed });
        });
        rows.push({ rowIndex: r, cells });
      }

      this.setData({ rows });
    },

    onTapSeat(e) {
      const { id, status } = e.currentTarget.dataset;
      // 停用座位不可点（自检清单要求）
      if (status === 'DISABLED') return;
      this.triggerEvent('select', { seatId: id });
    },
  },
});