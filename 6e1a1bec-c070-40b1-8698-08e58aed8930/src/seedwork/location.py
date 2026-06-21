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
    error_ellipse_major_km: float = 0.0
    error_ellipse_minor_km: float = 0.0
    error_ellipse_azimuth: float = 0.0
    covariance_matrix: list[list[float]] = field(default_factory=list)


class LocationEngine:
    def __init__(self, config_path: Optional[str] = None):
        self.db = Database()
        self._vp = 6.0
        self._vs = 3.5
        self._vp_vs_ratio = self._vp / self._vs

    def _latlon_to_xy(self, lat: float, lon: float,
                      ref_lat: float, ref_lon: float) -> tuple[float, float]:
        km_per_deg_lat = degrees2kilometers(1.0)
        km_per_deg_lon = degrees2kilometers(1.0) * math.cos(math.radians(ref_lat))
        x = (lon - ref_lon) * km_per_deg_lon
        y = (lat - ref_lat) * km_per_deg_lat
        return x, y

    def _xy_to_latlon(self, x: float, y: float,
                      ref_lat: float, ref_lon: float) -> tuple[float, float]:
        km_per_deg_lat = degrees2kilometers(1.0)
        km_per_deg_lon = degrees2kilometers(1.0) * math.cos(math.radians(ref_lat))
        lat = ref_lat + y / km_per_deg_lat
        lon = ref_lon + x / km_per_deg_lon
        return lat, lon

    def _compute_travel_time_residuals(self, x: float, y: float, origin_time: float,
                                       stations_xy: list[tuple[float, float]],
                                       observed_times: list[float]) -> list[float]:
        residuals = []
        for (sx, sy), t_obs in zip(stations_xy, observed_times):
            dist = math.sqrt((x - sx) ** 2 + (y - sy) ** 2)
            t_pred = origin_time + dist / self._vp
            residuals.append(t_obs - t_pred)
        return residuals

    def _compute_objective(self, params: tuple[float, float, float],
                           stations_xy: list[tuple[float, float]],
                           observed_times: list[float]) -> float:
        x, y, t0 = params
        residuals = self._compute_travel_time_residuals(x, y, t0, stations_xy, observed_times)
        return sum(r ** 2 for r in residuals)

    def _compute_covariance(self, x: float, y: float, t0: float,
                            stations_xy: list[tuple[float, float]],
                            observed_times: list[float]) -> np.ndarray:
        n = len(stations_xy)
        m = 3
        G = np.zeros((n, m))

        for i, (sx, sy) in enumerate(stations_xy):
            dist = math.sqrt((x - sx) ** 2 + (y - sy) ** 2)
            if dist < 0.001:
                dist = 0.001
            G[i, 0] = (x - sx) / (dist * self._vp)
            G[i, 1] = (y - sy) / (dist * self._vp)
            G[i, 2] = 1.0

        residuals = self._compute_travel_time_residuals(x, y, t0, stations_xy, observed_times)
        s2 = sum(r ** 2 for r in residuals) / max(1, n - m)

        GtG_inv = np.linalg.pinv(G.T @ G)
        covariance = s2 * GtG_inv
        return covariance

    def _compute_error_ellipse(self, covariance: np.ndarray) -> tuple[float, float, float]:
        if covariance.shape[0] < 2 or covariance.shape[1] < 2:
            return 0.0, 0.0, 0.0

        cov_xy = covariance[:2, :2]
        try:
            eigenvalues, eigenvectors = np.linalg.eigh(cov_xy)
            eigenvalues = np.sort(eigenvalues)[::-1]

            major_axis = math.sqrt(max(eigenvalues[0], 0)) * 1.96
            minor_axis = math.sqrt(max(eigenvalues[1], 0)) * 1.96

            if eigenvalues[0] == eigenvalues[1]:
                azimuth = 0.0
            else:
                idx = np.argmax(eigenvalues)
                major_vec = eigenvectors[:, idx]
                azimuth = math.degrees(math.atan2(major_vec[0], major_vec[1]))
                if azimuth < 0:
                    azimuth += 360.0

            return major_axis, minor_axis, azimuth
        except Exception:
            return 0.0, 0.0, 0.0

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

        ref_lat = float(np.mean([s.latitude for s in stations]))
        ref_lon = float(np.mean([s.longitude for s in stations]))

        stations_xy = []
        observed_times = []
        first_time = min(p.arrival_time for p in p_picks)

        for pick, station in zip(p_picks, stations):
            x, y = self._latlon_to_xy(station.latitude, station.longitude, ref_lat, ref_lon)
            stations_xy.append((x, y))
            t_rel = (pick.arrival_time - first_time).total_seconds()
            observed_times.append(t_rel)

        x_coords = [s[0] for s in stations_xy]
        y_coords = [s[1] for s in stations_xy]
        x_min, x_max = min(x_coords) - 100.0, max(x_coords) + 100.0
        y_min, y_max = min(y_coords) - 100.0, max(y_coords) + 100.0

        best_obj = float("inf")
        best_params = (0.0, 0.0, 0.0)

        coarse_step = 5.0
        for x in np.arange(x_min, x_max + coarse_step, coarse_step):
            for y in np.arange(y_min, y_max + coarse_step, coarse_step):
                for t0_idx in range(-20, 21):
                    t0 = -5.0 + t0_idx * 0.5
                    obj = self._compute_objective((x, y, t0), stations_xy, observed_times)
                    if obj < best_obj:
                        best_obj = obj
                        best_params = (x, y, t0)

        fine_steps = [1.0, 0.2, 0.05]
        for step in fine_steps:
            bx, by, bt0 = best_params
            best_local_obj = best_obj
            best_local_params = best_params
            for dx in [-step, 0.0, step]:
                for dy in [-step, 0.0, step]:
                    for dt0 in [-step / 10.0, 0.0, step / 10.0]:
                        if dx == 0 and dy == 0 and dt0 == 0:
                            continue
                        params = (bx + dx, by + dy, bt0 + dt0)
                        obj = self._compute_objective(params, stations_xy, observed_times)
                        if obj < best_local_obj:
                            best_local_obj = obj
                            best_local_params = params
            if best_local_obj < best_obj:
                best_obj = best_local_obj
                best_params = best_local_params
            else:
                break

        best_x, best_y, best_t0 = best_params

        residuals = self._compute_travel_time_residuals(
            best_x, best_y, best_t0, stations_xy, observed_times
        )

        covariance = self._compute_covariance(
            best_x, best_y, best_t0, stations_xy, observed_times
        )

        major_km, minor_km, azimuth = self._compute_error_ellipse(covariance)

        lat_uncert_km = math.sqrt(covariance[1, 1]) if covariance.shape[0] > 1 else 5.0
        lon_uncert_km = math.sqrt(covariance[0, 0]) if covariance.shape[0] > 0 else 5.0

        km_per_deg_lat = degrees2kilometers(1.0)
        km_per_deg_lon = degrees2kilometers(1.0) * math.cos(math.radians(ref_lat))
        lat_uncertainty = lat_uncert_km / km_per_deg_lat
        lon_uncertainty = lon_uncert_km / km_per_deg_lon

        best_lat, best_lon = self._xy_to_latlon(best_x, best_y, ref_lat, ref_lon)
        origin_time = first_time + timedelta(seconds=best_t0)

        azimuth_gap = self._calculate_azimuth_gap(stations, best_lat, best_lon)

        cov_matrix = covariance.tolist() if covariance.size > 0 else []

        return LocationResult(
            latitude=best_lat,
            longitude=best_lon,
            depth=10.0,
            origin_time=origin_time,
            latitude_uncertainty=max(abs(lat_uncertainty), 0.001),
            longitude_uncertainty=max(abs(lon_uncertainty), 0.001),
            depth_uncertainty=5.0,
            num_stations=len(stations),
            azimuth_gap=azimuth_gap,
            residuals=residuals,
            method="hyperbolic_intersection",
            error_ellipse_major_km=float(major_km),
            error_ellipse_minor_km=float(minor_km),
            error_ellipse_azimuth=float(azimuth),
            covariance_matrix=cov_matrix
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
