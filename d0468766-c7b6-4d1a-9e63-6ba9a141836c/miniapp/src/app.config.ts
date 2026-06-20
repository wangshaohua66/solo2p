export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/movie/index',
    'pages/order/index',
    'pages/mine/index',
    'pages/booking/index',
    'pages/cinema-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#0b0b12',
    navigationBarTitleText: '光影院线',
    navigationBarTextStyle: 'white',
    backgroundColor: '#0b0b12',
    backgroundColorTop: '#0b0b12',
    backgroundColorBottom: '#0b0b12'
  },
  tabBar: {
    color: '#6b6f7e',
    selectedColor: '#e8b547',
    backgroundColor: '#12121c',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/index/index', text: '影院' },
      { pagePath: 'pages/movie/index', text: '电影' },
      { pagePath: 'pages/order/index', text: '订单' },
      { pagePath: 'pages/mine/index', text: '我的' }
    ]
  },
  style: 'v2',
  componentFramework: 'glass',
  sitemapLocation: 'sitemap.json'
})
