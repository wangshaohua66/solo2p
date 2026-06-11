from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from storage.db import Database

LIMITED_TAG_WEIGHTS: dict[str, int] = {
    "taproom only": 25,
    "taproom exclusive": 25,
    "brewery only": 20,
    "exclusive": 18,
    "one-off": 22,
    "one off": 22,
    "flash release": 20,
    "limited run": 15,
    "limited edition": 14,
    "limited release": 14,
    "limited": 12,
    "rare": 18,
    "small batch": 10,
    "reserve": 8,
    "anniversary": 12,
    "barrel aged": 8,
    "special release": 10,
    "seasonal limited": 8,
    "collab": 6,
    "collaboration": 6,
    "single batch": 10,
    "flagged_limited": 10,
    "kickstarter": 15,
    "crowdfunding": 15,
    "newsletter": 12,
    "24h": 18,
}

SOURCE_DENSITY_WEIGHT: float = 5.0
AGE_WEIGHT_NEW: float = 10.0
AGE_WEIGHT_FRESH: float = 5.0
CROSS_SOURCE_BONUS: float = 8.0


class ScarcityEngine:
    def __init__(self, db: Database):
        self.db = db

    def calculate_score(self, beer: dict[str, Any], source_count: int = 1) -> int:
        score = 0.0

        tag_score = self._tag_score(beer.get("limited_tags", ""))
        score += tag_score

        if beer.get("is_limited"):
            score += 15

        if source_count == 1:
            score += SOURCE_DENSITY_WEIGHT
        elif source_count == 0:
            score += SOURCE_DENSITY_WEIGHT * 2

        score += self._age_score(beer.get("created_at"))

        if source_count >= 3:
            score += CROSS_SOURCE_BONUS

        return min(max(int(round(score)), 0), 100)

    def _tag_score(self, limited_tags: str) -> float:
        if not limited_tags:
            return 0.0
        tags = [t.strip() for t in limited_tags.split(",") if t.strip()]
        total = 0.0
        for tag in tags:
            total += LIMITED_TAG_WEIGHTS.get(tag.lower(), 3)
        return min(total, 60)

    def _age_score(self, created_at: str | None) -> float:
        if not created_at:
            return 0.0
        try:
            dt = datetime.fromisoformat(created_at)
            now = datetime.now(timezone.utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            hours = (now - dt).total_seconds() / 3600
            if hours <= 6:
                return AGE_WEIGHT_NEW
            elif hours <= 24:
                return AGE_WEIGHT_FRESH
            elif hours <= 72:
                return 2.0
            return 0.0
        except (ValueError, TypeError):
            return 0.0

    def recalculate_all(self) -> int:
        from parsers.normalize import generate_fingerprint

        conn = self.db.conn
        rows = conn.execute(
            """SELECT b.id, b.fingerprint, b.is_limited, b.limited_tags, b.created_at,
                      COUNT(DISTINCT bs.source) as source_count
               FROM beers b
               LEFT JOIN beer_sources bs ON b.id = bs.beer_id
               GROUP BY b.id"""
        ).fetchall()

        updated = 0
        for row in rows:
            beer = dict(row)
            score = self.calculate_score(beer, beer.get("source_count", 1))
            self.db.update_scarcity_score(beer["id"], score)
            updated += 1

        logger.info("Recalculated scarcity for {count} beers", count=updated)
        return updated

    def deduplicate_and_score(self) -> int:
        conn = self.db.conn
        fingerprints = conn.execute(
            "SELECT fingerprint, COUNT(*) as cnt FROM beers GROUP BY fingerprint HAVING cnt > 1"
        ).fetchall()

        merged = 0
        for row in fingerprints:
            fp = row["fingerprint"]
            beers = conn.execute(
                "SELECT id, brewery_id FROM beers WHERE fingerprint = ? ORDER BY created_at ASC",
                (fp,),
            ).fetchall()

            if len(beers) <= 1:
                continue

            primary_id = beers[0]["id"]
            for duplicate in beers[1:]:
                dup_id = duplicate["id"]
                conn.execute(
                    "UPDATE beer_sources SET beer_id = ? WHERE beer_id = ?",
                    (primary_id, dup_id),
                )
                conn.execute(
                    "UPDATE price_history SET beer_id = ? WHERE beer_id = ?",
                    (primary_id, dup_id),
                )
                conn.execute(
                    "UPDATE availability SET beer_id = ? WHERE beer_id = ?",
                    (primary_id, dup_id),
                )
                conn.execute(
                    "UPDATE kickstarter_campaigns SET beer_id = ? WHERE beer_id = ?",
                    (primary_id, dup_id),
                )
                conn.execute(
                    "UPDATE notifications SET beer_id = ? WHERE beer_id = ?",
                    (primary_id, dup_id),
                )
                conn.execute("DELETE FROM beers WHERE id = ?", (dup_id,))
                merged += 1

        self.db.conn.commit()
        self.recalculate_all()
        logger.info("Deduplication complete: merged {count} duplicates", count=merged)
        return merged
