import json
import os
from datetime import datetime, timedelta
from typing import Optional

from rich.table import Table
from sqlalchemy import func, and_

from .db import Database, Station, QualityMetric, DownloadRecord, load_config
from .logger import get_logger, get_console

logger = get_logger()
console = get_console()


class StationManager:
    def __init__(self, config_path: Optional[str] = None):
        self.config = load_config(config_path)
        self.db = Database()

    def init_stations_from_config(self) -> int:
        stations_config = self.config.get("stations", [])
        count = 0
        with self.db.get_session() as session:
            for st_cfg in stations_config:
                existing = session.query(Station).filter(
                    Station.network == st_cfg["network"],
                    Station.station == st_cfg["station"]
                ).first()

                if existing:
                    existing.location = st_cfg.get("location", "00")
                    existing.channels = ",".join(st_cfg.get("channels", []))
                    existing.latitude = st_cfg["latitude"]
                    existing.longitude = st_cfg["longitude"]
                    existing.elevation = st_cfg["elevation"]
                    existing.sample_rate = st_cfg.get("sample_rate", 100.0)
                    existing.sensor_type = st_cfg.get("sensor_type")
                    existing.ftp_host = st_cfg.get("ftp_host")
                    existing.ftp_port = st_cfg.get("ftp_port", 21)
                    existing.ftp_user = st_cfg.get("ftp_user")
                    existing.ftp_password = st_cfg.get("ftp_password")
                    existing.ftp_path = st_cfg.get("ftp_path")
                    existing.is_active = st_cfg.get("is_active", True)
                    logger.info(
                        f"[yellow]Updated station:[/yellow] "
                        f"{st_cfg['network']}.{st_cfg['station']}"
                    )
                else:
                    station = Station(
                        network=st_cfg["network"],
                        station=st_cfg["station"],
                        location=st_cfg.get("location", "00"),
                        channels=",".join(st_cfg.get("channels", [])),
                        latitude=st_cfg["latitude"],
                        longitude=st_cfg["longitude"],
                        elevation=st_cfg["elevation"],
                        sample_rate=st_cfg.get("sample_rate", 100.0),
                        sensor_type=st_cfg.get("sensor_type"),
                        ftp_host=st_cfg.get("ftp_host"),
                        ftp_port=st_cfg.get("ftp_port", 21),
                        ftp_user=st_cfg.get("ftp_user"),
                        ftp_password=st_cfg.get("ftp_password"),
                        ftp_path=st_cfg.get("ftp_path"),
                        is_active=st_cfg.get("is_active", True)
                    )
                    session.add(station)
                    logger.info(
                        f"[green]Added station:[/green] "
                        f"{st_cfg['network']}.{st_cfg['station']}"
                    )
                count += 1
        return count

    def add_station(self, network: str, station: str, latitude: float,
                    longitude: float, elevation: float,
                    location: str = "00", channels: list[str] = None,
                    sample_rate: float = 100.0, **kwargs) -> Station:
        with self.db.get_session() as session:
            existing = session.query(Station).filter(
                Station.network == network,
                Station.station == station
            ).first()
            if existing:
                raise ValueError(
                    f"Station {network}.{station} already exists"
                )

            st = Station(
                network=network,
                station=station,
                location=location,
                channels=",".join(channels or []),
                latitude=latitude,
                longitude=longitude,
                elevation=elevation,
                sample_rate=sample_rate,
                **kwargs
            )
            session.add(st)
            session.flush()
            logger.info(f"[green]Added station:[/green] {network}.{station}")
            return st

    def update_station(self, network: str, station: str, **kwargs) -> Optional[Station]:
        with self.db.get_session() as session:
            st = session.query(Station).filter(
                Station.network == network,
                Station.station == station
            ).first()
            if not st:
                logger.warning(f"[yellow]Station not found:[/yellow] {network}.{station}")
                return None

            for key, value in kwargs.items():
                if key == "channels" and isinstance(value, list):
                    value = ",".join(value)
                if hasattr(st, key):
                    setattr(st, key, value)

            logger.info(f"[green]Updated station:[/green] {network}.{station}")
            return st

    def get_station(self, network: str, station: str) -> Optional[Station]:
        with self.db.get_session() as session:
            st = session.query(Station).filter(
                Station.network == network,
                Station.station == station
            ).first()
            if st:
                _ = st.network, st.station, st.location, st.channels
                _ = st.latitude, st.longitude, st.elevation
                _ = st.sample_rate, st.sensor_type, st.is_active
                _ = st.ftp_host, st.ftp_port, st.ftp_user
                _ = st.ftp_path, st.created_at, st.updated_at
                session.expunge(st)
            return st

    def get_all_stations(self, active_only: bool = True) -> list[Station]:
        with self.db.get_session() as session:
            query = session.query(Station)
            if active_only:
                query = query.filter(Station.is_active == True)
            stations = query.order_by(Station.network, Station.station).all()
            for st in stations:
                _ = st.network, st.station, st.location, st.channels
                _ = st.latitude, st.longitude, st.elevation
                _ = st.sample_rate, st.sensor_type, st.is_active
                _ = st.ftp_host, st.ftp_port, st.ftp_user
                _ = st.ftp_path, st.created_at, st.updated_at
                session.expunge(st)
            return stations

    def get_station_health(self, network: str, station: str,
                           start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None) -> dict:
        if start_date is None:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

        st = self.get_station(network, station)
        if not st:
            return {}

        with self.db.get_session() as session:
            qm_query = session.query(QualityMetric).filter(
                QualityMetric.station_id == st.id,
                QualityMetric.date >= start_date,
                QualityMetric.date <= end_date
            )

            total_days = qm_query.count()
            if total_days == 0:
                return {"station": f"{network}.{station}", "total_days": 0}

            avg_continuity = session.query(
                func.avg(QualityMetric.continuity_rate)
            ).filter(QualityMetric.station_id == st.id,
                     QualityMetric.date >= start_date,
                     QualityMetric.date <= end_date).scalar() or 0

            avg_snr = session.query(
                func.avg(QualityMetric.snr_db)
            ).filter(QualityMetric.station_id == st.id,
                     QualityMetric.date >= start_date,
                     QualityMetric.date <= end_date).scalar() or 0

            alert_days = session.query(
                func.count(QualityMetric.id)
            ).filter(QualityMetric.station_id == st.id,
                     QualityMetric.date >= start_date,
                     QualityMetric.date <= end_date,
                     QualityMetric.has_alert == True).scalar() or 0

            dr_query = session.query(DownloadRecord).filter(
                DownloadRecord.station_id == st.id,
                DownloadRecord.start_time >= start_date,
                DownloadRecord.start_time <= end_date
            )
            total_downloads = dr_query.count()
            failed_downloads = dr_query.filter(
                DownloadRecord.is_valid == False
            ).count()

            return {
                "station": f"{network}.{station}",
                "total_days": total_days,
                "avg_continuity": float(avg_continuity),
                "avg_snr": float(avg_snr),
                "alert_days": int(alert_days),
                "availability": 100.0 - (alert_days / total_days * 100) if total_days > 0 else 0,
                "total_downloads": int(total_downloads),
                "failed_downloads": int(failed_downloads)
            }

    def get_station_availability_ranking(self, start_date: Optional[datetime] = None,
                                         end_date: Optional[datetime] = None,
                                         limit: int = 85) -> list[dict]:
        if start_date is None:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=30)

        stations = self.get_all_stations()
        rankings = []
        for st in stations:
            health = self.get_station_health(st.network, st.station, start_date, end_date)
            if health.get("total_days", 0) > 0:
                rankings.append(health)

        rankings.sort(key=lambda x: x.get("availability", 0), reverse=True)
        return rankings[:limit]

    def list_stations(self, active_only: bool = True):
        stations = self.get_all_stations(active_only)
        table = Table(
            title=f"Stations ({len(stations)})",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("Net", style="dim")
        table.add_column("Station", style="bold")
        table.add_column("Loc")
        table.add_column("Channels")
        table.add_column("Latitude", justify="right")
        table.add_column("Longitude", justify="right")
        table.add_column("Elev(m)", justify="right")
        table.add_column("SR(Hz)", justify="right")
        table.add_column("Status")

        for st in stations:
            status = "[green]ACTIVE[/green]" if st.is_active else "[red]INACTIVE[/red]"
            table.add_row(
                st.network,
                st.station,
                st.location,
                st.channels,
                f"{st.latitude:.4f}",
                f"{st.longitude:.4f}",
                f"{st.elevation:.1f}",
                f"{st.sample_rate:.0f}",
                status
            )

        console.print(table)

    def show_station_health(self, network: str, station: str,
                            start_date: Optional[str] = None,
                            end_date: Optional[str] = None):
        sd = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
        ed = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
        health = self.get_station_health(network, station, sd, ed)

        if not health:
            console.print(f"[red]No data found for {network}.{station}[/red]")
            return

        table = Table(
            title=f"Station Health: {health['station']}",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("Metric")
        table.add_column("Value", justify="right")

        for key, value in health.items():
            if key == "station":
                continue
            if isinstance(value, float):
                if key == "avg_continuity":
                    val_str = f"[green]{value*100:.2f}%[/green]" if value >= 0.95 else f"[red]{value*100:.2f}%[/red]"
                elif key == "avg_snr":
                    val_str = f"[green]{value:.2f} dB[/green]" if value >= 3 else f"[red]{value:.2f} dB[/red]"
                elif key == "availability":
                    val_str = f"[green]{value:.2f}%[/green]" if value >= 95 else f"[red]{value:.2f}%[/red]"
                else:
                    val_str = f"{value:.2f}"
            else:
                val_str = str(value)
            table.add_row(key.replace("_", " ").title(), val_str)

        console.print(table)

    def show_availability_ranking(self, start_date: Optional[str] = None,
                                  end_date: Optional[str] = None,
                                  limit: int = 85):
        sd = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
        ed = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None
        rankings = self.get_station_availability_ranking(sd, ed, limit)

        table = Table(
            title="Station Availability Ranking",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("#", justify="right", style="dim")
        table.add_column("Station", style="bold")
        table.add_column("Days", justify="right")
        table.add_column("Cont(%)", justify="right")
        table.add_column("SNR(dB)", justify="right")
        table.add_column("Alerts", justify="right")
        table.add_column("Avail(%)", justify="right")

        for i, h in enumerate(rankings, 1):
            cont = h.get("avg_continuity", 0) * 100
            snr = h.get("avg_snr", 0)
            avail = h.get("availability", 0)
            alerts = h.get("alert_days", 0)

            cont_str = f"[green]{cont:.1f}[/green]" if cont >= 95 else f"[red]{cont:.1f}[/red]"
            snr_str = f"[green]{snr:.1f}[/green]" if snr >= 3 else f"[red]{snr:.1f}[/red]"
            avail_str = f"[green]{avail:.1f}[/green]" if avail >= 95 else f"[red]{avail:.1f}[/red]"
            alerts_str = f"[red]{alerts}[/red]" if alerts > 0 else str(alerts)

            table.add_row(
                str(i),
                h["station"],
                str(h.get("total_days", 0)),
                cont_str,
                snr_str,
                alerts_str,
                avail_str
            )

        console.print(table)


def get_station_manager(config_path: Optional[str] = None) -> StationManager:
    return StationManager(config_path)
