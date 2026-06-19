#!/usr/bin/env python3
import argparse
import os
import sys
import time
import signal
import threading
from datetime import datetime
from typing import List, Dict, Optional

from twisted.internet import reactor, defer
from scrapy.crawler import CrawlerRunner, CrawlerProcess
from scrapy.settings import Settings
from scrapy.utils.project import get_project_settings
from scrapy.utils.log import configure_logging

from utils.config_loader import ConfigLoader
from utils.logger import CrawlLogger
from utils.proxy_manager import ProxyManager

SPIDER_MODULES = {
    'cnki': 'spiders.cnki_spider.CnkiSpider',
    'wanfang': 'spiders.wanfang_spider.WanfangSpider',
    'vip': 'spiders.vip_spider.VipSpider',
    'webofscience': 'spiders.webofscience_spider.WebOfScienceSpider',
    'scopus': 'spiders.scopus_spider.ScopusSpider',
    'pubmed': 'spiders.pubmed_spider.PubMedSpider',
    'doaj': 'spiders.doaj_spider.DoajSpider',
    'crossref': 'spiders.crossref_spider.CrossrefSpider',
    'google_scholar': 'spiders.google_scholar_spider.GoogleScholarSpider',
    'baidu_scholar': 'spiders.baidu_scholar_spider.BaiduScholarSpider',
    'microsoft_academic': 'spiders.microsoft_academic_spider.MicrosoftAcademicSpider',
    'cnki_journal_nav': 'spiders.cnki_journal_nav_spider.CnkiJournalNavSpider',
}


class JournalMetadataCrawler:
    def __init__(self, args):
        self.args = args
        self.start_time = time.time()
        self._shutdown = False

        self.config = ConfigLoader(args.config)

        if args.concurrent:
            self.config.set('crawl.concurrent_requests', min(int(args.concurrent), 10))
        if args.output:
            self.config.set('storage.default_format', args.output)
        if args.proxy:
            self.config.set('crawl.proxy_enabled', True)
        if args.quiet:
            self.config.set('logging.quiet', True)
        if args.verbose:
            self.config.set('logging.verbose', True)

        log_cfg = self.config.get('logging', {})
        self.crawl_logger = CrawlLogger(
            log_dir=log_cfg.get('log_dir', 'logs'),
            log_level=log_cfg.get('log_level', 'INFO'),
            verbose=args.verbose,
            quiet=args.quiet,
        )
        self.logger = self.crawl_logger.get_logger('MainCrawler')

        self.proxy_manager = None
        if self.config.get('crawl.proxy_enabled', False):
            proxy_list = self.config.get_proxy_list()
            self.proxy_manager = ProxyManager(
                proxy_list=proxy_list,
                check_interval=self.config.get('proxies.check_interval', 300),
                max_failures=self.config.get('proxies.max_failures', 5),
            )

        self.target_sources = self._resolve_sources(args.sources)
        self.crawl_settings = self.config.get_crawl_settings()

        self.progress_stats: Dict[str, Dict] = {s: {'success': 0, 'fail': 0, 'total': 0} for s in self.target_sources}
        self._progress_lock = threading.Lock()
        self._monitor_thread: Optional[threading.Thread] = None
        self._current_journals: Dict[str, Dict[str, str]] = {s: {} for s in self.target_sources}
        self._failed_queue: List[Dict] = []

        configure_logging(install_root_handler=False)

    def _resolve_sources(self, source_arg: Optional[str]) -> List[str]:
        if source_arg:
            specified = [s.strip() for s in source_arg.split(',') if s.strip()]
            enabled = self.config.get_enabled_sources()
            return [s for s in specified if s in SPIDER_MODULES]
        return self.config.get_enabled_sources()

    def _build_scrapy_settings(self) -> Settings:
        crawl_cfg = self.crawl_settings
        concurrent = int(crawl_cfg.get('concurrent_requests', 3))
        delay = float(crawl_cfg.get('download_delay', 1.0))

        settings = Settings({
            'BOT_NAME': 'JournalMetadataCrawler',
            'SPIDER_MODULES': ['spiders'],
            'NEWSPIDER_MODULE': 'spiders',

            'CONCURRENT_REQUESTS': concurrent,
            'CONCURRENT_REQUESTS_PER_DOMAIN': max(1, concurrent // 2),
            'CONCURRENT_REQUESTS_PER_IP': max(1, concurrent // 3),
            'DOWNLOAD_DELAY': delay,
            'RANDOMIZE_DOWNLOAD_DELAY': True,
            'AUTOTHROTTLE_ENABLED': True,
            'AUTOTHROTTLE_START_DELAY': delay,
            'AUTOTHROTTLE_MAX_DELAY': max(5.0, delay * 5),
            'AUTOTHROTTLE_TARGET_CONCURRENCY': concurrent * 0.8,

            'DOWNLOAD_TIMEOUT': int(crawl_cfg.get('timeout', 30)),

            'COOKIES_ENABLED': True,
            'COOKIES_DEBUG': False,

            'RETRY_ENABLED': False,

            'HTTPERROR_ALLOW_ALL': True,

            'DOWNLOADER_MIDDLEWARES': {
                'middlewares.useragent_middleware.UserAgentMiddleware': 400,
                'middlewares.auth_middleware.AuthMiddleware': 500,
                'middlewares.retry_middleware.ExponentialBackoffRetryMiddleware': 550,
            },

            'ITEM_PIPELINES': {
                'pipelines.deduplication_pipeline.DeduplicationPipeline': 100,
                'pipelines.validation_pipeline.ValidationPipeline': 200,
                'pipelines.storage_pipeline.StoragePipeline': 300,
            },

            'EXTENSIONS': {
                'scrapy.extensions.memusage.MemoryUsage': None,
                'scrapy.extensions.logstats.LogStats': 500,
            },

            'MEMUSAGE_ENABLED': True,
            'MEMUSAGE_LIMIT_MB': int(crawl_cfg.get('max_memory_mb', 1024)),
            'MEMUSAGE_WARNING_MB': int(crawl_cfg.get('max_memory_mb', 1024)) * 0.8,

            'LOG_ENABLED': not self.args.quiet,
            'LOG_LEVEL': 'WARNING' if self.args.quiet else ('DEBUG' if self.args.verbose else 'INFO'),
            'LOG_FORMAT': '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            'LOG_DATEFORMAT': '%Y-%m-%d %H:%M:%S',

            'REQUEST_FINGERPRINTER_IMPLEMENTATION': '2.7',

            'CONFIG_LOADER': self.config,
            'PROXY_MANAGER': self.proxy_manager,
            'OUTPUT_FORMAT': self.args.output or self.config.get('storage.default_format', 'sqlite'),

            'FEED_EXPORT_ENCODING': 'utf-8',
            'TELNETCONSOLE_ENABLED': False,
            'TELNETCONSOLE_PORT': None,
        })

        return settings

    def _start_progress_monitor(self):
        def monitor():
            total_prev = 0
            while not self._shutdown:
                try:
                    with self._progress_lock:
                        total_success = sum(s['success'] for s in self.progress_stats.values())
                        total_fail = sum(s['fail'] for s in self.progress_stats.values())
                        total_all = sum(s['total'] for s in self.progress_stats.values())
                        current_info = dict(self._current_journals)

                    elapsed = time.time() - self.start_time
                    rate = total_all / elapsed if elapsed > 0 else 0
                    new_items = total_all - total_prev
                    total_prev = total_all

                    if not self.args.quiet:
                        self._print_progress(total_success, total_fail, total_all, elapsed, rate, current_info)

                    if rate > 0 and new_items > 0:
                        if not self.args.quiet:
                            pass

                    time.sleep(2)
                except Exception as e:
                    self.logger.debug(f'Progress monitor error: {e}')
                    time.sleep(5)

        self._monitor_thread = threading.Thread(target=monitor, daemon=True)
        self._monitor_thread.start()

    def _print_progress(self, success: int, fail: int, total: int, elapsed: float, rate: float, current_info: Dict[str, Dict] = None):
        bar_width = 30
        target_issns = len(self.config.get_target_issns())
        expected_total = max(target_issns * len(self.target_sources), total * 2) if target_issns > 0 else max(1000, total * 2)
        progress = min(total / expected_total, 1.0)
        filled = int(bar_width * progress)
        bar = '█' * filled + '░' * (bar_width - filled)

        hrs, rem = divmod(int(elapsed), 3600)
        mins, secs = divmod(rem, 60)

        current_journal_text = ''
        if current_info:
            active_entries = []
            for source, info in current_info.items():
                name = info.get('journal_name', '') or info.get('issn', '')
                if name:
                    active_entries.append(f'{source}:{name[:10]}')
            if active_entries:
                current_journal_text = ' | ' + ', '.join(active_entries[:3])
                if len(active_entries) > 3:
                    current_journal_text += f'...(+{len(active_entries)-3})'

        try:
            term_width = os.get_terminal_size().columns
        except (OSError, AttributeError):
            term_width = 120

        base_line = (
            f'[{bar}] {progress*100:5.1f}% | '
            f'OK:{success:>5} F:{fail:>4} T:{total:>5} | '
            f'{rate:.1f}/s | '
            f'[{hrs:02d}:{mins:02d}:{secs:02d}]'
        )

        if current_journal_text:
            available = max(10, term_width - len(base_line) - len(current_journal_text) - 2)
            if len(current_journal_text) > available:
                current_journal_text = current_journal_text[:max(1, available-3)] + '...'
            output_line = base_line + current_journal_text
        else:
            output_line = base_line

        if len(output_line) > term_width - 1:
            output_line = output_line[:term_width - 1]

        sys.stdout.write(f'\r{output_line}')
        sys.stdout.flush()
        if progress >= 1.0:
            sys.stdout.write('\n')

    def update_current_journal(self, source: str, journal_name: str = '', issn: str = '', url: str = ''):
        with self._progress_lock:
            if source in self._current_journals:
                self._current_journals[source] = {
                    'journal_name': journal_name or '',
                    'issn': issn or '',
                    'url': url or '',
                    'updated_at': time.time(),
                }

    def update_stats(self, source: str, success: int = 0, fail: int = 0, total: int = 0):
        with self._progress_lock:
            if source in self.progress_stats:
                self.progress_stats[source]['success'] += success
                self.progress_stats[source]['fail'] += fail
                self.progress_stats[source]['total'] += total

    def _load_failed_queue(self) -> Dict[str, List[Dict]]:
        state_path = self.config.get('storage.resume_db_path', 'output/crawl_state.db')
        failed_by_source: Dict[str, List[Dict]] = {s: [] for s in self.target_sources}
        if not state_path:
            return failed_by_source
        try:
            import sqlite3
            import json
            import os
            if not os.path.exists(state_path):
                return failed_by_source
            conn = sqlite3.connect(state_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='failed_requests'")
            if cursor.fetchone():
                max_retry = self.config.get('crawl.max_retry_times', 3)
                for source in self.target_sources:
                    cursor.execute(
                        'SELECT id, url, reason, meta, retry_count FROM failed_requests '
                        'WHERE source = ? AND retry_count < ? ORDER BY id ASC LIMIT 500',
                        (source, max_retry)
                    )
                    for row in cursor.fetchall():
                        try:
                            meta = json.loads(row[3]) if row[3] else {}
                        except (json.JSONDecodeError, TypeError):
                            meta = {}
                        failed_by_source[source].append({
                            'id': row[0],
                            'url': row[1],
                            'reason': row[2],
                            'meta': meta,
                            'retry_count': row[4] or 0,
                        })
            conn.close()
            total = sum(len(v) for v in failed_by_source.values())
            if total > 0:
                self.logger.info(f'Loaded {total} failed requests for retry from database')
                for src, items in failed_by_source.items():
                    if items:
                        self.logger.info(f'  {src}: {len(items)} pending requests')
            else:
                self.logger.info('No failed requests found in database')
        except Exception as e:
            self.logger.warning(f'Failed to load failed queue: {e}')
        return failed_by_source

    def run(self):
        self.logger.info('=' * 60)
        self.logger.info('JOURNAL METADATA CRAWLER - STARTING')
        self.logger.info('=' * 60)
        self.logger.info(f'Target sources: {", ".join(self.target_sources)}')
        self.logger.info(f'Target ISSNs: {len(self.config.get_target_issns())}')
        self.logger.info(f'Concurrency: {self.crawl_settings.get("concurrent_requests", 3)}')
        self.logger.info(f'Output format: {self.args.output or self.config.get("storage.default_format")}')
        self.logger.info(f'Proxy enabled: {self.config.get("crawl.proxy_enabled", False)}')
        self.logger.info(f'Incremental mode: {self.config.get("incremental.enabled", True)}')
        self.logger.info('=' * 60)

        CrawlLogger().log_crawl_start('ALL_SOURCES', len(self.target_sources))

        failed_queue = self._load_failed_queue()

        settings = self._build_scrapy_settings()
        settings.set('MAIN_CRAWLER_REF', self, priority='settings')
        process = CrawlerProcess(settings, install_root_handler=False)

        incremental = self.config.get('incremental.enabled', True)
        target_issns = self.config.get_target_issns()

        for source in self.target_sources:
            if source not in SPIDER_MODULES:
                self.logger.warning(f'Skipping unknown source: {source}')
                continue

            module_path, class_name = SPIDER_MODULES[source].rsplit('.', 1)
            try:
                spider_module = __import__(module_path, fromlist=[class_name])
                spider_cls = getattr(spider_module, class_name)
            except (ImportError, AttributeError) as e:
                self.logger.error(f'Failed to load spider {source}: {e}')
                continue

            self.logger.info(f'Registering spider: {source} ({class_name})')
            process.crawl(
                spider_cls,
                config=self.config,
                target_issns=target_issns,
                incremental=incremental,
                failed_requests=failed_queue.get(source, []),
                progress_callback=self.update_current_journal,
                stats_callback=self.update_stats,
            )

        self._start_progress_monitor()

        def on_shutdown(signum, frame):
            self.logger.warning(f'Shutdown signal received ({signum}), finishing safely...')
            self._shutdown = True
            try:
                reactor.stop()
            except Exception:
                pass

        signal.signal(signal.SIGINT, on_shutdown)
        signal.signal(signal.SIGTERM, on_shutdown)

        try:
            process.start()
        finally:
            self._shutdown = True
            elapsed = time.time() - self.start_time
            self._print_final_report(elapsed)

    def _print_final_report(self, elapsed: float):
        self.logger.info('=' * 60)
        self.logger.info('FINAL CRAWL REPORT')
        self.logger.info('=' * 60)
        self.logger.info(f'Total duration: {elapsed:.1f}s ({elapsed/60:.1f} min)')

        with self._progress_lock:
            total_success = sum(s['success'] for s in self.progress_stats.values())
            total_fail = sum(s['fail'] for s in self.progress_stats.values())
            total_all = sum(s['total'] for s in self.progress_stats.values())

        self.logger.info(f'Total processed: {total_all}')
        self.logger.info(f'Total succeeded: {total_success}')
        self.logger.info(f'Total failed:    {total_fail}')
        if total_all > 0:
            rate = total_success / total_all * 100
            self.logger.info(f'Success rate:    {rate:.2f}%')
        self.logger.info(f'Throughput:      {total_all/elapsed:.2f} items/s')

        self.logger.info('')
        self.logger.info('Per-source breakdown:')
        with self._progress_lock:
            for source, stats in self.progress_stats.items():
                total_src = stats['total']
                if total_src > 0:
                    sr = stats['success'] / total_src * 100
                    self.logger.info(
                        f'  {source:22s} -> OK:{stats["success"]:>6} / '
                        f'FAIL:{stats["fail"]:>5} / TOTAL:{total_src:>6} ({sr:.1f}%)'
                    )

        output_dir = self.config.get('storage.output_dir', 'output')
        if os.path.exists(output_dir):
            outputs = [f for f in os.listdir(output_dir) if os.path.isfile(os.path.join(output_dir, f))]
            if outputs:
                self.logger.info('')
                self.logger.info('Output files:')
                for f in sorted(outputs)[-5:]:
                    fp = os.path.join(output_dir, f)
                    size = os.path.getsize(fp)
                    self.logger.info(f'  {f} ({size/1024:.1f} KB)')

        self.logger.info('=' * 60)
        self.logger.info('CRAWL COMPLETED')
        self.logger.info('=' * 60)
        CrawlLogger().log_crawl_end('ALL_SOURCES', total_success, total_fail, elapsed)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='期刊元数据采集系统 - 多源学术期刊信息爬虫',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python journal_metadata_crawler.py --config config/config.yaml
  python journal_metadata_crawler.py --output csv --concurrent 5
  python journal_metadata_crawler.py --sources cnki,wanfang,pubmed --proxy
  python journal_metadata_crawler.py --verbose --output all
  python journal_metadata_crawler.py --quiet --output sqlite
        '''
    )

    parser.add_argument(
        '--config', '-c',
        type=str,
        default=None,
        help='配置文件路径 (YAML/JSON格式)',
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        choices=['csv', 'json', 'sqlite', 'all'],
        default=None,
        help='输出格式 (默认: sqlite)',
    )
    parser.add_argument(
        '--concurrent', '-n',
        type=int,
        default=None,
        help='并发请求数 (1-10, 默认: 3)',
    )
    parser.add_argument(
        '--proxy', '-p',
        action='store_true',
        help='启用代理池',
    )
    parser.add_argument(
        '--sources', '-s',
        type=str,
        default=None,
        help=f'指定数据源 (逗号分隔), 可用: {",".join(SPIDER_MODULES.keys())}',
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='静默模式, 仅输出错误信息',
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='详细日志模式',
    )

    return parser.parse_args()


def main():
    args = parse_args()

    if args.concurrent and (args.concurrent < 1 or args.concurrent > 10):
        print(f'错误: 并发数必须在 1-10 之间, 得到: {args.concurrent}', file=sys.stderr)
        sys.exit(1)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    if base_dir not in sys.path:
        sys.path.insert(0, base_dir)

    try:
        crawler = JournalMetadataCrawler(args)
        crawler.run()
    except KeyboardInterrupt:
        print('\n\n用户中断, 正在退出...')
        sys.exit(130)
    except Exception as e:
        print(f'\n\n严重错误: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
