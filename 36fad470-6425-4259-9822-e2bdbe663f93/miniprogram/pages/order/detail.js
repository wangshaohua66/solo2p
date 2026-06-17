const app = getApp()

Page({
  data: {
    order: null,
    loading: false
  },

  onLoad(options) {
    if (options.id) {
      this.loadDetail(options.id)
    }
  },

  loadDetail(id) {
    this.setData({ loading: true })
    app.request({
      url: `/orders/${id}`,
      method: 'GET'
    }).then((res) => {
      this.setData({
        order: res.data?.data || res.data,
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onPayTap() {
    const order = this.data.order
    if (!order) return
    wx.requestPayment({
      timeStamp: String(Date.now()),
      nonceStr: Math.random().toString(36).substr(2),
      package: `prepay_id=${order.orderNo}`,
      signType: 'MD5',
      paySign: '',
      success: () => {
        wx.showToast({ title: '支付成功', icon: 'success' })
        this.loadDetail(order.id)
      },
      fail: () => {
        wx.showToast({ title: '支付取消', icon: 'none' })
      }
    })
  },

  onSaveQrCode() {
    const order = this.data.order
    if (!order?.qrCode) {
      wx.showToast({ title: '暂无二维码', icon: 'none' })
      return
    }
    wx.showToast({ title: '请长按二维码图片保存', icon: 'none', duration: 2000 })
  }
})
