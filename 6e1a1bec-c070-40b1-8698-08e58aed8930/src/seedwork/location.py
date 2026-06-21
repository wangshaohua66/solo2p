import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
from obspy.geodetics import kilometers2degrees, degrees2kilometers, gps2dist_azimuth
from rich.table import Table

from .db import Database, Station, Event, Pick, CatalogEntry, CatalogVersion
from .logger import get_logger, get_console

logger = get_logger()
console = get_console()


@dataclass
class MagnitudeResult:
    ml: float
    station_magnitudes: dict[str, float] = field(default_factory=dict)
    uncertainty: float = 0.0


@dataclass
class LocationResult:
    latitude: float
    longitude: float
    depth: float
    origin_time: datetime
    latitude_uncertainty: float
    longitude_uncertainty: float
    depth_uncertainty: float
    num_stations: int
    azimuth_gap: float
    residuals: list[float] = field(default_factory=list)
    method: str = "intersection"


class LocationEngine:
    def __init__(self, config_path: Optional[str] = None):
        self.db = Database()
        self._vp = 6.0
        self._vs = 3.5
        self._vp_vs_ratio = self._vp / self._vs

    def _calculate_magnitude_ml(self, amplitude: float, period: float,
                                distance_km: float, station_gain: float = 1.0) -> float:
        if amplitude <= 0 or distance_km <= 0:
            return 0.0

        amp_mm = amplitude / 1000.0 * station_gain
        amp_nm = amp_mm * 1e6

        ml = math.log10(amp_nm) + self._attenuation_correction(distance_km)
        return ml

    def _attenuation_correction(self, distance_km: float) -> float:
        if distance_km <= 0:
            return 0.0

        a = 1.110
        b = 0.00189
        log_term = math.log10(distance_km / 100.0) if distance_km > 100 else 0
        correction = a * log_term + b * (distance_km - 100) + 3.0
        return correction

    def calculate_magnitude(self, event_id: int) -> MagnitudeResult:
        with self.db.get_session() as session:
            event = session.query(Event).filter(Event.id == event_id).first()
            if not event:
                return MagnitudeResult(ml=0.0)

            p_picks = session.query(Pick).filter(
                Pick.event_id == event_id,
                Pick.phase == "P",
                Pick.amplitude > 0
            ).all()

            station_mags = {}
            for pick in p_picks:
                station = pick.station
                if not station:
                    continue

                with self.db.get_session() as s2:
                    event2 = s2.query(Event).filter(Event.id == event_id).first()
                    all_p_picks = s2.query(Pick).filter(
                        Pick.event_id == event_id,
                        Pick.phase == "P"
                    ).all()

                    if len(all_p_picks) < 3:
                        dist_km = 10.0
                    else:
                        dist_km = self._estimate_distance(pick, all_p_picks, station)

                ml = self._calculate_magnitude_ml(
                    pick.amplitude,
                    pick.period or 1.0,
                    dist_km
                )

                if -2.0 <= ml <= 8.0:
                    station_mags[f"{station.network}.{station.station}"] = ml

            if not station_mags:
                return MagnitudeResult(ml=0.0)

            values = list(station_mags.values())
            mean_ml = float(np.mean(values))
            std_ml = float(np.std(values)) if len(values) > 1 else 0.3

            return MagnitudeResult(
                ml=mean_ml,
                station_magnitudes=station_mags,
                uncertainty=std_ml
            )

    def _estimate_distance(self, pick: Pick, all_picks: list[Pick], station: Station) -> float:
        s_pick = None
        for p in all_picks:
            if p.station_id == station.id and p.phase == "S":
                s_pick = p
                break

        if s_pick:
            s_p_diff = (s_pick.arrival_time - pick.arrival_time).total_seconds()
            if s_p_diff > 0:
                distance = s_p_diff / (1.0 / self._vs - 1.0 / self._vp)
                return distance

        return 10.0

    def _calculate_azimuth_gap(self, stations: list[Station], event_lat: float,
                               event_lon: float) -> float:
        if len(stations) < 2:
            return 360.0

        azimuths = []
        for st in stations:
            _, az, _ = gps2dist_azimuth(event_lat, event_lon, st.latitude, st.longitude)
            azimuths.append(az)

        azimuths.sort()
        azimuths.append(azimuths[0] + 360.0)

        gaps = [azimuths[i + 1] - azimuths[i] for i in range(len(azimuths) - 1)]
        return float(max(gaps))

    def _locate_intersection(self, p_picks: list[Pick], stations: list[Station]) -> LocationResult:
        if len(p_picks) < 3:
            ref_pick = min(p_picks, key=lambda p: p.arrival_time)
            ref_station = next((s for s in stations if s.id == ref_pick.station_id), None)
            if ref_station is None:
                return LocationResult(
                    latitude=0.0, longitude=0.0, depth=10.0,
                    origin_time=ref_pick.arrival_time,
                    latitude_uncertainty=1.0, longitude_uncertainty=1.0,
                    depth_uncertainty=5.0, num_stations=len(stations),
                    azimuth_gap=360.0, method="single_station"
                )
            return LocationResult(
                latitude=ref_station.latitude, longitude=ref_station.longitude, depth=10.0,
                origin_time=ref_pick.arrival_time - timedelta(seconds=10.0 / self._vp),
                latitude_uncertainty=0.5, longitude_uncertainty=0.5,
                depth_uncertainty=5.0, num_stations=len(stations),
                azimuth_gap=360.0, method="station_centroid"
            )

        origin_times = []
        lats = []
        lons = []

        for i in range(len(p_picks)):
            for j in range(i + 1, len(p_picks)):
                for k in range(j + 1, len(p_picks)):
                    p1, p2, p3 = p_picks[i], p_picks[j], p_picks[k]
                    s1 = next((s for s in stations if s.id == p1.station_id), None)
                    s2 = next((s for s in stations if s.id == p2.station_id), None)
                    s3 = next((s for s in stations if s.id == p3.station_id), None)

                    if not s1 or not s2 or not s3:
                        continue

                    t12 = (p2.arrival_time - p1.arrival_time).total_seconds()
                    t13 = (p3.arrival_time - p1.arrival_time).total_seconds()

                    d12 = degrees2kilometers(gps2dist_azimuth(s1.latitude, s1.longitude,
                                                             s2.latitude, s2.longitude)[0] / 1000.0)
                    d13 = degrees2kilometers(gps2dist_azimuth(s1.latitude, s1.longitude,
                                                             s3.latitude, s3.longitude)[0] / 1000.0)

                    d12_max = abs(t12) * self._vp + 0.1
                    d13_max = abs(t13) * self._vp + 0.1

                    mid_lat = (s1.latitude + s2.latitude + s3.latitude) / 3.0
                    mid_lon = (s1.longitude + s2.longitude + s3.longitude) / 3.0

                    r12 = t12 * self._vp
                    r13 = t13 * self._vp

                    w1 = 1.0 / (d12 + 1)
                    w2 = 1.0 / (d13 + 1)

                    lat = (s1.latitude + w1 * s2.latitude + w2 * s3.latitude) / (1 + w1 + w2)
                    lon = (s1.longitude + w1 * s2.longitude + w2 * s3.longitude) / (1 + w1 + w2)

                    dist1 = degrees2kilometers(gps2dist_azimuth(s1.latitude, s1.longitude, lat, lon)[0] / 1000.0)
                    origin_time = p1.arrival_time - timedelta(seconds=dist1 / self._vp)

                    origin_times.append(origin_time)
                    lats.append(lat)
                    lons.append(lon)

        if not lats:
            ref_pick = min(p_picks, key=lambda p: p.arrival_time)
            ref_station = next((s for s in stations if s.id == ref_pick.station_id), None)
            if ref_station:
                return LocationResult(
                    latitude=ref_station.latitude,
                    longitude=ref_station.longitude,
                    depth=10.0,
                    origin_time=ref_pick.arrival_time - timedelta(seconds=10.0 / self._vp),
                    latitude_uncertainty=0.5,
                    longitude_uncertainty=0.5,
                    depth_uncertainty=5.0,
                    num_stations=len(stations),
                    azimuth_gap=360.0,
                    method="fallback"
                )

        mean_lat = float(np.mean(lats))
        mean_lon = float(np.mean(lons))
        std_lat = float(np.std(lats)) if len(lats) > 1 else 0.2
        std_lon = float(np.std(lons)) if len(lons) > 1 else 0.2

        if len(origin_times) > 1:
            ts = [(ot - origin_times[0]).total_seconds() for ot in origin_times]
            mean_ot = origin_times[0] + timedelta(seconds=float(np.mean(ts)))
        else:
            mean_ot = origin_times[0]

        residuals = []
        for p, s in zip(p_picks, stations):
            dist_km = degrees2kilometers(
                gps2dist_azimuth(s.latitude, s.longitude, mean_lat, mean_lon)[0] / 1000.0
            )
            expected_t = mean_ot + timedelta(seconds=dist_km / self._vp)
            residual = (p.arrival_time - expected_t).total_seconds()
            residuals.append(residual)

        azimuth_gap = self._calculate_azimuth_gap(stations, mean_lat, mean_lon)

        return LocationResult(
            latitude=mean_lat,
            longitude=mean_lon,
            depth=10.0,
            origin_time=mean_ot,
            latitude_uncertainty=max(std_lat, 0.05),
            longitude_uncertainty=max(std_lon, 0.05),
            depth_uncertainty=5.0,
            num_stations=len(stations),
            azimuth_gap=azimuth_gap,
            residuals=residuals,
            method="intersection"
        )

    def locate_event(self, event_id: int) -> Optional[LocationResult]:
        with self.db.get_session() as session:
            event = session.query(Event).filter(Event.id == event_id).first()
            if not event:
                logger.warning(f"[yellow]Event {event_id} not found[/yellow]")
                return None

            p_picks = session.query(Pick).filter(
                Pick.event_id == event_id,
                Pick.phase == "P"
            ).order_by(Pick.arrival_time).all()

            if len(p_picks) == 0:
                logger.warning(f"[yellow]No P picks for event {event_id}[/yellow]")
                return None

            station_ids = [p.station_id for p in p_picks]
            stations = session.query(Station).filter(Station.id.in_(station_ids)).all()

            if len(stations) == 0:
                logger.warning(f"[yellow]No stations found for event {event_id}[/yellow]")
                return None

            stations_by_id = {s.id: s for s in stations}
            ordered_stations = [stations_by_id[pid] for pid in station_ids if pid in stations_by_id]
            ordered_picks = [p for p in p_picks if p.station_id in stations_by_id]

            return self._locate_intersection(ordered_picks, ordered_stations)

    def process_event(self, event_id: int, analyst: str = "automatic",
                      status: str = "preliminary") -> Optional[CatalogEntry]:
        location = self.locate_event(event_id)
        if location is None:
            return None

        magnitude = self.calculate_magnitude(event_id)

        with self.db.get_session() as session:
            existing = session.query(CatalogEntry).filter(
                CatalogEntry.event_id == event_id
            ).first()

            if existing:
                existing.origin_time = location.origin_time
                existing.latitude = location.latitude
                existing.longitude = location.longitude
                existing.depth = location.depth
                existing.latitude_uncertainty = location.latitude_uncertainty
                existing.longitude_uncertainty = location.longitude_uncertainty
                existing.depth_uncertainty = location.depth_uncertainty
                existing.magnitude = magnitude.ml
                existing.magnitude_type = "ML"
                existing.magnitude_uncertainty = magnitude.uncertainty
                existing.num_stations = location.num_stations
                existing.azimuth_gap = location.azimuth_gap
                existing.location_method = location.method
                existing.status = status
                existing.analyst = analyst

                max_version = session.query(CatalogVersion).filter(
                    CatalogVersion.catalog_id == existing.id
                ).order_by(CatalogVersion.version.desc()).first()
                next_version = (max_version.version + 1) if max_version else 1

                version = CatalogVersion(
                    catalog_id=existing.id,
                    version=next_version,
                    origin_time=location.origin_time,
                    latitude=location.latitude,
                    longitude=location.longitude,
                    depth=location.depth,
                    magnitude=magnitude.ml,
                    magnitude_type="ML",
                    status=status,
                    analyst=analyst,
                    change_description=f"Automatic relocation by {location.method}"
                )
                session.add(version)

                logger.info(
                    f"[green]Updated catalog entry for event {event_id}: "
                    f"M{magnitude.ml:.2f} at {location.latitude:.4f}, {location.longitude:.4f}[/green]"
                )
                return existing
            else:
                entry = CatalogEntry(
                    event_id=event_id,
                    origin_time=location.origin_time,
                    latitude=location.latitude,
                    longitude=location.longitude,
                    depth=location.depth,
                    latitude_uncertainty=location.latitude_uncertainty,
                    longitude_uncertainty=location.longitude_uncertainty,
                    depth_uncertainty=location.depth_uncertainty,
                    magnitude=magnitude.ml,
                    magnitude_type="ML",
                    magnitude_uncertainty=magnitude.uncertainty,
                    num_stations=location.num_stations,
                    azimuth_gap=location.azimuth_gap,
                    location_method=location.method,
                    status=status,
                    analyst=analyst
                )
                session.add(entry)
                session.flush()

                version = CatalogVersion(
                    catalog_id=entry.id,
                    version=1,
                    origin_time=location.origin_time,
                    latitude=location.latitude,
                    longitude=location.longitude,
                    depth=location.depth,
                    magnitude=magnitude.ml,
                    magnitude_type="ML",
                    status=status,
                    analyst=analyst,
                    change_description="Initial automatic location"
                )
                session.add(version)

                logger.info(
                    f"[green]Created catalog entry for event {event_id}: "
                    f"M{magnitude.ml:.2f} at {location.latitude:.4f}, {location.longitude:.4f}[/green]"
                )
                return entry

    def process_all(self, start_time: Optional[str] = None,
                    end_time: Optional[str] = None,
                    min_picks: int = 3) -> dict:
        with self.db.get_session() as session:
            query = session.query(Event)
            if start_time:
                st = datetime.strptime(start_time, "%Y-%m-%d")
                query = query.filter(Event.start_time >= st)
            if end_time:
                et = datetime.strptime(end_time, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(Event.start_time < et)

            events = query.all()

        results = {
            "total_events": len(events),
            "processed": 0,
            "failed": 0,
            "catalog_entries": []
        }

        from rich.progress import (
            Progress, SpinnerColumn, TextColumn, BarColumn,
            TaskProgressColumn, TimeRemainingColumn
        )

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            task = progress.add_task(
                "[cyan]Processing events...",
                total=len(events)
            )

            for event in events:
                try:
                    with self.db.get_session() as s:
                        num_picks = s.query(Pick).filter(
                            Pick.event_id == event.id,
                            Pick.phase == "P"
                        ).count()

                    if num_picks < min_picks:
                        results["failed"] += 1
                        progress.update(task, advance=1)
                        continue

                    entry = self.process_event(event.id)
                    if entry:
                        results["processed"] += 1
                        results["catalog_entries"].append({
                            "event_id": event.event_id,
                            "magnitude": entry.magnitude,
                            "latitude": entry.latitude,
                            "longitude": entry.longitude
                        })
                    else:
                        results["failed"] += 1

                    progress.update(task, advance=1)

                except Exception as e:
                    logger.error(f"[red]Failed processing event {event.id}: {e}[/red]")
                    results["failed"] += 1
                    progress.update(task, advance=1)

        logger.info(
            f"[green]Location processing complete:[/green] "
            f"{results['processed']} processed, {results['failed']} failed"
        )

        return results

    def show_catalog(self, start_time: Optional[str] = None,
                     end_time: Optional[str] = None,
                     min_magnitude: Optional[float] = None,
                     limit: int = 100):
        with self.db.get_session() as session:
            query = session.query(CatalogEntry)
            if start_time:
                st = datetime.strptime(start_time, "%Y-%m-%d")
                query = query.filter(CatalogEntry.origin_time >= st)
            if end_time:
                et = datetime.strptime(end_time, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(CatalogEntry.origin_time < et)
            if min_magnitude is not None:
                query = query.filter(CatalogEntry.magnitude >= min_magnitude)

            entries = query.order_by(CatalogEntry.origin_time.desc()).limit(limit).all()

            table = Table(
                title=f"Earthquake Catalog ({len(entries)})",
                show_header=True,
                header_style="bold cyan"
            )
            table.add_column("#", justify="right", style="dim")
            table.add_column("Origin Time", style="bold")
            table.add_column("Lat", justify="right")
            table.add_column("Lon", justify="right")
            table.add_column("Depth(km)", justify="right")
            table.add_column("Mag", justify="right")
            table.add_column("#Sta", justify="right")
            table.add_column("Gap", justify="right")
            table.add_column("Status")
            table.add_column("Analyst")

            for i, entry in enumerate(entries, 1):
                mag_color = "green" if entry.magnitude < 3 else "yellow" if entry.magnitude < 5 else "red"
                status_color = "green" if entry.status == "final" else "yellow" if entry.status == "preliminary" else "dim"

                table.add_row(
                    str(i),
                    entry.origin_time.strftime("%Y-%m-%d %H:%M:%S"),
                    f"{entry.latitude:.4f}",
                    f"{entry.longitude:.4f}",
                    f"{entry.depth:.1f}",
                    f"[{mag_color}]{entry.magnitude:.2f}[/{mag_color}]",
                    str(entry.num_stations or 0),
                    f"{entry.azimuth_gap:.1f}" if entry.azimuth_gap else "",
                    f"[{status_color}]{entry.status}[/{status_color}]",
                    entry.analyst or ""
                )

            console.print(table)


def get_location_engine(config_path: Optional[str] = None) -> LocationEngine:
    return LocationEngine(config_path)
