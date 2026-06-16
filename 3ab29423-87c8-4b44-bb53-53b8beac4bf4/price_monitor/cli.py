#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""农产品价格监测预警系统 - 命令行入口"""

import argparse
import sys
import os
from collections import defaultdict
from typing import Dict, List

from tabulate import tabulate

from .utils import (
    load_config,
    logger,
    today_str,
    Color,
    color_text,
    fmt_pct,
    pct_color,
    text_bar,
)
from .spider_manager import SpiderManager


def _init_manager() -> SpiderManager:
    try:
        return SpiderManager()
    except Exception as e:
        logger.error(color_text(f"初始化失败: {e}", Color.RED))
        sys.exit(1)


def cmd_crawl(args):
    mgr = _init_manager()
    force = args.force
    no_resume = args.no_resume
    daemon = args.daemon

    if daemon:
        logger.info(color_text("[CLI] 以守护模式启动，等待每日定时任务...", Color.CYAN))
        mgr.start_scheduler()
        mgr.wait_forever()
        return

    market_arg = args.market
    if market_arg == "all":
        market_ids = None
    else:
        if "," in market_arg:
            market_ids = [m.strip() for m in market_arg.split(",") if m.strip()]
        else:
            market_ids = [market_arg]

    if market_ids is None:
        summary = mgr.crawl_all(force=force, resume=not no_resume)
    elif len(market_ids) == 1:
        result = mgr.crawl_one(market_ids[0], force=force)
        _print_market_result(result)
        return
    else:
        summary = mgr.crawl_all(market_ids=market_ids, force=force, resume=False)

    _print_crawl_summary(summary)


def _print_market_result(mr: Dict):
    headers = [
        color_text("项目", Color.BOLD),
        color_text("值", Color.BOLD),
    ]
    status_color = {
        "success": Color.GREEN,
        "skipped": Color.YELLOW,
        "failed": Color.RED,
        "error": Color.RED,
    }.get(mr["status"], Color.WHITE)

    rows = [
        ["市场ID", mr["market_id"]],
        ["市场名称", mr["market_name"]],
        ["状态", color_text(mr["status"].upper(), status_color)],
        ["信息", mr["message"]],
        ["原始记录数", mr["total"]],
        ["成功入库", mr["success"]],
        ["重复跳过", mr["duplicate"]],
        ["待人工确认", mr["unmapped"]],
        ["触发预警", mr["alerts"]],
        ["错误数", mr["errors"]],
        ["耗时(秒)", mr["duration_seconds"]],
    ]
    print("\n" + tabulate(rows, headers=headers, tablefmt="fancy_grid") + "\n")


def _print_crawl_summary(summary: Dict):
    failed = summary.get("failed", [])
    headers = [
        color_text("指标", Color.BOLD),
        color_text("值", Color.BOLD),
    ]
    total = summary.get("total_markets", 0)
    suc = len(summary.get("completed", []))
    rows = [
        ["任务日期", summary.get("task_date", "-")],
        ["市场总数", total],
        [
            "成功/失败",
            color_text(str(suc), Color.GREEN) + " / " + color_text(str(len(failed)), Color.RED),
        ],
        ["原始记录数", summary.get("total_records", 0)],
        ["成功入库", color_text(str(summary.get("total_success", 0)), Color.GREEN)],
        ["重复跳过", color_text(str(summary.get("total_duplicate", 0)), Color.YELLOW)],
        ["待人工确认", color_text(str(summary.get("total_unmapped", 0)), Color.MAGENTA)],
        ["触发预警", color_text(str(summary.get("total_alerts", 0)), Color.BG_RED if summary.get("total_alerts") else Color.WHITE)],
        ["错误数", color_text(str(summary.get("total_errors", 0)), Color.RED if summary.get("total_errors") else Color.WHITE)],
        ["总耗时(分钟)", summary.get("duration_minutes", 0)],
    ]
    print("\n" + color_text("=" * 60, Color.BOLD + Color.CYAN))
    print(color_text("  批量采集结果汇总", Color.BOLD + Color.CYAN))
    print(color_text("=" * 60, Color.BOLD + Color.CYAN))
    print(tabulate(rows, headers=headers, tablefmt="fancy_grid"))

    if failed:
        print("\n" + color_text("⚠ 失败的市场:", Color.BG_RED))
        for mid in failed:
            print(f"  - {mid}")

    per = summary.get("per_market", [])
    if per:
        rows2 = []
        for mr in per:
            s_color = {
                "success": Color.GREEN,
                "skipped": Color.YELLOW,
                "failed": Color.RED,
                "error": Color.RED,
            }.get(mr["status"], Color.WHITE)
            rows2.append([
                mr["market_id"],
                mr["market_name"],
                color_text(mr["status"], s_color),
                mr["success"],
                mr["total"],
                mr["alerts"],
                mr["duration_seconds"],
            ])
        headers2 = [
            color_text("ID", Color.BOLD),
            color_text("市场", Color.BOLD),
            color_text("状态", Color.BOLD),
            color_text("成功", Color.BOLD),
            color_text("总数", Color.BOLD),
            color_text("预警", Color.BOLD),
            color_text("耗时(s)", Color.BOLD),
        ]
        print("\n" + tabulate(rows2, headers=headers2, tablefmt="fancy_grid") + "\n")


def cmd_report(args):
    mgr = _init_manager()
    db = mgr.pipeline.db
    mapper = mgr.pipeline.mapper

    date = args.date or today_str()
    category = args.category

    cat_group_map = {
        "vegetable": "蔬菜",
        "fruit": "水果",
        "livestock": "畜禽",
        "aquatic": "水产",
    }
    group_filter = None
    if category:
        group_filter = cat_group_map.get(category.lower())
        if not group_filter:
            logger.error(color_text(f"未知品类大类: {category}, 可选: {list(cat_group_map.keys())}", Color.RED))
            sys.exit(1)

    records = db.query_daily_report(trade_date=date, category_group=group_filter)
    if not records:
        print(color_text(f"\n日期 {date} 暂无数据\n", Color.YELLOW))
        return

    groups = defaultdict(list)
    for r in records:
        grp = r.get("category_group") or "未分类"
        groups[grp].append(r)

    print(color_text(f"\n{'='*80}", Color.BOLD + Color.CYAN))
    title = f"  {date} 农产品行情日报"
    if group_filter:
        title += f" 【{group_filter}】"
    print(color_text(title, Color.BOLD + Color.CYAN))
    print(color_text(f"{'='*80}\n", Color.BOLD + Color.CYAN))

    total_groups = 0
    total_items = 0
    for grp_name, items in sorted(groups.items()):
        disp_name = mapper.get_group_name(grp_name) if mapper else grp_name
        print(color_text(f"\n■ {disp_name} ({len(items)}个品类)", Color.BOLD + Color.BLUE))
        rows = []
        items_sorted = sorted(items, key=lambda x: (x.get("category_name") or "", x.get("market_name") or ""))
        for r in items_sorted:
            pct = r.get("change_pct") or 0
            alert_flag = color_text(" ⚠", Color.RED) if abs(pct) >= 15 else ""
            unmapped = ""
            if r.get("status") == "pending_review":
                unmapped = color_text(" ?", Color.MAGENTA)
            rows.append([
                color_text(r.get("category_name") or "-", Color.BOLD),
                r.get("market_name") or "-",
                f"{r.get('min_price') or '-':.2f}" if r.get("min_price") else "-",
                f"{r.get('max_price') or '-':.2f}" if r.get("max_price") else "-",
                color_text(
                    f"{r.get('avg_price') or '-':.2f}" if r.get("avg_price") else "-",
                    Color.BOLD + Color.GREEN,
                ),
                color_text(fmt_pct(pct), pct_color(pct)) + alert_flag + unmapped,
            ])
        headers = [
            color_text("品种", Color.BOLD),
            color_text("市场", Color.BOLD),
            color_text("最低价", Color.BOLD),
            color_text("最高价", Color.BOLD),
            color_text("均价", Color.BOLD),
            color_text("涨跌幅", Color.BOLD),
        ]
        print(tabulate(rows, headers=headers, tablefmt="simple", floatfmt=".2f"))
        total_groups += 1
        total_items += len(items)

    print(color_text(
        f"\n共 {total_groups} 个大类，{total_items} 条记录\n",
        Color.BOLD + Color.CYAN,
    ))


def cmd_alert(args):
    mgr = _init_manager()
    circuit = mgr.pipeline.circuit
    db = mgr.pipeline.db

    if args.status:
        open_list = circuit.list_open()
        if not open_list:
            print(color_text("\n✅ 当前没有熔断的市场\n", Color.GREEN))
        else:
            print(color_text(f"\n⚠ 当前共有 {len(open_list)} 个熔断市场:\n", Color.BG_YELLOW))
            rows = []
            for item in open_list:
                rows.append([
                    item["market_id"],
                    item["market_name"],
                    color_text(str(item["fail_count"]), Color.RED),
                    item["open_until"],
                    color_text(f"{item['remaining_hours']}h", Color.BOLD),
                ])
            headers = [
                color_text("ID", Color.BOLD),
                color_text("市场名称", Color.BOLD),
                color_text("失败次数", Color.BOLD),
                color_text("熔断到期", Color.BOLD),
                color_text("剩余时间", Color.BOLD),
            ]
            print(tabulate(rows, headers=headers, tablefmt="fancy_grid") + "\n")
        return

    unpushed = db.get_unpushed_alerts()
    if unpushed:
        print(color_text(f"\n⚠ 待推送预警 ({len(unpushed)}条):", Color.BG_RED))
    else:
        print(color_text("\n✅ 当前没有待推送的预警\n", Color.GREEN))

    for a in unpushed:
        level_color = {
            "critical": Color.BG_RED,
            "high": Color.RED,
            "warning": Color.YELLOW,
        }.get(a.get("alert_level"), Color.WHITE)
        pct = a.get("change_pct") or 0
        print(f"\n  {color_text(a.get('alert_type'), level_color)} "
              f"{a.get('market_name')} / {a.get('category_name')}")
        print(f"    当前价: {a.get('current_price')}  涨跌幅: {color_text(fmt_pct(pct), pct_color(pct))}")
        print(f"    说明: {a.get('message')}")
        if a.get("trend_7d"):
            print(f"    近7日: {a.get('trend_7d')}")
    print()


def cmd_history(args):
    mgr = _init_manager()
    db = mgr.pipeline.db
    mapper = mgr.pipeline.mapper

    category_arg = args.category.lower()
    days = args.days or 30

    cat_id_map = {}
    for cid, info in mapper.category_map.items():
        cat_id_map[info["name"]] = cid
        for alias in info["aliases"]:
            cat_id_map[alias] = cid

    cat_id = cat_id_map.get(category_arg)
    cat_name = category_arg
    if cat_id:
        info = mapper.get_category_info(cat_id)
        cat_name = info["name"]

    records = db.query_history(category_id=cat_id, category_name=cat_name if not cat_id else None, days=days)
    if not records:
        print(color_text(f"\n近{days}日未找到【{category_arg}】的历史数据\n", Color.YELLOW))
        return

    market_groups = defaultdict(list)
    for r in records:
        key = (r.get("market_id") or "-", r.get("market_name") or "-")
        market_groups[key].append(r)

    print(color_text(f"\n{'='*80}", Color.BOLD + Color.CYAN))
    print(color_text(f"  【{cat_name}】近{days}日价格趋势", Color.BOLD + Color.CYAN))
    print(color_text(f"{'='*80}\n", Color.BOLD + Color.CYAN))

    for (mid, mname), items in sorted(market_groups.items(), key=lambda x: x[0][1]):
        items_sorted = sorted(items, key=lambda x: x.get("trade_date") or "")
        prices = [r.get("avg_price") or 0 for r in items_sorted]
        dates = [r.get("trade_date") or "" for r in items_sorted]
        max_price = max(prices) if prices else 0
        min_price = min(prices) if prices else 0
        avg_price = sum(prices) / len(prices) if prices else 0
        first = prices[0] if prices else 0
        last = prices[-1] if prices else 0
        period_pct = round((last - first) / first * 100, 2) if first else 0

        print(color_text(f"\n市场: {mname} ({mid})", Color.BOLD + Color.BLUE))
        print(f"  区间涨跌: {color_text(fmt_pct(period_pct), pct_color(period_pct))}  "
              f"最低: {min_price:.2f}  最高: {max_price:.2f}  平均: {avg_price:.2f}")

        table_rows = []
        for r in items_sorted:
            pct = r.get("change_pct") or 0
            price = r.get("avg_price") or 0
            bar = text_bar(price, max_price or 1, width=20)
            table_rows.append([
                r.get("trade_date", "-"),
                color_text(f"{price:.2f}", Color.BOLD),
                bar,
                color_text(fmt_pct(pct), pct_color(pct)),
            ])
        headers = [
            color_text("日期", Color.BOLD),
            color_text("均价", Color.BOLD),
            color_text("价格趋势", Color.BOLD),
            color_text("日涨跌", Color.BOLD),
        ]
        print(tabulate(table_rows, headers=headers, tablefmt="simple"))
    print()


def _build_parser():
    parser = argparse.ArgumentParser(
        prog="price_monitor",
        description="省级农产品批发市场价格监测预警系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  price_monitor crawl --market all                    全量采集
  price_monitor crawl --market bj_xinfadi             采集单个市场
  price_monitor crawl --market bj_xinfadi,sh_caixin   采集多个市场
  price_monitor crawl --market all --daemon           守护模式(含定时调度)
  price_monitor report --date 2026-06-17              查看日报
  price_monitor report --category vegetable           按品类查看
  price_monitor alert --status                        查看熔断列表
  price_monitor history --category 白菜 --days 30     近30日价格趋势
        """,
    )
    sub = parser.add_subparsers(dest="command", required=True, help="子命令")

    # crawl
    p_crawl = sub.add_parser("crawl", help="采集市场价格数据")
    p_crawl.add_argument("--market", required=True, help="市场ID或 'all'，多个用逗号分隔")
    p_crawl.add_argument("--force", action="store_true", help="强制采集，忽略熔断状态")
    p_crawl.add_argument("--no-resume", action="store_true", help="不从断点续采，重跑全部")
    p_crawl.add_argument("--daemon", action="store_true", help="守护模式：启动APScheduler每日7点定时采集")
    p_crawl.set_defaults(func=cmd_crawl)

    # report
    p_report = sub.add_parser("report", help="输出行情汇总报告")
    p_report.add_argument("--date", default=None, help="查询日期，格式 YYYY-MM-DD（默认今日）")
    p_report.add_argument("--category", default=None, help="品类大类过滤: vegetable/fruit/livestock/aquatic")
    p_report.set_defaults(func=cmd_report)

    # alert
    p_alert = sub.add_parser("alert", help="预警与熔断管理")
    p_alert.add_argument("--status", action="store_true", help="查询当前熔断市场列表")
    p_alert.set_defaults(func=cmd_alert)

    # history
    p_hist = sub.add_parser("history", help="查询历史价格趋势")
    p_hist.add_argument("--category", required=True, help="品类名称，如: 白菜/西红柿/猪肉")
    p_hist.add_argument("--days", type=int, default=30, help="查询天数，默认30")
    p_hist.set_defaults(func=cmd_history)

    return parser


def main():
    parser = _build_parser()
    args = parser.parse_args()

    try:
        args.func(args)
    except KeyboardInterrupt:
        print(color_text("\n\n操作已中断", Color.YELLOW))
        sys.exit(130)
    except Exception as e:
        logger.error(color_text(f"执行异常: {e}", Color.BG_RED))
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
