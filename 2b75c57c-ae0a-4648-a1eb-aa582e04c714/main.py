import argparse
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from tqdm import tqdm

from config import init_config, load_config, AppConfig
from logger import get_logger, set_log_level
from database import DatabaseManager
from site_adapters import UniversityAdapter, ProvincialTalentAdapter
from data_processor import process_fair_data, save_to_database, match_student_jobs
from resume_generator import generate_resume_pdf, generate_batch_resumes
from resume_submitter import ResumeSubmitter
from status_tracker import StatusTracker, STATUS_LABELS
from report_generator import (
    generate_fair_report, generate_charts, generate_summary_report,
)
from monitor import SystemMonitor
from scheduler import TaskScheduler
from student_importer import StudentImporter


logger = get_logger("main")


def _build_adapter(site_cfg):
    if "省级" in site_cfg.name or "人才" in site_cfg.name:
        return ProvincialTalentAdapter(site_cfg)
    return UniversityAdapter(site_cfg)


def cmd_init_config(args: argparse.Namespace) -> int:
    path = init_config(args.output)
    logger.info(f"配置文件已初始化: {path}")
    print(f"✓ 配置文件已生成: {path}")
    print("  请根据实际情况修改站点URL、账号密码、通知参数等配置")
    return 0


def cmd_crawl(args: argparse.Namespace) -> int:
    config: AppConfig = load_config(args.config)
    db = DatabaseManager()
    all_fairs: List[Dict[str, Any]] = []
    total_stats = {"pages": 0, "items": 0, "errors": 0}

    sites = config.sites
    if args.sites:
        sites = [s for s in sites if s.name in args.sites]
        if not sites:
            logger.error(f"未找到指定站点: {args.sites}")
            return 1

    logger.info(f"开始爬取 {len(sites)} 个站点")
    pbar = tqdm(sites, desc="站点爬取进度", unit="site")
    for site in pbar:
        pbar.set_postfix_str(site.name)
        log_id = db.log_crawl({
            "site_name": site.name,
            "task_type": "crawl",
            "status": "running",
        })
        start_time = time.time()
        adapter = None
        try:
            adapter = _build_adapter(site)
            with adapter:
                if args.login and site.username:
                    adapter.login()
                fairs = adapter.crawl_job_fairs()
                if args.detail:
                    detail_pbar = tqdm(fairs, desc=f"  {site.name} 详情页", unit="fair", leave=False)
                    for fair in detail_pbar:
                        adapter.crawl_fair_detail(fair)
                        detail_pbar.set_postfix_str(fair["title"][:20])
                all_fairs.extend(fairs)
                stats = adapter.get_stats()
                total_stats["pages"] += stats.get("pages_crawled", 0)
                total_stats["items"] += stats.get("items_extracted", 0)
                total_stats["errors"] += stats.get("errors", 0)
                db.update_crawl_log(
                    log_id,
                    status="success",
                    end_time=datetime.now().isoformat(),
                    record_count=len(fairs),
                    error_count=stats.get("errors", 0),
                )
        except Exception as e:
            logger.error(f"[{site.name}] 爬取失败: {e}")
            db.update_crawl_log(
                log_id,
                status="failed",
                end_time=datetime.now().isoformat(),
                error_message=str(e)[:500],
            )
            total_stats["errors"] += 1
        finally:
            if adapter:
                adapter.close_driver()

        elapsed = time.time() - start_time
        pbar.set_postfix_str(f"{site.name} ({elapsed:.1f}s)")

    logger.info(
        f"爬取完成: 共{len(all_fairs)}场招聘会, "
        f"抓取{total_stats['pages']}页, "
        f"提取{total_stats['items']}条, "
        f"错误{total_stats['errors']}次"
    )

    if all_fairs and not args.no_save:
        fairs, companies, jobs = process_fair_data(all_fairs)
        save_to_database(fairs, companies, jobs)
        print(f"\n✓ 数据已入库: {len(fairs)}场招聘会, {len(companies)}家企业, {len(jobs)}个岗位")

    return 0


def cmd_track(args: argparse.Namespace) -> int:
    load_config(args.config)
    tracker = StatusTracker()
    statuses = args.status.split(",") if args.status else None
    results = tracker.track_all(statuses=statuses, simulate=(not args.real))
    status_counts: Dict[str, int] = {}
    for r in results:
        s = r.get("status", "unknown")
        status_counts[s] = status_counts.get(s, 0) + 1
    print("\n✓ 状态追踪完成:")
    for s, cnt in sorted(status_counts.items(), key=lambda x: -x[1]):
        print(f"  {STATUS_LABELS.get(s, s)}: {cnt}")
    if args.student:
        rows = tracker.get_student_submissions(args.student)
        print(f"\n学生 {args.student} 投递记录 ({len(rows)} 条):")
        for r in rows[:10]:
            status = STATUS_LABELS.get(r.get("status", ""), r.get("status", ""))
            print(f"  [{status}] {r.get('company_name', '')} - {r.get('job_title', '')} ({r.get('submit_time', '')[:10]})")
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    load_config(args.config)
    if args.fair:
        path = generate_fair_report(args.fair, args.output)
        print(f"✓ 招聘会报表已生成: {path}")
        if args.charts:
            chart_paths = generate_charts(args.fair)
            for p in chart_paths:
                print(f"  图表: {p}")
    else:
        path = generate_summary_report(args.output)
        print(f"✓ 汇总报表已生成: {path}")
    return 0


def cmd_submit(args: argparse.Namespace) -> int:
    config = load_config(args.config)
    db = DatabaseManager()

    student = {
        "student_id": args.student_id or f"stu_{int(time.time())}",
        "name": args.name or "张三",
        "gender": args.gender or "",
        "university": args.university or "某高校",
        "major": args.major or "计算机科学与技术",
        "education": args.education or "本科",
        "phone": args.phone or "",
        "email": args.email or "",
        "target_industry": args.target_industry or "互联网、IT",
        "target_position": args.target_position or "软件开发、算法工程师",
        "target_salary_min": args.salary or 8000,
    }

    if not args.no_resume:
        resume_path = generate_resume_pdf(student)
        student["resume_path"] = resume_path
        print(f"✓ 简历已生成: {resume_path}")

    db.upsert_student(student)

    all_jobs = [dict(r) for r in db.query_all("SELECT * FROM jobs ORDER BY id DESC LIMIT 500")]
    if not all_jobs:
        logger.warning("数据库中暂无岗位数据，请先执行爬取任务")
        return 1

    matched = match_student_jobs(student, all_jobs, limit=args.top_n)
    print(f"✓ 匹配到 {len(matched)} 个岗位 (Top {args.top_n}):")
    for i, job in enumerate(matched[:10], 1):
        score = job.get("match_score", 0)
        print(f"  {i}. [{score}分] {job.get('title', '')} (薪资: {job.get('salary_min', '')}-{job.get('salary_max', '')})")

    if args.do_submit:
        submitter = ResumeSubmitter()
        rate = config.crawler.submit_rate_per_minute
        submitter.submit_batch(
            student, matched,
            rate_per_minute=rate,
            simulate=(not args.real),
        )
        print(f"✓ 投递完成，共 {len(matched)} 份简历")
    return 0


def cmd_import_students(args: argparse.Namespace) -> int:
    load_config(args.config)
    importer = StudentImporter()

    if args.template:
        path = importer.get_template_csv(args.template)
        print(f"✓ 学生导入模板已生成: {path}")
        return 0

    if args.list:
        students = importer.list_students(args.limit)
        print(f"✓ 共 {len(students)} 名学生 (显示前 {args.limit} 名):")
        for s in students[:args.limit]:
            print(f"  {s.get('student_id', '')} | {s.get('name', '')} | "
                  f"{s.get('university', '')} | {s.get('major', '')} | "
                  f"{s.get('education', '')}")
        return 0

    if not args.file:
        print("错误: 请指定导入文件路径 (--file) 或使用 --template 生成模板")
        return 1

    result = importer.import_file(
        args.file,
        skip_errors=args.skip_errors,
    )

    print(f"✓ 导入完成: 共 {result['total']} 条")
    print(f"  成功: {result['success']}")
    print(f"  失败: {result['errors']}")
    if args.skip_errors:
        print(f"  跳过: {result['skipped']}")

    if result['error_details'] and args.verbose:
        print("\n错误详情:")
        for err in result['error_details'][:10]:
            print(f"  第 {err['row']} 行: {'; '.join(err['errors'])}")
        if len(result['error_details']) > 10:
            print(f"  ... 共 {len(result['error_details'])} 条错误")

    return 0


def cmd_monitor(args: argparse.Namespace) -> int:
    load_config(args.config)
    mon = SystemMonitor()
    result = mon.run_all_checks()
    print(f"✓ 系统健康检查 ({result['timestamp']}):")
    crawl = result["crawl_health"]
    print(f"\n  爬取健康: {crawl['total_runs']}次运行, {len(crawl['failed_sites'])}个站点异常")
    for site, s in crawl["sites"].items():
        flag = "✗" if site in crawl["failed_sites"] else "✓"
        print(f"    {flag} {site}: 失败率{s['fail_rate']:.1%} (错误{s['total_errors']}次)")
    backlog = result["submission_backlog"]
    print(f"\n  投递积压 (近{backlog['time_window_hours']}小时):")
    for k, v in backlog["by_status"].items():
        print(f"    {STATUS_LABELS.get(k, k)}: {v}")
    print(f"\n  数据库容量:")
    for label, cnt in result["database_size"].items():
        print(f"    {label}: {cnt}")
    return 0


def cmd_schedule(args: argparse.Namespace) -> int:
    load_config(args.config)

    def crawl_task():
        logger.info("调度触发: 执行全量爬取")
        ns = argparse.Namespace(
            config=None, sites=None, login=True, detail=True, no_save=False
        )
        try:
            cmd_crawl(ns)
        except Exception as e:
            logger.error(f"调度爬取任务异常: {e}")

    def track_task():
        logger.info("调度触发: 执行状态追踪")
        ns = argparse.Namespace(config=None, status=None, student=None, real=False)
        try:
            cmd_track(ns)
        except Exception as e:
            logger.error(f"调度追踪任务异常: {e}")

    def monitor_task():
        logger.info("调度触发: 执行健康检查")
        ns = argparse.Namespace(config=None)
        try:
            cmd_monitor(ns)
        except Exception as e:
            logger.error(f"调度监控任务异常: {e}")

    scheduler = TaskScheduler()
    scheduler.add_crawl_job(crawl_task)
    scheduler.add_track_job(track_task)
    scheduler.add_monitor_job(monitor_task)
    scheduler.run_forever()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="recruitment",
        description="省级人才招聘信息管理系统 - 多站点爬取、简历投递、状态追踪",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-c", "--config", help="配置文件路径", default=None)
    parser.add_argument("-v", "--verbose", action="store_true", help="调试模式(DEBUG日志)")
    parser.add_argument("-q", "--quiet", action="store_true", help="静默模式(WARNING以上日志)")

    sub = parser.add_subparsers(dest="command", help="可用子命令")

    p_init = sub.add_parser("init-config", help="初始化配置文件")
    p_init.add_argument("-o", "--output", help="输出路径", default=None)
    p_init.set_defaults(func=cmd_init_config)

    p_crawl = sub.add_parser("crawl", help="执行爬取任务")
    p_crawl.add_argument("-s", "--sites", help="指定站点名称(逗号分隔)", default=None)
    p_crawl.add_argument("--login", action="store_true", help="尝试登录站点")
    p_crawl.add_argument("--no-detail", dest="detail", action="store_false", help="仅爬取列表，不进入详情页", default=True)
    p_crawl.add_argument("--no-save", action="store_true", help="不保存到数据库")
    p_crawl.set_defaults(func=cmd_crawl)

    p_track = sub.add_parser("track", help="追踪简历状态")
    p_track.add_argument("-s", "--status", help="只追踪指定状态(逗号分隔)", default=None)
    p_track.add_argument("--student", help="查看某学生的投递记录", default=None)
    p_track.add_argument("--real", action="store_true", help="真实查询(非模拟)")
    p_track.set_defaults(func=cmd_track)

    p_report = sub.add_parser("report", help="生成统计报表")
    p_report.add_argument("-f", "--fair", help="招聘会ID，生成单场详细报表", default=None)
    p_report.add_argument("-o", "--output", help="输出路径", default=None)
    p_report.add_argument("--charts", action="store_true", help="同时生成可视化图表")
    p_report.set_defaults(func=cmd_report)

    p_submit = sub.add_parser("submit", help="简历匹配与批量投递")
    p_submit.add_argument("--student-id", help="学生ID")
    p_submit.add_argument("--name", help="姓名", default=None)
    p_submit.add_argument("--gender", help="性别", default=None)
    p_submit.add_argument("--university", help="学校", default=None)
    p_submit.add_argument("--major", help="专业", default=None)
    p_submit.add_argument("--education", help="学历", default=None)
    p_submit.add_argument("--phone", help="电话", default=None)
    p_submit.add_argument("--email", help="邮箱", default=None)
    p_submit.add_argument("--target-industry", help="意向行业", default=None)
    p_submit.add_argument("--target-position", help="意向岗位", default=None)
    p_submit.add_argument("--salary", type=int, help="期望最低薪资", default=None)
    p_submit.add_argument("--top-n", type=int, help="匹配岗位数量", default=20)
    p_submit.add_argument("--no-resume", action="store_true", help="不生成PDF简历")
    p_submit.add_argument("--do-submit", action="store_true", help="实际执行投递")
    p_submit.add_argument("--real", action="store_true", help="真实投递(非模拟)")
    p_submit.set_defaults(func=cmd_submit)

    p_import = sub.add_parser("import-students", help="学生信息批量导入 (CSV/JSON)")
    p_import.add_argument("-f", "--file", help="导入文件路径 (.csv / .json)", default=None)
    p_import.add_argument("-t", "--template", help="生成模板文件并保存到指定路径", default=None)
    p_import.add_argument("-l", "--list", action="store_true", help="列出已导入的学生")
    p_import.add_argument("-n", "--limit", type=int, help="列表显示数量", default=20)
    p_import.add_argument("--skip-errors", action="store_true", help="跳过错误行继续导入")
    p_import.set_defaults(func=cmd_import_students)

    p_monitor = sub.add_parser("monitor", help="系统健康检查")
    p_monitor.set_defaults(func=cmd_monitor)

    p_sched = sub.add_parser("schedule", help="启动定时任务调度")
    p_sched.set_defaults(func=cmd_schedule)

    return parser


def main(argv: List[str] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.verbose:
        set_log_level(logger, logging.DEBUG)
    elif args.quiet:
        set_log_level(logger, logging.WARNING)

    if not args.command:
        parser.print_help()
        return 0

    try:
        return args.func(args)
    except KeyboardInterrupt:
        logger.info("用户中断")
        return 130
    except Exception as e:
        logger.exception(f"命令执行失败: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
