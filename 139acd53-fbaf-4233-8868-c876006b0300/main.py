import os
import sys
import time
import signal
import argparse
import threading
from datetime import datetime
from typing import Dict, Any, List

try:
    from colorama import init, Fore, Style, Back
    init(autoreset=True)
    COLOR_AVAILABLE = True
except ImportError:
    COLOR_AVAILABLE = False
    class _Dummy:
        def __getattr__(self, _): return ""
    Fore = Back = Style = _Dummy()

try:
    from tqdm import tqdm
    TQDM_AVAILABLE = True
except ImportError:
    TQDM_AVAILABLE = False

try:
    from tabulate import tabulate
    TABULATE_AVAILABLE = True
except ImportError:
    TABULATE_AVAILABLE = False

try:
    import schedule
    SCHEDULE_AVAILABLE = True
except ImportError:
    SCHEDULE_AVAILABLE = False

from config_manager import ConfigManager
from log_manager import LogManager, SyncStatus
from data_persistence import DataPersistence
from sync_engine import SyncEngine
from price_analyzer import PriceAnalyzer
from stock_monitor import StockMonitor


APP_BANNER = r"""
  _____                      _                             
 |_   _|                    (_)                            
   | |  _ ____   _____ _ __   _ _ __   ___  _ __ ___  _   _ 
   | | | '_ \ \ / / _ \ '_ \| | '_ \ / _ \| '_ ` _ \| | | |
  _| |_| | | \ V /  __/ | | | | | | | (_) | | | | | | |_| |
 |_____|_| |_|\_/ \___|_| |_|_|_| |_|\___/|_| |_| |_|\__, |
                                                       __/ |
    Inventory Sync Engine v1.0                        |___/ 
"""


def _c(text: str, color: str) -> str:
    if not COLOR_AVAILABLE:
        return text
    return f"{color}{text}{Style.RESET_ALL}"


def _red(s): return _c(s, Fore.RED)
def _green(s): return _c(s, Fore.GREEN)
def _yellow(s): return _c(s, Fore.YELLOW)
def _blue(s): return _c(s, Fore.BLUE)
def _magenta(s): return _c(s, Fore.MAGENTA)
def _cyan(s): return _c(s, Fore.CYAN)
def _white(s): return _c(s, Fore.WHITE)
def _bold(s): return _c(s, Style.BRIGHT)


class AppContext:
    def __init__(self):
        self.config = ConfigManager()
        gs = self.config.global_settings
        self.db = DataPersistence(gs.db_path)
        self.log = LogManager(gs.log_dir, db_log_handler=self.db)
        self.engine = SyncEngine(self.config, self.log, self.db)
        self.pricer = PriceAnalyzer(self.config, self.log, self.db)
        self.stocker = StockMonitor(self.config, self.log, self.db)


def _progress(total: int, desc: str = "Progress", unit: str = "item"):
    if TQDM_AVAILABLE:
        return tqdm(total=total, desc=_cyan(desc), unit=unit, ncols=80,
                   bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]")
    class _Fallback:
        def __init__(s, t): s.t = t; s.n = 0
        def update(s, n=1):
            s.n += n
            pct = int(s.n / s.t * 100) if s.t else 0
            bar = "█" * int(pct / 2) + "░" * (50 - int(pct / 2))
            sys.stdout.write(f"\r  {_cyan(desc)} |{bar}| {s.n}/{s.t} {pct:5.1f}%  ")
            sys.stdout.flush()
            if s.n >= s.t: sys.stdout.write("\n")
        def close(s): pass
        def __enter__(s): return s
        def __exit__(s, *a): pass
    return _Fallback(total)


def cmd_sync(args, ctx: AppContext):
    print(_bold("\n=== Sync Task Start ==="))
    start = datetime.now()

    if args.all:
        sids = ctx.config.all_supplier_ids()
    elif args.supplier:
        sids = [args.supplier] if isinstance(args.supplier, str) else list(args.supplier)
    elif args.group:
        sids = [s.id for s in ctx.config.get_suppliers_by_group(args.group)]
    else:
        sids = ctx.config.all_supplier_ids()

    if not sids:
        print(_red("No suppliers specified"))
        return 1

    print(f"  Suppliers: {_cyan(str(len(sids)))}")
    print(f"  Scheduled: {_cyan(ctx.config.global_settings.sync_time)}")

    results_list = []

    try:
        with _progress(len(sids), "Sync", "suppliers") as bar:
            for sid in sids:
                sup = ctx.config.get_supplier(sid)
                name = sup.name if sup else sid
                try:
                    res = ctx.engine.sync_single(sid)
                    results_list.append(res)
                    status = res.get("status", "UNKNOWN")
                    recs = res.get("records_inserted", 0)
                except Exception as e:
                    results_list.append({"supplier_id": sid, "status": "FAILED", "error": str(e)})
                bar.update(1)
    except KeyboardInterrupt:
        print(f"\n{_yellow('Interrupted by user')}")
        return 130

    _print_sync_summary(results_list, start)

    if not getattr(args, 'no_analyze', False):
        try:
            ctx.pricer.analyze_all()
            ctx.stocker.monitor_all()
        except Exception as e:
            ctx.log.error(f"Post-sync analysis failed: {str(e)}")

    return 0


def _print_sync_summary(results: List[Dict], start: datetime):
    print(_bold("\n========== Sync Summary =========="))
    total = len(results)
    success = sum(1 for r in results if r.get("status") == "SUCCESS")
    partial = sum(1 for r in results if r.get("status") == "PARTIAL")
    failed = sum(1 for r in results if r.get("status") == "FAILED")
    skipped = sum(1 for r in results if r.get("status") == "SKIPPED")
    total_recs = sum(r.get("records_inserted", 0) for r in results)
    duration = (datetime.now() - start).total_seconds()

    table = [
        ["Total", total, total_recs, f"{duration:.1f}s"],
        [_green("Success"), success, "-", "-"],
        [_yellow("Partial"), partial, "-", "-"],
        [_red("Failed"), failed, "-", "-"],
        [_yellow("Skipped"), skipped, "-", "-"],
    ]
    headers = [_bold("Status"), _bold("Count"), _bold("Records"), _bold("Duration")]

    if TABULATE_AVAILABLE:
        print(tabulate(table, headers=headers, tablefmt="grid"))
    else:
        for row in table:
            print("  ", " | ".join(str(x) for x in row))

    if failed > 0:
        print(_bold("\nFailed suppliers:"))
        for r in results:
            if r.get("status") == "FAILED":
                print(f"  {_red('*')} {r.get('supplier_id')} {r.get('supplier_name', '')}: {_red(r.get('error') or 'Unknown error')}")

    print(_green(f"\nDone"))


def cmd_report_stock(args, ctx: AppContext):
    print(_bold("\n=== Stock Alert Report ==="))
    date = args.date or datetime.now().strftime("%Y-%m-%d")
    summary = ctx.stocker.monitor_all()

    out_path = None
    if args.export:
        out_path = ctx.stocker.export_report(date=date)

    print(f"  Date: {_cyan(date)}")
    print(f"  SKU scanned: {summary['total_skus']}")
    print(f"  Below safety: {_yellow(str(summary['below_safety']))}")

    summary2 = ctx.stocker.get_summary_report(date=date)

    rows = []
    for level, count in summary2['by_level'].items():
        lv_color = {
            'CRITICAL': _red(level),
            'HIGH': _magenta(level),
            'MEDIUM': _yellow(level),
            'LOW': _blue(level),
        }.get(level, level)
        rows.append([lv_color, str(count)])

    if rows:
        print(_bold("\nBy Level:"))
        if TABULATE_AVAILABLE:
            print(tabulate(rows, headers=[_bold('Level'), _bold('Count')], tablefmt='simple'))
        else:
            for r in rows: print("  ", " | ".join(r))

    top_rows = []
    for cat, info in summary2['by_category'].items():
        top_rows.append([cat, str(info['count']), str(info['suggested'])])
    if top_rows:
        print(_bold("\nBy Category:"))
        headers = [_bold('Category'), _bold('Alerts'), _bold('Suggested Qty')]
        if TABULATE_AVAILABLE:
            print(tabulate(top_rows, headers=headers, tablefmt='simple'))
        else:
            for r in top_rows: print("  ", " | ".join(r))

    hot = summary.get("hot_items", [])[:10]
    if hot:
        print(_bold("\nHot Shortage TOP 10:"))
        hrows = []
        for h in hot:
            lv = _red(h['level']) if h['level'] == 'CRITICAL' else _magenta(h['level'])
            hrows.append([
                h['supplier_id'], str(h['sku'])[:20], str(h['name'])[:30],
                lv, str(h['current_stock']),
                str(h['safety_stock']), str(h['shortfall']),
            ])
        headers = [_bold('Supplier'), _bold('SKU'), _bold('Name'), _bold('Level'),
                   _bold('Stock'), _bold('Safety'), _bold('Gap')]
        if TABULATE_AVAILABLE:
            print(tabulate(hrows, headers=headers, tablefmt='simple'))
        else:
            for r in hrows: print("  ", " | ".join(r))

    if out_path:
        print(f"\n{_green('Exported:')}{_cyan(out_path)}")

    return 0


def cmd_report_price(args, ctx: AppContext):
    print(_bold("\n=== Price Fluctuation Analysis ==="))
    date = args.date or datetime.now().strftime("%Y-%m-%d")
    summary = ctx.pricer.analyze_all()

    out_path = None
    if args.export:
        out_path = ctx.pricer.export_report(date=date)

    threshold = ctx.config.global_settings.price_threshold
    print(f"  Date: {_cyan(date)}")
    print(f"  SKU scanned: {summary['total_skus']}")
    print(f"  Price changed: {summary['with_changes']}")
    print(f"  Over threshold ({threshold}%): {_yellow(str(summary['over_threshold']))}")
    print(f"  Anomalies: {_red(str(summary['anomalies']))}")
    print(f"  Alerts generated: {summary['alerts_generated']}")

    alerts = ctx.pricer.get_pending_alerts(date=date, only_anomaly=False)[:20]

    if alerts:
        print(_bold("\nPending Price Alerts TOP 20:"))
        arows = []
        for a in alerts:
            anomaly = _red('YES') if a.get('is_anomaly') else 'no'
            dchg = a.get('daily_change_pct', 0)
            wchg = a.get('weekly_change_pct', 0)
            dcol = _red(f'{dchg:+.2f}%') if abs(dchg) > 10 else (
                _yellow(f'{dchg:+.2f}%') if abs(dchg) > 5 else f'{dchg:+.2f}%')
            wcol = _red(f'{wchg:+.2f}%') if abs(wchg) > 10 else (
                _yellow(f'{wchg:+.2f}%') if abs(wchg) > 5 else f'{wchg:+.2f}%')
            arows.append([
                a.get('supplier_id'), str(a.get('sku'))[:20],
                str(a.get('name'))[:25], a.get('category') or '',
                f"{a.get('current_price', 0):.4f}", dcol, wcol, anomaly,
            ])
        headers = [_bold('Supp'), _bold('SKU'), _bold('Name'), _bold('Cat'),
                   _bold('Price'), _bold('Daily'), _bold('Weekly'), _bold('Anom')]
        if TABULATE_AVAILABLE:
            print(tabulate(arows, headers=headers, tablefmt='simple'))
        else:
            for r in arows: print("  ", " | ".join(r))

    if out_path:
        print(f"\n{_green('Exported:')}{_cyan(out_path)}")

    return 0


def cmd_logs(args, ctx: AppContext):
    print(_bold("\n=== Sync Log Query ==="))
    rows = ctx.db.query_sync_logs(
        date_from=args.from_date,
        date_to=args.to_date,
        supplier_id=args.supplier,
        status=args.status,
        limit=args.limit or 50,
    )
    if not rows:
        print(_yellow("No matching logs found"))
        return 0

    print(f"  Total: {len(rows)} records\n")

    log_rows = []
    for r in rows:
        st = r['status']
        stcol = _green(st) if st == "SUCCESS" else (
            _yellow(st) if st == "PARTIAL" else _red(st))
        sname = (r['supplier_name'] or '')[:20]
        tid = (r['task_id'] or '')[:18]
        tstr = (r['start_time'] or '')[11:19]
        log_rows.append([
            tid, r['supplier_id'], sname, r['sync_type'],
            stcol, str(r['records_inserted']),
            f"{r['duration_seconds'] or 0:.1f}s", tstr,
        ])
    headers = [
        _bold('TaskID'), _bold('Supp'), _bold('Name'), _bold('Type'),
        _bold('Status'), _bold('Recs'), _bold('Dur'), _bold('Start')
    ]
    if TABULATE_AVAILABLE:
        print(tabulate(log_rows, headers=headers, tablefmt='simple'))

    failed = [r for r in rows if r['status'] == "FAILED" and r['error_message']]
    if failed:
        print(_bold("\nError details:"))
        for r in failed:
            print(f"\n  {_red('*')} {r['supplier_id']}/{r['task_id']}")
            print(f"    {_red(r['error_message'])}")
    return 0


def cmd_status(args, ctx: AppContext):
    print(_bold("\n=== System Status ==="))
    stats = ctx.db.get_db_stats()
    print(f"  Time: {_cyan(datetime.now().strftime('%Y-%m-%d %H:%M:%S'))}")
    print(f"  DB: {_cyan(ctx.config.global_settings.db_path)}")
    print()
    trows = [[k, str(v)] for k, v in stats.items()]
    headers = [_bold('Table'), _bold('Records')]
    if TABULATE_AVAILABLE:
        print(tabulate(trows, headers=headers, tablefmt='simple'))

    inv_count = len(ctx.config.all_supplier_ids())
    print(f"\n  Configured suppliers: {_cyan(str(inv_count))}")
    by_type = {}
    for s in ctx.config.suppliers.values():
        by_type[s.type] = by_type.get(s.type, 0) + 1
    t2 = []
    for k, v in by_type.items():
        kmap = {'web': _blue, 'excel': _green, 'ftp': _yellow, 'api': _magenta}
        t2.append([kmap.get(k, _white)(k), str(v)])
    print("  By type:")
    if TABULATE_AVAILABLE:
        print(tabulate(t2, headers=[_bold('Type'), _bold('Count')], tablefmt='simple'))
    return 0


def run_scheduler(ctx: AppContext):
    if not SCHEDULE_AVAILABLE:
        print(_red("schedule library not installed"))
        return 1

    sync_time = ctx.config.global_settings.sync_time
    print(_bold("\n=== Scheduler Mode ==="))
    print(f"  Daily at {_cyan(sync_time)} - full sync + analysis")
    print(f"  Ctrl+C to exit\n")

    def job():
        print(_bold(f"\n[Scheduled job triggered at {datetime.now()}]"))
        try:
            sids = ctx.config.all_supplier_ids()
            with _progress(len(sids), "Scheduled", "suppliers") as bar:
                for sid in sids:
                    try:
                        ctx.engine.sync_single(sid)
                    except Exception:
                        pass
                    bar.update(1)
            ctx.pricer.analyze_all()
            ctx.stocker.monitor_all()
            print(_green("Scheduled job complete"))
        except Exception as e:
            ctx.log.error(f"Scheduled job error: {str(e)}")

    schedule.every().day.at(sync_time).do(job)

    stop = threading.Event()
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    signal.signal(signal.SIGTERM, lambda *_: stop.set())

    try:
        while not stop.is_set():
            schedule.run_pending()
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    print(_yellow("\nScheduler stopped"))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="inv_sync", description="Inventory & Price Sync Engine",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=APP_BANNER,
    )
    parser.add_argument("--no-color", action="store_true", help="disable color output")
    sub = parser.add_subparsers(dest="command", help="sub-command")

    p_sync = sub.add_parser("sync", help="Sync data")
    g = p_sync.add_mutually_exclusive_group()
    g.add_argument("--all", action="store_true", help="sync all suppliers")
    g.add_argument("--supplier", action="append", help="supplier ID (repeatable)")
    g.add_argument("--group", help="sync by supplier group")
    p_sync.add_argument("--no-analyze", action="store_true", help="skip post-sync analysis")
    p_sync.set_defaults(func=cmd_sync)

    p_stock = sub.add_parser("report-stock", help="Stock alert report")
    p_stock.add_argument("--date", help="target date YYYY-MM-DD")
    p_stock.add_argument("--export", action="store_true", help="export CSV")
    p_stock.set_defaults(func=cmd_report_stock)

    p_price = sub.add_parser("report-price", help="Price fluctuation report")
    p_price.add_argument("--date", help="target date YYYY-MM-DD")
    p_price.add_argument("--export", action="store_true", help="export CSV")
    p_price.set_defaults(func=cmd_report_price)

    p_logs = sub.add_parser("logs", help="Query sync logs")
    p_logs.add_argument("--from-date", help="start date")
    p_logs.add_argument("--to-date", help="end date")
    p_logs.add_argument("--supplier", help="supplier ID")
    p_logs.add_argument("--status", choices=["SUCCESS", "PARTIAL", "FAILED", "SKIPPED"])
    p_logs.add_argument("--limit", type=int)
    p_logs.set_defaults(func=cmd_logs)

    p_status = sub.add_parser("status", help="System status")
    p_status.set_defaults(func=cmd_status)

    p_sched = sub.add_parser("scheduler", help="Run scheduled sync")
    p_sched.set_defaults(func=lambda a, c: run_scheduler(c))

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if not getattr(args, 'command', None):
        print(APP_BANNER)
        parser.print_help()
        return 0
    if args.no_color:
        global COLOR_AVAILABLE
        COLOR_AVAILABLE = False
    try:
        ctx = AppContext()
    except Exception as e:
        print(_red(f"Init failed: {str(e)}"))
        return 2
    try:
        return args.func(args, ctx)
    except KeyboardInterrupt:
        print(_yellow("\nInterrupted"))
        return 130


if __name__ == "__main__":
    sys.exit(main() or 0)
