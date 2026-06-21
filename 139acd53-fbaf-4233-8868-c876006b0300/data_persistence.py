import os
import sqlite3
import json
import threading
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
from dataclasses import dataclass, asdict


@dataclass
class InventoryRecord:
    supplier_id: str
    sku: str
    name: str
    category: str
    stock_qty: int
    unit: str
    price: float
    sync_date: str
    raw_data: Optional[str] = None


@dataclass
class PriceHistoryRecord:
    supplier_id: str
    sku: str
    price_date: str
    price: float
    stock_qty: int


@dataclass
class SyncLogRecord:
    task_id: str
    supplier_id: str
    supplier_name: str
    sync_type: str
    status: str
    start_time: str
    end_time: Optional[str]
    duration_seconds: float
    records_fetched: int
    records_inserted: int
    records_failed: int
    error_message: Optional[str]


@dataclass
class StockAlert:
    supplier_id: str
    sku: str
    name: str
    category: str
    current_stock: int
    safety_stock: int
    daily_consumption: int
    lead_time_days: int
    expected_out_date: str
    suggested_purchase_qty: int
    alert_date: str
    alert_level: str


@dataclass
class PriceAlert:
    supplier_id: str
    sku: str
    name: str
    category: str
    current_price: float
    previous_price: float
    daily_change_pct: float
    weekly_change_pct: float
    threshold_pct: float
    is_anomaly: int
    confirm_status: str
    alert_date: str
    history_prices: str


class DataPersistence:
    def __init__(self, db_path: str = "data/inventory.db"):
        self.db_path = db_path
        self._ensure_dir()
        self._lock = threading.RLock()
        self._init_tables()

    def _ensure_dir(self):
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(
            self.db_path,
            timeout=30,
            isolation_level=None,
        )
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=10000")
        conn.row_factory = sqlite3.Row
        try:
            with self._lock:
                yield conn
        finally:
            conn.close()

    def _init_tables(self):
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.executescript("""
                CREATE TABLE IF NOT EXISTS suppliers (
                    supplier_id TEXT PRIMARY KEY,
                    supplier_name TEXT NOT NULL,
                    supplier_type TEXT,
                    supplier_group TEXT,
                    categories TEXT,
                    sku_count INTEGER DEFAULT 0,
                    created_at TEXT DEFAULT (datetime('now','localtime')),
                    updated_at TEXT DEFAULT (datetime('now','localtime'))
                );

                CREATE TABLE IF NOT EXISTS inventory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    name TEXT,
                    category TEXT,
                    stock_qty INTEGER DEFAULT 0,
                    unit TEXT,
                    price REAL DEFAULT 0.0,
                    sync_date TEXT NOT NULL,
                    raw_data TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime')),
                    UNIQUE(supplier_id, sku, sync_date)
                );

                CREATE INDEX IF NOT EXISTS idx_inventory_sku
                    ON inventory(sku);
                CREATE INDEX IF NOT EXISTS idx_inventory_sync_date
                    ON inventory(sync_date);
                CREATE INDEX IF NOT EXISTS idx_inventory_supplier_sku
                    ON inventory(supplier_id, sku);

                CREATE TABLE IF NOT EXISTS price_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    price_date TEXT NOT NULL,
                    price REAL DEFAULT 0.0,
                    stock_qty INTEGER DEFAULT 0,
                    UNIQUE(supplier_id, sku, price_date)
                );

                CREATE INDEX IF NOT EXISTS idx_price_history_lookup
                    ON price_history(supplier_id, sku, price_date);

                CREATE TABLE IF NOT EXISTS sync_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT NOT NULL UNIQUE,
                    supplier_id TEXT NOT NULL,
                    supplier_name TEXT,
                    sync_type TEXT,
                    status TEXT,
                    start_time TEXT NOT NULL,
                    end_time TEXT,
                    duration_seconds REAL DEFAULT 0,
                    records_fetched INTEGER DEFAULT 0,
                    records_inserted INTEGER DEFAULT 0,
                    records_failed INTEGER DEFAULT 0,
                    error_message TEXT,
                    created_at TEXT DEFAULT (datetime('now','localtime'))
                );

                CREATE INDEX IF NOT EXISTS idx_sync_logs_date
                    ON sync_logs(start_time);
                CREATE INDEX IF NOT EXISTS idx_sync_logs_supplier
                    ON sync_logs(supplier_id);

                CREATE TABLE IF NOT EXISTS sync_event_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_type TEXT,
                    timestamp TEXT DEFAULT (datetime('now','localtime')),
                    payload TEXT
                );

                CREATE TABLE IF NOT EXISTS stock_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    name TEXT,
                    category TEXT,
                    current_stock INTEGER,
                    safety_stock INTEGER,
                    daily_consumption INTEGER,
                    lead_time_days INTEGER,
                    expected_out_date TEXT,
                    suggested_purchase_qty INTEGER,
                    alert_date TEXT NOT NULL,
                    alert_level TEXT,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT,
                    UNIQUE(supplier_id, sku, alert_date)
                );

                CREATE TABLE IF NOT EXISTS price_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    supplier_id TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    name TEXT,
                    category TEXT,
                    current_price REAL,
                    previous_price REAL,
                    daily_change_pct REAL,
                    weekly_change_pct REAL,
                    threshold_pct REAL,
                    is_anomaly INTEGER DEFAULT 0,
                    confirm_status TEXT DEFAULT 'PENDING',
                    alert_date TEXT NOT NULL,
                    history_prices TEXT,
                    UNIQUE(supplier_id, sku, alert_date)
                );

                CREATE INDEX IF NOT EXISTS idx_price_alerts_status
                    ON price_alerts(confirm_status);
            """)
            conn.commit()

    def upsert_supplier(self, supplier_id: str, supplier_name: str,
                        supplier_type: str, supplier_group: str,
                        categories: List[str], sku_count: int):
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO suppliers (supplier_id, supplier_name, supplier_type,
                    supplier_group, categories, sku_count)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(supplier_id) DO UPDATE SET
                    supplier_name=excluded.supplier_name,
                    supplier_type=excluded.supplier_type,
                    supplier_group=excluded.supplier_group,
                    categories=excluded.categories,
                    sku_count=excluded.sku_count,
                    updated_at=datetime('now','localtime')
            """, (supplier_id, supplier_name, supplier_type,
                  supplier_group, json.dumps(categories, ensure_ascii=False),
                  sku_count))
            conn.commit()

    def batch_insert_inventory(self, records: List[InventoryRecord]) -> Tuple[int, int]:
        inserted = 0
        failed = 0
        with self._get_conn() as conn:
            cur = conn.cursor()
            for rec in records:
                try:
                    cur.execute("""
                        INSERT INTO inventory (supplier_id, sku, name, category,
                            stock_qty, unit, price, sync_date, raw_data)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(supplier_id, sku, sync_date) DO UPDATE SET
                            name=excluded.name,
                            category=excluded.category,
                            stock_qty=excluded.stock_qty,
                            unit=excluded.unit,
                            price=excluded.price,
                            raw_data=excluded.raw_data
                    """, (rec.supplier_id, rec.sku, rec.name, rec.category,
                          rec.stock_qty, rec.unit, rec.price,
                          rec.sync_date, rec.raw_data))

                    cur.execute("""
                        INSERT OR IGNORE INTO price_history
                            (supplier_id, sku, price_date, price, stock_qty)
                        VALUES (?, ?, ?, ?, ?)
                    """, (rec.supplier_id, rec.sku, rec.sync_date,
                          rec.price, rec.stock_qty))
                    cur.execute("""
                        UPDATE price_history SET price=?, stock_qty=?
                        WHERE supplier_id=? AND sku=? AND price_date=?
                    """, (rec.price, rec.stock_qty, rec.supplier_id,
                          rec.sku, rec.sync_date))
                    inserted += 1
                except Exception:
                    failed += 1
            conn.commit()
        return inserted, failed

    def get_latest_inventory(self, supplier_id: str = None,
                             category: str = None) -> List[sqlite3.Row]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            sql = """
                SELECT i.* FROM inventory i
                INNER JOIN (
                    SELECT supplier_id, sku, MAX(sync_date) AS max_date
                    FROM inventory GROUP BY supplier_id, sku
                ) m ON i.supplier_id=m.supplier_id
                    AND i.sku=m.sku AND i.sync_date=m.max_date
                WHERE 1=1
            """
            params: List[Any] = []
            if supplier_id:
                sql += " AND i.supplier_id=?"
                params.append(supplier_id)
            if category:
                sql += " AND i.category=?"
                params.append(category)
            cur.execute(sql, params)
            return cur.fetchall()

    def get_price_history(self, supplier_id: str, sku: str,
                          days: int = 30) -> List[sqlite3.Row]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
            cur.execute("""
                SELECT * FROM price_history
                WHERE supplier_id=? AND sku=? AND price_date>=?
                ORDER BY price_date ASC
            """, (supplier_id, sku, start_date))
            return cur.fetchall()

    def get_previous_day_price(self, supplier_id: str, sku: str,
                               current_date: str) -> Optional[float]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT price FROM price_history
                WHERE supplier_id=? AND sku=? AND price_date < ?
                ORDER BY price_date DESC LIMIT 1
            """, (supplier_id, sku, current_date))
            row = cur.fetchone()
            return row["price"] if row else None

    def get_week_ago_price(self, supplier_id: str, sku: str,
                           current_date: str) -> Optional[float]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT price FROM price_history
                WHERE supplier_id=? AND sku=? AND date(price_date) <= date(?, '-7 days')
                ORDER BY price_date DESC LIMIT 1
            """, (supplier_id, sku, current_date))
            row = cur.fetchone()
            return row["price"] if row else None

    def insert_sync_log(self, log: SyncLogRecord):
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT OR REPLACE INTO sync_logs
                    (task_id, supplier_id, supplier_name, sync_type, status,
                     start_time, end_time, duration_seconds, records_fetched,
                     records_inserted, records_failed, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (log.task_id, log.supplier_id, log.supplier_name,
                  log.sync_type, log.status, log.start_time, log.end_time,
                  log.duration_seconds, log.records_fetched,
                  log.records_inserted, log.records_failed, log.error_message))
            conn.commit()

    def query_sync_logs(self, date_from: str = None, date_to: str = None,
                        supplier_id: str = None, status: str = None,
                        limit: int = 100) -> List[sqlite3.Row]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            sql = "SELECT * FROM sync_logs WHERE 1=1"
            params: List[Any] = []
            if date_from:
                sql += " AND date(start_time)>=?"
                params.append(date_from)
            if date_to:
                sql += " AND date(start_time)<=?"
                params.append(date_to)
            if supplier_id:
                sql += " AND supplier_id=?"
                params.append(supplier_id)
            if status:
                sql += " AND status=?"
                params.append(status)
            sql += " ORDER BY start_time DESC LIMIT ?"
            params.append(limit)
            cur.execute(sql, params)
            return cur.fetchall()

    def insert_sync_event(self, event_type: str, payload: Dict[str, Any]):
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                INSERT INTO sync_event_log (event_type, payload)
                VALUES (?, ?)
            """, (event_type, json.dumps(payload, ensure_ascii=False)))
            conn.commit()

    def batch_insert_stock_alerts(self, alerts: List[StockAlert]) -> int:
        count = 0
        with self._get_conn() as conn:
            cur = conn.cursor()
            for a in alerts:
                cur.execute("""
                    INSERT OR IGNORE INTO stock_alerts
                        (supplier_id, sku, name, category, current_stock,
                         safety_stock, daily_consumption, lead_time_days,
                         expected_out_date, suggested_purchase_qty,
                         alert_date, alert_level)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (a.supplier_id, a.sku, a.name, a.category,
                      a.current_stock, a.safety_stock, a.daily_consumption,
                      a.lead_time_days, a.expected_out_date,
                      a.suggested_purchase_qty, a.alert_date, a.alert_level))
                if cur.rowcount > 0:
                    count += 1
            conn.commit()
        return count

    def query_stock_alerts(self, alert_date: str = None,
                           resolved: int = 0,
                           category: str = None) -> List[sqlite3.Row]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            sql = "SELECT * FROM stock_alerts WHERE resolved=?"
            params: List[Any] = [resolved]
            if alert_date:
                sql += " AND alert_date=?"
                params.append(alert_date)
            if category:
                sql += " AND category=?"
                params.append(category)
            sql += " ORDER BY alert_level DESC, current_stock ASC"
            cur.execute(sql, params)
            return cur.fetchall()

    def batch_insert_price_alerts(self, alerts: List[PriceAlert]) -> int:
        count = 0
        with self._get_conn() as conn:
            cur = conn.cursor()
            for a in alerts:
                cur.execute("""
                    INSERT OR IGNORE INTO price_alerts
                        (supplier_id, sku, name, category, current_price,
                         previous_price, daily_change_pct, weekly_change_pct,
                         threshold_pct, is_anomaly, confirm_status, alert_date,
                         history_prices)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (a.supplier_id, a.sku, a.name, a.category,
                      a.current_price, a.previous_price, a.daily_change_pct,
                      a.weekly_change_pct, a.threshold_pct, a.is_anomaly,
                      a.confirm_status, a.alert_date, a.history_prices))
                if cur.rowcount > 0:
                    count += 1
            conn.commit()
        return count

    def query_price_alerts(self, alert_date: str = None,
                           confirm_status: str = "PENDING",
                           is_anomaly: int = None) -> List[sqlite3.Row]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            sql = "SELECT * FROM price_alerts WHERE confirm_status=?"
            params: List[Any] = [confirm_status]
            if alert_date:
                sql += " AND alert_date=?"
                params.append(alert_date)
            if is_anomaly is not None:
                sql += " AND is_anomaly=?"
                params.append(is_anomaly)
            sql += " ORDER BY ABS(daily_change_pct) DESC"
            cur.execute(sql, params)
            return cur.fetchall()

    def update_price_alert_status(self, supplier_id: str, sku: str,
                                   alert_date: str, status: str):
        with self._get_conn() as conn:
            cur = conn.cursor()
            cur.execute("""
                UPDATE price_alerts SET confirm_status=?
                WHERE supplier_id=? AND sku=? AND alert_date=?
            """, (status, supplier_id, sku, alert_date))
            conn.commit()

    def get_db_stats(self) -> Dict[str, int]:
        with self._get_conn() as conn:
            cur = conn.cursor()
            stats = {}
            for table in ["inventory", "price_history", "sync_logs",
                          "stock_alerts", "price_alerts", "suppliers"]:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                stats[table] = cur.fetchone()[0]
            return stats
