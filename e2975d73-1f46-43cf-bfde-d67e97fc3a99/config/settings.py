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
]

ENABLE_PROXY = False

CRAWL_SOURCES = {
    'mva_gov_cn': {
        'name': '退役军人事务部',
        'base_url': 'http://www.mva.gov.cn',
        'list_urls': [
            'http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/index.html',
            'http://www.mva.gov.cn/gongkai/fdzdgknr/zcfg/index_1.html',
        ],
        'list_selector': {
            'item': 'ul.list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text',
        },
        'detail_selector': {
            'title': 'h1::text, .title::text',
            'content': '.content::text, #content::text, .article-content ::text',
            'publish_date': '.time::text, .date::text, .publish-time::text',
            'source': '.source::text, .from::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': True,
        'site_type': 'government',
        'encoding': 'utf-8',
    },
    'provincial_mva': {
        'name': '省退役军人事务厅',
        'base_url': 'http://tyjrswt.xxx.gov.cn',
        'list_urls': [
            'http://tyjrswt.xxx.gov.cn/xxgk/zcwj/index.html',
        ],
        'list_selector': {
            'item': '.news-list li, ul.news li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text, em::text',
        },
        'detail_selector': {
            'title': 'h1::text, .article-title::text',
            'content': '.article-content ::text, .content ::text',
            'publish_date': '.info .time::text',
            'source': '.info .source::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': False,
        'site_type': 'government',
        'encoding': 'utf-8',
    },
    'provincial_hrss': {
        'name': '省人力资源和社会保障厅',
        'base_url': 'http://rst.xxx.gov.cn',
        'list_urls': [
            'http://rst.xxx.gov.cn/xxgk/zcwj/index.html',
        ],
        'list_selector': {
            'item': '.zcwj-list li, ul.file-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text',
        },
        'detail_selector': {
            'title': 'h1::text',
            'content': '.content ::text',
            'publish_date': '.time::text',
            'source': '.source::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': False,
        'site_type': 'government',
        'encoding': 'utf-8',
    },
    'provincial_ybj': {
        'name': '省医疗保障局',
        'base_url': 'http://ybj.xxx.gov.cn',
        'list_urls': [
            'http://ybj.xxx.gov.cn/xxgk/zcwj/index.html',
        ],
        'list_selector': {
            'item': '.policy-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.date::text',
        },
        'detail_selector': {
            'title': 'h1::text',
            'content': '.content ::text',
            'publish_date': '.date::text',
            'source': '.source::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': False,
        'site_type': 'government',
        'encoding': 'utf-8',
    },
    'provincial_mca': {
        'name': '省民政厅',
        'base_url': 'http://mca.xxx.gov.cn',
        'list_urls': [
            'http://mca.xxx.gov.cn/xxgk/zcwj/index.html',
        ],
        'list_selector': {
            'item': '.file-list li',
            'title': 'a::text',
            'url': 'a::attr(href)',
            'date': 'span.time::text',
        },
        'detail_selector': {
            'title': 'h1::text',
            'content': '.content ::text',
            'publish_date': '.time::text',
            'source': '.source::text',
            'attachment_links': 'a[href$=".pdf"]::attr(href), a[href$=".doc"]::attr(href), a[href$=".docx"]::attr(href)',
        },
        'enabled': False,
        'site_type': 'government',
        'encoding': 'utf-8',
    },
}

POLICY_CATEGORIES = {
    '伤残抚恤': {
        'keywords': ['伤残', '抚恤', '残疾', '评残', '伤残等级', '残疾军人', '伤残抚恤', '护理费', '辅助器具'],
        'weight': 1.0,
    },
    '定期生活补助': {
        'keywords': ['定期生活补助', '生活补助', '补助金', '优抚金', '定期定量补助', '老年生活补助'],
        'weight': 1.0,
    },
    '医疗救助': {
        'keywords': ['医疗救助', '医保', '医疗保障', '医疗补助', '医疗优惠', '医疗报销', '优抚医疗', '大病救助'],
        'weight': 1.0,
    },
    '就业扶持': {
        'keywords': ['就业', '创业', '职业培训', '技能培训', '就业扶持', '就业服务', '创业扶持', '岗位补贴', '社保补贴'],
        'weight': 1.0,
    },
    '优待抚恤': {
        'keywords': ['优待', '优抚', '优待金', '抚恤补助', '优抚对象', '优待抚恤'],
        'weight': 0.9,
    },
    '退役安置': {
        'keywords': ['退役', '安置', '自主择业', '计划分配', '退伍', '复员', '转业', '安置工作', '一次性退役金'],
        'weight': 1.0,
    },
    '教育培训': {
        'keywords': ['教育', '培训', '学历教育', '职业教育', '技能培训', '教育培训', '助学', '学费减免'],
        'weight': 1.0,
    },
    '住房保障': {
        'keywords': ['住房', '保障房', '廉租房', '公租房', '住房补贴', '危房改造', '住房保障'],
        'weight': 1.0,
    },
    '养老服务': {
        'keywords': ['养老', '敬老院', '养老院', '养老服务', '光荣院', '养老保障', '高龄津贴'],
        'weight': 1.0,
    },
    '褒扬纪念': {
        'keywords': ['褒扬', '纪念', '烈士', '英雄', '纪念馆', '烈士陵园', '烈士评定', '纪念日'],
        'weight': 1.0,
    },
    '帮扶援助': {
        'keywords': ['帮扶', '援助', '救助', '困难补助', '临时救助', '特困', '帮扶解困'],
        'weight': 1.0,
    },
    '其他': {
        'keywords': ['其他', '综合', '通知', '意见', '办法', '规定'],
        'weight': 0.5,
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
