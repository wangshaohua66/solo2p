#!/usr/bin/env python3
import sys
import os
import time
import json
import hashlib
import signal
import threading
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from loguru import logger
from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings

from core.database import DatabaseManager
from core.platforms import NOVEL_PLATFORMS, DOC_PLATFORMS
from core.settings import (
    FULL_SCAN_INTERVAL_HOURS,
    INCREMENTAL_SCAN_INTERVAL_HOURS,
    NEW_WORK_DAILY_SCAN_DAYS,
    FORENSICS_DIR,
    REPORT_DIR,
    SCREENSHOT_DIR,
    HTML_ARCHIVE_DIR,
)
from utils.forensics import ForensicsManager
from utils.report import ReportGenerator


logger.remove()
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level:<7}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
    level="INFO",
)
logger.add(
    os.path.join("data", "logs", "copyright_monitor_{time:YYYY-MM-DD}.log"),
    rotation="1 day",
    retention="30 days",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level:<7} | {name}:{line} - {message}",
    level="DEBUG",
)


class CopyrightMonitorScheduler:
    def __init__(self):
        self.db = DatabaseManager()
        self.forensics = ForensicsManager()
        self.report_gen = ReportGenerator()
        self.running = False
        self.scan_in_progress = False
        self.current_scan_type = None
        self.scan_start_time = None
        self.stats = {
            "pages_crawled": 0,
            "infringements_found": 0,
            "platforms_scanned": 0,
            "total_platforms": len(NOVEL_PLATFORMS) + len(DOC_PLATFORMS),
            "highest_similarity": 0.0,
            "new_infringements_today": 0,
            "scan_rounds_completed": 0,
        }
        self._ensure_dirs()
        self._load_checkpoints()

    def _ensure_dirs(self):
        for d in ["data/logs", FORENSICS_DIR, REPORT_DIR, SCREENSHOT_DIR, HTML_ARCHIVE_DIR]:
            os.makedirs(d, exist_ok=True)

    def _load_checkpoints(self):
        checkpoints = self.db.fetchall("SELECT * FROM scan_checkpoints")
        self.checkpoints = {}
        if checkpoints:
            for cp in checkpoints:
                key = f"{cp['spider_name']}_{cp['work_id']}_{cp['platform_key']}"
                self.checkpoints[key] = dict(cp)

    def _save_checkpoint(self, spider_name, work_id, platform_key, last_url=None, last_keyword=None):
        self.db.execute(
            """INSERT OR REPLACE INTO scan_checkpoints
               (spider_name, work_id, platform_key, last_processed_url, last_processed_keyword, checkpoint_time)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (spider_name, work_id, platform_key, last_url, last_keyword, datetime.now().isoformat()),
        )
        key = f"{spider_name}_{work_id}_{platform_key}"
        self.checkpoints[key] = {
            "spider_name": spider_name,
            "work_id": work_id,
            "platform_key": platform_key,
            "last_processed_url": last_url,
            "last_processed_keyword": last_keyword,
            "checkpoint_time": datetime.now().isoformat(),
        }

    def register_work(self, title, author="", genre="", keywords="", original_text="",
                      key_paragraphs=None, similarity_threshold=0.75, registration_date=None):
        work_id = hashlib.md5(f"{title}:{author}".encode("utf-8")).hexdigest()[:16]
        existing = self.db.fetchone("SELECT id FROM copyrighted_works WHERE id=?", (work_id,))
        if existing:
            logger.warning(f"Work already registered: {title} (ID: {work_id})")
            return work_id

        ngram_fingerprint = ""
        if original_text:
            ngrams = self._extract_ngrams(original_text)
            ngram_fingerprint = str(ngrams) if ngrams else ""

        kp_str = str(key_paragraphs) if key_paragraphs else "[]"

        self.db.execute(
            """INSERT INTO copyrighted_works
               (id, title, author, genre, keywords, original_text, key_paragraphs,
                ngram_fingerprint, similarity_threshold, registration_date)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (work_id, title, author, genre, keywords, original_text[:100000],
             kp_str, ngram_fingerprint, similarity_threshold,
             registration_date or datetime.now().strftime("%Y-%m-%d")),
        )

        self._init_scan_schedule(work_id)

        logger.info(f"Registered work: {title} (ID: {work_id})")
        return work_id

    def _init_scan_schedule(self, work_id):
        now = datetime.now()
        for pkey, pconf in NOVEL_PLATFORMS.items():
            self.db.execute(
                """INSERT OR IGNORE INTO scan_schedule
                   (work_id, platform_key, next_scan_time, scan_priority, scan_status)
                   VALUES (?, ?, ?, ?, ?)""",
                (work_id, pkey, now.isoformat(), 9, "pending"),
            )
        for pkey, pconf in DOC_PLATFORMS.items():
            self.db.execute(
                """INSERT OR IGNORE INTO scan_schedule
                   (work_id, platform_key, next_scan_time, scan_priority, scan_status)
                   VALUES (?, ?, ?, ?, ?)""",
                (work_id, pkey, now.isoformat(), 7, "pending"),
            )

    def _update_scan_schedule(self, work_id, platform_key, success=True):
        now = datetime.now()
        work = self.db.fetchone("SELECT registration_date, created_at FROM copyrighted_works WHERE id=?", (work_id,))
        if work:
            reg_date_str = work["registration_date"] or work["created_at"]
            try:
                reg_date = datetime.fromisoformat(reg_date_str)
            except (ValueError, TypeError):
                reg_date = now - timedelta(days=30)

            days_since_reg = (now - reg_date).days
            if days_since_reg <= NEW_WORK_DAILY_SCAN_DAYS:
                next_scan = now + timedelta(hours=INCREMENTAL_SCAN_INTERVAL_HOURS)
                priority = 9
            else:
                existing_infringement = self.db.fetchone(
                    "SELECT id FROM comparison_results WHERE work_id=? AND platform_key=? AND is_infringement=1",
                    (work_id, platform_key),
                )
                if existing_infringement:
                    next_scan = now + timedelta(hours=FULL_SCAN_INTERVAL_HOURS)
                    priority = 5
                else:
                    next_scan = now + timedelta(hours=INCREMENTAL_SCAN_INTERVAL_HOURS * 2)
                    priority = 7

            status = "completed" if success else "failed"
            failures = 0 if success else 1

            self.db.execute(
                """UPDATE scan_schedule
                   SET last_scan_time=?, next_scan_time=?, scan_priority=?,
                       scan_status=?, consecutive_failures=consecutive_failures+?
                   WHERE work_id=? AND platform_key=?""",
                (now.isoformat(), next_scan.isoformat(), priority, status, failures, work_id, platform_key),
            )

    def _extract_ngrams(self, text, n=5):
        import re
        chars = re.sub(r"[^\u4e00-\u9fff]", "", text)
        if len(chars) < n:
            return set()
        return {chars[i:i + n] for i in range(min(len(chars) - n + 1, 5000))}

    def run_scan(self, scan_type="incremental", work_ids=None, platform_keys=None):
        if self.scan_in_progress:
            logger.warning("Scan already in progress, skipping")
            return

        self.scan_in_progress = True
        self.current_scan_type = scan_type
        self.scan_start_time = datetime.now()
        logger.info(f"Starting {scan_type} scan at {self.scan_start_time}")

        try:
            settings = get_project_settings()
            process = CrawlerProcess(settings)

            spider_kwargs = {
                "scan_type": scan_type,
            }
            if work_ids:
                spider_kwargs["work_ids"] = ",".join(work_ids) if isinstance(work_ids, list) else work_ids
            if platform_keys:
                spider_kwargs["platform_keys"] = ",".join(platform_keys) if isinstance(platform_keys, list) else platform_keys

            process.crawl("novel_spider", **spider_kwargs)
            process.crawl("doc_spider", **spider_kwargs)

            process.start()

            self._perform_forensics_for_infringements()
            self._update_scan_statistics()
            self.stats["scan_rounds_completed"] += 1

            elapsed = (datetime.now() - self.scan_start_time).total_seconds()
            logger.info(f"Scan completed in {elapsed:.1f}s")

        except Exception as e:
            logger.error(f"Scan failed: {e}")
        finally:
            self.scan_in_progress = False
            self.current_scan_type = None

    def _perform_forensics_for_infringements(self):
        unprocessed = self.db.fetchall(
            """SELECT cr.id, cr.work_id, cr.platform_key, cr.result_url
               FROM comparison_results cr
               LEFT JOIN forensics_records fr ON cr.id = fr.comparison_id
               WHERE cr.is_infringement=1 AND fr.id IS NULL"""
        )
        if not unprocessed:
            return

        logger.info(f"Performing forensics for {len(unprocessed)} infringement records")
        for record in unprocessed:
            crawled = self.db.fetchone(
                "SELECT * FROM crawled_pages WHERE work_id=? AND platform_key=? AND result_url=?",
                (record["work_id"], record["platform_key"], record["result_url"]),
            )
            html_content = crawled["content_text"] if crawled else ""
            response_headers = ""

            forensics_record = self.forensics.perform_forensics(
                work_id=record["work_id"],
                platform_key=record["platform_key"],
                result_url=record["result_url"],
                html_content=html_content,
                response_headers=response_headers,
            )

            self.db.execute(
                """INSERT INTO forensics_records
                   (comparison_id, work_id, result_url, screenshot_path, html_archive_path,
                    sha256_hash, html_sha256, forensics_time, forensics_status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    record["id"], forensics_record["work_id"], forensics_record["result_url"],
                    forensics_record["screenshot_path"], forensics_record["html_archive_path"],
                    forensics_record["sha256_hash"], forensics_record["html_sha256"],
                    forensics_record["forensics_time"], forensics_record["forensics_status"],
                ),
            )

    def _update_scan_statistics(self):
        today = datetime.now().strftime("%Y-%m-%d")
        crawled_today = self.db.fetchone(
            "SELECT COUNT(*) as cnt FROM crawled_pages WHERE DATE(crawl_time)=?", (today,)
        )
        infringements_today = self.db.fetchone(
            "SELECT COUNT(*) as cnt FROM comparison_results WHERE DATE(crawl_time)=? AND is_infringement=1", (today,)
        )

        self.stats["pages_crawled"] = crawled_today["cnt"] if crawled_today else 0
        self.stats["infringements_found"] = infringements_today["cnt"] if infringements_today else 0
        self.stats["new_infringements_today"] = self.stats["infringements_found"]

        highest = self.db.fetchone(
            "SELECT MAX(overall_similarity) as max_sim FROM comparison_results WHERE DATE(crawl_time)=?", (today,)
        )
        self.stats["highest_similarity"] = highest["max_sim"] if highest and highest["max_sim"] else 0.0

    def run_scheduled(self, interval_hours=None):
        if interval_hours is None:
            interval_hours = INCREMENTAL_SCAN_INTERVAL_HOURS

        self.running = True
        logger.info(f"Scheduled mode started, interval: {interval_hours}h")

        def scheduler_loop():
            while self.running:
                try:
                    self.run_scan(scan_type="incremental")
                    next_run = datetime.now() + timedelta(hours=interval_hours)
                    logger.info(f"Next incremental scan at {next_run}")
                    wait_seconds = interval_hours * 3600
                    for _ in range(int(wait_seconds)):
                        if not self.running:
                            break
                        time.sleep(1)
                except Exception as e:
                    logger.error(f"Scheduled scan error: {e}")
                    time.sleep(60)

        scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
        scheduler_thread.start()

        self._cli_interface()

    def _cli_interface(self):
        print("\n" + "=" * 70)
        print("  版权侵权监测与取证系统 - Copyright Infringement Monitor")
        print("=" * 70)
        print("  命令帮助:")
        print("    status        - 查看巡查状态与实时统计")
        print("    scan [type]   - 启动巡查 (full/incremental，默认incremental)")
        print("    work <id>     - 查询作品详细比对结果")
        print("    register      - 注册新作品")
        print("    report [id]   - 生成侵权报告 (作品ID或daily)")
        print("    works         - 列出所有受保护作品")
        print("    infringes     - 列出今日发现侵权")
        print("    stop          - 停止定时巡查")
        print("    quit          - 退出系统")
        print("=" * 70 + "\n")

        while self.running:
            try:
                cmd = input("\n版权监测> ").strip()
                if not cmd:
                    continue

                parts = cmd.split()
                action = parts[0].lower()

                if action == "quit" or action == "exit":
                    self.running = False
                    print("正在停止巡查并退出...")
                    break
                elif action == "stop":
                    self.running = False
                    print("定时巡查已停止")
                elif action == "status":
                    self._show_status()
                elif action == "scan":
                    scan_type = parts[1] if len(parts) > 1 else "incremental"
                    if scan_type not in ("full", "incremental"):
                        scan_type = "incremental"
                    self.run_scan(scan_type=scan_type)
                elif action == "work":
                    if len(parts) < 2:
                        print("用法: work <作品ID>")
                        continue
                    self._show_work_details(parts[1])
                elif action == "register":
                    self._interactive_register()
                elif action == "report":
                    target = parts[1] if len(parts) > 1 else "daily"
                    if target == "daily":
                        paths = self.report_gen.generate_daily_report()
                    else:
                        paths = self.report_gen.generate_work_report(target)
                    if paths:
                        for fmt, path in paths.items():
                            print(f"  {fmt.upper()}: {path}")
                elif action == "works":
                    self._list_works()
                elif action == "infringes":
                    self._list_today_infringements()
                else:
                    print(f"未知命令: {action}，输入命令查看帮助")

            except KeyboardInterrupt:
                print("\n使用 'quit' 退出系统")
            except EOFError:
                break
            except Exception as e:
                logger.error(f"Command error: {e}")

    def _show_status(self):
        self._update_scan_statistics()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        scan_status = "巡查中" if self.scan_in_progress else "待命"
        scan_type = self.current_scan_type or "-"

        bar_width = 40
        platforms_done = self.stats["platforms_scanned"]
        platforms_total = self.stats["total_platforms"]
        progress = platforms_done / max(1, platforms_total)
        filled = int(bar_width * progress)
        bar = "█" * filled + "░" * (bar_width - filled)

        highest_sim = self.stats["highest_similarity"]
        sim_display = f"{highest_sim:.1%}" if highest_sim > 0 else "-"
        sim_color = "\033[91m" if highest_sim >= 0.9 else "\033[93m" if highest_sim >= 0.75 else "\033[92m"

        print(f"\n┌{'─' * 52}┐")
        print(f"│ 版权侵权监测系统 - 运行状态                    │")
        print(f"│ 时间: {now}                              │")
        print(f"├{'─' * 52}┤")
        print(f"│ 巡查状态: {scan_status:<10} 类型: {scan_type:<14} │")
        print(f"│ 平台进度: [{bar}] {progress:.0%}   │")
        print(f"│ 已巡查: {platforms_done}/{platforms_total} 平台                          │")
        print(f"│ 最高相似度: {sim_color}{sim_display}\033[0m                               │")
        print(f"│ 今日新增侵权: \033[91m{self.stats['new_infringements_today']}\033[0m                                │")
        print(f"│ 抓取页面数: {self.stats['pages_crawled']:<10} 累计侵权: {self.stats['infringements_found']:<10} │")
        print(f"│ 完成巡查轮次: {self.stats['scan_rounds_completed']}                                  │")
        if self.scan_start_time and self.scan_in_progress:
            elapsed = (datetime.now() - self.scan_start_time).total_seconds()
            print(f"│ 当前巡查耗时: {elapsed / 60:.1f} 分钟                            │")
        print(f"└{'─' * 52}┘")

    def _show_work_details(self, work_id):
        work = self.db.fetchone("SELECT * FROM copyrighted_works WHERE id=?", (work_id,))
        if not work:
            print(f"作品未找到: {work_id}")
            return

        results = self.db.fetchall(
            """SELECT cr.*, fr.screenshot_path, fr.sha256_hash
               FROM comparison_results cr
               LEFT JOIN forensics_records fr ON cr.id = fr.comparison_id
               WHERE cr.work_id=?
               ORDER BY cr.overall_similarity DESC
               LIMIT 20""",
            (work_id,),
        )

        print(f"\n{'=' * 70}")
        print(f"  作品: {work['title']} (作者: {work['author'] or '-'})")
        print(f"  ID: {work['id']}  类型: {work['genre'] or '-'}")
        print(f"  相似度阈值: {work['similarity_threshold']}")
        print(f"{'=' * 70}")

        if not results:
            print("  暂无比对结果")
            return

        print(f"  {'#':<4} {'平台':<12} {'标题':<20} {'综合相似度':<12} {'侵权':<6} {'类型':<16}")
        print(f"  {'─' * 70}")

        for idx, r in enumerate(results, 1):
            sim = r["overall_similarity"]
            is_inf = "是" if r["is_infringement"] else "否"
            if is_inf == "是":
                is_inf = "\033[91m是\033[0m"
            title = (r["result_title"] or "")[:18]
            platform = (r["platform_name"] or r["platform_key"] or "")[:10]
            match_type = r["match_type"] or ""
            sim_str = f"{sim:.2%}"

            line = f"  {idx:<4} {platform:<12} {title:<20} {sim_str:<12} {is_inf:<8} {match_type}"
            print(line)

    def _interactive_register(self):
        print("\n--- 注册新作品 ---")
        title = input("作品标题: ").strip()
        if not title:
            print("标题不能为空")
            return
        author = input("作者 (可空): ").strip()
        genre = input("类型 (可空): ").strip()
        keywords = input("关键词 (逗号分隔, 可空): ").strip()
        original_text = input("原文路径 (文本文件, 可空): ").strip()

        text = ""
        if original_text and os.path.exists(original_text):
            with open(original_text, "r", encoding="utf-8") as f:
                text = f.read()
        elif original_text:
            print(f"文件不存在: {original_text}，将跳过原文")

        threshold = input("相似度阈值 (0-1, 默认0.75): ").strip()
        threshold = float(threshold) if threshold else 0.75

        work_id = self.register_work(
            title=title, author=author, genre=genre,
            keywords=keywords, original_text=text,
            similarity_threshold=threshold,
        )
        print(f"注册成功! 作品ID: {work_id}")

    def _list_works(self):
        works = self.db.fetchall(
            "SELECT id, title, author, genre, similarity_threshold FROM copyrighted_works ORDER BY created_at DESC LIMIT 50"
        )
        if not works:
            print("暂无注册作品，使用 'register' 命令注册")
            return

        print(f"\n  {'ID':<18} {'标题':<24} {'作者':<14} {'类型':<10} {'阈值':<6}")
        print(f"  {'─' * 72}")
        for w in works:
            title = (w["title"] or "")[:22]
            author = (w["author"] or "-")[:12]
            genre = (w["genre"] or "-")[:8]
            print(f"  {w['id']:<18} {title:<24} {author:<14} {genre:<10} {w['similarity_threshold']:<6}")

    def _list_today_infringements(self):
        today = datetime.now().strftime("%Y-%m-%d")
        results = self.db.fetchall(
            """SELECT cr.*, cw.title as work_title
               FROM comparison_results cr
               JOIN copyrighted_works cw ON cr.work_id = cw.id
               WHERE DATE(cr.crawl_time)=? AND cr.is_infringement=1
               ORDER BY cr.overall_similarity DESC""",
            (today,),
        )
        if not results:
            print("今日暂无新增侵权")
            return

        print(f"\n  今日新增侵权 ({today}):")
        print(f"  {'#':<4} {'作品':<16} {'平台':<10} {'侵权标题':<20} {'相似度':<10}")
        print(f"  {'─' * 60}")
        for idx, r in enumerate(results, 1):
            work_title = (r["work_title"] or "")[:14]
            platform = (r["platform_name"] or "")[:8]
            result_title = (r["result_title"] or "")[:18]
            sim = f"{r['overall_similarity']:.2%}"
            if r["overall_similarity"] >= 0.9:
                sim = f"\033[91m{sim}\033[0m"
            elif r["overall_similarity"] >= 0.75:
                sim = f"\033[93m{sim}\033[0m"
            print(f"  {idx:<4} {work_title:<16} {platform:<10} {result_title:<20} {sim}")


def signal_handler(signum, frame):
    print("\n收到中断信号，正在优雅退出...")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, signal_handler)

    os.makedirs("data/logs", exist_ok=True)

    scheduler = CopyrightMonitorScheduler()

    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd == "scan":
            scan_type = sys.argv[2] if len(sys.argv) > 2 else "incremental"
            work_ids = sys.argv[3] if len(sys.argv) > 3 else None
            scheduler.run_scan(scan_type=scan_type, work_ids=work_ids)
        elif cmd == "full":
            scheduler.run_scan(scan_type="full")
        elif cmd == "schedule":
            interval = float(sys.argv[2]) if len(sys.argv) > 2 else INCREMENTAL_SCAN_INTERVAL_HOURS
            scheduler.run_scheduled(interval_hours=interval)
        elif cmd == "register":
            title = sys.argv[2] if len(sys.argv) > 2 else None
            if not title:
                print("Usage: main.py register <title> [author] [genre]")
                sys.exit(1)
            author = sys.argv[3] if len(sys.argv) > 3 else ""
            genre = sys.argv[4] if len(sys.argv) > 4 else ""
            wid = scheduler.register_work(title=title, author=author, genre=genre)
            print(f"Registered: {title} -> {wid}")
        elif cmd == "report":
            target = sys.argv[2] if len(sys.argv) > 2 else "daily"
            if target == "daily":
                paths = scheduler.report_gen.generate_daily_report()
            else:
                paths = scheduler.report_gen.generate_work_report(target)
            if paths:
                for fmt, path in paths.items():
                    print(f"{fmt.upper()}: {path}")
        else:
            print_usage()
    else:
        scheduler.run_scheduled()


def print_usage():
    print("""
版权侵权监测与取证系统 - 使用说明
====================================

交互模式 (默认):
  python main.py

命令行模式:
  python main.py scan [incremental|full] [work_ids]   - 启动巡查
  python main.py full                                  - 全量巡查
  python main.py schedule [interval_hours]             - 定时巡查
  python main.py register <title> [author] [genre]     - 注册作品
  python main.py report [work_id|daily]                - 生成报告

交互命令:
  status        查看巡查状态
  scan [type]   启动巡查
  work <id>     查询作品比对结果
  register      注册新作品
  report [id]   生成报告
  works         列出受保护作品
  infringes     列出今日侵权
  stop          停止定时巡查
  quit          退出
""")


if __name__ == "__main__":
    main()
