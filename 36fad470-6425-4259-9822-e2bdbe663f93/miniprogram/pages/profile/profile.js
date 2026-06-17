const app = getApp()

Page({
  data: {
    userInfo: null,
    isLogin: false,
    menuList: [
      { icon: '🎫', label: '我的订单', url: '/pages/order/list' },
      { icon: '⭐', label: '我的收藏', url: '' },
      { icon: '🎫', label: '优惠券', url: '' },
      { icon: '📞', label: '联系客服', url: '' },
      { icon: '⚙️', label: '设置', url: '' }
    ]
  },

  onShow() {
    const userInfo = app.globalData.userInfo
    this.setData({
      userInfo,
      isLogin: !!userInfo
    })
  },

  onLoginTap() {
    wx.showModal({
      title: '登录',
      content: '请使用微信快速登录',
      success: (res) => {
        if (res.confirm) {
          this.mockLogin()
        }
      }
    })
  },

  mockLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          const mockUser = {
            id: 'wx_user_' + Date.now(),
            username: '微信用户',
            name: '微信用户',
            avatar: '',
            role: 'audience'
          }
          app.globalData.userInfo = mockUser
          app.globalData.token = 'mock_token_' + Date.now()
          wx.setStorageSync('user_info', mockUser)
          wx.setStorageSync('access_token', app.globalData.token)
          this.setData({ userInfo: mockUser, isLogin: true })
          wx.showToast({ title: '登录成功', icon: 'success' })
        }
      }
    })
  },

  onMenuTap(e) {
    const url = e.currentTarget.dataset.url
    if (url) {
      wx.navigateTo({ url })
    } else {
      wx.showToast({ title: '功能开发中', icon: 'none' })
    }
  },

  onLogoutTap() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userInfo = null
          app.globalData.token = ''
          wx.removeStorageSync('user_info')
          wx.removeStorageSync('access_token')
          this.setData({ userInfo: null, isLogin: false })
        }
      }
    })
  }
})
