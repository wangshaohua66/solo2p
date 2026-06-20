const cheerio = require('cheerio');
const _ = require('lodash');
const dayjs = require('dayjs');

const commonTitleSelectors = [
  'h1', '.title', '#title', '.article-title', '.news-title',
  '.main-title', '.post_title', '.h-title', '.headline',
  'article h1', '.content h1', '.detail-title'
];

const commonContentSelectors = [
  'article', '.article-content', '#content', '.content',
  '.article-body', '.post-content', '.text', '.news-content',
  '.detail-content', '.rm_txt_con', '.text_con', '#p-detail',
  '.cnt_bd', '#artibody', '.post_body', '#endText',
  '.content-article', '.js_selection_area', '.news_txt',
  '#id_text', '.rich-text', '.m-txt', '#mp-editor',
  '.syl-page-article', '.article-detail', '.main-text'
];

const commonTimeSelectors = [
  '.time', '.date', '.pubtime', '.publish-time', '.publishTime',
  '.pub-time', '.post_time_source', '.post-time', '.pub_time',
  '.article-time', '.info1 .time', '.box01 .fl', '.info time',
  '.news_about .time', '.time-source', '#pub_date', '.a_time',
  '.index_time_link', '.article-item-time', '.c-color-gray',
  '.footer-bar', '.telegraph-time', '.meta', '.article-item .time'
];

const commonSourceSelectors = [
  '.source', '.laiyuan', '.comeFrom', '.from', '.media-name',
  '.box01 .fr', '.post_source', '.media', '.info1 .source',
  '.news_about .source', '.info1 .fr', '.author'
];

const noisePatterns = [
  /责任编辑[：:].*/g,
  /本文来源[：:].*/g,
  /原标题[：:].*/g,
  /作者[：:].*/g,
  /来源[：:].*/g,
  /编辑[：:].*/g,
  /审核[：:].*/g,
  /[【\[]责编.*?[】\]]/g,
  /[【\[]编辑.*?[】\]]/g,
  /\(完\)/g,
  /<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi,
  /<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi,
  /<\s*noscript[^>]*>[\s\S]*?<\s*\/\s*noscript\s*>/gi,
  /&[a-z]+;/gi,
  /\s+/g
];

class Parser {
  constructor() {
    this.knownTimeFormats = [
      'YYYY-MM-DD HH:mm:ss',
      'YYYY-MM-DD HH:mm',
      'YYYY-MM-DD',
      'YYYY年MM月DD日 HH:mm:ss',
      'YYYY年MM月DD日 HH:mm',
      'YYYY年MM月DD日',
      'YYYY/MM/DD HH:mm:ss',
      'YYYY/MM/DD HH:mm',
      'YYYY/MM/DD',
      'MM-DD HH:mm',
      'MM月DD日 HH:mm'
    ];
  }

  parseListPage(html, site) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const selectors = site.listSelectors || {};
    const results = [];

    try {
      const listSelector = selectors.newsList || 'a[href*="article"], a[href*="news"], a[href*="detail"]';
      const listItems = $(listSelector);

      listItems.each((idx, elem) => {
        try {
          const $elem = $(elem);

          let title = '';
          if (selectors.title) {
            title = $elem.find(selectors.title).first().text().trim();
          }
          if (!title) {
            title = $elem.find('a').first().text().trim();
          }
          if (!title) {
            title = $elem.text().trim();
          }

          let link = '';
          if (selectors.link) {
            link = $elem.find(selectors.link).first().attr('href') || '';
          }
          if (!link) {
            link = $elem.find('a').first().attr('href') || '';
          }
          if (!link) {
            link = $elem.attr('href') || '';
          }

          let time = '';
          if (selectors.time) {
            time = $elem.find(selectors.time).first().text().trim();
          }

          const cleanTitle = this._cleanText(title);
          const cleanLink = link ? link.trim() : '';

          if (cleanTitle && cleanTitle.length >= 4 && cleanLink && !cleanLink.includes('#')) {
            results.push({
              title: cleanTitle,
              url: cleanLink,
              publish_time: time || null,
              index: idx
            });
          }
        } catch (e) {
          // skip bad item
        }
      });
    } catch (e) {
      return [];
    }

    return _.uniqBy(results, 'url');
  }

  parseDetailPage(html, site) {
    const $ = cheerio.load(html, { decodeEntities: false });
    const selectors = site.detailSelectors || {};

    const title = this._extractTitle($, selectors.title);
    const content = this._extractContent($, selectors.content);
    const time = this._extractTime($, selectors.time);
    const source = this._extractSource($, selectors.source);
    const author = this._extractAuthor($, site);

    return {
      title: this._cleanText(title),
      content: this._cleanText(content),
      time: this._parseTime(time),
      source: this._cleanText(source),
      author: this._cleanText(author)
    };
  }

  _extractTitle($, customSelector) {
    const selectors = customSelector
      ? [customSelector, ...commonTitleSelectors]
      : commonTitleSelectors;

    for (const sel of selectors) {
      try {
        const $el = $(sel).first();
        if ($el.length) {
          const text = $el.text().trim();
          if (text && text.length >= 4 && text.length <= 200) {
            return text;
          }
        }
      } catch (e) { /* continue */ }
    }

    try {
      const metaTitle = $('meta[property="og:title"]').attr('content')
        || $('meta[name="title"]').attr('content')
        || $('title').text();
      if (metaTitle) return metaTitle;
    } catch (e) { /* ignore */ }

    return '';
  }

  _extractContent($, customSelector) {
    const selectors = customSelector
      ? [customSelector, ...commonContentSelectors]
      : commonContentSelectors;

    let bestContent = '';
    let maxLength = 0;

    for (const sel of selectors) {
      try {
        const $el = $(sel).first();
        if ($el.length) {
          const text = $el.text().trim();
          const length = text.length;
          if (length > maxLength && length >= 50) {
            maxLength = length;
            bestContent = text;
          }
        }
      } catch (e) { /* continue */ }
    }

    if (bestContent) {
      return this._removeNoise(bestContent);
    }

    try {
      const metaDesc = $('meta[property="og:description"]').attr('content')
        || $('meta[name="description"]').attr('content');
      if (metaDesc && metaDesc.length >= 50) {
        return this._removeNoise(metaDesc);
      }
    } catch (e) { /* ignore */ }

    return '';
  }

  _extractTime($, customSelector) {
    const selectors = customSelector
      ? [customSelector, ...commonTimeSelectors]
      : commonTimeSelectors;

    for (const sel of selectors) {
      try {
        const $el = $(sel).first();
        if ($el.length) {
          const text = $el.text().trim();
          if (text && /\d/.test(text)) {
            return text;
          }
        }
      } catch (e) { /* continue */ }
    }

    try {
      const metaTime = $('meta[property="article:published_time"]').attr('content')
        || $('meta[name="pubdate"]').attr('content')
        || $('meta[name="publishdate"]').attr('content')
        || $('time').first().attr('datetime');
      if (metaTime) return metaTime;
    } catch (e) { /* ignore */ }

    try {
      const scriptContent = $('script[type="application/ld+json"]').first().html();
      if (scriptContent) {
        const json = JSON.parse(scriptContent);
        if (json.datePublished) return json.datePublished;
        if (Array.isArray(json)) {
          const found = json.find((x) => x.datePublished);
          if (found) return found.datePublished;
        }
      }
    } catch (e) { /* ignore */ }

    return '';
  }

  _extractSource($, customSelector) {
    const selectors = customSelector
      ? [customSelector, ...commonSourceSelectors]
      : commonSourceSelectors;

    for (const sel of selectors) {
      try {
        const $el = $(sel).first();
        if ($el.length) {
          const text = $el.text().trim();
          if (text && text.length <= 50 && !/\d{4}/.test(text)) {
            return text.replace(/来源[：:]/g, '').trim();
          }
        }
      } catch (e) { /* continue */ }
    }

    try {
      const metaSource = $('meta[property="article:author"]').attr('content')
        || $('meta[name="source"]').attr('content')
        || $('meta[name="author"]').attr('content');
      if (metaSource) return metaSource;
    } catch (e) { /* ignore */ }

    return '';
  }

  _extractAuthor($, site) {
    const authorSelectors = [
      '.author', '.writer', '.byline', '.editor',
      '.news_about .author', '.article-author'
    ];

    for (const sel of authorSelectors) {
      try {
        const $el = $(sel).first();
        if ($el.length) {
          const text = $el.text().trim();
          if (text && text.length <= 30 && !/\d/.test(text)) {
            return text.replace(/作者[：:]/g, '').trim();
          }
        }
      } catch (e) { /* continue */ }
    }

    return '';
  }

  _cleanText(text) {
    if (!text || typeof text !== 'string') return '';

    let cleaned = text
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/\u3000/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    cleaned = this._removeNoise(cleaned);

    return cleaned;
  }

  _removeNoise(text) {
    if (!text) return '';

    let cleaned = text;
    for (const pattern of noisePatterns) {
      cleaned = cleaned.replace(pattern, ' ');
    }

    cleaned = cleaned
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  _parseTime(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;

    const cleanTime = timeStr.trim()
      .replace(/[\s年]/g, '-').replace(/月/g, '-').replace(/日/g, ' ')
      .replace(/[点时]/g, ':').replace(/分/g, '').replace(/秒/g, '')
      .replace(/^-/, '').trim();

    if (/^20\d{2}-\d{1,2}-\d{1,2}/.test(cleanTime)) {
      const d = dayjs(cleanTime);
      if (d.isValid()) {
        return d.format('YYYY-MM-DD HH:mm:ss');
      }
    }

    for (const format of this.knownTimeFormats) {
      const d = dayjs(timeStr, format);
      if (d.isValid()) {
        return d.format('YYYY-MM-DD HH:mm:ss');
      }
    }

    const match = timeStr.match(/(20\d{2})[^\d]*(\d{1,2})[^\d]*(\d{1,2})/);
    if (match) {
      const [, y, m, d] = match;
      const timeMatch = timeStr.match(/(\d{1,2})[^\d]*(\d{2})/);
      if (timeMatch) {
        return dayjs(`${y}-${m}-${d} ${timeMatch[1]}:${timeMatch[2]}`).format('YYYY-MM-DD HH:mm:ss');
      }
      return dayjs(`${y}-${m}-${d}`).format('YYYY-MM-DD HH:mm:ss');
    }

    return null;
  }

  extractKeywords(text, topN = 20) {
    if (!text || text.length < 10) return [];

    const stopWords = new Set([
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      '自己', '这', '他', '她', '它', '这个', '那个', '这些', '那些', '什么', '怎么',
      '但', '而', '与', '及', '或', '等', '为', '以', '之', '其', '于', '后', '中',
      '里', '前', '后', '大', '小', '多', '少', '新', '年', '月', '日', '时', '分',
      '被', '把', '让', '给', '向', '从', '对', '将', '还', '才', '再', '并', '又',
      '可以', '已经', '因为', '所以', '但是', '如果', '虽然', '不过', '而且', '以及',
      '进行', '通过', '表示', '认为', '可能', '应该', '需要', '成为', '开始', '工作',
      '这样', '那样', '如何', '哪些', '哪里', '哪个', '现在', '今天', '昨天', '明天',
      '记者', '报道', '消息', '新闻', '了解', '获悉', '据', '称', '说', '指出', '透露'
    ]);

    const freq = {};
    const minLen = 2;
    const maxLen = 4;

    for (let len = minLen; len <= maxLen; len++) {
      for (let i = 0; i <= text.length - len; i++) {
        const word = text.slice(i, i + len);
        if (/^[\u4e00-\u9fa5a-zA-Z]+$/.test(word) && !stopWords.has(word)) {
          freq[word] = (freq[word] || 0) + 1;
        }
      }
    }

    return Object.entries(freq)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word]) => word);
  }
}

module.exports = Parser;
