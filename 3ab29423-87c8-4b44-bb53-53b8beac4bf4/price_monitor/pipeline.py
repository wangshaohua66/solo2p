import os
import sqlite3
import json
import time
import datetime
from typing import List, Dict, Optional, Any, Tuple

import redis
from fuzzywuzzy import fuzz

from .utils import (
    load_config,
    logger,
    today_str,
    yesterday_str,
    date_days_ago,
    gen_fingerprint,
    gen_unique_id,
    safe_float,
    calc_change_pct,
    http_request,
    Color,
    color_text,
    fmt_pct,
    pct_color,
)


class CategoryMapper:
    def __init__(self):
        self.config = load_config()
        self._build_mapping()

    def reload(self):
        self.config = load_config(reload=True)
        self._build_mapping()

    def _build_mapping(self):
        self.category_map = {}
        self.alias_index = {}
        self.category_group = {}

        for group_key, group_data in self.config.get("categories", {}).items():
            self.category_group[group_key] = group_data.get("display_name", group_key)
            for item in group_data.get("items", []):
                cat_id = item["id"]
                cat_name = item["name"]
                self.category_map[cat_id] = {
                    "id": cat_id,
                    "name": cat_name,
                    "group": group_key,
                    "aliases": item.get("aliases", []),
                }
                self.alias_index[cat_name] = cat_id
                for alias in item.get("aliases", []):
                    self.alias_index[alias] = cat_id

    def map_category(self, raw_name: str) -> Tuple[Optional[str], str, Optional[str]]:
        if not raw_name:
            return None, raw_name, None

        raw_name_stripped = raw_name.strip()
        if raw_name_stripped in self.alias_index:
            cat_id = self.alias_index[raw_name_stripped]
            info = self.category_map[cat_id]
            return cat_id, info["name"], info["group"]

        threshold = self.config["pipeline"]["fuzzy_match_threshold"]
        best_score = 0
        best_cat_id = None
        best_cat_name = raw_name_stripped
        best_group = None

        for cat_id, info in self.category_map.items():
            candidates = [info["name"]] + info["aliases"]
            for cand in candidates:
                score = max(
                    fuzz.ratio(raw_name_stripped, cand),
                    fuzz.partial_ratio(raw_name_stripped, cand),
                    fuzz.token_sort_ratio(raw_name_stripped, cand),
                )
                if score > best_score:
                    best_score = score
                    best_cat_id = cat_id
                    best_cat_name = info["name"]
                    best_group = info["group"]

        if best_score >= threshold and best_cat_id:
            return best_cat_id, best_cat_name, best_group
        return None, raw_name_stripped, None

    def get_category_info(self, cat_id: str) -> Optional[Dict]:
        return self.category_map.get(cat_id)

    def get_all_category_ids(self) -> List[str]:
        return list(self.category_map.keys())

    def get_group_name(self, group_key: str) -> str:
        return self.category_group.get(group_key, group_key)


class DedupManager:
    def __init__(self):
        self.config = load_config()
        rc = self.config["redis"]
        try:
            self.redis = redis.Redis(
                host=rc["host"],
                port=rc["port"],
                db=rc["db"],
                password=rc.get("password"),
                decode_responses=True,
            )
            self.redis.ping()
            self.enabled = True
        except redis.RedisError as e:
            logger.warning(f"Redis连接失败，去重功能降级为内存: {e}")
            self.enabled = False
            self._mem_set = set()

    def _dedup_key(self, date_str=None):
        if date_str is None:
            date_str = today_str()
        return f"{self.config['redis']['dedup_set_prefix']}:{date_str}"

    def is_duplicate(self, fingerprint: str, date_str=None) -> bool:
        if self.enabled:
            try:
                return self.redis.sismember(self._dedup_key(date_str), fingerprint)
            except redis.RedisError as e:
                logger.error(f"Redis去重查询失败: {e}")
                return fingerprint in self._mem_set
        else:
            return fingerprint in self._mem_set

    def mark_processed(self, fingerprint: str, date_str=None) -> bool:
        if self.enabled:
            try:
                key = self._dedup_key(date_str)
                res = self.redis.sadd(key, fingerprint)
                self.redis.expire(key, self.config["redis"]["fingerprint_ttl_seconds"])
                return res > 0
            except redis.RedisError as e:
                logger.error(f"Redis去重写入失败: {e}")
                self._mem_set.add(fingerprint)
                return True
        else:
            self._mem_set.add(fingerprint)
            return True

    def clear_day(self, date_str=None):
        if self.enabled:
            try:
                self.redis.delete(self._dedup_key(date_str))
            except redis.RedisError as e:
                logger.error(f"Redis清失败: {e}")


class CircuitBreaker:
    def __init__(self):
        self.config = load_config()
        ac = self.config["alert"]
        self.threshold = ac["circuit_breaker_threshold"]
        self.open_hours = ac["circuit_breaker_hours"]
        rc = self.config["redis"]
        try:
            self.redis = redis.Redis(
                host=rc["host"],
                port=rc["port"],
                db=rc["db"],
                password=rc.get("password"),
                decode_responses=True,
            )
            self.redis.ping()
            self.enabled = True
        except redis.RedisError as e:
            logger.warning(f"Redis连接失败，熔断降级为内存: {e}")
            self.enabled = False
            self._fail_count = {}
            self._open = {}

    def _fail_key(self, market_id: str) -> str:
        return f"{self.config['redis']['circuit_key_prefix']}:fail:{market_id}"

    def _open_key(self, market_id: str) -> str:
        return f"{self.config['redis']['circuit_key_prefix']}:open:{market_id}"

    def is_open(self, market_id: str) -> bool:
        if self.enabled:
            try:
                return self.redis.exists(self._open_key(market_id)) > 0
            except redis.RedisError as e:
                logger.error(f"Redis熔断查询失败: {e}")
                return market_id in self._open and self._open[market_id] > time.time()
        else:
            return market_id in self._open and self._open[market_id] > time.time()

    def get_open_until(self, market_id: str) -> Optional[float]:
        if self.enabled:
            try:
                ttl = self.redis.ttl(self._open_key(market_id))
                if ttl > 0:
                    return time.time() + ttl
            except redis.RedisError as e:
                logger.error(f"Redis熔断时间查询失败: {e}")
        if market_id in self._open and self._open[market_id] > time.time():
            return self._open[market_id]
        return None

    def get_fail_count(self, market_id: str) -> int:
        if self.enabled:
            try:
                v = self.redis.get(self._fail_key(market_id))
                return int(v) if v else 0
            except redis.RedisError as e:
                logger.error(f"Redis失败计数查询失败: {e}")
        return self._fail_count.get(market_id, 0)

    def record_failure(self, market_id: str) -> bool:
        new_count = self.get_fail_count(market_id) + 1
        if self.enabled:
            try:
                self.redis.setex(
                    self._fail_key(market_id),
                    self.open_hours * 3600,
                    str(new_count),
                )
            except redis.RedisError as e:
                logger.error(f"Redis失败计数写入失败: {e}")
                self._fail_count[market_id] = new_count
        else:
            self._fail_count[market_id] = new_count

        if new_count >= self.threshold and not self.is_open(market_id):
            self._open_circuit(market_id)
            return True
        return False

    def record_success(self, market_id: str):
        if self.enabled:
            try:
                self.redis.delete(self._fail_key(market_id))
            except redis.RedisError as e:
                logger.error(f"Redis失败计数清除失败: {e}")
        if market_id in self._fail_count:
            del self._fail_count[market_id]

    def _open_circuit(self, market_id: str):
        logger.warning(color_text(f"[熔断] 市场 {market_id} 连续失败{self.threshold}次，熔断{self.open_hours}小时", Color.BG_YELLOW))
        if self.enabled:
            try:
                self.redis.setex(
                    self._open_key(market_id),
                    self.open_hours * 3600,
                    str(int(time.time())),
                )
            except redis.RedisError as e:
                logger.error(f"Redis熔断写入失败: {e}")
                self._open[market_id] = time.time() + self.open_hours * 3600
        else:
            self._open[market_id] = time.time() + self.open_hours * 3600

    def list_open(self) -> List[Dict[str, Any]]:
        result = []
        from .utils import load_config as _lc
        cfg = _lc()
        all_markets = []
        for _t, lst in cfg.get("markets", {}).items():
            all_markets.extend(lst)
        market_names = {m["id"]: m["name"] for m in all_markets}

        for mid in market_names:
            if self.is_open(mid):
                until = self.get_open_until(mid)
                result.append({
                    "market_id": mid,
                    "market_name": market_names[mid],
                    "fail_count": self.get_fail_count(mid),
                    "open_until": datetime.datetime.fromtimestamp(until).strftime("%Y-%m-%d %H:%M:%S") if until else "unknown",
                    "remaining_hours": round((until - time.time()) / 3600, 1) if until else 0,
                })
        return result


class Database:
    def __init__(self):
        self.config = load_config()
        self.db_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            self.config["system"]["data_dir"],
            "price_monitor.db",
        )
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_tables()

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=-20000")
        return conn

    def _init_tables(self):
        with self._conn() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS price_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    record_id TEXT UNIQUE,
                    market_id TEXT NOT NULL,
                    market_name TEXT,
                    category_id TEXT,
                    category_name TEXT NOT NULL,
                    category_group TEXT,
                    max_price REAL,
                    min_price REAL,
                    avg_price REAL,
                    unit TEXT,
                    trade_date TEXT NOT NULL,
                    change_pct REAL DEFAULT 0,
                    prev_avg_price REAL,
                    raw_data TEXT,
                    status TEXT DEFAULT 'new',
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                );

                CREATE INDEX IF NOT EXISTS idx_price_date ON price_records(trade_date);
                CREATE INDEX IF NOT EXISTS idx_price_market ON price_records(market_id);
                CREATE INDEX IF NOT EXISTS idx_price_category ON price_records(category_id);
                CREATE INDEX IF NOT EXISTS idx_price_mc_date ON price_records(market_id, category_id, trade_date);

                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    market_id TEXT NOT NULL,
                    source_url TEXT,
                    raw_value TEXT,
                    cleaned_value TEXT,
                    status_code INTEGER DEFAULT 200,
                    error_msg TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                );

                CREATE INDEX IF NOT EXISTS idx_audit_market ON audit_logs(market_id);
                CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    alert_id TEXT UNIQUE,
                    market_id TEXT NOT NULL,
                    market_name TEXT,
                    category_id TEXT,
                    category_name TEXT,
                    alert_type TEXT,
                    alert_level TEXT,
                    current_price REAL,
                    change_pct REAL,
                    trend_7d TEXT,
                    message TEXT,
                    pushed INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                );

                CREATE INDEX IF NOT EXISTS idx_alert_date ON alerts(created_at);
                CREATE INDEX IF NOT EXISTS idx_alert_pushed ON alerts(pushed);

                CREATE TABLE IF NOT EXISTS crawl_progress (
                    task_date TEXT PRIMARY KEY,
                    completed_markets TEXT DEFAULT '[]',
                    failed_markets TEXT DEFAULT '[]',
                    in_progress TEXT DEFAULT NULL,
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                );
                """
            )
            conn.commit()

    def insert_price(self, record: Dict) -> bool:
        try:
            with self._conn() as conn:
                conn.execute(
                    """INSERT OR REPLACE INTO price_records
                    (record_id, market_id, market_name, category_id, category_name,
                     category_group, max_price, min_price, avg_price, unit,
                     trade_date, change_pct, prev_avg_price, raw_data, status)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        record["record_id"],
                        record.get("market_id", ""),
                        record.get("market_name", ""),
                        record.get("category_id"),
                        record.get("category_name", ""),
                        record.get("category_group"),
                        record.get("max_price"),
                        record.get("min_price"),
                        record.get("avg_price"),
                        record.get("unit", ""),
                        record.get("trade_date", today_str()),
                        record.get("change_pct", 0),
                        record.get("prev_avg_price"),
                        json.dumps(record.get("raw_data", {}), ensure_ascii=False),
                        record.get("status", "new"),
                    ),
                )
                conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"价格数据插入失败: {e}")
            return False

    def batch_insert_price(self, records: List[Dict]) -> int:
        if not records:
            return 0
        success = 0
        for rec in records:
            if self.insert_price(rec):
                success += 1
        return success

    def insert_audit(self, audit: Dict):
        try:
            with self._conn() as conn:
                conn.execute(
                    """INSERT INTO audit_logs
                    (market_id, source_url, raw_value, cleaned_value, status_code, error_msg)
                    VALUES (?,?,?,?,?,?)""",
                    (
                        audit.get("market_id", ""),
                        audit.get("source_url", ""),
                        audit.get("raw_value", ""),
                        json.dumps(audit.get("cleaned_value", {}), ensure_ascii=False),
                        audit.get("status_code", 200),
                        audit.get("error_msg", ""),
                    ),
                )
                conn.commit()
        except sqlite3.Error as e:
            logger.error(f"审计日志插入失败: {e}")

    def get_prev_avg_price(self, market_id: str, category_id: str, trade_date: str) -> Optional[float]:
        if not category_id:
            return None
        try:
            with self._conn() as conn:
                row = conn.execute(
                    """SELECT avg_price FROM price_records
                    WHERE market_id=? AND category_id=? AND trade_date < ?
                    ORDER BY trade_date DESC LIMIT 1""",
                    (market_id, category_id, trade_date),
                ).fetchone()
                return row["avg_price"] if row else None
        except sqlite3.Error as e:
            logger.error(f"查询前日价格失败: {e}")
            return None

    def get_recent_avg_prices(self, market_id: str, category_id: str, days: int = 7) -> List[Dict]:
        if not category_id:
            return []
        start_date = date_days_ago(days - 1)
        try:
            with self._conn() as conn:
                rows = conn.execute(
                    """SELECT trade_date, avg_price, max_price, min_price, change_pct
                    FROM price_records
                    WHERE market_id=? AND category_id=? AND trade_date >= ?
                    ORDER BY trade_date ASC""",
                    (market_id, category_id, start_date),
                ).fetchall()
                return [dict(r) for r in rows]
        except sqlite3.Error as e:
            logger.error(f"查询近{days}日价格失败: {e}")
            return []

    def get_consecutive_trend(self, market_id: str, category_id: str, days: int = 3) -> Tuple[int, float]:
        """返回连续N日的同向波动天数和累计涨跌幅"""
        recent = self.get_recent_avg_prices(market_id, category_id, days + 1)
        if len(recent) < 2:
            return 0, 0.0
        prices = [r["avg_price"] for r in recent if r["avg_price"] is not None]
        if len(prices) < 2:
            return 0, 0.0
        direction = 0
        count = 0
        total_pct = 0.0
        for i in range(1, len(prices)):
            prev, cur = prices[i - 1], prices[i]
            if prev == 0:
                break
            pct = (cur - prev) / prev * 100
            cur_dir = 1 if pct > 0 else (-1 if pct < 0 else 0)
            if cur_dir == 0:
                break
            if direction == 0:
                direction = cur_dir
                count = 1
                total_pct = pct
            elif cur_dir == direction:
                count += 1
                total_pct += pct
            else:
                break
        return count, round(total_pct, 2)

    def insert_alert(self, alert: Dict) -> bool:
        try:
            with self._conn() as conn:
                conn.execute(
                    """INSERT OR IGNORE INTO alerts
                    (alert_id, market_id, market_name, category_id, category_name,
                     alert_type, alert_level, current_price, change_pct, trend_7d, message)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        alert["alert_id"],
                        alert.get("market_id", ""),
                        alert.get("market_name", ""),
                        alert.get("category_id"),
                        alert.get("category_name", ""),
                        alert.get("alert_type", ""),
                        alert.get("alert_level", "warning"),
                        alert.get("current_price"),
                        alert.get("change_pct", 0),
                        alert.get("trend_7d", ""),
                        alert.get("message", ""),
                    ),
                )
                conn.commit()
            return True
        except sqlite3.Error as e:
            logger.error(f"预警记录插入失败: {e}")
            return False

    def mark_alert_pushed(self, alert_id: str):
        try:
            with self._conn() as conn:
                conn.execute("UPDATE alerts SET pushed=1 WHERE alert_id=?", (alert_id,))
                conn.commit()
        except sqlite3.Error as e:
            logger.error(f"预警推送标记失败: {e}")

    def get_unpushed_alerts(self) -> List[Dict]:
        try:
            with self._conn() as conn:
                rows = conn.execute(
                    "SELECT * FROM alerts WHERE pushed=0 ORDER BY created_at DESC"
                ).fetchall()
                return [dict(r) for r in rows]
        except sqlite3.Error as e:
            logger.error(f"查询未推送预警失败: {e}")
            return []

    def query_daily_report(self, trade_date: str = None, category_group: str = None) -> List[Dict]:
        if trade_date is None:
            trade_date = today_str()
        sql = """SELECT * FROM price_records WHERE trade_date=?"""
        params = [trade_date]
        if category_group:
            sql += " AND category_group=?"
            params.append(category_group)
        sql += " ORDER BY category_group, category_name, market_name"
        try:
            with self._conn() as conn:
                rows = conn.execute(sql, params).fetchall()
                return [dict(r) for r in rows]
        except sqlite3.Error as e:
            logger.error(f"查询日报失败: {e}")
            return []

    def query_history(self, category_id: str = None, category_name: str = None,
                      market_id: str = None, days: int = 30) -> List[Dict]:
        start_date = date_days_ago(days - 1)
        sql = """SELECT * FROM price_records WHERE trade_date >= ?"""
        params = [start_date]
        if category_id:
            sql += " AND category_id=?"
            params.append(category_id)
        if category_name:
            sql += " AND category_name=?"
            params.append(category_name)
        if market_id:
            sql += " AND market_id=?"
            params.append(market_id)
        sql += " ORDER BY trade_date ASC, market_name, category_name"
        try:
            with self._conn() as conn:
                rows = conn.execute(sql, params).fetchall()
                return [dict(r) for r in rows]
        except sqlite3.Error as e:
            logger.error(f"查询历史价格失败: {e}")
            return []

    def save_progress(self, task_date: str, completed: List[str], failed: List[str], in_progress: str = None):
        try:
            with self._conn() as conn:
                conn.execute(
                    """INSERT OR REPLACE INTO crawl_progress
                    (task_date, completed_markets, failed_markets, in_progress)
                    VALUES (?,?,?,?)""",
                    (
                        task_date,
                        json.dumps(completed, ensure_ascii=False),
                        json.dumps(failed, ensure_ascii=False),
                        in_progress,
                    ),
                )
                conn.commit()
        except sqlite3.Error as e:
            logger.error(f"进度保存失败: {e}")

    def load_progress(self, task_date: str) -> Dict:
        try:
            with self._conn() as conn:
                row = conn.execute(
                    "SELECT * FROM crawl_progress WHERE task_date=?", (task_date,)
                ).fetchone()
                if row:
                    return {
                        "completed": json.loads(row["completed_markets"] or "[]"),
                        "failed": json.loads(row["failed_markets"] or "[]"),
                        "in_progress": row["in_progress"],
                    }
        except sqlite3.Error as e:
            logger.error(f"进度加载失败: {e}")
        return {"completed": [], "failed": [], "in_progress": None}


class AlertNotifier:
    def __init__(self):
        self.config = load_config()

    def format_markdown(self, alert: Dict) -> str:
        lines = []
        level_map = {
            "critical": color_text("【严重预警】", Color.BG_RED),
            "high": color_text("【高危预警】", Color.RED),
            "warning": color_text("【一般预警】", Color.YELLOW),
        }
        lines.append(f"{level_map.get(alert.get('alert_level', 'warning'), '【预警】')}农产品价格异常波动")
        lines.append(f"> **市场**: {alert.get('market_name', '-')}")
        lines.append(f"> **品种**: {alert.get('category_name', '-')}")
        lines.append(f"> **当前价**: {alert.get('current_price', '-')} 元/公斤")
        lines.append(f"> **涨跌幅**: {fmt_pct(alert.get('change_pct', 0))}")
        if alert.get("trend_7d"):
            lines.append(f"> **近7日趋势**: {alert['trend_7d']}")
        lines.append(f"> **详情**: {alert.get('message', '')}")
        lines.append(f"> _时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_")
        return "\n".join(lines)

    def push_wechat(self, alert: Dict) -> bool:
        if not self.config["pipeline"]["alert_push_enabled"]:
            return False
        webhook = self.config["alert"]["wechat_webhook_url"]
        if not webhook or "YOUR_KEY_HERE" in webhook:
            return False
        try:
            msg = self.format_markdown(alert)
            payload = {
                "msgtype": "markdown",
                "markdown": {"content": msg},
            }
            resp = http_request(
                webhook,
                method="POST",
                json=payload,
            )
            data = resp.json()
            if data.get("errcode") == 0:
                return True
            logger.error(f"企业微信推送返回错误: {data}")
        except Exception as e:
            logger.error(f"企业微信推送失败: {e}")
        return False

    def push_all_pending(self, db: Database):
        alerts = db.get_unpushed_alerts()
        pushed = 0
        for alert in alerts:
            if self.push_wechat(alert):
                db.mark_alert_pushed(alert["alert_id"])
                pushed += 1
        if pushed:
            logger.info(color_text(f"已推送{pushed}条预警", Color.BG_GREEN))
        return pushed


class AlertDetector:
    def __init__(self, db: Database, mapper: CategoryMapper):
        self.config = load_config()
        self.db = db
        self.mapper = mapper
        self.ac = self.config["alert"]

    def detect(self, record: Dict) -> List[Dict]:
        alerts = []
        cat_id = record.get("category_id")
        if not cat_id:
            return alerts

        market_id = record["market_id"]
        change_pct = record.get("change_pct", 0)
        current_price = record.get("avg_price", 0)

        single_threshold = self.ac["single_day_change_pct"]
        if abs(change_pct) >= single_threshold:
            trend_7d = self._format_trend(market_id, cat_id)
            alerts.append({
                "alert_id": gen_unique_id("sda", market_id, cat_id, record["trade_date"]),
                "market_id": market_id,
                "market_name": record.get("market_name", ""),
                "category_id": cat_id,
                "category_name": record.get("category_name", ""),
                "alert_type": "single_day_large_change",
                "alert_level": "critical" if abs(change_pct) >= single_threshold * 2 else "high",
                "current_price": current_price,
                "change_pct": change_pct,
                "trend_7d": trend_7d,
                "message": f"单日涨跌幅{fmt_pct(change_pct)}超过阈值{single_threshold}%",
            })

        consec_days = self.ac["consecutive_days"]
        consec_pct = self.ac["consecutive_day_change_pct"]
        actual_days, total_change = self.db.get_consecutive_trend(market_id, cat_id, consec_days)
        if actual_days >= consec_days and abs(total_change) >= consec_pct:
            trend_7d = self._format_trend(market_id, cat_id)
            direction = "上涨" if total_change > 0 else "下跌"
            alerts.append({
                "alert_id": gen_unique_id("cda", market_id, cat_id, record["trade_date"]),
                "market_id": market_id,
                "market_name": record.get("market_name", ""),
                "category_id": cat_id,
                "category_name": record.get("category_name", ""),
                "alert_type": "consecutive_change",
                "alert_level": "warning",
                "current_price": current_price,
                "change_pct": total_change,
                "trend_7d": trend_7d,
                "message": f"连续{actual_days}日{direction}，累计{fmt_pct(total_change)}",
            })

        return alerts

    def _format_trend(self, market_id: str, cat_id: str) -> str:
        recent = self.db.get_recent_avg_prices(market_id, cat_id, 7)
        if not recent:
            return ""
        parts = []
        for r in recent:
            price = r["avg_price"] or 0
            parts.append(f"{r['trade_date'][5:]}:{price:.2f}")
        return " → ".join(parts)


class DataPipeline:
    def __init__(self):
        self.mapper = CategoryMapper()
        self.db = Database()
        self.dedup = DedupManager()
        self.circuit = CircuitBreaker()
        self.detector = AlertDetector(self.db, self.mapper)
        self.notifier = AlertNotifier()

    def reload_config(self):
        self.config = load_config(reload=True)
        self.mapper.reload()

    def process_records(self, market_info: Dict, raw_records: List[Dict], source_url: str = "") -> Dict:
        market_id = market_info["id"]
        market_name = market_info.get("name", market_id)
        unit = market_info.get("unit", "元/公斤")
        trade_date = today_str()

        result = {
            "total": len(raw_records),
            "success": 0,
            "duplicate": 0,
            "unmapped": 0,
            "alerts": 0,
            "errors": 0,
            "records": [],
        }

        for raw in raw_records:
            try:
                category_name_raw = str(raw.get("category_name", "")).strip()
                max_price = safe_float(raw.get("max_price"))
                min_price = safe_float(raw.get("min_price"))
                avg_price = safe_float(raw.get("avg_price"))
                if not category_name_raw or avg_price <= 0:
                    result["errors"] += 1
                    self.db.insert_audit({
                        "market_id": market_id,
                        "source_url": source_url,
                        "raw_value": str(raw),
                        "cleaned_value": {},
                        "status_code": 400,
                        "error_msg": "品类名或价格无效",
                    })
                    continue

                cat_id, cat_name, cat_group = self.mapper.map_category(category_name_raw)
                fp = gen_fingerprint(market_id, cat_id or category_name_raw, trade_date)
                if self.dedup.is_duplicate(fp, trade_date):
                    result["duplicate"] += 1
                    continue

                prev_avg = None
                if cat_id:
                    prev_avg = self.db.get_prev_avg_price(market_id, cat_id, trade_date)
                change_pct = calc_change_pct(avg_price, prev_avg) if prev_avg else 0.0

                record = {
                    "record_id": gen_unique_id(market_id, cat_id or category_name_raw, trade_date),
                    "market_id": market_id,
                    "market_name": market_name,
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "category_group": cat_group,
                    "max_price": round(max_price, 2) if max_price else None,
                    "min_price": round(min_price, 2) if min_price else None,
                    "avg_price": round(avg_price, 2) if avg_price else None,
                    "unit": unit,
                    "trade_date": trade_date,
                    "change_pct": change_pct,
                    "prev_avg_price": round(prev_avg, 2) if prev_avg else None,
                    "raw_data": raw,
                    "status": "mapped" if cat_id else "pending_review",
                }

                if self.db.insert_price(record):
                    self.dedup.mark_processed(fp, trade_date)
                    result["success"] += 1
                    result["records"].append(record)
                    if not cat_id:
                        result["unmapped"] += 1

                    if cat_id:
                        alerts = self.detector.detect(record)
                        for alert in alerts:
                            if self.db.insert_alert(alert):
                                result["alerts"] += 1
                                self.notifier.push_wechat(alert)
                                self.db.mark_alert_pushed(alert["alert_id"])

                    self.db.insert_audit({
                        "market_id": market_id,
                        "source_url": source_url,
                        "raw_value": json.dumps(raw, ensure_ascii=False),
                        "cleaned_value": {k: record[k] for k in ["category_name", "max_price", "min_price", "avg_price", "change_pct"]},
                        "status_code": 200,
                        "error_msg": "",
                    })
                else:
                    result["errors"] += 1
            except Exception as e:
                result["errors"] += 1
                logger.error(f"单条记录处理异常: {e}, raw={raw}")

        return result

    def flush_pending_alerts(self):
        return self.notifier.push_all_pending(self.db)
