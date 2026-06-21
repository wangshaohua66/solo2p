import os
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict

from config_manager import ConfigManager
from log_manager import LogManager, LogLevel
from data_persistence import (
    DataPersistence, StockAlert,
)


class StockMonitor:
    def __init__(self, config: ConfigManager, log_manager: LogManager,
                 db: DataPersistence):
        self.config = config
        self.log = log_manager
        self.db = db
        self.settings = config.global_settings
        self.analysis_date = datetime.now().strftime("%Y-%m-%d")

    def _expected_out_of_stock_date(self, current_stock: int,
                                     daily_consumption: int,
                                     lead_time_days: int) -> Optional[str]:
        if daily_consumption <= 0 or current_stock <= 0:
            return datetime.now().strftime("%Y-%m-%d")
        days_left = int(current_stock / daily_consumption)
        out_date = datetime.now() + timedelta(days=days_left)
        return out_date.strftime("%Y-%m-%d")

    def _suggested_purchase_qty(self, current_stock: int, safety_stock: int,
                                 daily_consumption: int,
                                 lead_time_days: int) -> int:
        min_required = safety_stock + daily_consumption * lead_time_days
        if current_stock >= min_required:
            return 0
        base = min_required - current_stock
        buffer = int(daily_consumption * max(3, lead_time_days // 2))
        return int(base + buffer)

    def _alert_level(self, current_stock: int, safety_stock: int,
                      daily_consumption: int) -> str:
        if current_stock <= 0:
            return "CRITICAL"
        if current_stock <= daily_consumption * 2:
            return "CRITICAL"
        if current_stock <= safety_stock * 0.3:
            return "CRITICAL"
        if current_stock <= safety_stock * 0.7:
            return "HIGH"
        if current_stock <= safety_stock:
            return "MEDIUM"
        return "LOW"

    def monitor_all(self) -> Dict[str, Any]:
        summary = {
            "date": self.analysis_date,
            "total_skus": 0,
            "below_safety": 0,
            "alerts_generated": 0,
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "total_suggested_qty": 0,
            "by_category": defaultdict(lambda: {
                "total": 0, "below_safety": 0, "critical": 0,
                "high": 0, "medium": 0, "low": 0,
            }),
            "by_supplier": defaultdict(lambda: {
                "total": 0, "below_safety": 0, "critical": 0,
                "high": 0, "medium": 0, "low": 0,
            }),
            "hot_items": [],
        }

        latest_inv = self.db.get_latest_inventory()
        self.log.info(f"库存监控开始，扫描 {len(latest_inv)} 条最新库存记录")

        alerts: List[StockAlert] = []
        current_date = self.analysis_date
        candidate_hot = []

        for row in latest_inv:
            supplier_id = row["supplier_id"]
            sku = row["sku"]
            name = row["name"] or ""
            category = row["category"] or "其他"
            current_stock = int(row["stock_qty"] or 0)

            summary["total_skus"] += 1
            summary["by_category"][category]["total"] += 1
            summary["by_supplier"][supplier_id]["total"] += 1

            threshold = self.config.get_threshold(category)
            safety_stock = threshold.safety_stock
            daily_consumption = threshold.daily_consumption
            lead_time_days = threshold.lead_time_days

            level = self._alert_level(current_stock, safety_stock,
                                       daily_consumption)

            expected_out = self._expected_out_of_stock_date(
                current_stock, daily_consumption, lead_time_days
            )
            suggested_qty = self._suggested_purchase_qty(
                current_stock, safety_stock, daily_consumption, lead_time_days
            )

            if current_stock < safety_stock:
                summary["below_safety"] += 1
                summary["by_category"][category]["below_safety"] += 1
                summary["by_supplier"][supplier_id]["below_safety"] += 1

                if level == "CRITICAL":
                    summary["critical"] += 1
                    summary["by_category"][category]["critical"] += 1
                    summary["by_supplier"][supplier_id]["critical"] += 1
                elif level == "HIGH":
                    summary["high"] += 1
                    summary["by_category"][category]["high"] += 1
                    summary["by_supplier"][supplier_id]["high"] += 1
                elif level == "MEDIUM":
                    summary["medium"] += 1
                    summary["by_category"][category]["medium"] += 1
                    summary["by_supplier"][supplier_id]["medium"] += 1
                else:
                    summary["low"] += 1
                    summary["by_category"][category]["low"] += 1
                    summary["by_supplier"][supplier_id]["low"] += 1

                summary["total_suggested_qty"] += suggested_qty

                alerts.append(StockAlert(
                    supplier_id=supplier_id,
                    sku=sku,
                    name=name,
                    category=category,
                    current_stock=current_stock,
                    safety_stock=safety_stock,
                    daily_consumption=daily_consumption,
                    lead_time_days=lead_time_days,
                    expected_out_date=expected_out or current_date,
                    suggested_purchase_qty=suggested_qty,
                    alert_date=current_date,
                    alert_level=level,
                ))

            if current_stock < safety_stock * 0.5 and level in ("CRITICAL", "HIGH"):
                candidate_hot.append({
                    "supplier_id": supplier_id,
                    "sku": sku,
                    "name": name,
                    "category": category,
                    "current_stock": current_stock,
                    "safety_stock": safety_stock,
                    "level": level,
                    "shortfall": max(0, safety_stock - current_stock),
                })

        if alerts:
            count = self.db.batch_insert_stock_alerts(alerts)
            summary["alerts_generated"] = count
            self.log.info(
                f"库存监控完成：{len(latest_inv)} SKU，"
                f"{summary['below_safety']} 低于安全库存，"
                f"CRITICAL/HIGH/MEDIUM/LOW = "
                f"{summary['critical']}/{summary['high']}/"
                f"{summary['medium']}/{summary['low']}，"
                f"入库预警 {count} 条，"
                f"建议采购总量 {summary['total_suggested_qty']}"
            )
        else:
            self.log.info("库存监控完成：无低于安全库存的SKU")

        candidate_hot.sort(key=lambda x: x["shortfall"], reverse=True)
        summary["hot_items"] = candidate_hot[:20]
        summary["by_category"] = dict(summary["by_category"])
        summary["by_supplier"] = dict(summary["by_supplier"])
        return summary

    def get_active_alerts(self, date: str = None,
                           category: str = None,
                           level: str = None) -> List[Dict[str, Any]]:
        rows = self.db.query_stock_alerts(alert_date=date, resolved=0,
                                           category=category)
        data = [dict(r) for r in rows]
        if level:
            data = [d for d in data if d.get("alert_level") == level]
        return data

    def get_summary_report(self, date: str = None) -> Dict[str, Any]:
        if date is None:
            date = self.analysis_date
        alerts = self.get_active_alerts(date=date)
        by_level = defaultdict(int)
        by_cat = defaultdict(lambda: {"count": 0, "suggested": 0})
        total_suggested = 0
        for a in alerts:
            by_level[a.get("alert_level", "UNKNOWN")] += 1
            cat = a.get("category", "其他")
            by_cat[cat]["count"] += 1
            sg = int(a.get("suggested_purchase_qty") or 0)
            by_cat[cat]["suggested"] += sg
            total_suggested += sg
        return {
            "date": date,
            "total_alerts": len(alerts),
            "by_level": dict(by_level),
            "by_category": {k: dict(v) for k, v in by_cat.items()},
            "total_suggested_purchase_qty": total_suggested,
        }

    def export_report(self, output_dir: str = None,
                       date: str = None) -> Optional[str]:
        if output_dir is None:
            output_dir = self.settings.export_dir
        if date is None:
            date = self.analysis_date
        os.makedirs(output_dir, exist_ok=True)

        rows = self.db.query_stock_alerts(alert_date=date, resolved=0)
        if not rows:
            self.log.info(f"{date} 无库存预警数据可导出")
            return None

        try:
            import pandas as pd
            data = [dict(r) for r in rows]
            df = pd.DataFrame(data)
            out_path = os.path.join(
                output_dir, f"stock_alert_report_{date}.csv"
            )
            df.to_csv(out_path, index=False, encoding="utf-8-sig")
            self.log.info(f"库存预警报表已导出: {out_path}")
            return out_path
        except Exception as e:
            self.log.error(f"导出库存报表失败: {str(e)}")
            return None
