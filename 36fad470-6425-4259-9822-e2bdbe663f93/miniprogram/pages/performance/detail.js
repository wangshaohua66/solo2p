const app = getApp()

Page({
  data: {
    performance: null,
    loading: false,
    ticketTypes: [
      { type: 'regular', label: '普通票', desc: '全场通用' },
      { type: 'early_bird', label: '早鸟票', desc: '限时优惠85折' },
      { type: 'student', label: '学生票', desc: '需验证学生证' },
      { type: 'group', label: '团体票', desc: '满10人8折' }
    ]
  },

  onLoad(options) {
    if (options.id) {
      this.loadDetail(options.id)
    }
  },

  loadDetail(id) {
    this.setData({ loading: true })
    app.request({
      url: `/performances/${id}`,
      method: 'GET'
    }).then((res) => {
      this.setData({
        performance: res.data?.data || res.data,
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  onBuyTap() {
    const id = this.data.performance?.id
    if (!id) return
    wx.navigateTo({ url: `/pages/seat/select?performanceId=${id}` })
  }
})
