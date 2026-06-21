from datetime import datetime, timedelta
from typing import Any, Dict, List

from logger import get_logger
from database import DatabaseManager
from notifier import Notifier
from config import load_config


logger = get_logger("monitor")


class SystemMonitor:
    def __init__(self):
        self.db = DatabaseManager()
        self.notifier = Notifier()
        self.config = load_config()

    def check_crawl_health(self, fail_threshold: float = 0.3,
                           recent_minutes: int = 60) -> Dict[str, Any]:
        since = (datetime.now() - timedelta(minutes=recent_minutes)).isoformat()
        rows = self.db.query_all(
            "SELECT site_name, status, record_count, error_count, error_message "
            "FROM crawl_logs WHERE start_time >= ? ORDER BY start_time DESC",
            (since,)
        )
        results: Dict[str, Any] = {"sites": {}, "total_runs": len(rows), "failed_sites": []}

        site_stats: Dict[str, Dict[str, int]] = {}
        for row in rows:
            site = row["site_name"]
            if site not in site_stats:
                site_stats[site] = {"success": 0, "failed": 0, "total_errors": 0}
            if row["status"] == "success":
                site_stats[site]["success"] += 1
            else:
                site_stats[site]["failed"] += 1
            site_stats[site]["total_errors"] += int(row["error_count"] or 0)

        for site, stats in site_stats.items():
            total = stats["success"] + stats["failed"]
            fail_rate = stats["failed"] / total if total > 0 else 0
            results["sites"][site] = {
                "runs": total,
                "success": stats["success"],
                "failed": stats["failed"],
                "fail_rate": round(fail_rate, 3),
                "total_errors": stats["total_errors"],
            }
            if fail_rate >= fail_threshold:
                results["failed_sites"].append(site)
                self.notifier.send_alert(
                    f"站点爬取异常: {site}",
                    f"近{recent_minutes}分钟失败率 {fail_rate:.1%}，"
                    f"共{total}次运行，失败{stats['failed']}次，错误{stats['total_errors']}条"
                )

        logger.info(
            f"爬取健康检查: {len(rows)}条记录, "
            f"{len(results['failed_sites'])}个站点异常"
        )
        return results

    def check_site_structure(self, site_name: str,
                             expected_selectors: List[str] = None) -> Dict[str, Any]:
        result = {"site": site_name, "status": "ok", "missing_selectors": [],
                  "message": ""}
        logger.debug(f"站点结构检查: {site_name}")
        return result

    def check_submission_backlog(self, max_age_hours: int = 48) -> Dict[str, Any]:
        since = (datetime.now() - timedelta(hours=max_age_hours)).isoformat()
        rows = self.db.query_all(
            "SELECT status, COUNT(*) AS c FROM submissions "
            "WHERE submit_time >= ? GROUP BY status",
            (since,)
        )
        stats = {r["status"]: r["c"] for r in rows}
        pending = stats.get("submitted", 0) + stats.get("viewed", 0)
        result = {
            "time_window_hours": max_age_hours,
            "by_status": stats,
            "pending_review": pending,
            "rejected": stats.get("rejected", 0),
            "interview": stats.get("interview", 0),
            "offer": stats.get("offer", 0),
        }
        logger.info(f"投递积压检查: 待处理{pending}条, 面试{result['interview']}条, offer{result['offer']}条")
        return result

    def check_database_size(self) -> Dict[str, Any]:
        tables = [
            ("job_fairs", "招聘会"),
            ("companies", "企业"),
            ("jobs", "岗位"),
            ("submissions", "投递"),
            ("students", "学生"),
            ("crawl_logs", "爬取日志"),
            ("notifications", "通知"),
        ]
        result = {}
        for table, label in tables:
            try:
                rows = self.db.query_all(f"SELECT COUNT(*) AS c FROM {table}")
                result[label] = rows[0]["c"] if rows else 0
            except Exception as e:
                result[label] = f"error: {e}"
        logger.info(f"数据库容量检查: {result}")
        return result

    def run_all_checks(self) -> Dict[str, Any]:
        logger.info("开始系统健康检查...")
        return {
            "timestamp": datetime.now().isoformat(),
            "crawl_health": self.check_crawl_health(),
            "submission_backlog": self.check_submission_backlog(),
            "database_size": self.check_database_size(),
        }
