import os
import json
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from config_manager import ConfigManager
from log_manager import LogManager, LogLevel
from data_persistence import (
    DataPersistence, PriceAlert,
)


class PriceAnalyzer:
    def __init__(self, config: ConfigManager, log_manager: LogManager,
                 db: DataPersistence):
        self.config = config
        self.log = log_manager
        self.db = db
        self.settings = config.global_settings
        self.analysis_date = datetime.now().strftime("%Y-%m-%d")

    def _change_pct(self, new_val: float, old_val: float) -> float:
        if not old_val or old_val == 0:
            return 0.0
        return round((new_val - old_val) / old_val * 100.0, 4)

    def _z_score_anomaly(self, prices: List[float], current: float) -> bool:
        if len(prices) < 5:
            return False
        arr = np.array(prices, dtype=float)
        mean = float(np.mean(arr))
        std = float(np.std(arr))
        if std == 0:
            return False
        z = abs(current - mean) / std
        return z > 2.5

    def _mad_anomaly(self, prices: List[float], current: float) -> bool:
        if len(prices) < 7:
            return False
        arr = np.array(prices, dtype=float)
        median = float(np.median(arr))
        mad = float(np.median(np.abs(arr - median)))
        if mad == 0:
            return False
        modified_z = 0.6745 * abs(current - median) / mad
        return modified_z > 3.5

    def _trend_detection(self, dates_prices: List[Tuple[str, float]]) -> Dict[str, Any]:
        if len(dates_prices) < 10:
            return {"trend": "insufficient", "slope": 0.0, "volatility": 0.0}
        prices = [p for _, p in dates_prices]
        arr = np.array(prices, dtype=float)
        x = np.arange(len(arr))
        try:
            slope, intercept = np.polyfit(x, arr, 1)
        except Exception:
            slope = 0.0
        returns = np.diff(arr) / arr[:-1]
        volatility = float(np.std(returns)) if len(returns) > 0 else 0.0
        if slope > 0.001:
            trend = "up"
        elif slope < -0.001:
            trend = "down"
        else:
            trend = "stable"
        return {
            "trend": trend,
            "slope": round(float(slope), 6),
            "volatility": round(volatility, 6),
        }

    def analyze_all(self) -> Dict[str, Any]:
        summary = {
            "date": self.analysis_date,
            "total_skus": 0,
            "with_changes": 0,
            "over_threshold": 0,
            "anomalies": 0,
            "alerts_generated": 0,
            "by_category": defaultdict(lambda: {
                "total": 0, "over_threshold": 0, "anomalies": 0,
            }),
            "by_supplier": defaultdict(lambda: {
                "total": 0, "over_threshold": 0, "anomalies": 0,
            }),
        }

        threshold = self.settings.price_threshold
        latest_inv = self.db.get_latest_inventory()
        self.log.info(f"价格分析开始，扫描 {len(latest_inv)} 条最新库存记录")

        alerts: List[PriceAlert] = []
        current_date = self.analysis_date

        for row in latest_inv:
            supplier_id = row["supplier_id"]
            sku = row["sku"]
            name = row["name"] or ""
            category = row["category"] or "其他"
            current_price = float(row["price"] or 0.0)

            summary["total_skus"] += 1
            summary["by_category"][category]["total"] += 1
            summary["by_supplier"][supplier_id]["total"] += 1

            if current_price <= 0:
                continue

            prev_day_price = self.db.get_previous_day_price(
                supplier_id, sku, current_date
            )
            week_ago_price = self.db.get_week_ago_price(
                supplier_id, sku, current_date
            )

            daily_chg = self._change_pct(current_price, prev_day_price or 0)
            weekly_chg = self._change_pct(current_price, week_ago_price or 0)

            over_threshold = (
                abs(daily_chg) > threshold or abs(weekly_chg) > threshold
            )

            history_rows = self.db.get_price_history(supplier_id, sku, 30)
            history_prices = [float(r["price"]) for r in history_rows
                              if float(r["price"]) > 0]
            dates_prices = [(r["price_date"], float(r["price"]))
                            for r in history_rows if float(r["price"]) > 0]

            is_anomaly = 0
            if over_threshold and history_prices:
                if self._z_score_anomaly(history_prices, current_price):
                    is_anomaly = 1
                elif self._mad_anomaly(history_prices, current_price):
                    is_anomaly = 1
                trend_info = self._trend_detection(dates_prices)
                if is_anomaly == 0 and trend_info.get("volatility", 0) > 0.15 \
                        and abs(daily_chg) > threshold * 1.5:
                    is_anomaly = 1

            if daily_chg != 0 or weekly_chg != 0:
                summary["with_changes"] += 1

            if over_threshold:
                summary["over_threshold"] += 1
                summary["by_category"][category]["over_threshold"] += 1
                summary["by_supplier"][supplier_id]["over_threshold"] += 1
                if is_anomaly:
                    summary["anomalies"] += 1
                    summary["by_category"][category]["anomalies"] += 1
                    summary["by_supplier"][supplier_id]["anomalies"] += 1

                history_series = json.dumps(
                    dates_prices[-10:], ensure_ascii=False
                ) if dates_prices else "[]"

                alerts.append(PriceAlert(
                    supplier_id=supplier_id,
                    sku=sku,
                    name=name,
                    category=category,
                    current_price=round(current_price, 6),
                    previous_price=round(prev_day_price or 0.0, 6),
                    daily_change_pct=round(daily_chg, 4),
                    weekly_change_pct=round(weekly_chg, 4),
                    threshold_pct=round(threshold, 2),
                    is_anomaly=is_anomaly,
                    confirm_status="PENDING",
                    alert_date=current_date,
                    history_prices=history_series,
                ))

        if alerts:
            count = self.db.batch_insert_price_alerts(alerts)
            summary["alerts_generated"] = count
            self.log.info(
                f"价格分析完成：共 {len(latest_inv)} SKU，"
                f"{summary['with_changes']} 有变动，"
                f"{summary['over_threshold']} 超阈值，"
                f"{summary['anomalies']} 识别为异常，"
                f"入库预警 {count} 条"
            )
        else:
            self.log.info("价格分析完成：未产生新的价格波动预警")

        summary["by_category"] = dict(summary["by_category"])
        summary["by_supplier"] = dict(summary["by_supplier"])
        return summary

    def get_pending_alerts(self, date: str = None,
                            only_anomaly: bool = False) -> List[Dict[str, Any]]:
        rows = self.db.query_price_alerts(
            alert_date=date, confirm_status="PENDING",
            is_anomaly=1 if only_anomaly else None,
        )
        return [dict(r) for r in rows]

    def confirm_alert(self, supplier_id: str, sku: str,
                       alert_date: str, confirmed: bool = True):
        status = "CONFIRMED" if confirmed else "DISMISSED"
        self.db.update_price_alert_status(supplier_id, sku, alert_date, status)
        self.log.info(
            f"价格预警已标记: {supplier_id}/{sku}@{alert_date} -> {status}"
        )

    def export_report(self, output_dir: str = None,
                       date: str = None) -> Optional[str]:
        if output_dir is None:
            output_dir = self.settings.export_dir
        if date is None:
            date = self.analysis_date
        os.makedirs(output_dir, exist_ok=True)

        rows = self.db.query_price_alerts(alert_date=date,
                                           confirm_status="PENDING")
        if not rows:
            self.log.info(f"{date} 无价格波动预警数据可导出")
            return None

        try:
            import pandas as pd
            data = [dict(r) for r in rows]
            df = pd.DataFrame(data)
            out_path = os.path.join(
                output_dir, f"price_alert_report_{date}.csv"
            )
            df.to_csv(out_path, index=False, encoding="utf-8-sig")
            self.log.info(f"价格波动分析报表已导出: {out_path}")
            return out_path
        except Exception as e:
            self.log.error(f"导出价格报表失败: {str(e)}")
            return None
