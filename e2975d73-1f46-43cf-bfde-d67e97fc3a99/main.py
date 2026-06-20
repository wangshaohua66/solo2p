#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import argparse
import time
from datetime import datetime, timedelta
from colorama import init, Fore, Style
from tqdm import tqdm
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.settings import (
    CRAWL_SOURCES, POLICY_CATEGORIES, EXPORT_FORMATS,
    DATA_DIR, LOG_DIR, DB_PATH
)
from utils.logger import logger, log_performance
from utils.db import db
from utils.pdf_parser import pdf_parser
from utils.docx_parser import docx_parser

init(autoreset=True)

BANNER = f"""{Fore.CYAN}
╔══════════════════════════════════════════════════════════════╗
║                    优抚政策自动采集与聚合工具                 ║
║          Veterans Affairs Policy Collection System          ║
╚══════════════════════════════════════════════════════════════╝
{Style.RESET_ALL}"""


def print_banner():
    print(BANNER)


def print_success(message):
    print(f"{Fore.GREEN}✓ {message}{Style.RESET_ALL}")


def print_error(message):
    print(f"{Fore.RED}✗ {message}{Style.RESET_ALL}")


def print_warning(message):
    print(f"{Fore.YELLOW}⚠ {message}{Style.RESET_ALL}")


def print_info(message):
    print(f"{Fore.CYAN}ℹ {message}{Style.RESET_ALL}")


def init_database(args):
    print_info("正在初始化数据库...")
    start_time = time.time()

    try:
        db.init_database()
        duration = time.time() - start_time

        print_success(f"数据库初始化完成 (耗时: {duration:.2f}s)")
        print_info(f"数据库路径: {DB_PATH}")

        log_performance(logger, 'Database initialization', duration)

        return 0
    except Exception as e:
        print_error(f"数据库初始化失败: {str(e)}")
        logger.error(f"Database initialization failed: {str(e)}", exc_info=True)
        return 1


def crawl_policies(args):
    from scrapy.crawler import CrawlerProcess
    from scrapy.utils.project import get_project_settings
    from spiders.policy_spider import PolicySpider

    print_info("启动政策采集任务...")
    start_time = time.time()

    sources = args.sources
    if sources:
        print_info(f"指定采集源: {sources}")
    else:
        enabled_sources = [k for k, v in CRAWL_SOURCES.items() if v.get('enabled', True)]
        print_info(f"默认采集源: {', '.join(enabled_sources)}")

    if args.start_date:
        print_info(f"开始日期: {args.start_date}")
    if args.end_date:
        print_info(f"结束日期: {args.end_date}")
    if args.incremental:
        print_info("增量更新模式: 开启")
    if args.max_pages:
        print_info(f"最大采集页数: {args.max_pages}")

    try:
        settings = get_project_settings()
        settings.set('LOG_FILE', os.path.join(LOG_DIR, f'crawl_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'))
        settings.set('LOG_LEVEL', 'INFO')

        process = CrawlerProcess(settings)
        process.crawl(
            PolicySpider,
            sources=sources,
            start_date=args.start_date,
            end_date=args.end_date,
            incremental=args.incremental,
            max_pages=args.max_pages
        )

        print_info("爬虫启动中... (按 Ctrl+C 可中止)")
        process.start()

        duration = time.time() - start_time
        print_success(f"采集任务完成 (总耗时: {duration:.2f}s)")

        if args.attachments:
            print_info("开始处理附件...")
            return crawl_attachments(args)

        return 0

    except KeyboardInterrupt:
        print_warning("采集任务被用户中断")
        return 130
    except Exception as e:
        print_error(f"采集任务失败: {str(e)}")
        logger.error(f"Crawl failed: {str(e)}", exc_info=True)
        return 1


def crawl_attachments(args):
    from scrapy.crawler import CrawlerProcess
    from scrapy.utils.project import get_project_settings
    from spiders.attachment_spider import AttachmentSpider

    print_info("启动附件处理任务...")
    start_time = time.time()

    try:
        settings = get_project_settings()
        settings.set('LOG_FILE', os.path.join(LOG_DIR, f'attachments_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log'))
        settings.set('LOG_LEVEL', 'INFO')

        process = CrawlerProcess(settings)
        process.crawl(
            AttachmentSpider,
            policy_urls=args.policy_urls,
            attachment_urls=args.attachment_urls,
            parse_documents=True,
            ocr_enabled=args.ocr
        )

        print_info("附件处理启动中...")
        process.start()

        duration = time.time() - start_time
        print_success(f"附件处理完成 (总耗时: {duration:.2f}s)")

        return 0
    except Exception as e:
        print_error(f"附件处理失败: {str(e)}")
        logger.error(f"Attachment crawl failed: {str(e)}", exc_info=True)
        return 1


def export_data(args):
    print_info("正在导出数据...")
    start_time = time.time()

    format_type = args.format.lower()
    if format_type not in EXPORT_FORMATS:
        print_error(f"不支持的导出格式: {format_type}")
        print_info(f"支持的格式: {', '.join(EXPORT_FORMATS)}")
        return 1

    try:
        policies = db.get_policies(
            category=args.category,
            start_date=args.start_date,
            end_date=args.end_date,
            limit=args.limit
        )

        if not policies:
            print_warning("没有匹配的数据可导出")
            return 0

        print_info(f"找到 {len(policies)} 条记录准备导出")

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"policies_export_{timestamp}"

        if format_type == 'json':
            output_path = os.path.join(DATA_DIR, f"{filename}.json")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(policies, f, ensure_ascii=False, indent=2)

        elif format_type == 'excel':
            output_path = os.path.join(DATA_DIR, f"{filename}.xlsx")
            df = pd.DataFrame(policies)

            columns_to_keep = [
                'id', 'title', 'category', 'sub_category', 'policy_type',
                'publish_date', 'source', 'site_name', 'url', 'summary',
                'keywords', 'created_at'
            ]
            columns_to_keep = [col for col in columns_to_keep if col in df.columns]
            df = df[columns_to_keep]

            if 'keywords' in df.columns:
                df['keywords'] = df['keywords'].apply(
                    lambda x: ', '.join(x) if isinstance(x, list) else str(x)
                )

            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name='政策数据', index=False)

                if args.category:
                    by_type = df.groupby('policy_type').size().reset_index(name='数量')
                    by_type.to_excel(writer, sheet_name='按类型统计', index=False)

        elif format_type == 'markdown':
            output_path = os.path.join(DATA_DIR, f"{filename}.md")
            md_content = generate_markdown_report(policies, args)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)

        duration = time.time() - start_time
        file_size = os.path.getsize(output_path) / 1024

        print_success(f"数据导出完成")
        print_info(f"输出文件: {output_path}")
        print_info(f"文件大小: {file_size:.2f} KB")
        print_info(f"记录数量: {len(policies)}")
        print_info(f"耗时: {duration:.2f}s")

        log_performance(logger, f'Data export ({format_type})', duration, len(policies))

        return 0

    except Exception as e:
        print_error(f"导出失败: {str(e)}")
        logger.error(f"Export failed: {str(e)}", exc_info=True)
        return 1


def generate_markdown_report(policies, args):
    md = []
    md.append("# 优抚政策采集报告\n")
    md.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")

    if args.category:
        md.append(f"**分类筛选**: {args.category}\n")
    if args.start_date:
        md.append(f"**时间范围**: {args.start_date} ~ {args.end_date or '至今'}\n")

    md.append(f"**总记录数**: {len(policies)}\n")

    categories = Counter(p.get('category', '未分类') for p in policies)
    md.append("\n## 按分类统计\n")
    md.append("| 分类 | 数量 |\n|------|------|\n")
    for cat, count in categories.most_common():
        md.append(f"| {cat} | {count} |\n")

    types = Counter(p.get('policy_type', '未知') for p in policies)
    md.append("\n## 按类型统计\n")
    md.append("| 类型 | 数量 |\n|------|------|\n")
    for ptype, count in types.most_common():
        md.append(f"| {ptype} | {count} |\n")

    md.append("\n## 政策列表\n")
    for i, policy in enumerate(policies, 1):
        md.append(f"\n### {i}. {policy.get('title', '无标题')}\n")
        md.append(f"- **分类**: {policy.get('category', '未分类')} / {policy.get('policy_type', '未知')}\n")
        md.append(f"- **发布日期**: {policy.get('publish_date', '未知')}\n")
        md.append(f"- **来源**: {policy.get('source', policy.get('site_name', '未知'))}\n")
        md.append(f"- **链接**: {policy.get('url', '')}\n")

        if policy.get('summary'):
            md.append(f"- **摘要**: {policy['summary']}\n")

        if policy.get('keywords'):
            keywords = policy['keywords']
            if isinstance(keywords, list):
                keywords = ', '.join(keywords)
            md.append(f"- **关键词**: {keywords}\n")

    return ''.join(md)


def search_policies(args):
    print_info(f"搜索关键词: '{args.keyword}'")
    start_time = time.time()

    try:
        policies = db.search_policies(
            keyword=args.keyword,
            category=args.category,
            limit=args.limit
        )

        duration = time.time() - start_time

        if not policies:
            print_warning("未找到匹配的政策")
            return 0

        print_success(f"找到 {len(policies)} 条匹配结果 (搜索耗时: {duration:.3f}s)")
        print("=" * 100)

        for i, policy in enumerate(policies, 1):
            title = policy.get('title', '无标题')
            category = policy.get('category', '未分类')
            ptype = policy.get('policy_type', '')
            date = policy.get('publish_date', '未知')
            source = policy.get('source', policy.get('site_name', '未知'))
            url = policy.get('url', '')

            highlight_title = title.replace(args.keyword, f"{Fore.YELLOW}{args.keyword}{Fore.RESET}")

            print(f"\n{i}. [{category}/{ptype}] {highlight_title}")
            print(f"   日期: {date} | 来源: {source}")
            print(f"   链接: {Fore.BLUE}{url}{Fore.RESET}")

            if policy.get('summary'):
                summary = policy['summary'][:100] + '...' if len(policy['summary']) > 100 else policy['summary']
                print(f"   摘要: {summary}")

        print("\n" + "=" * 100)

        log_performance(logger, f'Search: {args.keyword}', duration, len(policies))

        if args.export:
            args.format = 'json'
            export_data(args)

        return 0

    except Exception as e:
        print_error(f"搜索失败: {str(e)}")
        logger.error(f"Search failed: {str(e)}", exc_info=True)
        return 1


def show_statistics(args):
    print_info("正在获取统计信息...")
    start_time = time.time()

    try:
        stats = db.get_statistics()
        duration = time.time() - start_time

        if not stats:
            print_warning("暂无统计数据")
            return 0

        print("\n" + "=" * 60)
        print(f"{Fore.CYAN}📊 数据库统计概览{Style.RESET_ALL}")
        print("=" * 60)

        print(f"\n{Fore.GREEN}总政策记录数:{Style.RESET_ALL} {stats.get('total_policies', 0):,}")
        print(f"{Fore.GREEN}总关联关系数:{Style.RESET_ALL} {stats.get('total_relations', 0):,}")

        by_category = stats.get('by_category', [])
        if by_category:
            print(f"\n{Fore.YELLOW}📁 按分类统计:{Style.RESET_ALL}")
            for item in by_category:
                count = item.get('count', 0)
                total = stats.get('total_policies', 1)
                percentage = (count / total * 100) if total > 0 else 0
                bar = '█' * int(percentage / 5)
                print(f"  {item.get('category', '未分类'):15s} | {bar:<20s} | {count:5d} ({percentage:5.1f}%)")

        by_month = stats.get('by_month', [])
        if by_month:
            print(f"\n{Fore.YELLOW}📅 近12个月发布趋势:{Style.RESET_ALL}")
            for item in by_month:
                month = item.get('month', '未知')
                count = item.get('count', 0)
                bar = '█' * min(count, 50)
                print(f"  {month} | {bar:<50s} | {count:3d}")

        print("\n" + "=" * 60)
        print_info(f"统计查询耗时: {duration:.3f}s")

        if args.detailed:
            print_detailed_stats()

        return 0

    except Exception as e:
        print_error(f"获取统计信息失败: {str(e)}")
        logger.error(f"Statistics failed: {str(e)}", exc_info=True)
        return 1


def print_detailed_stats():
    print(f"\n{Fore.CYAN}📋 详细分类信息:{Style.RESET_ALL}")
    print("-" * 60)

    for category, config in POLICY_CATEGORIES.items():
        policies = db.get_policies(category=category, limit=5)
        count = len(policies)
        print(f"\n{Fore.YELLOW}{category}{Style.RESET_ALL} (关键词: {len(config.get('keywords', []))}个)")
        if policies:
            for p in policies[:3]:
                print(f"  • {p.get('title', '')[:50]}...")
        else:
            print(f"  (暂无数据)")


def show_update_report(args):
    print_info("生成更新报告...")

    try:
        report = db.get_update_report(days=args.days)

        if not report:
            print_warning("暂无更新数据")
            return 0

        print("\n" + "=" * 60)
        print(f"{Fore.CYAN}📰 {args.days}日更新报告{Style.RESET_ALL}")
        print("=" * 60)

        print(f"\n更新记录数: {Fore.GREEN}{report.get('updated_count', 0)}{Style.RESET_ALL}")
        print(f"失败记录数: {Fore.RED}{report.get('failed_count', 0)}{Style.RESET_ALL}")

        updated = report.get('updated_policies', [])
        if updated:
            print(f"\n{Fore.YELLOW}最近更新的政策:{Style.RESET_ALL}")
            for i, policy in enumerate(updated[:10], 1):
                print(f"  {i}. [{policy.get('category', '')}] {policy.get('title', '')[:60]}...")
                print(f"     {policy.get('updated_at', '')} - {policy.get('site_name', '')}")

        failed = report.get('failed_urls', [])
        if failed:
            print(f"\n{Fore.RED}采集失败的链接:{Style.RESET_ALL}")
            for i, item in enumerate(failed[:5], 1):
                print(f"  {i}. {item.get('url', '')[:80]}...")
                print(f"     状态: {item.get('status', '')} | 重试: {item.get('retry_count', 0)}次")

        print("\n" + "=" * 60)

        if args.export:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(DATA_DIR, f"update_report_{timestamp}.json")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            print_success(f"报告已导出: {output_path}")

        return 0

    except Exception as e:
        print_error(f"生成更新报告失败: {str(e)}")
        logger.error(f"Update report failed: {str(e)}", exc_info=True)
        return 1


def show_sources(args):
    print_info("可用采集源列表:")
    print("=" * 80)

    for code, config in CRAWL_SOURCES.items():
        status = f"{Fore.GREEN}✓ 已启用{Style.RESET_ALL}" if config.get('enabled', False) else f"{Fore.RED}✗ 已禁用{Style.RESET_ALL}"
        print(f"\n{Fore.CYAN}{code}{Style.RESET_ALL} - {config.get('name', '')} [{status}]")
        print(f"  类型: {config.get('site_type', '未知')}")
        print(f"  基地址: {config.get('base_url', '')}")
        print(f"  列表页: {len(config.get('list_urls', []))}个")

    print("\n" + "=" * 80)
    print_info(f"共 {len(CRAWL_SOURCES)} 个采集源，其中 {sum(1 for c in CRAWL_SOURCES.values() if c.get('enabled'))} 个已启用")

    return 0


def show_categories(args):
    print_info("优抚事项分类体系:")
    print("=" * 80)

    for i, (category, config) in enumerate(POLICY_CATEGORIES.items(), 1):
        keywords = config.get('keywords', [])
        weight = config.get('weight', 1.0)
        print(f"\n{i}. {Fore.CYAN}{category}{Style.RESET_ALL} (权重: {weight})")
        print(f"   关键词: {', '.join(keywords[:10])}")
        if len(keywords) > 10:
            print(f"           ... 等 {len(keywords)} 个关键词")

    print("\n" + "=" * 80)
    return 0


def parse_args():
    parser = argparse.ArgumentParser(
        prog='policy-crawler',
        description='优抚政策自动采集与聚合工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s init                              # 初始化数据库
  %(prog)s crawl --sources mva_gov_cn        # 采集指定来源
  %(prog)s crawl --start-date 2024-01-01     # 指定日期范围采集
  %(prog)s crawl --no-incremental            # 全量采集
  %(prog)s crawl --attachments               # 同时处理附件
  %(prog)s export --format excel             # 导出Excel
  %(prog)s search "伤残抚恤" --category 医疗救助  # 关键词搜索
  %(prog)s stats                             # 统计概览
  %(prog)s report --days 7                   # 周报
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    init_parser = subparsers.add_parser('init', help='初始化数据库')
    init_parser.set_defaults(func=init_database)

    crawl_parser = subparsers.add_parser('crawl', help='启动政策采集')
    crawl_parser.add_argument('--sources', type=str, default=None,
                              help='指定采集源，逗号分隔 (如: mva_gov_cn,provincial_mva)')
    crawl_parser.add_argument('--start-date', type=str, default=None,
                              help='开始日期 (YYYY-MM-DD)')
    crawl_parser.add_argument('--end-date', type=str, default=None,
                              help='结束日期 (YYYY-MM-DD)')
    crawl_parser.add_argument('--incremental', action='store_true', default=True,
                              help='增量更新 (默认开启)')
    crawl_parser.add_argument('--no-incremental', dest='incremental', action='store_false',
                              help='全量采集')
    crawl_parser.add_argument('--max-pages', type=int, default=None,
                              help='最大采集页数')
    crawl_parser.add_argument('--attachments', action='store_true',
                              help='同时下载并解析附件')
    crawl_parser.add_argument('--ocr', action='store_true',
                              help='开启OCR识别扫描版PDF')
    crawl_parser.set_defaults(func=crawl_policies)

    attach_parser = subparsers.add_parser('attachments', help='处理附件')
    attach_parser.add_argument('--policy-urls', type=str, default=None,
                               help='指定政策URL处理其附件')
    attach_parser.add_argument('--attachment-urls', type=str, default=None,
                               help='直接指定附件URL处理')
    attach_parser.add_argument('--ocr', action='store_true',
                               help='开启OCR识别')
    attach_parser.set_defaults(func=crawl_attachments)

    export_parser = subparsers.add_parser('export', help='导出数据')
    export_parser.add_argument('--format', type=str, default='json',
                               choices=EXPORT_FORMATS,
                               help='导出格式')
    export_parser.add_argument('--category', type=str, default=None,
                               help='按分类筛选')
    export_parser.add_argument('--start-date', type=str, default=None,
                               help='开始日期')
    export_parser.add_argument('--end-date', type=str, default=None,
                               help='结束日期')
    export_parser.add_argument('--limit', type=int, default=None,
                               help='最大导出数量')
    export_parser.set_defaults(func=export_data)

    search_parser = subparsers.add_parser('search', help='搜索政策')
    search_parser.add_argument('keyword', type=str, help='搜索关键词')
    search_parser.add_argument('--category', type=str, default=None,
                               help='按分类筛选')
    search_parser.add_argument('--limit', type=int, default=50,
                               help='最大返回数量')
    search_parser.add_argument('--export', action='store_true',
                               help='导出搜索结果')
    search_parser.add_argument('--format', type=str, default='json',
                               choices=EXPORT_FORMATS)
    search_parser.set_defaults(func=search_policies)

    stats_parser = subparsers.add_parser('stats', help='统计概览')
    stats_parser.add_argument('--detailed', action='store_true',
                              help='显示详细统计')
    stats_parser.set_defaults(func=show_statistics)

    report_parser = subparsers.add_parser('report', help='更新报告')
    report_parser.add_argument('--days', type=int, default=1,
                               help='报告天数')
    report_parser.add_argument('--export', action='store_true',
                               help='导出报告')
    report_parser.set_defaults(func=show_update_report)

    sources_parser = subparsers.add_parser('sources', help='查看采集源')
    sources_parser.set_defaults(func=show_sources)

    categories_parser = subparsers.add_parser('categories', help='查看分类体系')
    categories_parser.set_defaults(func=show_categories)

    return parser.parse_args()


def main():
    print_banner()

    if len(sys.argv) == 1:
        print_info("使用 --help 查看可用命令")
        return 0

    args = parse_args()

    if hasattr(args, 'func'):
        return args.func(args)
    else:
        print_error("请指定有效命令")
        return 1


if __name__ == '__main__':
    from collections import Counter
    sys.exit(main())
