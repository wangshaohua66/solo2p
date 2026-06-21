import csv
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from rich.table import Table
from sqlalchemy import and_, or_

from .db import Database, Event, Pick, CatalogEntry, CatalogVersion, Station
from .logger import get_logger, get_console

logger = get_logger()
console = get_console()


class CatalogManager:
    def __init__(self, config_path: Optional[str] = None):
        self.db = Database()

    def add_entry(self, event_id: str, origin_time: datetime,
                  latitude: float, longitude: float, depth: float,
                  magnitude: float, magnitude_type: str = "ML",
                  status: str = "preliminary", analyst: str = "manual",
                  comments: Optional[str] = None) -> Optional[CatalogEntry]:
        with self.db.get_session() as session:
            event = session.query(Event).filter(
                Event.event_id == event_id
            ).first()
            if not event:
                logger.warning(f"[yellow]Event {event_id} not found[/yellow]")
                return None

            existing = session.query(CatalogEntry).filter(
                CatalogEntry.event_id == event.id
            ).first()
            if existing:
                logger.warning(
                    f"[yellow]Catalog entry already exists for event {event_id}[/yellow]"
                )
                _ = existing.id, existing.event_id, existing.origin_time, existing.latitude
                _ = existing.longitude, existing.depth, existing.magnitude, existing.magnitude_type
                _ = existing.status, existing.analyst, existing.comments
                _ = existing.num_stations, existing.azimuth_gap, existing.location_method
                _ = existing.magnitude_uncertainty, existing.created_at, existing.updated_at
                session.expunge(existing)
                return existing

            entry = CatalogEntry(
                event_id=event.id,
                origin_time=origin_time,
                latitude=latitude,
                longitude=longitude,
                depth=depth,
                magnitude=magnitude,
                magnitude_type=magnitude_type,
                status=status,
                analyst=analyst,
                comments=comments
            )
            session.add(entry)
            session.flush()

            version = CatalogVersion(
                catalog_id=entry.id,
                version=1,
                origin_time=origin_time,
                latitude=latitude,
                longitude=longitude,
                depth=depth,
                magnitude=magnitude,
                magnitude_type=magnitude_type,
                status=status,
                analyst=analyst,
                comments=comments,
                change_description="Manual entry creation"
            )
            session.add(version)

            logger.info(
                f"[green]Created catalog entry:[/green] M{magnitude:.2f} "
                f"at {origin_time.strftime('%Y-%m-%d %H:%M:%S')}"
            )
            session.commit()
            session.refresh(entry)
            _ = entry.id, entry.event_id, entry.origin_time, entry.latitude
            _ = entry.longitude, entry.depth, entry.magnitude, entry.magnitude_type
            _ = entry.status, entry.analyst, entry.comments, entry.num_stations
            _ = entry.azimuth_gap, entry.location_method, entry.magnitude_uncertainty
            _ = entry.created_at, entry.updated_at
            session.expunge(entry)
            return entry

    def update_entry(self, catalog_id: int, analyst: str,
                     change_description: str, **kwargs) -> Optional[CatalogEntry]:
        with self.db.get_session() as session:
            entry = session.query(CatalogEntry).filter(
                CatalogEntry.id == catalog_id
            ).first()
            if not entry:
                logger.warning(f"[yellow]Catalog entry {catalog_id} not found[/yellow]")
                return None

            max_version = session.query(CatalogVersion).filter(
                CatalogVersion.catalog_id == entry.id
            ).order_by(CatalogVersion.version.desc()).first()
            next_version = (max_version.version + 1) if max_version else 1

            version_kwargs = {}
            for key, value in kwargs.items():
                if hasattr(entry, key):
                    setattr(entry, key, value)
                    version_kwargs[key] = value

            entry.analyst = analyst
            entry.updated_at = datetime.utcnow()

            version = CatalogVersion(
                catalog_id=entry.id,
                version=next_version,
                origin_time=version_kwargs.get("origin_time", entry.origin_time),
                latitude=version_kwargs.get("latitude", entry.latitude),
                longitude=version_kwargs.get("longitude", entry.longitude),
                depth=version_kwargs.get("depth", entry.depth),
                magnitude=version_kwargs.get("magnitude", entry.magnitude),
                magnitude_type=version_kwargs.get("magnitude_type", entry.magnitude_type),
                status=version_kwargs.get("status", entry.status),
                analyst=analyst,
                comments=version_kwargs.get("comments", entry.comments),
                change_description=change_description
            )
            session.add(version)

            logger.info(
                f"[green]Updated catalog entry {catalog_id}[/green] "
                f"(v{next_version}): {change_description}"
            )
            session.commit()
            session.refresh(entry)
            _ = entry.id, entry.event_id, entry.origin_time, entry.latitude
            _ = entry.longitude, entry.depth, entry.magnitude, entry.magnitude_type
            _ = entry.status, entry.analyst, entry.comments, entry.num_stations
            _ = entry.azimuth_gap, entry.location_method, entry.magnitude_uncertainty
            _ = entry.created_at, entry.updated_at
            session.expunge(entry)
            return entry

    def delete_entry(self, catalog_id: int, analyst: str,
                     reason: str) -> bool:
        with self.db.get_session() as session:
            entry = session.query(CatalogEntry).filter(
                CatalogEntry.id == catalog_id
            ).first()
            if not entry:
                logger.warning(f"[yellow]Catalog entry {catalog_id} not found[/yellow]")
                return False

            version_history = []
            for v in entry.versions:
                version_history.append({
                    "version": v.version,
                    "origin_time": v.origin_time,
                    "latitude": v.latitude,
                    "longitude": v.longitude,
                    "depth": v.depth,
                    "magnitude": v.magnitude,
                    "magnitude_type": v.magnitude_type,
                    "status": v.status,
                    "analyst": v.analyst,
                    "comments": v.comments,
                    "change_description": v.change_description,
                    "created_at": v.created_at
                })

            max_version = max((v.version for v in entry.versions), default=0)
            next_version = max_version + 1

            entry.status = "deleted"
            entry.analyst = analyst
            entry.updated_at = datetime.utcnow()

            version = CatalogVersion(
                catalog_id=entry.id,
                version=next_version,
                origin_time=entry.origin_time,
                latitude=entry.latitude,
                longitude=entry.longitude,
                depth=entry.depth,
                magnitude=entry.magnitude,
                magnitude_type=entry.magnitude_type,
                status="deleted",
                analyst=analyst,
                change_description=f"DELETED: {reason}"
            )
            session.add(version)

            logger.info(
                f"[red]Soft-deleted catalog entry {catalog_id}[/red]: {reason}"
            )
            return True

    def get_entry(self, catalog_id: Optional[int] = None,
                  event_id: Optional[str] = None) -> Optional[CatalogEntry]:
        with self.db.get_session() as session:
            entry = None
            if catalog_id is not None:
                entry = session.query(CatalogEntry).filter(
                    CatalogEntry.id == catalog_id
                ).first()
            elif event_id is not None:
                event = session.query(Event).filter(
                    Event.event_id == event_id
                ).first()
                if event:
                    entry = session.query(CatalogEntry).filter(
                        CatalogEntry.event_id == event.id
                    ).first()
            if entry:
                _ = entry.id, entry.event_id, entry.origin_time, entry.latitude
                _ = entry.longitude, entry.depth, entry.magnitude, entry.magnitude_type
                _ = entry.status, entry.analyst, entry.comments, entry.num_stations
                _ = entry.azimuth_gap, entry.location_method, entry.magnitude_uncertainty
                _ = entry.created_at, entry.updated_at
                session.expunge(entry)
            return entry

    def search(self, start_time: Optional[str] = None,
               end_time: Optional[str] = None,
               min_magnitude: Optional[float] = None,
               max_magnitude: Optional[float] = None,
               min_latitude: Optional[float] = None,
               max_latitude: Optional[float] = None,
               min_longitude: Optional[float] = None,
               max_longitude: Optional[float] = None,
               status: Optional[str] = None,
               station: Optional[str] = None,
               include_deleted: bool = False,
               limit: int = 10000) -> list[CatalogEntry]:
        with self.db.get_session() as session:
            query = session.query(CatalogEntry)

            if not include_deleted:
                query = query.filter(CatalogEntry.status != "deleted")

            if start_time:
                st = datetime.strptime(start_time, "%Y-%m-%d")
                query = query.filter(CatalogEntry.origin_time >= st)
            if end_time:
                et = datetime.strptime(end_time, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(CatalogEntry.origin_time < et)
            if min_magnitude is not None:
                query = query.filter(CatalogEntry.magnitude >= min_magnitude)
            if max_magnitude is not None:
                query = query.filter(CatalogEntry.magnitude <= max_magnitude)
            if min_latitude is not None:
                query = query.filter(CatalogEntry.latitude >= min_latitude)
            if max_latitude is not None:
                query = query.filter(CatalogEntry.latitude <= max_latitude)
            if min_longitude is not None:
                query = query.filter(CatalogEntry.longitude >= min_longitude)
            if max_longitude is not None:
                query = query.filter(CatalogEntry.longitude <= max_longitude)
            if status:
                query = query.filter(CatalogEntry.status == status)
            if station:
                query = query.join(Event).join(Pick).join(Station)
                if "." in station:
                    net, sta = station.split(".", 1)
                    query = query.filter(
                        (Station.network == net) & (Station.station == sta)
                    )
                else:
                    query = query.filter(Station.station == station)

            entries = query.order_by(CatalogEntry.origin_time.desc()).limit(limit).all()
            for entry in entries:
                _ = entry.id, entry.event_id, entry.origin_time, entry.latitude
                _ = entry.longitude, entry.depth, entry.magnitude, entry.magnitude_type
                _ = entry.status, entry.analyst, entry.comments, entry.num_stations
                _ = entry.azimuth_gap, entry.location_method, entry.magnitude_uncertainty
                _ = entry.created_at, entry.updated_at
                session.expunge(entry)
            return entries

    def get_version_history(self, catalog_id: int) -> list[CatalogVersion]:
        with self.db.get_session() as session:
            versions = session.query(CatalogVersion).filter(
                CatalogVersion.catalog_id == catalog_id
            ).order_by(CatalogVersion.version).all()
            for v in versions:
                _ = v.id, v.catalog_id, v.version, v.origin_time, v.latitude
                _ = v.longitude, v.depth, v.magnitude, v.magnitude_type
                _ = v.status, v.analyst, v.comments, v.change_description
                _ = v.created_at
                session.expunge(v)
            return versions

    def revert_to_version(self, catalog_id: int, version: int,
                          analyst: str, reason: str) -> Optional[CatalogEntry]:
        with self.db.get_session() as session:
            target_version = session.query(CatalogVersion).filter(
                CatalogVersion.catalog_id == catalog_id,
                CatalogVersion.version == version
            ).first()
            if not target_version:
                logger.warning(
                    f"[yellow]Version {version} for catalog {catalog_id} not found[/yellow]"
                )
                return None

            entry = session.query(CatalogEntry).filter(
                CatalogEntry.id == catalog_id
            ).first()
            if not entry:
                logger.warning(f"[yellow]Catalog entry {catalog_id} not found[/yellow]")
                return None

            max_version = session.query(CatalogVersion).filter(
                CatalogVersion.catalog_id == entry.id
            ).order_by(CatalogVersion.version.desc()).first()
            next_version = (max_version.version + 1) if max_version else 1

            entry.origin_time = target_version.origin_time
            entry.latitude = target_version.latitude
            entry.longitude = target_version.longitude
            entry.depth = target_version.depth
            entry.magnitude = target_version.magnitude
            entry.magnitude_type = target_version.magnitude_type
            entry.status = target_version.status
            entry.comments = target_version.comments
            entry.analyst = analyst
            entry.updated_at = datetime.utcnow()

            new_version = CatalogVersion(
                catalog_id=entry.id,
                version=next_version,
                origin_time=target_version.origin_time,
                latitude=target_version.latitude,
                longitude=target_version.longitude,
                depth=target_version.depth,
                magnitude=target_version.magnitude,
                magnitude_type=target_version.magnitude_type,
                status=target_version.status,
                analyst=analyst,
                comments=target_version.comments,
                change_description=f"Reverted to v{version}: {reason}"
            )
            session.add(new_version)

            logger.info(
                f"[green]Reverted catalog {catalog_id} to v{version}[/green]"
            )
            session.commit()
            session.refresh(entry)
            _ = entry.id, entry.event_id, entry.origin_time, entry.latitude
            _ = entry.longitude, entry.depth, entry.magnitude, entry.magnitude_type
            _ = entry.status, entry.analyst, entry.comments, entry.num_stations
            _ = entry.azimuth_gap, entry.location_method, entry.magnitude_uncertainty
            _ = entry.created_at, entry.updated_at
            session.expunge(entry)
            return entry

    def show_entry_detail(self, catalog_id: Optional[int] = None,
                          event_id: Optional[str] = None):
        entry = self.get_entry(catalog_id, event_id)
        if not entry:
            console.print("[red]Catalog entry not found[/red]")
            return

        table = Table(
            title=f"Catalog Entry #{entry.id} - Event {entry.event.event_id}",
            show_header=False,
            header_style="bold cyan"
        )
        table.add_column("Field", style="bold cyan")
        table.add_column("Value")

        table.add_row("Origin Time", entry.origin_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3])
        table.add_row("Latitude", f"{entry.latitude:.6f}°")
        table.add_row("Longitude", f"{entry.longitude:.6f}°")
        table.add_row("Depth", f"{entry.depth:.2f} km")
        table.add_row("Lat Uncertainty", f"±{entry.latitude_uncertainty or 0:.3f}°")
        table.add_row("Lon Uncertainty", f"±{entry.longitude_uncertainty or 0:.3f}°")
        table.add_row("Depth Uncertainty", f"±{entry.depth_uncertainty or 0:.2f} km")
        table.add_row("Magnitude", f"M{entry.magnitude_type or 'L'} {entry.magnitude:.2f} ±{entry.magnitude_uncertainty or 0:.2f}")
        table.add_row("Stations", str(entry.num_stations or 0))
        table.add_row("Azimuth Gap", f"{entry.azimuth_gap or 0:.1f}°")
        table.add_row("Method", entry.location_method or "N/A")
        table.add_row("Status", entry.status or "N/A")
        table.add_row("Analyst", entry.analyst or "N/A")
        table.add_row("Created", entry.created_at.strftime("%Y-%m-%d %H:%M:%S"))
        table.add_row("Updated", entry.updated_at.strftime("%Y-%m-%d %H:%M:%S"))
        if entry.comments:
            table.add_row("Comments", entry.comments)

        console.print(table)

        if entry.event and entry.event.picks:
            picks_table = Table(
                title="Phase Picks",
                show_header=True,
                header_style="bold cyan"
            )
            picks_table.add_column("Station")
            picks_table.add_column("Phase")
            picks_table.add_column("Arrival Time")
            picks_table.add_column("Unc(s)", justify="right")
            picks_table.add_column("SNR(dB)", justify="right")
            picks_table.add_column("Amp", justify="right")
            picks_table.add_column("Algorithm")
            picks_table.add_column("Status")

            for pick in sorted(entry.event.picks, key=lambda p: p.arrival_time):
                status = "[green]REVIEWED[/green]" if pick.is_reviewed else "[yellow]AUTO[/yellow]"
                picks_table.add_row(
                    f"{pick.station.network}.{pick.station.station}" if pick.station else "Unknown",
                    pick.phase,
                    pick.arrival_time.strftime("%H:%M:%S.%f")[:-3],
                    f"{pick.uncertainty or 0:.3f}",
                    f"{pick.snr or 0:.1f}",
                    f"{pick.amplitude or 0:.2e}",
                    pick.algorithm or "N/A",
                    status
                )

            console.print(picks_table)

    def show_version_history(self, catalog_id: int):
        versions = self.get_version_history(catalog_id)
        if not versions:
            console.print("[red]No version history found[/red]")
            return

        table = Table(
            title=f"Version History - Catalog #{catalog_id}",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("V", justify="right")
        table.add_column("Time", style="dim")
        table.add_column("Origin")
        table.add_column("Lat", justify="right")
        table.add_column("Lon", justify="right")
        table.add_column("Mag", justify="right")
        table.add_column("Status")
        table.add_column("Analyst")
        table.add_column("Description")

        for v in versions:
            table.add_row(
                str(v.version),
                v.created_at.strftime("%Y-%m-%d %H:%M"),
                v.origin_time.strftime("%H:%M:%S") if v.origin_time else "",
                f"{v.latitude:.3f}" if v.latitude is not None else "",
                f"{v.longitude:.3f}" if v.longitude is not None else "",
                f"{v.magnitude:.2f}" if v.magnitude is not None else "",
                v.status or "",
                v.analyst or "",
                v.change_description or ""
            )

        console.print(table)

    def export_to_csv(self, filepath: str, start_time: Optional[str] = None,
                      end_time: Optional[str] = None,
                      min_magnitude: Optional[float] = None) -> int:
        entries = self.search(
            start_time=start_time,
            end_time=end_time,
            min_magnitude=min_magnitude,
            limit=100000
        )

        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "EventID", "OriginTime", "Latitude", "Longitude",
                "Depth(km)", "Magnitude", "MagnitudeType", "NumStations",
                "AzimuthGap", "Status", "Analyst", "CreatedAt", "UpdatedAt",
                "Comments"
            ])

            for entry in entries:
                writer.writerow([
                    entry.id,
                    entry.event.event_id if entry.event else "",
                    entry.origin_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3],
                    f"{entry.latitude:.6f}",
                    f"{entry.longitude:.6f}",
                    f"{entry.depth:.3f}",
                    f"{entry.magnitude:.3f}",
                    entry.magnitude_type or "",
                    entry.num_stations or "",
                    f"{entry.azimuth_gap:.1f}" if entry.azimuth_gap else "",
                    entry.status or "",
                    entry.analyst or "",
                    entry.created_at.strftime("%Y-%m-%dT%H:%M:%S"),
                    entry.updated_at.strftime("%Y-%m-%dT%H:%M:%S"),
                    entry.comments or ""
                ])

        logger.info(f"[green]Exported {len(entries)} entries to {filepath}[/green]")
        return len(entries)

    def get_statistics(self, start_time: Optional[str] = None,
                       end_time: Optional[str] = None) -> dict:
        entries = self.search(
            start_time=start_time,
            end_time=end_time,
            limit=100000
        )

        if not entries:
            return {"count": 0}

        mags = [e.magnitude for e in entries if e.magnitude is not None]
        stats = {
            "count": len(entries),
            "min_magnitude": min(mags) if mags else 0,
            "max_magnitude": max(mags) if mags else 0,
            "avg_magnitude": sum(mags) / len(mags) if mags else 0,
            "by_status": {},
            "by_magnitude_range": {
                "<2": 0, "2-3": 0, "3-4": 0, "4-5": 0, "5-6": 0, ">=6": 0
            }
        }

        for e in entries:
            s = e.status or "unknown"
            stats["by_status"][s] = stats["by_status"].get(s, 0) + 1

            if e.magnitude is not None:
                if e.magnitude < 2:
                    stats["by_magnitude_range"]["<2"] += 1
                elif e.magnitude < 3:
                    stats["by_magnitude_range"]["2-3"] += 1
                elif e.magnitude < 4:
                    stats["by_magnitude_range"]["3-4"] += 1
                elif e.magnitude < 5:
                    stats["by_magnitude_range"]["4-5"] += 1
                elif e.magnitude < 6:
                    stats["by_magnitude_range"]["5-6"] += 1
                else:
                    stats["by_magnitude_range"][">=6"] += 1

        return stats


def get_catalog_manager(config_path: Optional[str] = None) -> CatalogManager:
    return CatalogManager(config_path)
