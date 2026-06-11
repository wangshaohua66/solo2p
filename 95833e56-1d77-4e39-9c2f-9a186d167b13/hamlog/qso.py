"""QSO model and CRUD operations for HAMLOG.

Handles QSO record management with validation, callsign normalization,
and flexible search queries.
"""

import re
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, field, asdict

from .db import Database

logger = logging.getLogger(__name__)

BANDS = ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m", "2m", "70cm"]
MODES = ["SSB", "CW", "FT8", "FT4", "RTTY", "PSK31", "JT65", "JT9", "JS8", "OLIVIA", "DOMINO", "HELL", "SSTV", "FM", "AM"]

BAND_FREQ_RANGES = {
    "160m": (1.8, 2.0),
    "80m": (3.5, 4.0),
    "60m": (5.0, 5.5),
    "40m": (7.0, 7.3),
    "30m": (10.1, 10.15),
    "20m": (14.0, 14.35),
    "17m": (18.068, 18.168),
    "15m": (21.0, 21.45),
    "12m": (24.89, 24.99),
    "10m": (28.0, 29.7),
    "6m": (50.0, 54.0),
    "2m": (144.0, 148.0),
    "70cm": (420.0, 450.0),
}

CALLSIGN_RE = re.compile(r'^[A-Z0-9]{1,3}[0-9][A-Z0-9]{1,4}$')
GRID_RE = re.compile(r'^[A-Ra-r]{2}[0-9]{2}([A-Xa-x]{2})?$')


@dataclass
class QSO:
    """QSO record data class."""
    callsign: str
    qso_date: str
    qso_time: str
    band: str
    mode: str
    freq: Optional[float] = None
    rst_sent: Optional[str] = None
    rst_rcvd: Optional[str] = None
    grid: Optional[str] = None
    name: Optional[str] = None
    qth: Optional[str] = None
    state: Optional[str] = None
    cq_zone: Optional[int] = None
    ituzone: Optional[int] = None
    dxcc: Optional[int] = None
    country: Optional[str] = None
    operator: Optional[str] = None
    station_callsign: Optional[str] = None
    my_grid: Optional[str] = None
    tx_pwr: Optional[float] = None
    rig: Optional[str] = None
    antenna: Optional[str] = None
    comment: Optional[str] = None
    notes: Optional[str] = None
    contest_id: Optional[str] = None
    srx: Optional[int] = None
    srx_string: Optional[str] = None
    stx: Optional[int] = None
    stx_string: Optional[str] = None
    qsl_rcvd: str = "N"
    qsl_sent: str = "N"
    lotw_rcvd: str = "N"
    lotw_sent: str = "N"
    id: Optional[int] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    def validate(self) -> List[str]:
        """Validate the QSO record. Returns list of error messages."""
        errors = []

        if not self.callsign:
            errors.append("callsign is required")
        else:
            self.callsign = normalize_callsign(self.callsign)
            if not CALLSIGN_RE.match(self.callsign):
                errors.append(f"invalid callsign format: {self.callsign}")

        if not self.qso_date:
            errors.append("qso_date is required")
        elif not re.match(r'^\d{8}$', self.qso_date):
            errors.append("qso_date must be YYYYMMDD format")

        if not self.qso_time:
            errors.append("qso_time is required")
        elif not re.match(r'^\d{4}$', self.qso_time) and not re.match(r'^\d{6}$', self.qso_time):
            errors.append("qso_time must be HHMM or HHMMSS format")

        if not self.band:
            errors.append("band is required")
        elif self.band not in BANDS:
            errors.append(f"invalid band: {self.band}. Valid: {', '.join(BANDS)}")

        if not self.mode:
            errors.append("mode is required")
        else:
            self.mode = self.mode.upper()
            if self.mode not in MODES:
                errors.append(f"invalid mode: {self.mode}. Valid: {', '.join(MODES)}")

        if self.freq is not None and self.band:
            low, high = BAND_FREQ_RANGES.get(self.band, (0, float('inf')))
            if self.freq < low or self.freq > high:
                errors.append(f"frequency {self.freq} MHz out of {self.band} band range ({low}-{high})")

        if self.grid:
            self.grid = self.grid.upper()
            if not GRID_RE.match(self.grid):
                errors.append(f"invalid grid square: {self.grid}")

        if self.my_grid:
            self.my_grid = self.my_grid.upper()
            if not GRID_RE.match(self.my_grid):
                errors.append(f"invalid my_grid: {self.my_grid}")

        if self.state:
            self.state = self.state.upper()

        return errors

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary, excluding None values."""
        result = asdict(self)
        return {k: v for k, v in result.items() if v is not None}


def normalize_callsign(callsign: str) -> str:
    """Normalize a callsign to uppercase, stripped, no suffix/prefix extras."""
    cs = callsign.strip().upper()
    cs = re.sub(r'^[A-Z0-9]+/', '', cs)
    cs = re.sub(r'/[A-Z0-9]+$', '', cs)
    return cs


def freq_to_band(freq_mhz: float) -> Optional[str]:
    """Determine the band from a frequency in MHz."""
    for band, (low, high) in BAND_FREQ_RANGES.items():
        if low <= freq_mhz <= high:
            return band
    return None


def now_utc_datetime() -> datetime:
    """Get current UTC datetime."""
    return datetime.now(timezone.utc)


def format_date(dt: datetime) -> str:
    """Format datetime as YYYYMMDD."""
    return dt.strftime("%Y%m%d")


def format_time(dt: datetime) -> str:
    """Format datetime as HHMM."""
    return dt.strftime("%H%M")


class QSOMANAGER:
    """Manager for QSO CRUD operations."""

    def __init__(self, db: Database):
        self.db = db

    def add(self, qso: QSO) -> int:
        """Add a new QSO. Returns the new record ID.
        
        Raises ValueError if validation fails or duplicate.
        """
        errors = qso.validate()
        if errors:
            raise ValueError("Validation failed: " + "; ".join(errors))

        try:
            cursor = self.db.execute("""
                INSERT INTO qsos (
                    callsign, qso_date, qso_time, band, mode, freq,
                    rst_sent, rst_rcvd, grid, name, qth, state,
                    cq_zone, ituzone, dxcc, country, operator,
                    station_callsign, my_grid, tx_pwr, rig, antenna,
                    comment, notes, contest_id, srx, srx_string,
                    stx, stx_string, qsl_rcvd, qsl_sent,
                    lotw_rcvd, lotw_sent
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            """, (
                qso.callsign, qso.qso_date, qso.qso_time, qso.band, qso.mode,
                qso.freq, qso.rst_sent, qso.rst_rcvd, qso.grid, qso.name,
                qso.qth, qso.state, qso.cq_zone, qso.ituzone, qso.dxcc,
                qso.country, qso.operator, qso.station_callsign, qso.my_grid,
                qso.tx_pwr, qso.rig, qso.antenna, qso.comment, qso.notes,
                qso.contest_id, qso.srx, qso.srx_string, qso.stx,
                qso.stx_string, qso.qsl_rcvd, qso.qsl_sent,
                qso.lotw_rcvd, qso.lotw_sent,
            ))
            self.db.commit()
            qso_id = cursor.lastrowid
            logger.info("Added QSO #%d: %s on %s %s", qso_id, qso.callsign, qso.band, qso.mode)
            return qso_id
        except Exception as e:
            self.db.rollback()
            if "UNIQUE constraint failed" in str(e):
                raise ValueError(f"Duplicate QSO: {qso.callsign} {qso.qso_date} {qso.qso_time} {qso.band} {qso.mode}")
            raise

    def add_batch(self, qsos: List[QSO]) -> Tuple[int, int]:
        """Batch add QSOs. Returns (success_count, skip_count)."""
        success = 0
        skipped = 0

        for qso in qsos:
            try:
                self.add(qso)
                success += 1
            except ValueError as e:
                if "Duplicate" in str(e):
                    skipped += 1
                    logger.debug("Skipped duplicate: %s", e)
                else:
                    raise

        return success, skipped

    def get(self, qso_id: int) -> Optional[QSO]:
        """Get a QSO by ID."""
        row = self.db.query_one("SELECT * FROM qsos WHERE id = ?", (qso_id,))
        return _row_to_qso(row) if row else None

    def delete(self, qso_id: int) -> bool:
        """Delete a QSO by ID. Returns True if deleted."""
        cursor = self.db.execute("DELETE FROM qsos WHERE id = ?", (qso_id,))
        self.db.commit()
        deleted = cursor.rowcount > 0
        if deleted:
            logger.info("Deleted QSO #%d", qso_id)
        return deleted

    def update(self, qso_id: int, updates: Dict[str, Any]) -> bool:
        """Update a QSO by ID. Returns True if updated."""
        if not updates:
            return False

        fields = []
        values = []
        for key, value in updates.items():
            if key == "id":
                continue
            fields.append(f"{key} = ?")
            values.append(value)

        values.append(qso_id)
        fields.append("updated_at = datetime('now')")

        sql = f"UPDATE qsos SET {', '.join(fields)} WHERE id = ?"
        cursor = self.db.execute(sql, values)
        self.db.commit()
        updated = cursor.rowcount > 0
        if updated:
            logger.info("Updated QSO #%d", qso_id)
        return updated

    def search(
        self,
        callsign: Optional[str] = None,
        callsign_regex: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        bands: Optional[List[str]] = None,
        modes: Optional[List[str]] = None,
        dxcc: Optional[int] = None,
        state: Optional[str] = None,
        cq_zone: Optional[int] = None,
        lotw_qsl: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
        order_by: str = "qso_date DESC, qso_time DESC",
    ) -> List[QSO]:
        """Search QSOs with various filters."""
        where_clauses = []
        params: List[Any] = []

        if callsign:
            if "%" in callsign or "_" in callsign:
                where_clauses.append("callsign LIKE ?")
                params.append(callsign.upper())
            else:
                where_clauses.append("callsign = ?")
                params.append(callsign.upper())

        if callsign_regex:
            where_clauses.append("callsign REGEXP ?")
            params.append(callsign_regex)

        if date_from:
            where_clauses.append("qso_date >= ?")
            params.append(date_from)

        if date_to:
            where_clauses.append("qso_date <= ?")
            params.append(date_to)

        if bands:
            placeholders = ", ".join("?" * len(bands))
            where_clauses.append(f"band IN ({placeholders})")
            params.extend(bands)

        if modes:
            placeholders = ", ".join("?" * len(modes))
            where_clauses.append(f"mode IN ({placeholders})")
            params.extend(m.upper() for m in modes)

        if dxcc:
            where_clauses.append("dxcc = ?")
            params.append(dxcc)

        if state:
            where_clauses.append("state = ?")
            params.append(state.upper())

        if cq_zone:
            where_clauses.append("cq_zone = ?")
            params.append(cq_zone)

        if lotw_qsl == "lotw":
            where_clauses.append("lotw_rcvd = 'Y'")
        elif lotw_qsl == "qsl":
            where_clauses.append("qsl_rcvd = 'Y'")

        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        sql = f"SELECT * FROM qsos{where_sql} ORDER BY {order_by} LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        rows = self.db.query_all(sql, tuple(params))
        return [_row_to_qso(row) for row in rows]

    def count(
        self,
        callsign: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        bands: Optional[List[str]] = None,
        modes: Optional[List[str]] = None,
    ) -> int:
        """Count QSOs matching criteria."""
        where_clauses = []
        params: List[Any] = []

        if callsign:
            where_clauses.append("callsign = ?")
            params.append(callsign.upper())

        if date_from:
            where_clauses.append("qso_date >= ?")
            params.append(date_from)

        if date_to:
            where_clauses.append("qso_date <= ?")
            params.append(date_to)

        if bands:
            placeholders = ", ".join("?" * len(bands))
            where_clauses.append(f"band IN ({placeholders})")
            params.extend(bands)

        if modes:
            placeholders = ", ".join("?" * len(modes))
            where_clauses.append(f"mode IN ({placeholders})")
            params.extend(m.upper() for m in modes)

        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        row = self.db.query_one(f"SELECT COUNT(*) as cnt FROM qsos{where_sql}", tuple(params))
        return row["cnt"] if row else 0

    def unique_callsigns(self, band: Optional[str] = None, mode: Optional[str] = None) -> List[str]:
        """Get list of unique callsigns."""
        where = []
        params = []
        if band:
            where.append("band = ?")
            params.append(band)
        if mode:
            where.append("mode = ?")
            params.append(mode.upper())

        where_sql = ""
        if where:
            where_sql = " WHERE " + " AND ".join(where)

        rows = self.db.query_all(
            f"SELECT DISTINCT callsign FROM qsos{where_sql} ORDER BY callsign",
            tuple(params)
        )
        return [row["callsign"] for row in rows]

    def get_by_unique_key(
        self, callsign: str, qso_date: str, qso_time: str, band: str, mode: str
    ) -> Optional[QSO]:
        """Get QSO by unique key for duplicate detection."""
        row = self.db.query_one(
            "SELECT * FROM qsos WHERE callsign = ? AND qso_date = ? AND qso_time = ? AND band = ? AND mode = ?",
            (callsign.upper(), qso_date, qso_time, band, mode.upper())
        )
        return _row_to_qso(row) if row else None


def _row_to_qso(row) -> QSO:
    """Convert a sqlite3.Row to a QSO object."""
    return QSO(
        id=row["id"],
        callsign=row["callsign"],
        qso_date=row["qso_date"],
        qso_time=row["qso_time"],
        band=row["band"],
        mode=row["mode"],
        freq=row["freq"],
        rst_sent=row["rst_sent"],
        rst_rcvd=row["rst_rcvd"],
        grid=row["grid"],
        name=row["name"],
        qth=row["qth"],
        state=row["state"],
        cq_zone=row["cq_zone"],
        ituzone=row["ituzone"],
        dxcc=row["dxcc"],
        country=row["country"],
        operator=row["operator"],
        station_callsign=row["station_callsign"],
        my_grid=row["my_grid"],
        tx_pwr=row["tx_pwr"],
        rig=row["rig"],
        antenna=row["antenna"],
        comment=row["comment"],
        notes=row["notes"],
        contest_id=row["contest_id"],
        srx=row["srx"],
        srx_string=row["srx_string"],
        stx=row["stx"],
        stx_string=row["stx_string"],
        qsl_rcvd=row["qsl_rcvd"] or "N",
        qsl_sent=row["qsl_sent"] or "N",
        lotw_rcvd=row["lotw_rcvd"] or "N",
        lotw_sent=row["lotw_sent"] or "N",
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
