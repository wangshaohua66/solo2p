import hashlib
import json
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

from logger import get_logger
from database import DatabaseManager
from notifier import Notifier
from config import load_config, AppConfig
from spider_base import BaseSpider


logger = get_logger("monitor")

BASELINE_DIR = Path(__file__).parent / "data" / "baselines"
BASELINE_DIR.mkdir(parents=True, exist_ok=True)


class SystemMonitor:
    def __init__(self, config: Optional[AppConfig] = None):
        self.db = DatabaseManager()
        self.notifier = Notifier()
        self.config = config or load_config()

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

    def _get_baseline_path(self, site_name: str, page_type: str = "list") -> Path:
        safe_name = "".join(c for c in site_name if c.isalnum() or c in "_-")
        return BASELINE_DIR / f"{safe_name}_{page_type}_baseline.json"

    def _load_baseline(self, site_name: str, page_type: str = "list") -> Optional[Dict[str, Any]]:
        path = self._get_baseline_path(site_name, page_type)
        if not path.exists():
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"加载基线数据失败 {path}: {e}")
            return None

    def _save_baseline(self, site_name: str, baseline: Dict[str, Any],
                       page_type: str = "list") -> None:
        path = self._get_baseline_path(site_name, page_type)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(baseline, f, ensure_ascii=False, indent=2)
            logger.debug(f"基线已保存: {path}")
        except Exception as e:
            logger.error(f"保存基线失败 {path}: {e}")

    def _compute_dom_signature(self, driver) -> Dict[str, Any]:
        try:
            signature = driver.execute_script("""
                function computeSignature() {
                    const allElements = document.querySelectorAll('*');
                    const tagCounts = {};
                    const classNames = new Set();
                    const ids = new Set();
                    let totalDepth = 0;
                    let maxDepth = 0;

                    function getDepth(el) {
                        let depth = 0;
                        let parent = el.parentElement;
                        while (parent) { depth++; parent = parent.parentElement; }
                        return depth;
                    }

                    allElements.forEach(el => {
                        const tag = el.tagName.toLowerCase();
                        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                        if (el.id) ids.add(el.id);
                        el.classList.forEach(cls => classNames.add(cls));
                        const d = getDepth(el);
                        totalDepth += d;
                        if (d > maxDepth) maxDepth = d;
                    });

                    const keySelectors = {
                        forms: document.querySelectorAll('form').length,
                        tables: document.querySelectorAll('table').length,
                        lists: document.querySelectorAll('ul, ol').length,
                        links: document.querySelectorAll('a').length,
                        inputs: document.querySelectorAll('input').length,
                        buttons: document.querySelectorAll('button').length,
                        divs: document.querySelectorAll('div').length,
                    };

                    const domStructure = JSON.stringify(tagCounts);
                    const hash = btoa(unescape(encodeURIComponent(domStructure))).substring(0, 32);

                    return {
                        element_count: allElements.length,
                        tag_counts: tagCounts,
                        unique_classes: classNames.size,
                        unique_ids: ids.size,
                        avg_depth: totalDepth / allElements.length,
                        max_depth: maxDepth,
                        key_selectors: keySelectors,
                        structure_hash: hash,
                    };
                }
                return computeSignature();
            """)
            return signature
        except Exception as e:
            logger.warning(f"计算DOM签名失败: {e}")
            return {}

    def _check_selectors_exist(self, driver, selectors: List[str]) -> Dict[str, Any]:
        results = {
            "total": len(selectors),
            "found": 0,
            "missing": [],
            "details": {},
        }
        for selector in selectors:
            try:
                count = len(driver.find_elements(By.CSS_SELECTOR, selector))
                results["details"][selector] = count
                if count > 0:
                    results["found"] += 1
                else:
                    results["missing"].append(selector)
            except Exception as e:
                results["missing"].append(selector)
                results["details"][selector] = f"error: {e}"
        return results

    def check_site_structure(self, site_name: str,
                             expected_selectors: List[str] = None,
                             use_baseline: bool = True,
                             alert_on_change: bool = True) -> Dict[str, Any]:
        result = {
            "site": site_name,
            "status": "ok",
            "message": "",
            "missing_selectors": [],
            "dom_changed": False,
            "change_details": {},
        }

        site_config = None
        for s in self.config.sites:
            if s.name == site_name:
                site_config = s
                break

        if site_config is None:
            result["status"] = "error"
            result["message"] = f"未找到站点配置: {site_name}"
            return result

        if expected_selectors is None:
            expected_selectors = [
                "table", ".jobfair-item", ".fair-item", "a[href*='detail']",
                "form", "input[type='text']", "button",
            ]

        logger.info(f"站点结构检查: {site_name}")

        driver = None
        try:
            opts = Options()
            opts.add_argument("--headless=new")
            opts.add_argument("--no-sandbox")
            opts.add_argument("--disable-dev-shm-usage")
            driver = webdriver.Chrome(options=opts)
            driver.set_page_load_timeout(30)

            driver.get(site_config.list_url)
            time.sleep(3)

            current_sig = self._compute_dom_signature(driver)

            selector_result = self._check_selectors_exist(driver, expected_selectors)
            result["missing_selectors"] = selector_result["missing"]
            result["selector_details"] = selector_result["details"]

            if selector_result["missing"]:
                result["status"] = "warning"
                result["message"] = f"有 {len(selector_result['missing'])} 个关键选择器未找到"
                logger.warning(
                    f"[{site_name}] 选择器缺失: {selector_result['missing']}"
                )

            baseline = self._load_baseline(site_name)
            if baseline and use_baseline:
                changes = self._compare_baseline(baseline, current_sig)
                result["change_details"] = changes
                result["dom_changed"] = changes["has_significant_change"]

                if changes["has_significant_change"]:
                    if result["status"] == "ok":
                        result["status"] = "changed"
                    result["message"] = (result.get("message", "") +
                                         f" DOM结构显著变化: {changes['change_summary']}").strip()
                    logger.warning(f"[{site_name}] DOM结构变化: {changes['change_summary']}")

                    if alert_on_change and selector_result["missing"]:
                        self.notifier.send_alert(
                            f"站点结构变更告警: {site_name}",
                            f"站点 {site_name} 的页面结构发生显著变化。\n\n"
                            f"变化概览: {changes['change_summary']}\n"
                            f"缺失选择器: {', '.join(selector_result['missing'])}\n"
                            f"元素数量变化: 基线{baseline.get('element_count', 0)} -> "
                            f"当前{current_sig.get('element_count', 0)}\n"
                            f"请及时检查并更新爬取规则。\n"
                            f"检测时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                        )
            else:
                self._save_baseline(site_name, current_sig)
                logger.info(f"[{site_name}] 已创建基线数据")

        except Exception as e:
            result["status"] = "error"
            result["message"] = str(e)
            logger.error(f"[{site_name}] 结构检查异常: {e}")
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass

        return result

    def _compare_baseline(self, baseline: Dict[str, Any],
                          current: Dict[str, Any]) -> Dict[str, Any]:
        changes = {
            "has_significant_change": False,
            "change_summary": "",
            "element_count_change": 0.0,
            "tag_differences": [],
            "class_change": 0.0,
            "structure_hash_changed": False,
        }

        baseline_count = baseline.get("element_count", 0)
        current_count = current.get("element_count", 0)
        if baseline_count > 0:
            change_ratio = abs(current_count - baseline_count) / baseline_count
            changes["element_count_change"] = round(change_ratio, 3)
            if change_ratio > 0.3:
                changes["has_significant_change"] = True

        if baseline.get("structure_hash") != current.get("structure_hash"):
            changes["structure_hash_changed"] = True

        baseline_tags = baseline.get("tag_counts", {})
        current_tags = current.get("tag_counts", {})
        all_tags = set(baseline_tags.keys()) | set(current_tags.keys())
        tag_diffs = []
        for tag in sorted(all_tags):
            b_val = baseline_tags.get(tag, 0)
            c_val = current_tags.get(tag, 0)
            if abs(c_val - b_val) > max(b_val * 0.3, 5):
                tag_diffs.append(f"{tag}: {b_val} -> {c_val}")
        changes["tag_differences"] = tag_diffs
        if len(tag_diffs) >= 3:
            changes["has_significant_change"] = True

        baseline_classes = baseline.get("unique_classes", 0)
        current_classes = current.get("unique_classes", 0)
        if baseline_classes > 0:
            class_change = abs(current_classes - baseline_classes) / baseline_classes
            changes["class_change"] = round(class_change, 3)
            if class_change > 0.3:
                changes["has_significant_change"] = True

        summary_parts = []
        if changes["element_count_change"] > 0.1:
            summary_parts.append(f"元素数变化{changes['element_count_change']:.0%}")
        if changes["tag_differences"]:
            summary_parts.append(f"{len(changes['tag_differences'])}类标签变化")
        if changes["class_change"] > 0.1:
            summary_parts.append(f"class数变化{changes['class_change']:.0%}")
        changes["change_summary"] = ", ".join(summary_parts) or "无显著变化"

        return changes

    def check_all_sites_structure(self) -> Dict[str, Any]:
        logger.info("开始全量站点结构检查...")
        results = {}
        changed_sites = []
        error_sites = []
        for site in self.config.sites:
            try:
                result = self.check_site_structure(site.name)
                results[site.name] = result
                if result.get("status") in ("warning", "changed"):
                    changed_sites.append(site.name)
                elif result.get("status") == "error":
                    error_sites.append(site.name)
            except Exception as e:
                logger.error(f"检查 {site.name} 失败: {e}")
                error_sites.append(site.name)
        logger.info(
            f"结构检查完成: {len(results)}个站点, "
            f"{len(changed_sites)}个变化, {len(error_sites)}个错误"
        )
        return {
            "total": len(results),
            "changed": changed_sites,
            "errors": error_sites,
            "details": results,
        }

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
            "site_structure": self.check_all_sites_structure(),
        }
