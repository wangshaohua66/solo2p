from datetime import datetime, date
from typing import List, Optional, Dict, Any, Tuple
from collections import defaultdict
from storage.sqlite_db import Database, get_db
from core.ink_model import JournalEntry, JournalEntryCreate, Ink
from utils.logger import get_logger

logger = get_logger()


class JournalManager:
    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()

    def add_entry(self, entry: JournalEntryCreate) -> JournalEntry:
        entry_id = self.db.execute(
            """
            INSERT INTO journal (date, pen, nib, ink_id, paper, humidity, rating, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry.date.isoformat(),
                entry.pen,
                entry.nib,
                entry.ink_id,
                entry.paper,
                entry.humidity,
                entry.rating,
                entry.notes,
            ),
        )
        logger.info(f"Added journal entry: {entry.pen} + {entry.paper}")
        return self.get_entry(entry_id)

    def get_entry(self, entry_id: int) -> JournalEntry:
        row = self.db.query_one("SELECT * FROM journal WHERE id = ?", (entry_id,))
        if not row:
            raise ValueError(f"Journal entry with ID {entry_id} not found")
        return self._row_to_entry(row)

    def list_entries(
        self,
        pen: Optional[str] = None,
        ink_id: Optional[int] = None,
        paper: Optional[str] = None,
        min_rating: Optional[int] = None,
        max_rating: Optional[int] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        limit: Optional[int] = None,
    ) -> List[JournalEntry]:
        sql = "SELECT * FROM journal WHERE 1=1"
        params: List[Any] = []

        if pen:
            sql += " AND pen LIKE ?"
            params.append(f"%{pen}%")
        if ink_id:
            sql += " AND ink_id = ?"
            params.append(ink_id)
        if paper:
            sql += " AND paper LIKE ?"
            params.append(f"%{paper}%")
        if min_rating:
            sql += " AND rating >= ?"
            params.append(min_rating)
        if max_rating:
            sql += " AND rating <= ?"
            params.append(max_rating)
        if date_from:
            sql += " AND date >= ?"
            params.append(date_from.isoformat())
        if date_to:
            sql += " AND date <= ?"
            params.append(date_to.isoformat())

        sql += " ORDER BY date DESC, id DESC"

        if limit:
            sql += " LIMIT ?"
            params.append(limit)

        rows = self.db.query(sql, tuple(params))
        return [self._row_to_entry(row) for row in rows]

    def find_best_ink_for_pen_paper(
        self, pen: str, paper: str, min_entries: int = 1
    ) -> List[Tuple[int, float, int]]:
        rows = self.db.query(
            """
            SELECT ink_id, AVG(rating) as avg_rating, COUNT(*) as count
            FROM journal
            WHERE pen LIKE ? AND paper LIKE ?
            GROUP BY ink_id
            HAVING COUNT(*) >= ?
            ORDER BY avg_rating DESC, count DESC
            """,
            (f"%{pen}%", f"%{paper}%", min_entries),
        )
        return [(r["ink_id"], r["avg_rating"], r["count"]) for r in rows]

    def find_best_pen_paper_for_ink(
        self, ink_id: int, min_entries: int = 1
    ) -> List[Tuple[str, str, float, int]]:
        rows = self.db.query(
            """
            SELECT pen, paper, AVG(rating) as avg_rating, COUNT(*) as count
            FROM journal
            WHERE ink_id = ?
            GROUP BY pen, paper
            HAVING COUNT(*) >= ?
            ORDER BY avg_rating DESC, count DESC
            """,
            (ink_id, min_entries),
        )
        return [(r["pen"], r["paper"], r["avg_rating"], r["count"]) for r in rows]

    def get_usage_stats(
        self, date_from: date, date_to: date
    ) -> Dict[str, Any]:
        rows = self.db.query(
            """
            SELECT ink_id, COUNT(*) as uses, AVG(rating) as avg_rating
            FROM journal
            WHERE date >= ? AND date <= ?
            GROUP BY ink_id
            ORDER BY uses DESC
            """,
            (date_from.isoformat(), date_to.isoformat()),
        )

        total_entries = sum(r["uses"] for r in rows)

        return {
            "date_from": date_from.isoformat(),
            "date_to": date_to.isoformat(),
            "total_entries": total_entries,
            "unique_inks": len(rows),
            "ink_usage": rows,
        }

    def _row_to_entry(self, row: Dict[str, Any]) -> JournalEntry:
        from core.inventory import InkManager

        ink = None
        try:
            ink_mgr = InkManager(self.db)
            ink = ink_mgr.get_ink(row["ink_id"])
        except Exception:
            pass

        return JournalEntry(
            id=row["id"],
            date=date.fromisoformat(row["date"]),
            pen=row["pen"],
            nib=row["nib"],
            ink_id=row["ink_id"],
            paper=row["paper"],
            humidity=row["humidity"],
            rating=row["rating"],
            notes=row["notes"],
            created_at=datetime.fromisoformat(row["created_at"]),
            ink=ink,
        )

    def get_all_pens(self) -> List[str]:
        rows = self.db.query("SELECT DISTINCT pen FROM journal ORDER BY pen")
        return [r["pen"] for r in rows if r["pen"]]

    def get_all_papers(self) -> List[str]:
        rows = self.db.query("SELECT DISTINCT paper FROM journal ORDER BY paper")
        return [r["paper"] for r in rows if r["paper"]]
