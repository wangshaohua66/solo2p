import { PlatformConfig, AnnouncementType, ProjectCategory } from '../types';

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: 'provincial',
    name: '省级公共资源交易平台',
    baseUrl: 'https://ggzy.example-province.gov.cn',
    listUrl: 'https://ggzy.example-province.gov.cn/trade/list',
    requiresLogin: true,
    loginConfig: {
      loginUrl: 'https://ggzy.example-province.gov.cn/login',
      username: 'operator@province.gov.cn',
      password: 'PROV_PASS_2024',
      usernameSelector: '#username',
      passwordSelector: '#password',
      captchaSelector: '#captchaImg',
      submitSelector: '#loginBtn',
      successIndicator: '.user-info',
      ocrServiceUrl: 'https://ocr-provider.com/api/recognize'
    },
    selectors: {
      listContainer: '.announcement-list',
      listItems: '.announcement-item',
      itemTitle: '.item-title a',
      itemLink: '.item-title a',
      itemTime: '.item-time',
      nextPage: '.pagination .next',
      detailContent: '.announcement-detail',
      projectName: '.project-info .name',
      projectNumber: '.project-info .number',
      tenderee: '.project-info .tenderee',
      tenderDeadline: '.project-info .deadline',
      budgetAmount: '.project-info .budget',
      contactInfo: '.contact-info',
      attachments: '.attachment-list a'
    },
    pagination: {
      type: 'page_number',
      maxPages: 50,
      startPage: 1,
      pageParam: 'page'
    },
    region: '全省',
    timeout: {
      listPage: 10000,
      detailPage: 5000
    },
    rateLimit: 1000
  },
  {
    id: 'city-01',
    name: 'A市公共资源交易平台',
    baseUrl: 'https://ggzy.city-a.gov.cn',
    listUrl: 'https://ggzy.city-a.gov.cn/notice/list',
    requiresLogin: false,
    selectors: {
      listContainer: '#noticeList',
      listItems: '.notice-row',
      itemTitle: 'h3 a',
      itemLink: 'h3 a',
      itemTime: '.pub-date',
      nextPage: '.pager .next-page',
      detailContent: '.notice-content',
      projectName: '.project-name',
      projectNumber: '.project-code',
      tenderee: '.owner',
      tenderDeadline: '.bid-deadline',
      budgetAmount: '.budget',
      contactInfo: '.contact',
      attachments: '.files a'
    },
    pagination: {
      type: 'page_number',
      maxPages: 30,
      startPage: 1,
      pageParam: 'pageNo'
    },
    region: 'A市',
    timeout: {
      listPage: 10000,
      detailPage: 5000
    },
    rateLimit: 1500
  },
  {
    id: 'city-02',
    name: 'B市公共资源交易平台',
    baseUrl: 'https://ggzy.city-b.gov.cn',
    listUrl: 'https://ggzy.city-b.gov.cn/trade/announcement',
    requiresLogin: true,
    loginConfig: {
      loginUrl: 'https://ggzy.city-b.gov.cn/user/login',
      username: 'city_b_user',
      password: 'CITY_B_PASS_2024',
      usernameSelector: 'input[name="account"]',
      passwordSelector: 'input[name="password"]',
      submitSelector: 'button[type="submit"]',
      successIndicator: '.user-center'
    },
    selectors: {
      listContainer: '.announcement-container',
      listItems: '.ann-row',
      itemTitle: '.ann-title a',
      itemLink: '.ann-title a',
      itemTime: '.ann-date',
      nextPage: '.page-nav .next',
      detailContent: '#announcementDetail',
      projectName: '.pname',
      projectNumber: '.pcode',
      tenderee: '.tenderer',
      tenderDeadline: '.deadline-time',
      budgetAmount: '.budget-amount',
      contactInfo: '.contact-detail',
      attachments: '.attachment-item a'
    },
    pagination: {
      type: 'infinite_scroll',
      maxPages: 20,
      startPage: 1
    },
    region: 'B市',
    timeout: {
      listPage: 10000,
      detailPage: 5000
    },
    rateLimit: 1200
  },
  {
    id: 'city-03',
    name: 'C市公共资源交易平台',
    baseUrl: 'https://ggzy.city-c.gov.cn',
    listUrl: 'https://ggzy.city-c.gov.cn/list/notice',
    requiresLogin: false,
    selectors: {
      listContainer: '.list-box',
      listItems: '.list-item',
      itemTitle: '.title a',
      itemLink: '.title a',
      itemTime: '.time',
      nextPage: '.page-next',
      detailContent: '.detail-body',
      projectName: '.xm-name',
      projectNumber: '.xm-code',
      tenderee: '.zbr',
      tenderDeadline: '.tbsj',
      budgetAmount: '.ysje',
      contactInfo: '.lxfs',
      attachments: '.fj-list a'
    },
    pagination: {
      type: 'page_number',
      maxPages: 25,
      startPage: 1,
      pageParam: 'p'
    },
    region: 'C市',
    timeout: {
      listPage: 10000,
      detailPage: 5000
    },
    rateLimit: 1000
  }
];

export const ANNOUNCEMENT_TYPE_PATTERNS: Record<AnnouncementType, RegExp[]> = {
  [AnnouncementType.TENDER_NOTICE]: [
    /招标公告/, /采购公告/, /出让公告/, /挂牌公告/, /竞争性谈判/, /竞争性磋商/, /询价公告/
  ],
  [AnnouncementType.WINNING_RESULT]: [
    /中标公告/, /成交公告/, /中标候选人/, /成交结果/, /预中标/
  ],
  [AnnouncementType.CHANGE_NOTICE]: [
    /变更公告/, /更正公告/, /补充公告/, /延期公告/, /澄清公告/, /修改公告/
  ],
  [AnnouncementType.QA_CLARIFICATION]: [
    /答疑公告/, /答疑澄清/, /问题答复/, /补充文件/
  ]
};

export const CATEGORY_PATTERNS: Record<ProjectCategory, RegExp[]> = {
  [ProjectCategory.GOVERNMENT_PROCUREMENT]: [
    /政府采购/, /货物类/, /服务类/, /工程类.*采购/, /询价/, /竞争性/
  ],
  [ProjectCategory.ENGINEERING_CONSTRUCTION]: [
    /工程建设/, /施工招标/, /监理/, /设计招标/, /勘察/, /总承包/
  ],
  [ProjectCategory.LAND_MINERAL]: [
    /土地出让/, /矿产/, /采矿权/, /探矿权/, /国有建设用地/, /挂牌出让/
  ],
  [ProjectCategory.PROPERTY_RIGHTS]: [
    /产权交易/, /股权转让/, /资产转让/, /租赁/, /经营权/
  ]
};

export const NATIONAL_PLATFORM_CONFIG: PlatformConfig = {
  id: 'national',
  name: '国家公共资源交易平台',
  baseUrl: 'https://www.ggzy.gov.cn',
  listUrl: 'https://www.ggzy.gov.cn/information/notice/list',
  requiresLogin: false,
  selectors: {
    listContainer: '.list_content',
    listItems: '.list-item',
    itemTitle: '.list_title a',
    itemLink: '.list_title a',
    itemTime: '.list_time',
    nextPage: '.pagination .nextPage',
    detailContent: '.article-content',
    projectName: '.xm_mc',
    projectNumber: '.xm_bh',
    tenderee: '.zbr_mc',
    tenderDeadline: '.tb_jzsj',
    budgetAmount: '.zb_je',
    contactInfo: '.lxfs',
    attachments: '.fjxx a'
  },
  pagination: {
    type: 'page_number',
    maxPages: 100,
    startPage: 1,
    pageParam: 'page'
  },
  region: '全国',
  timeout: {
    listPage: 10000,
    detailPage: 5000
  },
  rateLimit: 2000
};
