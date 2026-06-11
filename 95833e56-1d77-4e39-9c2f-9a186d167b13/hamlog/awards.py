"""Award progress tracking for HAMLOG.

DXCC, WAS (Worked All States), and WAZ (Worked All Zones) awards.
"""

import logging
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass

from .db import Database
from .qso import QSO
from .dxcc_data import get_dxcc_entity, get_all_dxcc_entities, get_us_states, get_cq_zones

logger = logging.getLogger(__name__)

CONTINENTS = ["NA", "SA", "EU", "AF", "AS", "OC", "AN"]
CQ_ZONES = list(range(1, 41))


@dataclass
class AwardProgress:
    """Progress for a specific award."""
    name: str
    worked: int
    total: int
    percentage: float
    missing: List[str]


class AwardManager:
    """Manager for award progress calculations."""

    def __init__(self, db: Database):
        self.db = db

    def dxcc_status(self, band: Optional[str] = None, mode: Optional[str] = None) -> AwardProgress:
        """Calculate DXCC progress.

        Returns number of worked entities and missing entities sorted by rarity.
        """
        where_clauses = []
        params: List = []

        if band:
            where_clauses.append("band = ?")
            params.append(band)
        if mode:
            where_clauses.append("mode = ?")
            params.append(mode.upper())

        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses) + " AND dxcc IS NOT NULL"
        else:
            where_sql = " WHERE dxcc IS NOT NULL"

        rows = self.db.query_all(
            f"SELECT DISTINCT dxcc, country FROM qsos{where_sql}",
            tuple(params)
        )

        worked_ids = set()
        for row in rows:
            worked_ids.add(row["dxcc"])

        all_entities = get_all_dxcc_entities()
        total_active = len([e for e in all_entities if not e.deleted])

        missing_entities = [
            e for e in all_entities
            if not e.deleted and e.entity_id not in worked_ids
        ]

        missing_names = [e.name for e in missing_entities]

        return AwardProgress(
            name="DXCC",
            worked=len(worked_ids),
            total=total_active,
            percentage=round(len(worked_ids) / total_active * 100, 1) if total_active > 0 else 0,
            missing=missing_names,
        )

    def dxcc_by_continent(self, band: Optional[str] = None) -> Dict[str, Tuple[int, int]]:
        """Get DXCC progress by continent."""
        all_entities = get_all_dxcc_entities()
        result: Dict[str, Tuple[int, int]] = {}

        for cont in CONTINENTS:
            cont_entities = [e for e in all_entities if e.continent == cont and not e.deleted]
            total = len(cont_entities)
            worked = 0

            if cont_entities:
                ids = [e.entity_id for e in cont_entities]
                placeholders = ", ".join("?" * len(ids))
                where_extra = ""
                params = list(ids)
                if band:
                    where_extra = " AND band = ?"
                    params.append(band)

                row = self.db.query_one(
                    f"SELECT COUNT(DISTINCT dxcc) as cnt FROM qsos WHERE dxcc IN ({placeholders}){where_extra}",
                    tuple(params)
                )
                worked = row["cnt"] if row else 0

            result[cont] = (worked, total)

        return result

    def was_status(self, band: Optional[str] = None, mode: Optional[str] = None) -> AwardProgress:
        """Calculate WAS (Worked All States) progress."""
        states = get_us_states()
        total = len(states)

        where_clauses = ["state IS NOT NULL", "state != ''"]
        params: List = []

        if band:
            where_clauses.append("band = ?")
            params.append(band)
        if mode:
            where_clauses.append("mode = ?")
            params.append(mode.upper())

        where_sql = " WHERE " + " AND ".join(where_clauses)

        rows = self.db.query_all(
            f"SELECT DISTINCT state FROM qsos{where_sql}",
            tuple(params)
        )

        worked_states = set(row["state"].upper() for row in rows if row["state"])
        all_state_codes = set(states.keys())

        worked = len(worked_states & all_state_codes)
        missing_codes = sorted(all_state_codes - worked_states)
        missing_names = [f"{code} - {states[code]}" for code in missing_codes]

        return AwardProgress(
            name="WAS (Worked All States)",
            worked=worked,
            total=total,
            percentage=round(worked / total * 100, 1) if total > 0 else 0,
            missing=missing_names,
        )

    def waz_status(self, band: Optional[str] = None, mode: Optional[str] = None) -> AwardProgress:
        """Calculate WAZ (Worked All Zones / CQ Zones) progress."""
        cq_zones = get_cq_zones()
        total = len(cq_zones)

        where_clauses = ["cq_zone IS NOT NULL"]
        params: List = []

        if band:
            where_clauses.append("band = ?")
            params.append(band)
        if mode:
            where_clauses.append("mode = ?")
            params.append(mode.upper())

        where_sql = " WHERE " + " AND ".join(where_clauses)

        rows = self.db.query_all(
            f"SELECT DISTINCT cq_zone FROM qsos{where_sql}",
            tuple(params)
        )

        worked_zones = set(row["cq_zone"] for row in rows if row["cq_zone"])
        all_zones_set = set(cq_zones)

        worked = len(worked_zones & all_zones_set)
        missing_zones = sorted(all_zones_set - worked_zones)
        missing_strs = [f"Zone {z}" for z in missing_zones]

        return AwardProgress(
            name="WAZ (Worked All Zones)",
            worked=worked,
            total=total,
            percentage=round(worked / total * 100, 1) if total > 0 else 0,
            missing=missing_strs,
        )

    def itu_zones_worked(self, band: Optional[str] = None) -> Set[int]:
        """Get set of ITU zones worked."""
        where = " WHERE ituzone IS NOT NULL"
        params = []
        if band:
            where += " AND band = ?"
            params.append(band)

        rows = self.db.query_all(
            f"SELECT DISTINCT ituzone FROM qsos{where}",
            tuple(params)
        )
        return set(row["ituzone"] for row in rows if row["ituzone"])

    def yearly_summary(self) -> List[Dict]:
        """Get yearly QSO summary."""
        rows = self.db.query_all("""
            SELECT 
                substr(qso_date, 1, 4) as year,
                COUNT(*) as qso_count,
                COUNT(DISTINCT callsign) as unique_calls,
                COUNT(DISTINCT dxcc) as dxcc_count
            FROM qsos 
            WHERE qso_date IS NOT NULL
            GROUP BY substr(qso_date, 1, 4)
            ORDER BY year DESC
        """)
        return [dict(row) for row in rows]

    def band_summary(self) -> List[Dict]:
        """Get QSO summary by band."""
        rows = self.db.query_all("""
            SELECT 
                band,
                COUNT(*) as qso_count,
                COUNT(DISTINCT callsign) as unique_calls,
                COUNT(DISTINCT dxcc) as dxcc_count
            FROM qsos 
            WHERE band IS NOT NULL
            GROUP BY band
            ORDER BY qso_count DESC
        """)
        return [dict(row) for row in rows]

    def mode_summary(self) -> List[Dict]:
        """Get QSO summary by mode."""
        rows = self.db.query_all("""
            SELECT 
                mode,
                COUNT(*) as qso_count,
                COUNT(DISTINCT callsign) as unique_calls
            FROM qsos 
            WHERE mode IS NOT NULL
            GROUP BY mode
            ORDER BY qso_count DESC
        """)
        return [dict(row) for row in rows]

    def lotw_status(self) -> Tuple[int, int]:
        """Get LoTW QSL status. Returns (confirmed, total)."""
        total_row = self.db.query_one("SELECT COUNT(*) as cnt FROM qsos")
        confirmed_row = self.db.query_one(
            "SELECT COUNT(*) as cnt FROM qsos WHERE lotw_rcvd = 'Y'"
        )
        total = total_row["cnt"] if total_row else 0
        confirmed = confirmed_row["cnt"] if confirmed_row else 0
        return confirmed, total

    def update_dxcc_for_qso(self, qso_id: int, dxcc_id: int) -> bool:
        """Update DXCC entity for a QSO."""
        entity = get_dxcc_entity(dxcc_id)
        if not entity:
            return False

        cursor = self.db.execute(
            "UPDATE qsos SET dxcc = ?, country = ?, cq_zone = ?, ituzone = ? WHERE id = ?",
            (dxcc_id, entity.name, entity.cq_zone, entity.ituzone, qso_id)
        )
        self.db.commit()
        return cursor.rowcount > 0
