"""Propagation prediction for HAMLOG.

Fetches solar data from HamQSL and provides band propagation ratings.
Supports SFI, A-index, K-index, SSN data.
"""

import logging
import datetime
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass

from .db import Database

logger = logging.getLogger(__name__)

HAMQSL_URL = "https://www.hamqsl.com/solarxml.php"
CACHE_TTL = 3600

BANDS = ["160m", "80m", "40m", "30m", "20m", "17m", "15m", "12m", "10m", "6m"]

BAND_COLORS = {
    "160m": "dark_red",
    "80m": "red",
    "40m": "orange",
    "30m": "yellow",
    "20m": "yellow",
    "17m": "green",
    "15m": "green",
    "12m": "cyan",
    "10m": "cyan",
    "6m": "blue",
    "2m": "blue",
    "70cm": "magenta",
}

PROPAGATION_LEVELS = [
    (0, 20, "Very Poor"),
    (21, 40, "Poor"),
    (41, 60, "Fair"),
    (61, 80, "Good"),
    (81, 90, "Very Good"),
    (91, 100, "Excellent"),
]


@dataclass
class SolarData:
    """Solar activity data."""
    date: str
    sfi: float
    a_index: int
    k_index: float
    ssn: int
    solar_wind_speed: float
    x_ray: float
    flux_line: str


@dataclass
class BandPropagation:
    """Propagation rating for a band."""
    band: str
    day_rating: int
    night_rating: int
    best_direction: str
    description: str


def rating_to_level(rating: int) -> str:
    """Convert numeric rating to description."""
    for low, high, level in PROPAGATION_LEVELS:
        if low <= rating <= high:
            return level
    return "Unknown"


class PropagationManager:
    """Manager for propagation predictions."""

    def __init__(self, db: Database, cache_ttl: int = CACHE_TTL):
        self.db = db
        self.cache_ttl = cache_ttl

    def get_solar_data(self, force_refresh: bool = False) -> Optional[SolarData]:
        """Get current solar data, using cache if fresh."""
        today = datetime.date.today().isoformat()

        if not force_refresh:
            cached = self._get_cached(today)
            if cached:
                logger.debug("Using cached solar data for %s", today)
                return cached

        solar_data = self._fetch_hamqsl()
        if solar_data:
            self._cache_solar_data(solar_data)
            logger.info("Fetched fresh solar data from HamQSL")
            return solar_data

        logger.warning("Failed to fetch solar data, returning cached if available")
        return self._get_cached(today)

    def _get_cached(self, date_str: str) -> Optional[SolarData]:
        """Get cached solar data for a date."""
        row = self.db.query_one(
            "SELECT * FROM propagation_cache WHERE cache_date = ?",
            (date_str,)
        )
        if row:
            return SolarData(
                date=row["cache_date"],
                sfi=row["sfi"] or 0,
                a_index=row["a_index"] or 0,
                k_index=row["k_index"] or 0,
                ssn=row["ssn"] or 0,
                solar_wind_speed=row["solar_wind_speed"] or 0,
                x_ray=row["x_ray"] or 0,
                flux_line=row["flux_line"] or "",
            )
        return None

    def _cache_solar_data(self, solar_data: SolarData):
        """Cache solar data in database."""
        self.db.execute("""
            INSERT OR REPLACE INTO propagation_cache
            (cache_date, sfi, a_index, k_index, ssn, solar_wind_speed, x_ray, flux_line)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            solar_data.date,
            solar_data.sfi,
            solar_data.a_index,
            solar_data.k_index,
            solar_data.ssn,
            solar_data.solar_wind_speed,
            solar_data.x_ray,
            solar_data.flux_line,
        ))
        self.db.commit()

    def _fetch_hamqsl(self) -> Optional[SolarData]:
        """Fetch solar data from HamQSL XML feed."""
        try:
            req = urllib.request.Request(
                HAMQSL_URL,
                headers={"User-Agent": "HAMLOG/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                xml_data = response.read()

            root = ET.fromstring(xml_data)

            sfi = 0.0
            a_index = 0
            k_index = 0.0
            ssn = 0
            solar_wind = 0.0
            x_ray = 0.0
            flux_line = ""

            solar = root.find("solardata")
            if solar is not None:
                sfi_elem = solar.find("solarflux")
                if sfi_elem is not None and sfi_elem.text:
                    try:
                        sfi = float(sfi_elem.text)
                    except ValueError:
                        pass

                a_elem = solar.find("aindex")
                if a_elem is not None and a_elem.text:
                    try:
                        a_index = int(a_elem.text)
                    except ValueError:
                        pass

                k_elem = solar.find("kindex")
                if k_elem is not None and k_elem.text:
                    try:
                        k_index = float(k_elem.text)
                    except ValueError:
                        pass

                ssn_elem = solar.find("sunspots")
                if ssn_elem is not None and ssn_elem.text:
                    try:
                        ssn = int(ssn_elem.text)
                    except ValueError:
                        pass

                wind_elem = solar.find("solarwind")
                if wind_elem is not None and wind_elem.text:
                    try:
                        solar_wind = float(wind_elem.text)
                    except ValueError:
                        pass

                xray_elem = solar.find("xray")
                if xray_elem is not None and xray_elem.text:
                    try:
                        x_ray = float(xray_elem.text)
                    except ValueError:
                        pass

                flux_elem = solar.find("fluxline")
                if flux_elem is not None and flux_elem.text:
                    flux_line = flux_elem.text

            return SolarData(
                date=datetime.date.today().isoformat(),
                sfi=sfi,
                a_index=a_index,
                k_index=k_index,
                ssn=ssn,
                solar_wind_speed=solar_wind,
                x_ray=x_ray,
                flux_line=flux_line,
            )

        except (urllib.error.URLError, ET.ParseError, OSError) as e:
            logger.error("Failed to fetch HamQSL data: %s", e)
            return None

    def calculate_band_propagation(
        self, solar_data: SolarData, my_lat: float = 40.0
    ) -> List[BandPropagation]:
        """Calculate propagation ratings for all HF bands.

        Based on SFI (solar flux index), A-index, K-index, and time of day.
        """
        sfi = solar_data.sfi
        a_index = solar_data.a_index
        k_index = solar_data.k_index

        conditions_factor = max(0, min(100, (sfi - 65) / 1.5))

        geomagnetic_factor = max(0, 100 - (a_index * 2 + k_index * 10))

        result = []

        for band in BANDS:
            day_rating = self._day_rating(band, sfi, conditions_factor, geomagnetic_factor)
            night_rating = self._night_rating(band, sfi, conditions_factor, geomagnetic_factor)

            best_dir = self._best_direction(band, solar_data)

            day_level = rating_to_level(day_rating)
            night_level = rating_to_level(night_rating)
            description = f"Day: {day_level}, Night: {night_level}"

            result.append(BandPropagation(
                band=band,
                day_rating=day_rating,
                night_rating=night_rating,
                best_direction=best_dir,
                description=description,
            ))

        return result

    def _day_rating(self, band: str, sfi: float, cond_factor: float, geo_factor: float) -> int:
        """Calculate daytime propagation rating for a band."""
        band_factors = {
            "160m": max(0, 10 - sfi / 30),
            "80m": max(0, 20 - sfi / 20),
            "40m": max(10, 40 - sfi / 10),
            "30m": max(20, 50 + sfi / 10),
            "20m": max(30, 60 + sfi / 5),
            "17m": max(20, 50 + sfi / 4),
            "15m": max(10, 40 + sfi / 3),
            "12m": max(5, 30 + sfi / 2.5),
            "10m": max(0, 20 + sfi / 2),
            "6m": max(0, 10 + sfi / 1.5),
        }

        base = band_factors.get(band, 50)
        rating = base * (geo_factor / 100)
        return max(0, min(100, int(rating)))

    def _night_rating(self, band: str, sfi: float, cond_factor: float, geo_factor: float) -> int:
        """Calculate nighttime propagation rating for a band."""
        band_factors = {
            "160m": 90,
            "80m": 85,
            "40m": 75,
            "30m": 60,
            "20m": 50,
            "17m": 30,
            "15m": 15,
            "12m": 10,
            "10m": 5,
            "6m": 0,
        }

        base = band_factors.get(band, 30)
        rating = base * (geo_factor / 100)
        return max(0, min(100, int(rating)))

    def _best_direction(self, band: str, solar_data: SolarData) -> str:
        """Estimate best propagation direction based on band and conditions."""
        if solar_data.sfi > 150:
            if band in ("10m", "12m", "15m"):
                return "Long-path possible"
            if band in ("17m", "20m"):
                return "Worldwide"

        if band in ("160m", "80m", "40m"):
            return "Regional/Nighttime DX"
        elif band in ("30m", "20m"):
            return "Medium to Long distance"
        elif band in ("17m", "15m"):
            return "Long distance (daytime)"
        else:
            return "Sporadic E / F2 (high SFI)"

    def get_7day_trend(self) -> List[SolarData]:
        """Get 7-day solar data trend from cache."""
        rows = self.db.query_all("""
            SELECT * FROM propagation_cache
            ORDER BY cache_date DESC
            LIMIT 7
        """)

        result = []
        for row in rows:
            result.append(SolarData(
                date=row["cache_date"],
                sfi=row["sfi"] or 0,
                a_index=row["a_index"] or 0,
                k_index=row["k_index"] or 0,
                ssn=row["ssn"] or 0,
                solar_wind_speed=row["solar_wind_speed"] or 0,
                x_ray=row["x_ray"] or 0,
                flux_line=row["flux_line"] or "",
            ))

        return result

    def get_suggested_band(self, current_utc_hour: Optional[int] = None) -> str:
        """Suggest the best band for current conditions.

        Uses time of day as a proxy for day/night at the QTH.
        """
        solar = self.get_solar_data()
        if not solar:
            return "20m"

        if current_utc_hour is None:
            current_utc_hour = datetime.datetime.utcnow().hour

        is_daytime = 6 <= current_utc_hour <= 18

        if is_daytime:
            if solar.sfi > 150:
                return "15m"
            elif solar.sfi > 100:
                return "20m"
            else:
                return "40m"
        else:
            if solar.sfi > 120:
                return "20m"
            elif solar.sfi > 80:
                return "40m"
            else:
                return "80m"

    def get_band_switch_suggestions(self, current_band: str) -> List[str]:
        """Get suggestions for next band to try based on conditions."""
        solar = self.get_solar_data()
        if not solar:
            return ["20m", "40m", "15m"]

        sfi = solar.sfi
        suggestions = []

        if sfi > 150:
            suggestions = ["10m", "12m", "15m", "17m", "20m"]
        elif sfi > 120:
            suggestions = ["15m", "17m", "20m", "30m", "40m"]
        elif sfi > 90:
            suggestions = ["20m", "30m", "40m", "17m", "15m"]
        elif sfi > 60:
            suggestions = ["40m", "30m", "20m", "80m", "160m"]
        else:
            suggestions = ["80m", "40m", "30m", "160m", "20m"]

        if current_band in suggestions:
            idx = suggestions.index(current_band)
            if idx > 0:
                higher = suggestions[:idx]
            else:
                higher = []
            if idx < len(suggestions) - 1:
                lower = suggestions[idx + 1:]
            else:
                lower = []
            return higher + lower

        return suggestions
