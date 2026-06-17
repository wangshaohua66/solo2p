App({
  globalData: {
    baseUrl: 'http://localhost:8000/api',
    token: '',
    refreshToken: '',
    userInfo: null
  },
  onLaunch() {
    const token = wx.getStorageSync('access_token')
    const refreshToken = wx.getStorageSync('refresh_token')
    const userInfo = wx.getStorageSync('user_info')

    if (token) {
      this.globalData.token = token
    }
    if (refreshToken) {
      this.globalData.refreshToken = refreshToken
    }
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }
  },
  request(options) {
    const { url, method = 'GET', data, header = {} } = options
    const fullUrl = url.startsWith('http') ? url : this.globalData.baseUrl + url

    const finalHeader = {
      'Content-Type': 'application/json',
      Authorization: this.globalData.token ? `Bearer ${this.globalData.token}` : '',
      ...header
    }

    return new Promise((resolve, reject) => {
      wx.request({
        url: fullUrl,
        method,
        data,
        header: finalHeader,
        success: async (res) => {
          if (res.statusCode === 401) {
            const refreshed = await this.refreshToken()
            if (refreshed) {
              finalHeader.Authorization = `Bearer ${this.globalData.token}`
              wx.request({
                url: fullUrl,
                method,
                data,
                header: finalHeader,
                success: (retryRes) => resolve(retryRes),
                fail: (err) => reject(err)
              })
            } else {
              wx.removeStorageSync('access_token')
              wx.removeStorageSync('refresh_token')
              wx.redirectTo({ url: '/pages/profile/profile' })
              reject(new Error('登录已过期'))
            }
          } else {
            resolve(res)
          }
        },
        fail: (err) => reject(err)
      })
    })
  },
  async refreshToken() {
    const refreshToken = this.globalData.refreshToken
    if (!refreshToken) return false

    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: this.globalData.baseUrl + '/auth/refresh',
          method: 'POST',
          data: { refreshToken },
          header: { 'Content-Type': 'application/json' },
          success: resolve,
          fail: reject
        })
      })

      if (res.statusCode === 200 && res.data.accessToken) {
        this.globalData.token = res.data.accessToken
        this.globalData.refreshToken = res.data.refreshToken
        wx.setStorageSync('access_token', res.data.accessToken)
        wx.setStorageSync('refresh_token', res.data.refreshToken)
        return true
      }
    } catch (e) {
      console.error('Token refresh failed', e)
    }
    return false
  }
})
