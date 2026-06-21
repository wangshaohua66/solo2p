#!/usr/bin/env python3
"""
省级公共就业服务招聘网站爬虫系统
"""

import os
import sys
import logging
import argparse
import time
from datetime import datetime, timedelta
from logging.handlers import TimedRotatingFileHandler
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import Select
from selenium.common.exceptions import (
    WebDriverException,
    TimeoutException,
    NoSuchElementException,
    ElementNotInteractableException,
    StaleElementReferenceException,
)

from config import settings
from browser_manager import BrowserManager, CookiePool, get_cookie_pool
from page_parser import PageParser, Job
from data_processor import DataProcessor
from scheduler import Scheduler, AlertNotifier


def setup_logging():
    log_dir = settings.logging.log_dir
    os.makedirs(log_dir, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.logging.level.upper(), logging.INFO))
    root_logger.handlers.clear()

    log_file = os.path.join(log_dir, f"{settings.logging.file_prefix}.log")
    file_handler = TimedRotatingFileHandler(
        log_file,
        when="midnight",
        interval=1,
        backupCount=settings.logging.retention_days,
        encoding="utf-8",
    )
    file_handler.setFormatter(logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)-20s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    root_logger.addHandler(file_handler)

    if settings.logging.console_colors:
        try:
            import colorama
            colorama.init()
        except ImportError:
            pass

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColorFormatter())
    root_logger.addHandler(console_handler)

    return root_logger


class ColorFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        formatted = super().format(record)
        if color and sys.stdout.isatty():
            return f"{color}{formatted}{self.RESET}"
        return formatted


class ProgressBar:
    def __init__(self, total: int, prefix: str = "Progress", width: int = 40):
        self.total = max(total, 1)
        self.prefix = prefix
        self.width = width
        self.current = 0
        self.start_time = time.time()

    def update(self, current: int = None):
        if current is not None:
            self.current = current
        else:
            self.current += 1
        self._render()

    def _render(self):
        fraction = min(self.current / self.total, 1.0)
        filled = int(self.width * fraction)
        bar = "█" * filled + "░" * (self.width - filled)
        elapsed = time.time() - self.start_time
        eta = elapsed / fraction - elapsed if fraction > 0 else 0
        sys.stdout.write(
            f"\r{self.prefix}: |{bar}| {self.current}/{self.total} "
            f"({fraction*100:5.1f}%) | 耗时 {elapsed:.1f}s | 剩余 {eta:.1f}s"
        )
        sys.stdout.flush()
        if self.current >= self.total:
            sys.stdout.write("\n")


class JobCrawler:
    def __init__(self):
        self.parser = PageParser()
        self.processor = DataProcessor()
        self.notifier = AlertNotifier()
        self.stats: Dict[str, Any] = {
            "pages_crawled": 0,
            "jobs_found": 0,
            "jobs_saved": 0,
            "jobs_added": 0,
            "jobs_modified": 0,
            "jobs_deleted": 0,
            "errors": 0,
        }

    @staticmethod
    def _find_first_element(driver, by: By, selectors: str):
        for selector in [s.strip() for s in selectors.split(",") if s.strip()]:
            try:
                el = driver.find_element(by, selector)
                if el.is_displayed():
                    return el
            except (NoSuchElementException, StaleElementReferenceException, ElementNotInteractableException):
                continue
        return None

    def submit_search_form(
        self,
        browser: BrowserManager,
        keyword: str = "",
        location: str = "",
        salary: str = "",
        education: str = "",
        search_url: str = "",
    ) -> bool:
        logger = logging.getLogger(__name__)
        target_url = search_url or settings.crawler.search_url
        if not target_url:
            logger.error("Search URL is not configured")
            return False

        logger.info(
            "Submitting search form: keyword=%s, location=%s, salary=%s, education=%s",
            keyword, location, salary, education,
        )

        try:
            browser.navigate(target_url, apply_cookies=True)
            browser.wait_for_ajax()

            form_indicators = [
                (By.CSS_SELECTOR, "form.search-form"),
                (By.CSS_SELECTOR, "form"),
                (By.CSS_SELECTOR, "div.search-container"),
                (By.CSS_SELECTOR, "input[name='keyword']"),
                (By.CSS_SELECTOR, "input#keyword"),
            ]
            found_any = False
            for by, sel in form_indicators:
                try:
                    browser.wait_for_element(by, sel, timeout=10)
                    found_any = True
                    break
                except TimeoutException:
                    continue
            if not found_any:
                logger.warning("Search form indicators not found; proceeding anyway")

            sf_cfg = settings.search_form

            if keyword:
                kw_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.keyword_selector)
                if kw_el is not None:
                    try:
                        kw_el.clear()
                        kw_el.send_keys(Keys.CONTROL, "a")
                        kw_el.send_keys(Keys.BACKSPACE)
                        kw_el.send_keys(keyword)
                        logger.info("Entered keyword: %s", keyword)
                    except (ElementNotInteractableException, StaleElementReferenceException) as e:
                        logger.warning("Failed to enter keyword: %s", str(e))
                else:
                    logger.warning("Keyword input not found with selectors: %s", sf_cfg.keyword_selector)

            if location:
                loc_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.location_selector)
                if loc_el is not None:
                    try:
                        if loc_el.tag_name.lower() == "select":
                            Select(loc_el).select_by_visible_text(location)
                        else:
                            loc_el.clear()
                            loc_el.send_keys(location)
                        logger.info("Set location: %s", location)
                    except Exception as e:
                        logger.warning("Failed to set location: %s", str(e))
                else:
                    logger.debug("Location input/select not found: %s", sf_cfg.location_selector)

            if salary:
                sal_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.salary_selector)
                if sal_el is not None:
                    try:
                        if sal_el.tag_name.lower() == "select":
                            Select(sal_el).select_by_visible_text(salary)
                        else:
                            sal_el.clear()
                            sal_el.send_keys(salary)
                        logger.info("Set salary: %s", salary)
                    except Exception as e:
                        logger.warning("Failed to set salary: %s", str(e))
                else:
                    logger.debug("Salary input/select not found: %s", sf_cfg.salary_selector)

            if education:
                edu_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.education_selector)
                if edu_el is not None:
                    try:
                        if edu_el.tag_name.lower() == "select":
                            Select(edu_el).select_by_visible_text(education)
                        else:
                            edu_el.clear()
                            edu_el.send_keys(education)
                        logger.info("Set education: %s", education)
                    except Exception as e:
                        logger.warning("Failed to set education: %s", str(e))
                else:
                    logger.debug("Education input/select not found: %s", sf_cfg.education_selector)

            submit_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.submit_selector)
            if submit_el is not None:
                try:
                    browser.driver.execute_script("arguments[0].scrollIntoView({block:'center'});", submit_el)
                    time.sleep(0.5)
                    try:
                        submit_el.click()
                    except ElementNotInteractableException:
                        browser.driver.execute_script("arguments[0].click();", submit_el)
                    logger.info("Search form submitted via click")
                except Exception as e:
                    logger.warning("Failed to click submit button: %s", str(e))
                    if keyword:
                        kw_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.keyword_selector)
                        if kw_el is not None:
                            try:
                                kw_el.send_keys(Keys.RETURN)
                                logger.info("Search form submitted via ENTER key")
                            except Exception as e2:
                                logger.error("Submit failed completely: %s", str(e2))
                                return False
            else:
                logger.warning("Submit button not found; trying ENTER on keyword input")
                if keyword:
                    kw_el = self._find_first_element(browser.driver, By.CSS_SELECTOR, sf_cfg.keyword_selector)
                    if kw_el is not None:
                        try:
                            kw_el.send_keys(Keys.RETURN)
                            logger.info("Search form submitted via ENTER key")
                        except Exception as e:
                            logger.error("Submit via ENTER failed: %s", str(e))
                            return False

            if sf_cfg.ajax_trigger:
                browser.wait_for_ajax(timeout=30)
            else:
                time.sleep(3)

            time.sleep(1)
            browser.handle_captcha()

            logger.info("Search form submission complete, current URL: %s", browser.driver.current_url)
            return True

        except (WebDriverException, TimeoutException, ConnectionError) as e:
            logger.error("Failed to submit search form: %s", str(e))
            self.stats["errors"] += 1
            return False

    def crawl_with_search(
        self,
        keyword: str = "",
        location: str = "",
        salary: str = "",
        education: str = "",
        search_url: str = "",
        max_pages: int = None,
    ) -> Dict[str, Any]:
        logger = logging.getLogger(__name__)
        start_time = time.time()

        with BrowserManager(headless=settings.headless) as browser:
            ok = self.submit_search_form(
                browser, keyword=keyword, location=location,
                salary=salary, education=education, search_url=search_url,
            )
            if not ok:
                logger.error("Search form submission failed, aborting crawl")
                self.stats["duration_seconds"] = round(time.time() - start_time, 2)
                return self.stats

            all_job_info = self._parse_current_page(browser)

            if max_pages:
                pagination_links = self.parser.extract_pagination_links(browser.get_page_source())
                for link in pagination_links[: max_pages - 1]:
                    try:
                        jobs = self.crawl_list_page(browser, link)
                        all_job_info.extend(jobs)
                    except Exception as e:
                        logger.warning("Error crawling pagination page %s: %s", link, str(e))
                        continue

        return self._process_and_save(all_job_info, start_time)

    def _parse_current_page(self, browser: BrowserManager) -> List[Dict[str, str]]:
        logger = logging.getLogger(__name__)
        list_indicators = [
            (By.CSS_SELECTOR, "div.job-list"),
            (By.CSS_SELECTOR, "ul.job-list"),
            (By.CSS_SELECTOR, "div.job-item"),
            (By.CSS_SELECTOR, "li.job-item"),
            (By.TAG_NAME, "table"),
        ]
        for by, sel in list_indicators:
            try:
                browser.wait_for_element(by, sel, timeout=10)
                break
            except TimeoutException:
                continue

        scroll_count = browser.scroll_infinite()
        logger.debug("Performed %d scroll operations on search result page", scroll_count)

        try:
            browser.click_load_more(By.XPATH, "//button[contains(text(), '加载更多')]")
        except Exception:
            pass
        try:
            browser.click_load_more(By.XPATH, "//a[contains(text(), '加载更多')]")
        except Exception:
            pass

        html = browser.get_page_source()
        job_list = self.parser.parse_job_list(html)
        self.stats["pages_crawled"] += 1
        self.stats["jobs_found"] += len(job_list)
        logger.info("Found %d jobs on search result page", len(job_list))
        return job_list

    def _process_and_save(
        self, all_job_info: List[Dict[str, str]], start_time: float
    ) -> Dict[str, Any]:
        logger = logging.getLogger(__name__)

        unique_info: Dict[str, Dict[str, str]] = {}
        for info in all_job_info:
            url = info.get("job_url", "")
            if url and url not in unique_info:
                unique_info[url] = info
        all_job_info = list(unique_info.values())
        logger.info("Total unique job URLs: %d", len(all_job_info))

        all_jobs: List[Job] = []
        if all_job_info:
            progress = ProgressBar(len(all_job_info), prefix="抓取详情页")
            concurrency = min(settings.crawler.concurrency, len(all_job_info))
            with ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = {executor.submit(self.crawl_job_detail, info): info for info in all_job_info}
                for future in as_completed(futures):
                    try:
                        job = future.result()
                        if job:
                            all_jobs.append(job)
                    except Exception as e:
                        logger.error("Error processing job detail: %s", str(e))
                        self.stats["errors"] += 1
                    progress.update()

        cleaned_jobs = [self.processor.clean_job(job) for job in all_jobs]
        cleaned_jobs = self.processor.deduplicate_jobs(cleaned_jobs)

        changes = self.processor.detect_changes(cleaned_jobs)
        inserted, updated = self.processor.save_jobs(changes["added"] + changes["modified"])
        deleted_ids = [j.job_id for j in changes["deleted"]]
        deleted_count = self.processor.mark_deleted(deleted_ids)

        self.stats["jobs_saved"] = inserted + updated
        self.stats["jobs_added"] = changes["summary"]["added"]
        self.stats["jobs_modified"] = changes["summary"]["modified"]
        self.stats["jobs_deleted"] = deleted_count
        self.stats["duration_seconds"] = round(time.time() - start_time, 2)
        self.stats["report_files"] = changes.get("report_files", [])

        logger.info("=" * 60)
        logger.info("抓取统计:")
        for key, value in self.stats.items():
            logger.info("  %-20s: %s", key, value)
        logger.info("=" * 60)

        return self.stats

    def crawl_list_page(self, browser: BrowserManager, url: str) -> List[Dict[str, str]]:
        logger = logging.getLogger(__name__)
        logger.info("Crawling list page: %s", url)
        try:
            browser.navigate(url)
            browser.wait_for_ajax()

            list_indicators = [
                (By.CSS_SELECTOR, "div.job-list"),
                (By.CSS_SELECTOR, "ul.job-list"),
                (By.CSS_SELECTOR, "div.job-item"),
                (By.CSS_SELECTOR, "li.job-item"),
                (By.TAG_NAME, "table"),
            ]
            for by, sel in list_indicators:
                try:
                    browser.wait_for_element(by, sel, timeout=10)
                    break
                except TimeoutException:
                    continue

            scroll_count = browser.scroll_infinite()
            logger.debug("Performed %d scroll operations", scroll_count)

            try:
                browser.click_load_more(By.XPATH, "//button[contains(text(), '加载更多')]")
            except Exception:
                pass
            try:
                browser.click_load_more(By.XPATH, "//a[contains(text(), '加载更多')]")
            except Exception:
                pass

            html = browser.get_page_source()
            job_list = self.parser.parse_job_list(html)
            self.stats["pages_crawled"] += 1
            self.stats["jobs_found"] += len(job_list)
            logger.info("Found %d jobs on list page", len(job_list))
            return job_list

        except (WebDriverException, TimeoutException, ConnectionError) as e:
            logger.error("Failed to crawl list page %s: %s", url, str(e))
            self.stats["errors"] += 1
            return []

    def crawl_job_detail(self, job_info: Dict[str, str]) -> Job:
        logger = logging.getLogger(__name__)
        url = job_info.get("job_url", "")
        if not url:
            job = Job()
            for k, v in job_info.items():
                if hasattr(job, k):
                    setattr(job, k, v)
            job.job_id = job.generate_id()
            return job

        with BrowserManager(headless=settings.headless) as browser:
            try:
                browser.navigate(url)
                browser.wait_for_ajax()

                detail_indicators = [
                    (By.CSS_SELECTOR, ".job-detail"),
                    (By.CSS_SELECTOR, ".job-description"),
                    (By.CSS_SELECTOR, ".description"),
                    (By.CSS_SELECTOR, ".content"),
                    (By.TAG_NAME, "h1"),
                ]
                for by, sel in detail_indicators:
                    try:
                        browser.wait_for_element(by, sel, timeout=10)
                        break
                    except TimeoutException:
                        continue

                browser.handle_captcha()

                html = browser.get_page_source()
                job = self.parser.parse_job_detail(html, url)

                for k, v in job_info.items():
                    if not getattr(job, k, None) and hasattr(job, k):
                        setattr(job, k, v)

                if not job.job_id:
                    job.job_id = job.generate_id()

                return job

            except (WebDriverException, TimeoutException, ConnectionError) as e:
                logger.error("Failed to crawl detail %s: %s", url, str(e))
                self.stats["errors"] += 1
                job = Job()
                for k, v in job_info.items():
                    if hasattr(job, k):
                        setattr(job, k, v)
                job.job_id = job.generate_id()
                return job

    def crawl_all(self, list_url: str = None, max_pages: int = None) -> Dict[str, Any]:
        logger = logging.getLogger(__name__)
        start_time = time.time()
        list_url = list_url or settings.crawler.list_url

        with BrowserManager(headless=settings.headless) as browser:
            all_job_info = self.crawl_list_page(browser, list_url)

            if max_pages:
                pagination_links = self.parser.extract_pagination_links(browser.get_page_source())
                for link in pagination_links[: max_pages - 1]:
                    try:
                        jobs = self.crawl_list_page(browser, link)
                        all_job_info.extend(jobs)
                    except Exception as e:
                        logger.warning("Error crawling pagination page %s: %s", link, str(e))
                        continue

        return self._process_and_save(all_job_info, start_time)

    def incremental_crawl(self) -> Dict[str, Any]:
        logger = logging.getLogger(__name__)
        logger.info("Starting incremental crawl")
        return self.crawl_all(max_pages=1)

    def export_data(self, output_format: str, output_path: str, start_date: str = None, end_date: str = None):
        logger = logging.getLogger(__name__)
        if start_date and end_date:
            jobs = self.processor.get_jobs_by_date_range(start_date, end_date)
        else:
            jobs = self.processor.get_all_jobs()

        logger.info("Exporting %d jobs to %s format at %s", len(jobs), output_format, output_path)

        if output_format.lower() == "json":
            self.processor.export_to_json(jobs, output_path)
        elif output_format.lower() == "csv":
            self.processor.export_to_csv(jobs, output_path)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")

        logger.info("Export complete: %s", output_path)


def main():
    parser = argparse.ArgumentParser(
        description="省级公共就业服务招聘网站爬虫系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s crawl --full                                 # 全量抓取
  %(prog)s crawl --incremental                          # 增量抓取
  %(prog)s crawl --max-pages 5 --no-headless            # 抓取指定页数并显示浏览器
  %(prog)s search --keyword "Java工程师"                # 按关键词搜索抓取
  %(prog)s search --keyword "后端" --location "北京" --education "本科" --max-pages 3
  %(prog)s export --format csv --output jobs.csv
  %(prog)s export --format json --output jobs.json --start 2024-01-01 --end 2024-01-31
  %(prog)s stats                                        # 查看数据库统计
  %(prog)s schedule --daily 2:00                        # 每天凌晨2点定时抓取
        """,
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    crawl_parser = subparsers.add_parser("crawl", help="执行抓取任务")
    crawl_group = crawl_parser.add_mutually_exclusive_group()
    crawl_group.add_argument("--full", action="store_true", help="全量抓取")
    crawl_group.add_argument("--incremental", action="store_true", help="增量抓取")
    crawl_parser.add_argument("--max-pages", type=int, help="最大抓取页数")
    crawl_parser.add_argument("--url", type=str, help="自定义列表页URL")
    crawl_parser.add_argument("--no-headless", action="store_true", help="显示浏览器窗口")
    crawl_parser.add_argument(
        "--enable-cookie-pool", action="store_true",
        help="启用 Cookie 池轮换 (config.cookie_pool.enabled)",
    )

    search_parser = subparsers.add_parser("search", help="按条件搜索并抓取")
    search_parser.add_argument("--keyword", "-k", type=str, default="", help="职位关键词")
    search_parser.add_argument("--location", "-l", type=str, default="", help="工作地点")
    search_parser.add_argument("--salary", "-s", type=str, default="", help="薪资范围选择")
    search_parser.add_argument("--education", "-e", type=str, default="", help="学历要求选择")
    search_parser.add_argument("--search-url", type=str, default="", help="自定义搜索页URL")
    search_parser.add_argument("--max-pages", type=int, help="搜索结果最大抓取页数")
    search_parser.add_argument("--no-headless", action="store_true", help="显示浏览器窗口")
    search_parser.add_argument(
        "--enable-cookie-pool", action="store_true",
        help="启用 Cookie 池轮换",
    )

    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("--format", required=True, choices=["json", "csv"], help="输出格式")
    export_parser.add_argument("--output", required=True, help="输出文件路径")
    export_parser.add_argument("--start", help="开始日期 (YYYY-MM-DD)")
    export_parser.add_argument("--end", help="结束日期 (YYYY-MM-DD)")

    subparsers.add_parser("stats", help="查看数据库统计")

    schedule_parser = subparsers.add_parser("schedule", help="定时任务")
    schedule_parser.add_argument("--hourly", type=int, help="每N小时执行一次")
    schedule_parser.add_argument("--daily", type=str, help="每天指定时间执行 (HH:MM)")

    args = parser.parse_args()

    setup_logging()
    logger = logging.getLogger(__name__)

    if args.command in ("crawl", "search"):
        if getattr(args, "no_headless", False):
            settings.headless = False
        if getattr(args, "enable_cookie_pool", False):
            settings.cookie_pool.enabled = True
            pool_size = get_cookie_pool().size()
            logger.info("Cookie pool enabled, current size: %d", pool_size)

    if args.command == "crawl":
        crawler = JobCrawler()
        if args.incremental:
            crawler.incremental_crawl()
        else:
            crawler.crawl_all(list_url=args.url, max_pages=args.max_pages)

    elif args.command == "search":
        if not any([args.keyword, args.location, args.salary, args.education]):
            logger.warning("No search criteria specified. Please provide at least one search parameter.")
        crawler = JobCrawler()
        crawler.crawl_with_search(
            keyword=args.keyword,
            location=args.location,
            salary=args.salary,
            education=args.education,
            search_url=args.search_url,
            max_pages=args.max_pages,
        )

    elif args.command == "export":
        crawler = JobCrawler()
        crawler.export_data(args.format, args.output, args.start, args.end)

    elif args.command == "stats":
        crawler = JobCrawler()
        stats = crawler.processor.get_stats()
        print("\n===== 数据库统计 =====")
        print(f"有效职位数: {stats['total_active']}")
        print(f"已删除职位数: {stats['total_deleted']}")
        print("\n最近发布日期统计:")
        for date, count in stats["jobs_by_date"]:
            print(f"  {date}: {count} 条")
        print()

    elif args.command == "schedule":
        crawler = JobCrawler()
        scheduler = Scheduler()
        if args.hourly:
            scheduler.run_hourly(crawler.incremental_crawl, interval_minutes=args.hourly * 60)
        elif args.daily:
            try:
                h, m = map(int, args.daily.split(":"))
                scheduler.run_daily(crawler.crawl_all, hour=h, minute=m)
            except ValueError:
                logger.error("时间格式错误，请使用 HH:MM 格式")
                sys.exit(1)
        else:
            schedule_parser.print_help()
            sys.exit(1)

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logging.getLogger(__name__).info("Program interrupted by user")
        sys.exit(0)
    except Exception as e:
        logging.getLogger(__name__).exception("Fatal error: %s", str(e))
        sys.exit(1)
