import re
import html
from bs4 import BeautifulSoup
from itemadapter import ItemAdapter
from config.settings import MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH
from utils.logger import logger, log_error_with_context


class CleanPipeline:
    def __init__(self):
        self.stats = {
            'processed': 0,
            'cleaned': 0,
            'skipped': 0,
            'html_removed': 0,
            'special_chars_cleaned': 0,
            'truncated': 0,
        }

    def process_item(self, item, spider):
        adapter = ItemAdapter(item)
        self.stats['processed'] += 1

        try:
            if adapter.get('title'):
                adapter['title'] = self._clean_title(adapter['title'])

            if adapter.get('content'):
                cleaned_content = self._clean_content(adapter['content'])
                adapter['content'] = cleaned_content

                if len(cleaned_content) < MIN_CONTENT_LENGTH:
                    logger.debug(f"Content too short after cleaning ({len(cleaned_content)} chars): {adapter.get('url', 'unknown')}")
                    self.stats['skipped'] += 1

                if len(cleaned_content) > MAX_CONTENT_LENGTH:
                    adapter['content'] = cleaned_content[:MAX_CONTENT_LENGTH]
                    self.stats['truncated'] += 1

            if adapter.get('summary'):
                adapter['summary'] = self._clean_text(adapter['summary'])

            if adapter.get('source'):
                adapter['source'] = self._clean_source(adapter['source'])

            if adapter.get('publish_date'):
                adapter['publish_date'] = self._normalize_date(adapter['publish_date'])

            self.stats['cleaned'] += 1

            return item

        except Exception as e:
            log_error_with_context(logger, e, f"Error cleaning item: {adapter.get('url', 'unknown')}")
            return item

    def _clean_title(self, title):
        if not title:
            return ''

        title = self._basic_clean(title)
        title = re.sub(r'\s+', ' ', title)
        title = title.strip()

        if len(title) > 200:
            title = title[:200] + '...'

        return title

    def _clean_content(self, content):
        if not content:
            return ''

        if self._has_html(content):
            content = self._remove_html(content)
            self.stats['html_removed'] += 1

        content = self._basic_clean(content)

        content = self._remove_special_chars(content)
        self.stats['special_chars_cleaned'] += 1

        content = self._normalize_whitespace(content)

        content = self._remove_boilerplate(content)

        return content.strip()

    def _basic_clean(self, text):
        if not text:
            return ''

        text = html.unescape(text)
        text = text.replace('\x00', '')
        text = text.replace('\ufffd', '')
        text = text.replace('\u3000', ' ')

        return text

    def _has_html(self, text):
        if not text:
            return False
        html_patterns = ['<div', '<p>', '<br', '<span', '<table', '<ul', '<li', '<a ', '&nbsp;']
        return any(pattern in text.lower() for pattern in html_patterns)

    def _remove_html(self, html_content):
        try:
            soup = BeautifulSoup(html_content, 'html.parser')

            for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'noscript']):
                tag.decompose()

            text = soup.get_text(separator='\n', strip=True)

            return text
        except Exception as e:
            log_error_with_context(logger, e, "HTML parsing failed, using regex fallback")
            return self._remove_html_regex(html_content)

    def _remove_html_regex(self, html_content):
        text = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', '', text)
        text = html.unescape(text)
        return text

    def _remove_special_chars(self, text):
        if not text:
            return ''

        allowed_chars = (
            r'\u4e00-\u9fff'
            r'\u3000-\u303f'
            r'\uff00-\uffef'
            r'a-zA-Z0-9'
            r'\s\n\r\t'
            r'，。、；：？！""''（）【】《》〈〉「」『』〔〕—…·￥'
            r',.;:\?!\"\'()<>\[\]{}\\-_/\\@#$%^&*+=`~|'
        )

        pattern = f'[^{allowed_chars}]'
        text = re.sub(pattern, ' ', text)

        return text

    def _normalize_whitespace(self, text):
        if not text:
            return ''

        lines = text.split('\n')
        cleaned_lines = []

        for line in lines:
            line = re.sub(r'[ \t]+', ' ', line)
            line = line.strip()
            if line:
                cleaned_lines.append(line)

        text = '\n\n'.join(cleaned_lines)

        text = re.sub(r'\n{3,}', '\n\n', text)

        return text

    def _remove_boilerplate(self, text):
        if not text:
            return ''

        boilerplate_patterns = [
            r'^版权所有.*$',
            r'^主办单位.*$',
            r'^承办单位.*$',
            r'^技术支持.*$',
            r'^网站地图.*$',
            r'^隐私政策.*$',
            r'^使用条款.*$',
            r'^联系我们.*$',
            r'^ICP备.*$',
            r'^邮编.*$',
            r'^地址.*$',
            r'^电话.*$',
            r'^邮箱.*$',
            r'分享到.*',
            r'打印.*',
            r'关闭.*',
            r'返回顶部.*',
        ]

        lines = text.split('\n\n')
        filtered_lines = []

        for line in lines:
            is_boilerplate = False
            for pattern in boilerplate_patterns:
                if re.match(pattern, line.strip(), re.IGNORECASE):
                    is_boilerplate = True
                    break

            if not is_boilerplate:
                filtered_lines.append(line)

        return '\n\n'.join(filtered_lines)

    def _clean_source(self, source):
        if not source:
            return ''

        source = self._basic_clean(source)
        source = re.sub(r'^来源[：:]\s*', '', source)
        source = re.sub(r'^本站.*$', '本网站', source)
        return source.strip()

    def _normalize_date(self, date_str):
        if not date_str:
            return ''

        date_str = str(date_str).strip()

        if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            return date_str

        match = re.search(r'(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})', date_str)
        if match:
            try:
                year, month, day = match.groups()
                return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
            except (ValueError, TypeError):
                pass

        match = re.search(r'(\d{4})[-/年.](\d{1,2})', date_str)
        if match:
            try:
                year, month = match.groups()
                return f"{int(year):04d}-{int(month):02d}-01"
            except (ValueError, TypeError):
                pass

        return date_str

    def close_spider(self, spider):
        logger.info("=" * 50)
        logger.info("CLEAN PIPELINE STATISTICS")
        logger.info("=" * 50)
        for key, value in self.stats.items():
            logger.info(f"{key:25s}: {value}")
        logger.info("=" * 50)
