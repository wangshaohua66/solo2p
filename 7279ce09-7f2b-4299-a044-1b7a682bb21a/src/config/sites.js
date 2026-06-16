/**
 * 司法拍卖站点配置
 * 包含全国主要司法拍卖平台及地方法院的站点配置信息
 * 每个站点配置包含：基本信息、登录配置、选择器映射、分页规则
 */

/**
 * 站点配置数组
 * 按优先级排序，数值越小优先级越高
 * @type {Array<SiteConfig>}
 */
export const sites = [
  {
    name: '阿里拍卖-司法',
    baseUrl: 'https://sf.taobao.com',
    listUrlTemplate: 'https://sf.taobao.com/item_list.htm?spm=a213w.7398504.filterSort.1.70f537c6XyZ7xY&category=50025969&city=&province=&sorder=0&auction_source=0&st_param=-1&auction_start_seg=-1&page={page}',
    priority: 1,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.sf-item-wrap',
        detailLinkSelector: '.item-title a',
        titleSelector: '.item-title',
        priceSelector: '.current-price',
        dateSelector: '.item-time'
      },
      detail: {
        title: '.pub-title',
        address: '.item-address .content',
        area: '.item-area .content',
        assessPrice: '.price-box .evaluate-price .num',
        startPrice: '.price-box .start-price .num',
        currentPrice: '.price-box .current-price .num',
        auctionDate: '.countdown .end-time',
        round: '.round',
        court: '.court-info .name',
        noticeUrl: '.notice-box a',
        status: '.status',
        bidCount: '.bid-count .num'
      }
    },

    pagination: {
      paginationType: 'page',
      maxPages: 100,
      pageParam: 'page'
    }
  },

  {
    name: '京东拍卖-司法',
    baseUrl: 'https://paimai.jd.com',
    listUrlTemplate: 'https://paimai.jd.com/auctionList?skuType=1&categoryId=13470&page={page}',
    priority: 2,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.jv-item',
        detailLinkSelector: '.jv-item-title a',
        titleSelector: '.jv-item-title',
        priceSelector: '.jv-current-price',
        dateSelector: '.jv-end-time'
      },
      detail: {
        title: '.pm-d-title',
        address: '.pm-detail-info .addr',
        area: '.pm-detail-info .area',
        assessPrice: '.pm-price-box .gujia em',
        startPrice: '.pm-price-box .start-price em',
        currentPrice: '.pm-price-box .current-price em',
        auctionDate: '.pm-countdown .end-time',
        round: '.pm-round',
        court: '.pm-court-name',
        noticeUrl: '.pm-notice a',
        status: '.pm-status',
        bidCount: '.pm-bid-count'
      }
    },

    pagination: {
      paginationType: 'loadMore',
      maxPages: 50,
      pageParam: 'page'
    }
  },

  {
    name: '公拍网',
    baseUrl: 'https://www.gpai.net',
    listUrlTemplate: 'https://www.gpai.net/sf/search.do?action=page&p={page}',
    priority: 3,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.sf-item',
        detailLinkSelector: '.sf-item-title a',
        titleSelector: '.sf-item-title',
        priceSelector: '.sf-item-price',
        dateSelector: '.sf-item-time'
      },
      detail: {
        title: '.detail-title',
        address: '.detail-address',
        area: '.detail-area',
        assessPrice: '.detail-price-gujia',
        startPrice: '.detail-price-start',
        currentPrice: '.detail-price-current',
        auctionDate: '.detail-endtime',
        round: '.detail-round',
        court: '.detail-court',
        noticeUrl: '.detail-notice a',
        status: '.detail-status',
        bidCount: '.detail-bid-count'
      }
    },

    pagination: {
      paginationType: 'infiniteScroll',
      maxPages: 30,
      pageParam: 'p'
    }
  },

  {
    name: '人民法院诉讼资产网',
    baseUrl: 'https://www.rmfysszc.gov.cn',
    listUrlTemplate: 'https://www.rmfysszc.gov.cn/newsList.aspx?channel=1&page={page}',
    priority: 4,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.news-item',
        detailLinkSelector: '.news-title a',
        titleSelector: '.news-title',
        priceSelector: '.news-price',
        dateSelector: '.news-date'
      },
      detail: {
        title: '.article-title',
        address: '.article-address',
        area: '.article-area',
        assessPrice: '.article-price-gujia',
        startPrice: '.article-price-start',
        currentPrice: '.article-price-current',
        auctionDate: '.article-endtime',
        round: '.article-round',
        court: '.article-court',
        noticeUrl: '.article-notice a',
        status: '.article-status',
        bidCount: '.article-bid-count'
      }
    },

    pagination: {
      paginationType: 'page',
      maxPages: 200,
      pageParam: 'page'
    }
  },

  {
    name: '北京产权交易所',
    baseUrl: 'https://www.cbex.com.cn',
    listUrlTemplate: 'https://www.cbex.com.cn/portal/sf/List?pageNo={page}',
    priority: 5,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.sf-list-item',
        detailLinkSelector: '.sf-list-title a',
        titleSelector: '.sf-list-title',
        priceSelector: '.sf-list-price',
        dateSelector: '.sf-list-date'
      },
      detail: {
        title: '.sf-detail-title',
        address: '.sf-detail-address',
        area: '.sf-detail-area',
        assessPrice: '.sf-detail-gujia',
        startPrice: '.sf-detail-startprice',
        currentPrice: '.sf-detail-currentprice',
        auctionDate: '.sf-detail-endtime',
        round: '.sf-detail-round',
        court: '.sf-detail-court',
        noticeUrl: '.sf-detail-notice a',
        status: '.sf-detail-status',
        bidCount: '.sf-detail-bidcount'
      }
    },

    pagination: {
      paginationType: 'page',
      maxPages: 50,
      pageParam: 'pageNo'
    }
  },

  {
    name: '广州产权交易所',
    baseUrl: 'https://www.gemas.com.cn',
    listUrlTemplate: 'https://www.gemas.com.cn/sfpm/list.html?page={page}',
    priority: 6,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.pm-item',
        detailLinkSelector: '.pm-item-title a',
        titleSelector: '.pm-item-title',
        priceSelector: '.pm-item-price',
        dateSelector: '.pm-item-time'
      },
      detail: {
        title: '.pm-detail-title',
        address: '.pm-detail-address',
        area: '.pm-detail-area',
        assessPrice: '.pm-detail-gujia',
        startPrice: '.pm-detail-start',
        currentPrice: '.pm-detail-current',
        auctionDate: '.pm-detail-end',
        round: '.pm-detail-round',
        court: '.pm-detail-court',
        noticeUrl: '.pm-detail-notice a',
        status: '.pm-detail-status',
        bidCount: '.pm-detail-bidnum'
      }
    },

    pagination: {
      paginationType: 'loadMore',
      maxPages: 30,
      pageParam: 'page'
    }
  },

  {
    name: '深圳联合产权交易所',
    baseUrl: 'https://www.sotcbb.com',
    listUrlTemplate: 'https://www.sotcbb.com/sf/list?page={page}',
    priority: 7,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.sf-item-card',
        detailLinkSelector: '.sf-card-title a',
        titleSelector: '.sf-card-title',
        priceSelector: '.sf-card-price',
        dateSelector: '.sf-card-time'
      },
      detail: {
        title: '.sf-detail-hd h1',
        address: '.sf-detail-address span',
        area: '.sf-detail-area span',
        assessPrice: '.sf-price-evaluate',
        startPrice: '.sf-price-start',
        currentPrice: '.sf-price-now',
        auctionDate: '.sf-countdown-time',
        round: '.sf-round-tag',
        court: '.sf-court-name',
        noticeUrl: '.sf-notice-link a',
        status: '.sf-status-tag',
        bidCount: '.sf-bid-num'
      }
    },

    pagination: {
      paginationType: 'infiniteScroll',
      maxPages: 20,
      pageParam: 'page'
    }
  },

  {
    name: '浙江省高级人民法院',
    baseUrl: 'https://www.zjcourt.cn',
    listUrlTemplate: 'https://www.zjcourt.cn/col/col1229439311/index.html?page={page}',
    priority: 8,

    login: {
      required: true,
      loginType: 'password',
      username: 'zhejiang_court_user',
      password: '',
      loginUrl: 'https://www.zjcourt.cn/col/col1229439311/login.html'
    },

    selectors: {
      list: {
        listItemSelector: '.court-list-item',
        detailLinkSelector: '.court-item-title a',
        titleSelector: '.court-item-title',
        priceSelector: '.court-item-price',
        dateSelector: '.court-item-date'
      },
      detail: {
        title: '.court-detail-title',
        address: '.court-detail-addr',
        area: '.court-detail-area',
        assessPrice: '.court-price-gujia',
        startPrice: '.court-price-start',
        currentPrice: '.court-price-current',
        auctionDate: '.court-end-time',
        round: '.court-detail-round',
        court: '.court-detail-court',
        noticeUrl: '.court-detail-notice a',
        status: '.court-detail-status',
        bidCount: '.court-bid-number'
      }
    },

    pagination: {
      paginationType: 'page',
      maxPages: 100,
      pageParam: 'page'
    }
  },

  {
    name: '江苏省高级人民法院',
    baseUrl: 'https://www.jsfy.gov.cn',
    listUrlTemplate: 'https://www.jsfy.gov.cn/col/col13014/index.html?page={page}',
    priority: 9,

    login: {
      required: true,
      loginType: 'cookie',
      username: '',
      password: '',
      loginUrl: 'https://www.jsfy.gov.cn/col/col13014/index.html',
      cookieValue: ''
    },

    selectors: {
      list: {
        listItemSelector: '.fy-list-item',
        detailLinkSelector: '.fy-item-title a',
        titleSelector: '.fy-item-title',
        priceSelector: '.fy-item-price',
        dateSelector: '.fy-item-time'
      },
      detail: {
        title: '.fy-detail-title',
        address: '.fy-detail-address',
        area: '.fy-detail-housearea',
        assessPrice: '.fy-price-evaluate',
        startPrice: '.fy-price-start',
        currentPrice: '.fy-price-current',
        auctionDate: '.fy-end-time',
        round: '.fy-detail-round',
        court: '.fy-detail-courtname',
        noticeUrl: '.fy-detail-notice a',
        status: '.fy-detail-state',
        bidCount: '.fy-bid-count'
      }
    },

    pagination: {
      paginationType: 'page',
      maxPages: 80,
      pageParam: 'page'
    }
  },

  {
    name: '重庆市公共资源交易中心',
    baseUrl: 'https://www.cqggzy.com',
    listUrlTemplate: 'https://www.cqggzy.com/sfpm/list_1.html?pageIndex={page}',
    priority: 10,

    login: {
      required: false,
      loginType: null,
      username: '',
      password: '',
      loginUrl: ''
    },

    selectors: {
      list: {
        listItemSelector: '.sf-pm-item',
        detailLinkSelector: '.sf-pm-title a',
        titleSelector: '.sf-pm-title',
        priceSelector: '.sf-pm-price',
        dateSelector: '.sf-pm-date'
      },
      detail: {
        title: '.sf-detail-main-title',
        address: '.sf-detail-info-address',
        area: '.sf-detail-info-area',
        assessPrice: '.sf-price-pg',
        startPrice: '.sf-price-start',
        currentPrice: '.sf-price-dq',
        auctionDate: '.sf-end-datetime',
        round: '.sf-detail-round',
        court: '.sf-detail-court',
        noticeUrl: '.sf-detail-file a',
        status: '.sf-detail-status',
        bidCount: '.sf-bid-times'
      }
    },

    pagination: {
      paginationType: 'loadMore',
      maxPages: 40,
      pageParam: 'pageIndex'
    }
  }
];

/**
 * 根据名称获取站点配置
 * @param {string} name - 站点名称
 * @returns {SiteConfig|undefined} 站点配置对象
 */
export function getSiteByName(name) {
  return sites.find(site => site.name === name);
}

/**
 * 根据优先级获取站点列表（优先级从高到低）
 * @returns {Array<SiteConfig>} 排序后的站点配置数组
 */
export function getSitesByPriority() {
  return [...sites].sort((a, b) => a.priority - b.priority);
}

/**
 * 获取需要登录的站点列表
 * @returns {Array<SiteConfig>} 需要登录的站点配置数组
 */
export function getSitesRequireLogin() {
  return sites.filter(site => site.login?.required);
}

/**
 * 根据分页类型获取站点列表
 * @param {string} paginationType - 分页类型 'page'|'loadMore'|'infiniteScroll'
 * @returns {Array<SiteConfig>} 对应分页类型的站点配置数组
 */
export function getSitesByPaginationType(paginationType) {
  return sites.filter(site => site.pagination.paginationType === paginationType);
}

export default sites;
