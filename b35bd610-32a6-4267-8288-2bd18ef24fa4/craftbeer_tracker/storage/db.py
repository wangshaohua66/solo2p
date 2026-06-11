from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "craftbeer.db"
MAX_DB_SIZE_MB = 2048


class Database:
    def __init__(self, db_path: Path | str | None = None):
        if db_path is None:
            db_path = DEFAULT_DB_PATH
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.execute("PRAGMA busy_timeout=30000")
        self._create_tables()
        logger.info("Database connected at {path}", path=self.db_path)

    def close(self) -> None:
        if self._conn:
            self._conn.close()
            self._conn = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self.connect()
        assert self._conn is not None
        return self._conn

    def _create_tables(self) -> None:
        cur = self.conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS breweries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                name_raw TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(name)
            );

            CREATE TABLE IF NOT EXISTS beers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fingerprint TEXT NOT NULL UNIQUE,
                brewery_id INTEGER NOT NULL,
                beer_name TEXT NOT NULL,
                beer_name_raw TEXT,
                batch_name TEXT,
                style TEXT,
                abv REAL,
                ibu INTEGER,
                release_date TEXT,
                is_limited INTEGER NOT NULL DEFAULT 0,
                limited_tags TEXT DEFAULT '',
                description TEXT,
                image_url TEXT,
                scarcity_score INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (brewery_id) REFERENCES breweries(id)
            );

            CREATE TABLE IF NOT EXISTS beer_sources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                source_url TEXT,
                price REAL,
                currency TEXT DEFAULT 'USD',
                availability_raw TEXT DEFAULT '{}',
                screenshot_path TEXT,
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id),
                UNIQUE(beer_id, source)
            );

            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                price REAL,
                currency TEXT DEFAULT 'USD',
                recorded_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id)
            );

            CREATE TABLE IF NOT EXISTS availability (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                source TEXT NOT NULL,
                region TEXT,
                zipcode_pattern TEXT,
                is_available INTEGER NOT NULL DEFAULT 1,
                notes TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id),
                UNIQUE(beer_id, source, region)
            );

            CREATE TABLE IF NOT EXISTS kickstarter_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER,
                campaign_url TEXT NOT NULL,
                title TEXT,
                goal_amount REAL,
                pledged_amount REAL,
                backer_count INTEGER DEFAULT 0,
                days_left INTEGER,
                is_funded INTEGER DEFAULT 0,
                deadline TEXT,
                risk_score INTEGER DEFAULT 0,
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id),
                UNIQUE(campaign_url)
            );

            CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                brewery_id INTEGER,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                source_type TEXT NOT NULL,
                published_at TEXT,
                content_snippet TEXT,
                scraped_at TEXT NOT NULL,
                FOREIGN KEY (brewery_id) REFERENCES breweries(id),
                UNIQUE(url)
            );

            CREATE TABLE IF NOT EXISTS manual_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source TEXT NOT NULL,
                error_message TEXT,
                last_attempt TEXT,
                attempt_count INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                UNIQUE(source)
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                beer_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                message TEXT,
                sent_at TEXT NOT NULL,
                FOREIGN KEY (beer_id) REFERENCES beers(id)
            );

            CREATE INDEX IF NOT EXISTS idx_beers_fingerprint ON beers(fingerprint);
            CREATE INDEX IF NOT EXISTS idx_beers_brewery ON beers(brewery_id);
            CREATE INDEX IF NOT EXISTS idx_beers_scarcity ON beers(scarcity_score DESC);
            CREATE INDEX IF NOT EXISTS idx_beers_limited ON beers(is_limited);
            CREATE INDEX IF NOT EXISTS idx_beer_sources_beer ON beer_sources(beer_id);
            CREATE INDEX IF NOT EXISTS idx_price_history_beer ON price_history(beer_id);
            CREATE INDEX IF NOT EXISTS idx_availability_beer ON availability(beer_id);
            CREATE INDEX IF NOT EXISTS idx_kickstarter_beer ON kickstarter_campaigns(beer_id);
            CREATE INDEX IF NOT EXISTS idx_blog_brewery ON blog_posts(brewery_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_beer ON notifications(beer_id);
        """)
        self.conn.commit()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def upsert_brewery(self, name: str, name_raw: str | None = None) -> int:
        now = self._now()
        cur = self.conn.execute(
            """INSERT INTO breweries (name, name_raw, created_at, updated_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(name) DO UPDATE SET
                   name_raw=COALESCE(excluded.name_raw, breweries.name_raw),
                   updated_at=excluded.updated_at""",
            (name, name_raw, now, now),
        )
        self.conn.commit()
        row = self.conn.execute(
            "SELECT id FROM breweries WHERE name = ?", (name,)
        ).fetchone()
        return row["id"]

    def upsert_beer(self, data: dict[str, Any]) -> int:
        now = self._now()
        brewery_id = self.upsert_brewery(
            data["brewery_name"], data.get("brewery_name_raw")
        )
        fingerprint = data["fingerprint"]
        existing = self.conn.execute(
            "SELECT id FROM beers WHERE fingerprint = ?", (fingerprint,)
        ).fetchone()

        if existing:
            beer_id = existing["id"]
            updates = {
                "style": data.get("style"),
                "abv": data.get("abv"),
                "ibu": data.get("ibu"),
                "release_date": data.get("release_date"),
                "is_limited": int(data.get("is_limited", False)),
                "limited_tags": data.get("limited_tags", ""),
                "description": data.get("description"),
                "image_url": data.get("image_url"),
                "updated_at": now,
            }
            set_clause = ", ".join(f"{k}=COALESCE({k}, ?)" if k != "updated_at" else f"{k}=?" for k in updates)
            vals = list(updates.values()) + [beer_id]
            self.conn.execute(
                f"UPDATE beers SET {set_clause} WHERE id = ?", vals
            )
        else:
            cur = self.conn.execute(
                """INSERT INTO beers
                   (fingerprint, brewery_id, beer_name, beer_name_raw, batch_name,
                    style, abv, ibu, release_date, is_limited, limited_tags,
                    description, image_url, scarcity_score, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)""",
                (
                    fingerprint, brewery_id, data["beer_name"],
                    data.get("beer_name_raw"), data.get("batch_name"),
                    data.get("style"), data.get("abv"), data.get("ibu"),
                    data.get("release_date"), int(data.get("is_limited", False)),
                    data.get("limited_tags", ""), data.get("description"),
                    data.get("image_url"), now, now,
                ),
            )
            beer_id = cur.lastrowid

        self._upsert_beer_source(beer_id, data)
        if data.get("price") is not None:
            self._insert_price(beer_id, data["source"], data["price"], data.get("currency", "USD"))
        if data.get("availability_raw"):
            self._upsert_availability(beer_id, data)
        self.conn.commit()
        return beer_id

    def _upsert_beer_source(self, beer_id: int, data: dict[str, Any]) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO beer_sources
               (beer_id, source, source_url, price, currency, availability_raw,
                screenshot_path, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(beer_id, source) DO UPDATE SET
                   source_url=excluded.source_url,
                   price=COALESCE(excluded.price, beer_sources.price),
                   currency=COALESCE(excluded.currency, beer_sources.currency),
                   availability_raw=excluded.availability_raw,
                   screenshot_path=COALESCE(excluded.screenshot_path, beer_sources.screenshot_path),
                   scraped_at=excluded.scraped_at""",
            (
                beer_id, data["source"], data.get("source_url"),
                data.get("price"), data.get("currency", "USD"),
                json.dumps(data.get("availability_raw", {})),
                data.get("screenshot_path"), data.get("scraped_at", now),
            ),
        )

    def _insert_price(self, beer_id: int, source: str, price: float, currency: str) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO price_history (beer_id, source, price, currency, recorded_at)
               VALUES (?, ?, ?, ?, ?)""",
            (beer_id, source, price, currency, now),
        )

    def _upsert_availability(self, beer_id: int, data: dict[str, Any]) -> None:
        now = self._now()
        avail = data.get("availability_raw", {})
        region = avail.get("region", "unknown")
        zipcode_pattern = avail.get("zipcode_pattern", "")
        is_available = int(avail.get("is_available", True))
        notes = avail.get("notes", "")
        self.conn.execute(
            """INSERT INTO availability
               (beer_id, source, region, zipcode_pattern, is_available, notes, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(beer_id, source, region) DO UPDATE SET
                   zipcode_pattern=excluded.zipcode_pattern,
                   is_available=excluded.is_available,
                   notes=excluded.notes,
                   updated_at=excluded.updated_at""",
            (beer_id, data["source"], region, zipcode_pattern, is_available, notes, now),
        )

    def upsert_kickstarter(self, data: dict[str, Any]) -> int:
        now = self._now()
        cur = self.conn.execute(
            """INSERT INTO kickstarter_campaigns
               (beer_id, campaign_url, title, goal_amount, pledged_amount,
                backer_count, days_left, is_funded, deadline, risk_score, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(campaign_url) DO UPDATE SET
                   title=excluded.title,
                   goal_amount=excluded.goal_amount,
                   pledged_amount=excluded.pledged_amount,
                   backer_count=excluded.backer_count,
                   days_left=excluded.days_left,
                   is_funded=excluded.is_funded,
                   deadline=excluded.deadline,
                   risk_score=excluded.risk_score,
                   scraped_at=excluded.scraped_at""",
            (
                data.get("beer_id"), data["campaign_url"], data.get("title"),
                data.get("goal_amount"), data.get("pledged_amount"),
                data.get("backer_count", 0), data.get("days_left"),
                int(data.get("is_funded", False)), data.get("deadline"),
                data.get("risk_score", 0), now,
            ),
        )
        self.conn.commit()
        return cur.lastrowid

    def upsert_blog_post(self, data: dict[str, Any]) -> int:
        now = self._now()
        cur = self.conn.execute(
            """INSERT INTO blog_posts
               (brewery_id, title, url, source_type, published_at, content_snippet, scraped_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(url) DO UPDATE SET
                   title=excluded.title,
                   content_snippet=excluded.content_snippet,
                   scraped_at=excluded.scraped_at""",
            (
                data.get("brewery_id"), data["title"], data["url"],
                data["source_type"], data.get("published_at"),
                data.get("content_snippet"), now,
            ),
        )
        self.conn.commit()
        return cur.lastrowid

    def add_to_manual_queue(self, source: str, error_message: str) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO manual_queue (source, error_message, last_attempt, attempt_count, created_at)
               VALUES (?, ?, ?, 1, ?)
               ON CONFLICT(source) DO UPDATE SET
                   error_message=excluded.error_message,
                   last_attempt=excluded.last_attempt,
                   attempt_count=attempt_count + 1""",
            (source, error_message, now, now),
        )
        self.conn.commit()

    def add_notification(self, beer_id: int, notification_type: str, message: str) -> None:
        now = self._now()
        self.conn.execute(
            """INSERT INTO notifications (beer_id, notification_type, message, sent_at)
               VALUES (?, ?, ?, ?)""",
            (beer_id, notification_type, message, now),
        )
        self.conn.commit()

    def get_beers_today(self) -> list[dict]:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        rows = self.conn.execute(
            """SELECT b.*, br.name as brewery_name
               FROM beers b
               JOIN breweries br ON b.brewery_id = br.id
               WHERE DATE(b.created_at) = ?
               ORDER BY b.scarcity_score DESC""",
            (today,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_scarcity_top(self, limit: int = 20) -> list[dict]:
        rows = self.conn.execute(
            """SELECT b.*, br.name as brewery_name
               FROM beers b
               JOIN breweries br ON b.brewery_id = br.id
               WHERE b.is_limited = 1
               ORDER BY b.scarcity_score DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_beer_by_fingerprint(self, fingerprint: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM beers WHERE fingerprint = ?", (fingerprint,)
        ).fetchone()
        return dict(row) if row else None

    def get_price_history(self, beer_id: int, hours: int = 48) -> list[dict]:
        rows = self.conn.execute(
            """SELECT * FROM price_history
               WHERE beer_id = ? AND datetime(recorded_at) >= datetime('now', ?)
               ORDER BY recorded_at DESC""",
            (beer_id, f"-{hours} hours"),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_availability_for_zipcode(self, beer_id: int, zipcode: str) -> list[dict]:
        rows = self.conn.execute(
            """SELECT * FROM availability
               WHERE beer_id = ? AND is_available = 1""",
            (beer_id,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            pattern = d.get("zipcode_pattern", "")
            if not pattern or self._zipcode_matches(zipcode, pattern):
                results.append(d)
        return results

    def _zipcode_matches(self, zipcode: str, pattern: str) -> bool:
        if not pattern or pattern == "*":
            return True
        patterns = [p.strip() for p in pattern.split(",")]
        for p in patterns:
            if "*" in p:
                prefix = p.rstrip("*")
                if zipcode.startswith(prefix):
                    return True
            elif zipcode == p:
                return True
            elif "-" in p:
                try:
                    lo, hi = p.split("-")
                    if int(zipcode[:5]) >= int(lo) and int(zipcode[:5]) <= int(hi):
                        return True
                except ValueError:
                    continue
        return False

    def get_kickstarter_active(self) -> list[dict]:
        rows = self.conn.execute(
            """SELECT k.*, b.beer_name, br.name as brewery_name
               FROM kickstarter_campaigns k
               LEFT JOIN beers b ON k.beer_id = b.id
               LEFT JOIN breweries br ON b.brewery_id = br.id
               WHERE k.is_funded = 0
               ORDER BY k.risk_score DESC"""
        ).fetchall()
        return [dict(r) for r in rows]

    def get_manual_queue(self) -> list[dict]:
        rows = self.conn.execute("SELECT * FROM manual_queue").fetchall()
        return [dict(r) for r in rows]

    def get_recent_blogs(self, limit: int = 50) -> list[dict]:
        rows = self.conn.execute(
            """SELECT bp.*, br.name as brewery_name
               FROM blog_posts bp
               LEFT JOIN breweries br ON bp.brewery_id = br.id
               ORDER BY bp.scraped_at DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_beers_for_price_recheck(self, hours: int = 48) -> list[dict]:
        rows = self.conn.execute(
            """SELECT DISTINCT b.*, bs.source, bs.source_url, bs.price
               FROM beers b
               JOIN beer_sources bs ON b.id = bs.beer_id
               WHERE bs.price IS NOT NULL
               AND datetime(bs.scraped_at) <= datetime('now', ?)
               ORDER BY bs.scraped_at ASC""",
            (f"-{hours} hours",),
        ).fetchall()
        return [dict(r) for r in rows]

    def update_scarcity_score(self, beer_id: int, score: int) -> None:
        now = self._now()
        self.conn.execute(
            "UPDATE beers SET scarcity_score = ?, updated_at = ? WHERE id = ?",
            (min(max(score, 0), 100), now, beer_id),
        )
        self.conn.commit()

    def check_db_size(self) -> float:
        if not self.db_path.exists():
            return 0.0
        return self.db_path.stat().st_size / (1024 * 1024)

    def get_scrape_queue_status(self) -> dict[str, Any]:
        manual = self.get_manual_queue()
        return {
            "manual_queue_count": len(manual),
            "manual_queue_sources": [m["source"] for m in manual],
            "db_size_mb": round(self.check_db_size(), 2),
        }
