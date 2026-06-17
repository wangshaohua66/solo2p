const app = getApp()

Page({
  data: {
    orders: [],
    loading: false,
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待支付' },
      { key: 'paid', label: '已支付' },
      { key: 'used', label: '已使用' }
    ]
  },

  onShow() {
    this.loadOrders()
  },

  onPullDownRefresh() {
    this.loadOrders(() => wx.stopPullDownRefresh())
  },

  loadOrders(callback) {
    if (!app.globalData.token) {
      wx.navigateTo({ url: '/pages/profile/profile' })
      return
    }
    this.setData({ loading: true })
    app.request({
      url: '/orders',
      method: 'GET',
      data: { status: this.data.activeTab === 'all' ? '' : this.data.activeTab }
    }).then((res) => {
      const list = res.data?.data || res.data?.orders || []
      this.setData({ orders: list, loading: false })
      if (callback) callback()
    }).catch(() => {
      this.setData({ loading: false })
      if (callback) callback()
    })
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ activeTab: key })
    this.loadOrders()
  },

  onOrderTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/order/detail?id=${id}` })
  }
})
