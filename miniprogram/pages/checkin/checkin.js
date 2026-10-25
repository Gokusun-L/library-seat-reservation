// pages/checkin/checkin.js
const { request } = require('../../utils/request');
const DEMO_USER_ID = "202411701223";

Page({
  data: {
    loading: false
  },

  onLoad() {

  },

  // 触发扫码
  handleScan() {
    this.setData({ loading: true });
    wx.scanCode({
      success: async (res) => {
        const qrcodeRaw = res.result;
        try {
          const data = await request('/reservations/checkin', {
            method: 'POST',
            data: {
              userId: DEMO_USER_ID,
              qrcode: qrcodeRaw
            }
          });
          wx.showToast({ title: '签到成功', icon: 'success' });
          // 签到成功，后续交给第五棒跳转到预约详情页
          setTimeout(() => {
            wx.navigateBack();
          }, 1200);
        } catch (err) {
          // 50003：座位不匹配，弹窗二次确认
          if (err.code === 50003) {
            wx.showModal({
              title: '座位号不匹配',
              content: '扫码座位与预约座位不一致，是否仍确认签到到此座位？',
              success: async (modalRes) => {
                if (modalRes.confirm) {
                  try {
                    await request('/reservations/checkin', {
                      method: 'POST',
                      data: {
                        userId: DEMO_USER_ID,
                        qrcode: qrcodeRaw
                      }
                    });
                    wx.showToast({ title: '签到成功', icon: 'success' });
                    setTimeout(() => wx.navigateBack(), 1200);
                  } catch (err) {
                    // 二次提交失败 request.js 内部已经toast
                  }
                }
              }
            });
          }          
          // 其余错误码交给request统一toast
        } finally {
          this.setData({ loading: false });
        }
      },
      fail: () => {
        wx.showToast({ title: '扫码取消或失败', icon: 'none' });
        this.setData({ loading: false });
      }
    })
  }
})
