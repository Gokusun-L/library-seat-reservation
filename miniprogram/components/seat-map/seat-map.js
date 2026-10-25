// 座位图渲染组件（第三棒：座位图渲染 + 三态配色 + 座位信息点击）
Component({
    properties: {
      layout: { type: Object, value: null },
      seats: { type: Array, value: [] },
      onlyFree: { type: Boolean, value: false },
    },
  
    data: {
      rows: [],
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
        const cols = [];
        for (let c = 1; c <= layout.colCount; c += 1) {
          cols.push(c);
          if (colGap.indexOf(c) !== -1) cols.push(null);
        }
  
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
            const dimmed = onlyFree && seat.status !== 'FREE';
            return Object.assign({ key: `s-${seat.seatId}` }, seat, { dimmed });
          });
          rows.push({ rowIndex: r, cells });
        }
  
        this.setData({ rows });
      },
  
      onTapSeat(e) {
        const { id, status } = e.currentTarget.dataset;
        if (status === 'DISABLED') return;
        this.triggerEvent('select', { seatId: id });
      }
    }
  })
  
