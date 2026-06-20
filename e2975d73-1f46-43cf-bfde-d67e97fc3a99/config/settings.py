import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
LOG_DIR = os.path.join(BASE_DIR, 'logs')
DOWNLOAD_DIR = os.path.join(DATA_DIR, 'downloads')
DB_PATH = os.path.join(DATA_DIR, 'policies.db')

for d in [DATA_DIR, LOG_DIR, DOWNLOAD_DIR]:
    os.makedirs(d, exist_ok=True)

BOT_NAME = 'policy_crawler'

SPIDER_MODULES = ['spiders']
NEWSPIDER_MODULE = 'spiders'

ROBOTSTXT_OBEY = False

CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 4

DOWNLOAD_DELAY = 2
RANDOMIZE_DOWNLOAD_DELAY = True

DOWNLOAD_TIMEOUT = 30
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [500, 502, 503, 504, 408, 429, 403]

COOKIES_ENABLED = True
COOKIES_DEBUG = False

DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

DOWNLOADER_MIDDLEWARES = {
    'middlewares.anti_ban_middleware.UserAgentMiddleware': 400,
    'middlewares.anti_ban_middleware.ProxyMiddleware': 410,
    'middlewares.anti_ban_middleware.DelayMiddleware': 420,
    'scrapy.downloadermiddlewares.retry.RetryMiddleware': 550,
}

ITEM_PIPELINES = {
    'pipelines.clean_pipeline.CleanPipeline': 300,
    'pipelines.classify_pipeline.ClassifyPipeline': 400,
    'pipelines.relation_pipeline.RelationPipeline': 500,
    'pipelines.classify_pipeline.StoragePipeline': 600,
}

LOG_ENABLED = True
LOG_LEVEL = 'INFO'
LOG_FILE = os.path.join(LOG_DIR, f'scrapy_{datetime.now().strftime("%Y%m%d")}.log')
LOG_STDOUT = False
LOG_SHORT_NAMES = True

DOWNLOADER_MIDDLEWARES_BASE = {
    'scrapy.downloadermiddlewares.robotstxt.RobotsTxtMiddleware': 100,
    'scrapy.downloadermiddlewares.httpauth.HttpAuthMiddleware': 300,
    'scrapy.downloadermiddlewares.downloadtimeout.DownloadTimeoutMiddleware': 350,
    'scrapy.downloadermiddlewares.defaultheaders.DefaultHeadersMiddleware': 400,
    'scrapy.downloadermiddlewares.useragent.UserAgentMiddleware': 500,
    'scrapy.downloadermiddlewares.ajaxcrawl.AjaxCrawlMiddleware': 560,
    'scrapy.downloadermiddlewares.redirect.MetaRefreshMiddleware': 580,
    'scrapy.downloadermiddlewares.httpcompression.HttpCompressionMiddleware': 590,
    'scrapy.downloadermiddlewares.redirect.RedirectMiddleware': 600,
    'scrapy.downloadermiddlewares.cookies.CookiesMiddleware': 700,
    'scrapy.downloadermiddlewares.httpproxy.HttpProxyMiddleware': 750,
    'scrapy.downloadermiddlewares.stats.DownloaderStats': 850,
    'scrapy.downloadermiddlewares.httpcache.HttpCacheMiddleware': 900,
}

USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
]

PROXY_POOL = [
    'http://proxy1.example.com:8080',
    'http://proxy2.example.com:3128',
    'http://user:pass@proxy3.example.com:8080',
    'http://192.168.1.100:8888',
    'https://proxy4.example.com:8443',
    'socks5://proxy5.example.com:1080',
    'http://proxy6.example.com:8888',
    'http://proxy7.example.com:3128',
]

PROXY_CHECK_URL = 'http://httpbin.org/ip'
PROXY_TIMEOUT = 10
PROXY_HEALTH_CHECK_INTERVAL = 300

ENABLE_PROXY = False

CHECKPOINT_FILE = os.path.join(DATA_DIR, 'crawl_checkpoint.json')
CHECKPOINT_SAVE_INTERVAL = 100

SCHEDULER_CONFIG = {
    'daily_crawl_hour': 2,
    'daily_crawl_minute': 30,
    'daily_report_hour': 8,
    'daily_report_minute': 0,
    'timezone': 'Asia/Shanghai',
}

CRAWL_SOURCES = {
    'mva_gov_cn': {
        'name': '退役军人事务部',
        'base_url': 'http://www.mva.gov.cn',
        'list_urls': [
            'http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/index.html',
            'http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/index_1.html',
        ],
        'list_selector': {
            'item': 'ul.list li, .news-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text, .article-title::text',
            'content': '.content ::text, #content ::text, .article-content ::text, .TRS_Editor ::text',
            'publish_date': '.time::text, .date::text, .publish-time::text, .info time::text',
            'source': '.source::text, .from::text, .laiyuan::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government_gov_cn',
        'encoding': 'utf-8',
        'priority': 1,
    },
    'gov_cn_gwy': {
        'name': '国务院办公厅',
        'base_url': 'http://www.gov.cn',
        'list_urls': [
            'http://www.gov.cn/zhengce/xxgk/index.htm',
            'http://www.gov.cn/zhengce/content/index.htm',
        ],
        'list_selector': {
            'item': 'ul.new-list li, .list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text, .xxgk-date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text',
            'content': '.pages_content ::text, #UCAP-CONTENT ::text, .content ::text',
            'publish_date': '.pubtime::text, .pages-date::text',
            'source': '.pages-source::text, .source::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government_gov_cn',
        'encoding': 'utf-8',
        'priority': 1,
    },
    'mca_gov_cn': {
        'name': '民政部',
        'base_url': 'http://www.mca.gov.cn',
        'list_urls': [
            'http://www.mca.gov.cn/article/gk/zcfg/index.html',
            'http://www.mca.gov.cn/article/gk/zcfg/index_1.html',
        ],
        'list_selector': {
            'item': 'ul.list_art li, .ar_list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text, em.time::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text',
            'content': '.content ::text, #zoom ::text, .article_content ::text',
            'publish_date': '.time::text, .date::text, .info::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government_gov_cn',
        'encoding': 'utf-8',
        'priority': 2,
    },
    'mohrss_gov_cn': {
        'name': '人力资源和社会保障部',
        'base_url': 'http://www.mohrss.gov.cn',
        'list_urls': [
            'http://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/index.html',
            'http://www.mohrss.gov.cn/xxgk2020/fdzdgknr/zcfg/index_1.html',
        ],
        'list_selector': {
            'item': 'ul.list li, .news-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .pub-date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text, .articleTitle::text',
            'content': '.content ::text, .TRS_UEDITOR ::text, .article-body ::text',
            'publish_date': '.time::text, .publishTime::text, .date::text',
            'source': '.source::text, .laiyuan::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government_gov_cn',
        'encoding': 'utf-8',
        'priority': 2,
    },
    'nhc_gov_cn': {
        'name': '国家卫生健康委员会',
        'base_url': 'http://www.nhc.gov.cn',
        'list_urls': [
            'http://www.nhc.gov.cn/xxgk/zcwj1/list.shtml',
            'http://www.nhc.gov.cn/xxgk/gfxwj/list.shtml',
        ],
        'list_selector': {
            'item': 'ul.list li, .zcfg_list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .list_date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text, .con_tit::text',
            'content': '.content ::text, .zoom ::text, .TRS_Editor ::text',
            'publish_date': '.time::text, .fabushijian::text, .dates::text',
            'source': '.source::text, .laiyuan::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government_gov_cn',
        'encoding': 'utf-8',
        'priority': 2,
    },
    'ybj_gov_cn': {
        'name': '国家医疗保障局',
        'base_url': 'http://www.nhsa.gov.cn',
        'list_urls': [
            'http://www.nhsa.gov.cn/col/col46/index.html',
            'http://www.nhsa.gov.cn/col/col47/index.html',
        ],
        'list_selector': {
            'item': 'ul.list li, .zhengce_list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text',
            'content': '.content ::text, .article-content ::text, #content ::text',
            'publish_date': '.time::text, .date::text, .pubtime::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government_gov_cn',
        'encoding': 'utf-8',
        'priority': 2,
    },
    'provincial_mva': {
        'name': '省退役军人事务厅',
        'base_url': 'http://tyjrswt.hebei.gov.cn',
        'list_urls': [
            'http://tyjrswt.hebei.gov.cn/xxgk/zcwj/index.html',
            'http://tyjrswt.hebei.gov.cn/xxgk/zcwj/gfxwj/index.html',
        ],
        'list_selector': {
            'item': '.news-list li, ul.news li, .zcwj_list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text, em::text, .time::text',
        },
        'detail_selector': {
            'title': 'h1::text, .article-title::text, .title::text',
            'content': '.article-content ::text, .content ::text, .TRS_Editor ::text',
            'publish_date': '.info .time::text, .date::text, .times::text',
            'source': '.info .source::text, .from::text, .laiyuan::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'provincial_gov',
        'encoding': 'utf-8',
        'priority': 3,
    },
    'provincial_hrss': {
        'name': '省人力资源和社会保障厅',
        'base_url': 'http://rst.hebei.gov.cn',
        'list_urls': [
            'http://rst.hebei.gov.cn/xxgk/zcwj/index.html',
            'http://rst.hebei.gov.cn/xxgk/zcfg/gfxwj/index.html',
        ],
        'list_selector': {
            'item': '.zcwj-list li, ul.file-list li, .news-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .article-title::text',
            'content': '.content ::text, .article-body ::text, #content ::text',
            'publish_date': '.time::text, .date::text, .fabushijian::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'provincial_gov',
        'encoding': 'utf-8',
        'priority': 3,
    },
    'provincial_ybj': {
        'name': '省医疗保障局',
        'base_url': 'http://ylbzj.hebei.gov.cn',
        'list_urls': [
            'http://ylbzj.hebei.gov.cn/xxgk/zcwj/index.html',
            'http://ylbzj.hebei.gov.cn/xxgk/zcfg/gfxwj/index.html',
        ],
        'list_selector': {
            'item': '.policy-list li, .news-list li, ul.list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text, .time::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text, .article-title::text',
            'content': '.content ::text, .article-content ::text, .TRS_UEDITOR ::text',
            'publish_date': '.date::text, .time::text, .publish_date::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'provincial_gov',
        'encoding': 'utf-8',
        'priority': 3,
    },
    'provincial_mca': {
        'name': '省民政厅',
        'base_url': 'http://minzheng.hebei.gov.cn',
        'list_urls': [
            'http://minzheng.hebei.gov.cn/xxgk/zcwj/index.html',
            'http://minzheng.hebei.gov.cn/xxgk/zcfg/gfxwj/index.html',
        ],
        'list_selector': {
            'item': '.file-list li, .news-list li, ul.zcfg li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .article-title::text',
            'content': '.content ::text, .article-content ::text, .zoom ::text',
            'publish_date': '.time::text, .date::text, .pubdate::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'provincial_gov',
        'encoding': 'utf-8',
        'priority': 3,
    },
    'provincial_health': {
        'name': '省卫生健康委员会',
        'base_url': 'http://wsjkw.hebei.gov.cn',
        'list_urls': [
            'http://wsjkw.hebei.gov.cn/xxgk/zcwj/index.html',
            'http://wsjkw.hebei.gov.cn/xxgk/zcfg/gfxwj/index.html',
        ],
        'list_selector': {
            'item': '.news-list li, .zcwj-list li, ul.list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text, .date::text',
        },
        'detail_selector': {
            'title': 'h1::text, .article-title::text, .title::text',
            'content': '.content ::text, .article-content ::text, .TRS_Editor ::text',
            'publish_date': '.time::text, .date::text, .publish-time::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'provincial_gov',
        'encoding': 'utf-8',
        'priority': 3,
    },
    'beijing_mva': {
        'name': '北京市退役军人事务局',
        'base_url': 'http://tyjrswj.beijing.gov.cn',
        'list_urls': [
            'http://tyjrswj.beijing.gov.cn/xxgk/zcwj/index.html',
        ],
        'list_selector': {
            'item': '.list-box li, ul.news li, .news-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text, em::text, .time::text',
        },
        'detail_selector': {
            'title': 'h1::text, .article-title::text, .title::text',
            'content': '.article-content ::text, .content ::text, .view TRS_UEDITOR ::text',
            'publish_date': '.info .time::text, .date::text',
            'source': '.info .source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'city_gov',
        'encoding': 'utf-8',
        'priority': 4,
    },
}

POLICY_CATEGORIES = {
    '伤残抚恤': {
        'keywords': ['伤残', '抚恤', '残疾', '评残', '伤残等级', '残疾军人', '伤残抚恤', '护理费', '辅助器具',
                     '伤残评定', '残疾评定', '退出现役残疾军人', '因战致残', '因公致残', '因病致残',
                     '伤残证', '残疾证', '革命伤残军人', '伤残人民警察', '伤残国家机关工作人员',
                     '伤残民兵民工', '伤残保健金', '伤残抚恤金', '残疾辅助器具', '康复器具',
                     '假肢配置', '矫形器', '轮椅', '助听器', '视力残疾', '听力残疾', '言语残疾',
                     '肢体残疾', '智力残疾', '精神残疾', '多重残疾'],
        'synonyms': {
            '伤残': ['残疾', '残废', '残障', '伤歼'],
            '抚恤': ['优抚', '优待', '补助', '补贴'],
            '护理费': ['陪护费', '护理补贴'],
            '辅助器具': ['康复器具', '假肢', '矫形器'],
        },
        'context_phrases': ['根据伤残抚恤', '按照残疾等级', '伤残等级为', '评定为残疾', '残疾军人享受',
                            '护理费标准', '辅助器具配置', '假肢更换', '评残程序'],
        'title_weight': 1.8,
        'weight': 1.0,
        'min_score': 2,
    },
    '定期生活补助': {
        'keywords': ['定期生活补助', '生活补助', '补助金', '优抚金', '定期定量补助', '老年生活补助',
                     '生活补贴', '定期补助', '定量补助', '在乡老复员军人', '带病回乡退伍军人',
                     '参战退役人员', '参试退役人员', '农村籍退役士兵', '部分退役士兵',
                     '老复员军人', '带病回乡', '参战参试', '两参人员', '退伍红军老战士',
                     '西路军红军老战士', '红军失散人员', '老党员', '老战士', '老烈属'],
        'synonyms': {
            '定期生活补助': ['生活补助', '生活补贴', '定量补助'],
            '优抚金': ['优待金', '补助金', '抚恤费'],
            '带病回乡': ['带病退伍', '回乡养病'],
            '参战参试': ['两参', '参战退役', '参试退役'],
        },
        'context_phrases': ['提高生活补助标准', '发放生活补助', '定期定量补助标准', '每人每月提高',
                            '一次性生活补助', '优抚对象生活', '补助资金下拨', '生活困难补助'],
        'title_weight': 1.8,
        'weight': 1.0,
        'min_score': 2,
    },
    '医疗救助': {
        'keywords': ['医疗救助', '医保', '医疗保障', '医疗补助', '医疗优惠', '医疗报销', '优抚医疗',
                     '大病救助', '医疗保险', '门诊救助', '住院救助', '医疗减免', '医疗优惠',
                     '一站式结算', '医疗一站式', '救助对象', '重特大疾病', '门诊统筹',
                     '住院报销', '医疗费用补助', '药品目录', '诊疗项目', '医疗服务设施',
                     '优抚医院', '荣军医院', '慢性病门诊', '特殊门诊', '大病保险',
                     '医疗救助对象', '医疗保障待遇', '医疗保障水平'],
        'synonyms': {
            '医疗救助': ['医疗补助', '医疗减免', '医疗援助'],
            '医保': ['医疗保险', '医保报销', '医保待遇'],
            '大病救助': ['重特大疾病救助', '大病保险'],
            '优抚医疗': ['军人医疗', '退役军人医疗'],
        },
        'context_phrases': ['医疗保障办法', '医疗救助实施', '医疗保险参保', '医疗费用报销比例',
                            '住院救助标准', '门诊救助额度', '一站式即时结算', '优抚对象医疗'],
        'title_weight': 1.8,
        'weight': 1.0,
        'min_score': 2,
    },
    '就业扶持': {
        'keywords': ['就业', '创业', '职业培训', '技能培训', '就业扶持', '就业服务', '创业扶持',
                     '岗位补贴', '社保补贴', '就业困难', '自主创业', '灵活就业', '公益性岗位',
                     '就业援助', '创业担保贷款', '创业培训', '职业技能', '就业创业',
                     '企业吸纳', '招聘退役军人', '退役军人就业', '就业创业服务',
                     '一次性创业补贴', '场地租金补贴', '创业孵化基地', '就业见习',
                     '岗位开发', '稳定就业', '转移就业', '就地就近就业'],
        'synonyms': {
            '就业': ['工作', '上岗', '职业'],
            '创业': ['自谋职业', '自主经营', '开公司'],
            '职业培训': ['技能培训', '职业教育', '岗位培训'],
            '创业担保贷款': ['创业贷款', '小额担保贷款'],
        },
        'context_phrases': ['促进就业创业', '就业扶持政策', '技能提升行动', '创业带动就业',
                            '就业服务体系', '职业技能等级', '岗位技能培训', '就业见习岗位'],
        'title_weight': 1.8,
        'weight': 1.0,
        'min_score': 2,
    },
    '优待抚恤': {
        'keywords': ['优待', '优抚', '优待金', '抚恤补助', '优抚对象', '优待抚恤',
                     '军人优待', '军属优待', '烈属优待', '抚恤优待', '优抚工作',
                     '拥军优属', '优待政策', '优待规定', '抚恤标准', '优抚安置',
                     '军人抚恤', '国家抚恤', '社会优待', '医疗优待', '交通优待',
                     '旅游优待', '文化优待', '住房优待', '教育优待'],
        'synonyms': {
            '优待': ['优抚', '照顾', '优惠', '特惠'],
            '抚恤': ['慰问', '安抚', '救助'],
            '拥军优属': ['双拥', '拥政爱民'],
        },
        'context_phrases': ['军人抚恤优待条例', '优抚对象优待', '拥军优属工作',
                            '优待抚恤标准', '抚恤优待对象', '依法享受优待'],
        'title_weight': 1.5,
        'weight': 0.9,
        'min_score': 2,
    },
    '退役安置': {
        'keywords': ['退役', '安置', '自主择业', '计划分配', '退伍', '复员', '转业',
                     '安置工作', '一次性退役金', '退役士兵', '退役军人', '转业干部',
                     '复员干部', '军转干部', '军队转业', '军队复员', '士兵退役',
                     '军官退役', '士官退役', '军士退役', '义务兵退役', '安置地',
                     '安置计划', '安置岗位', '安置方式', '逐月领取', '退休安置',
                     '供养安置', '由政府安排工作', '自主就业退役士兵'],
        'synonyms': {
            '退役': ['退伍', '复员', '转业', '退出现役'],
            '安置': ['安排工作', '分配', '就业安置'],
            '自主择业': ['逐月领取', '自主就业'],
            '军转干部': ['转业军官', '军队转业干部'],
        },
        'context_phrases': ['退役士兵安置', '军队转业干部安置', '退役军人安置',
                            '安置工作办法', '由政府安排工作', '自主就业退役士兵'],
        'title_weight': 1.8,
        'weight': 1.0,
        'min_score': 2,
    },
    '教育培训': {
        'keywords': ['教育', '培训', '学历教育', '职业教育', '技能培训', '教育培训',
                     '助学', '学费减免', '教育优待', '教育资助', '教育培训',
                     '退役军人教育', '成人教育', '继续教育', '高职扩招', '专升本',
                     '高考加分', '免试入学', '学费补偿', '国家助学贷款', '助学金',
                     '奖学金', '职业技能鉴定', '职业资格证书', '技能等级证书',
                     '1+X证书', '岗课赛证', '终身职业技能培训'],
        'synonyms': {
            '教育': ['教学', '就学', '升学'],
            '培训': ['培养', '训练', '实训'],
            '学历教育': ['高等教育', '中等教育', '职业教育'],
            '学费减免': ['学费补偿', '学费资助', '助学贷款'],
        },
        'context_phrases': ['教育优待政策', '教育培训工作', '职业技能提升',
                            '学费减免办法', '免试入学政策', '高职扩招专项'],
        'title_weight': 1.6,
        'weight': 1.0,
        'min_score': 2,
    },
    '住房保障': {
        'keywords': ['住房', '保障房', '廉租房', '公租房', '住房补贴', '危房改造',
                     '住房保障', '保障性住房', '租赁补贴', '购房补贴', '住房救助',
                     '保障性租赁住房', '共有产权住房', '棚户区改造', '城中村改造',
                     '老旧小区改造', '抗震改造', '房屋修缮', '拥军楼', '军产房',
                     '军人住房', '退役士兵住房', '优抚对象住房', '住房公积金',
                     '住房贷款', '住房优惠'],
        'synonyms': {
            '保障房': ['保障性住房', '公租房', '廉租房'],
            '危房改造': ['抗震改造', '房屋修缮', '老旧房改造'],
            '住房补贴': ['购房补贴', '租赁补贴', '住房补助'],
        },
        'context_phrases': ['住房保障办法', '优抚对象住房', '危房改造工作',
                            '保障性住房申请', '住房救助标准', '退役军人住房'],
        'title_weight': 1.6,
        'weight': 1.0,
        'min_score': 2,
    },
    '养老服务': {
        'keywords': ['养老', '敬老院', '养老院', '养老服务', '光荣院', '养老保障',
                     '高龄津贴', '养老机构', '居家养老', '社区养老', '医养结合',
                     '长期护理', '养老护理', '养老补贴', '基本养老服务',
                     '普惠养老', '互助养老', '智慧养老', '养老设施', '老年食堂',
                     '助餐服务', '适老化改造', '失能老人', '空巢老人', '独居老人',
                     '优抚对象养老', '光荣院养老', '军人养老院'],
        'synonyms': {
            '养老': ['养老服务', '老年照护', '养老保障'],
            '光荣院': ['荣军院', '军人养老院', '优抚医院养老'],
            '高龄津贴': ['高龄补贴', '老年补贴'],
            '医养结合': ['康养结合', '医养融合'],
        },
        'context_phrases': ['养老服务体系', '基本养老服务', '养老机构管理',
                            '光荣院建设', '高龄津贴发放', '医养结合服务'],
        'title_weight': 1.6,
        'weight': 1.0,
        'min_score': 2,
    },
    '褒扬纪念': {
        'keywords': ['褒扬', '纪念', '烈士', '英雄', '纪念馆', '烈士陵园', '烈士评定',
                     '纪念日', '英雄烈士', '烈士褒扬', '烈士纪念', '烈士墓',
                     '英雄模范', '功勋荣誉', '表彰奖励', '纪念设施', '烈士设施',
                     '军人公墓', '烈士公祭', '烈士纪念日', '清明祭扫', '缅怀英烈',
                     '英雄事迹', '烈士事迹', '红色教育', '革命传统教育',
                     '退役军人事务部烈士纪念设施保护中心', '国家级烈士纪念设施'],
        'synonyms': {
            '褒扬': ['表彰', '颂扬', '弘扬'],
            '纪念': ['缅怀', '追思', '祭奠'],
            '烈士': ['英烈', '英雄烈士', '革命烈士'],
            '烈士陵园': ['烈士墓', '烈士墓区', '军人公墓'],
        },
        'context_phrases': ['英雄烈士保护法', '烈士褒扬条例', '烈士纪念日活动',
                            '纪念设施保护', '烈士评定工作', '缅怀烈士功绩'],
        'title_weight': 1.8,
        'weight': 1.0,
        'min_score': 2,
    },
    '帮扶援助': {
        'keywords': ['帮扶', '援助', '救助', '困难补助', '临时救助', '特困', '帮扶解困',
                     '困难帮扶', '解困脱困', '送温暖', '走访慰问', '困难退役军人',
                     '生活困难', '医疗困难', '住房困难', '就业困难', '子女教育困难',
                     '特殊困难', '帮扶资金', '援助资金', '慈善帮扶', '社会帮扶',
                     '结对帮扶', '精准帮扶', '常态化帮扶', '帮扶联系卡',
                     '退役军人关爱基金', '困难帮扶机制', '解三难'],
        'synonyms': {
            '帮扶': ['援助', '救助', '扶助', '扶持'],
            '困难补助': ['困难救助', '临时补助', '送温暖'],
            '特困': ['特别困难', '特殊困难', '低保户'],
        },
        'context_phrases': ['困难退役军人帮扶', '帮扶援助办法', '解困脱困工作',
                            '常态化走访慰问', '关爱基金使用', '解三难工作'],
        'title_weight': 1.6,
        'weight': 1.0,
        'min_score': 2,
    },
    '其他': {
        'keywords': ['其他', '综合', '通知', '意见', '办法', '规定'],
        'synonyms': {},
        'context_phrases': [],
        'title_weight': 1.0,
        'weight': 0.3,
        'min_score': 10,
    },
}

POLICY_TYPES = {
    '法律': ['法律', '中华人民共和国', '法'],
    '行政法规': ['条例', '规定', '办法', '行政法规'],
    '部门规章': ['令', '规章', '规定', '办法'],
    '规范性文件': ['通知', '意见', '决定', '公告', '通告', '函'],
    '政策解读': ['解读', '问答', '解释', '说明', '指南'],
    '办事指南': ['办事指南', '办理流程', '申请指南', '服务指南'],
    '申请表格': ['表格', '申请表', '申报表', '下载'],
}

DATE_PATTERNS = [
    r'(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?',
    r'(\d{4})年(\d{1,2})月',
    r'发布日期[：: ]*(\d{4}-\d{2}-\d{2})',
    r'发文日期[：: ]*(\d{4}-\d{2}-\d{2})',
]

CRAWL_DATE_START = (datetime.now() - timedelta(days=365 * 5)).strftime('%Y-%m-%d')
CRAWL_DATE_END = datetime.now().strftime('%Y-%m-%d')

INCREMENTAL_UPDATE = True

CRAWL_PAGES = 50

STOP_ON_DUPLICATE = True

MIN_CONTENT_LENGTH = 50

MAX_CONTENT_LENGTH = 50000

OCR_ENABLED = False
OCR_LANG = 'chi_sim+eng'

EXPORT_FORMATS = ['json', 'excel', 'markdown']

JIEBA_CUSTOM_DICT = os.path.join(DATA_DIR, 'custom_dict.txt')

RELATION_PATTERNS = [
    r'根据[《〈]([^》〉]+)[》〉]',
    r'按照[《〈]([^》〉]+)[》〉]',
    r'依据[《〈]([^》〉]+)[》〉]',
    r'参照[《〈]([^》〉]+)[》〉]',
    r'[《〈]([^》〉]+)[》〉]规定',
    r'[《〈]([^》〉]+)[》〉]要求',
    r'[《〈]([^》〉]+)[》〉]明确',
    r'引用[《〈]([^》〉]+)[》〉]',
    r'见[《〈]([^》〉]+)[》〉]',
]

DB_INIT_SQL = '''
CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    title TEXT,
    content TEXT,
    category TEXT,
    sub_category TEXT,
    policy_type TEXT,
    publish_date TEXT,
    source TEXT,
    site_name TEXT,
    keywords TEXT,
    summary TEXT,
    attachments TEXT,
    raw_html TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS policy_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    policy_id INTEGER,
    referenced_policy_id INTEGER,
    referenced_title TEXT,
    relation_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (policy_id) REFERENCES policies (id),
    FOREIGN KEY (referenced_policy_id) REFERENCES policies (id)
);

CREATE TABLE IF NOT EXISTS crawl_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE NOT NULL,
    last_crawled TEXT,
    last_modified TEXT,
    etag TEXT,
    status TEXT,
    retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    keyword_count INTEGER DEFAULT 0,
    policy_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_policies_url ON policies(url);
CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_date ON policies(publish_date);
CREATE INDEX IF NOT EXISTS idx_policies_title ON policies(title);
CREATE INDEX IF NOT EXISTS idx_relations_policy ON policy_relations(policy_id);
CREATE INDEX IF NOT EXISTS idx_relations_referenced ON policy_relations(referenced_policy_id);
'''

APP_LOG_FILE = os.path.join(LOG_DIR, f'app_{datetime.now().strftime("%Y%m%d")}.log')
APP_LOG_LEVEL = 'INFO'
APP_LOG_MAX_BYTES = 10 * 1024 * 1024
APP_LOG_BACKUP_COUNT = 30

MEMCACHE_ENABLED = False
MEMCACHE_SERVERS = ['127.0.0.1:11211']

ENABLE_CACHE = False
CACHE_DIR = os.path.join(DATA_DIR, 'cache')
CACHE_EXPIRE = 86400
