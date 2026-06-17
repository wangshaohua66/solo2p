const app = getApp()

Page({
  data: {
    performances: [],
    loading: false,
    categories: [
      { type: 'drama', label: '话剧' },
      { type: 'concert', label: '音乐会' },
      { type: 'dance', label: '舞蹈' },
      { type: 'opera', label: '戏曲' },
      { type: 'children', label: '儿童剧' }
    ],
    activeCategory: '',
    banners: [
      { id: 1, image: '/assets/banner1.png', title: '新年演出季' }
    ]
  },

  onLoad() {
    this.loadPerformances()
  },

  onPullDownRefresh() {
    this.loadPerformances(() => wx.stopPullDownRefresh())
  },

  loadPerformances(callback) {
    this.setData({ loading: true })
    app.request({
      url: '/performances',
      method: 'GET',
      data: { status: 'approved' }
    }).then((res) => {
      const list = res.data?.data || res.data?.performances || []
      this.setData({ performances: list, loading: false })
      if (callback) callback()
    }).catch(() => {
      this.setData({ loading: false })
      if (callback) callback()
    })
  },

  onCategoryTap(e) {
    const type = e.currentTarget.dataset.type
    const active = type === this.data.activeCategory ? '' : type
    this.setData({ activeCategory: active })
    this.loadPerformances()
  },

  onPerformanceTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/performance/detail?id=${id}` })
  },

  onSearchTap() {
    wx.showToast({ title: '搜索功能开发中', icon: 'none' })
  }
})
