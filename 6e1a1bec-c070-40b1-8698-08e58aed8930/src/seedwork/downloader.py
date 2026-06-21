import hashlib
import os
import posixpath
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import ftputil
from obspy import read, UTCDateTime
from obspy.io.mseed import ObsPyMSEEDError
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
    TimeRemainingColumn,
)
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_exception_type

from .db import Database, Station, DownloadRecord, load_config
from .logger import get_logger, get_console

logger = get_logger()
console = get_console()


class MiniSEEDValidationError(Exception):
    pass


class FTPConnectionError(Exception):
    pass


class DataDownloader:
    def __init__(self, config_path: Optional[str] = None):
        self.config = load_config(config_path)
        self.db = Database()
        dl_cfg = self.config.get("download", {})
        self.data_dir = Path(dl_cfg.get("data_dir", "./data")).expanduser().resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.parallel_workers = dl_cfg.get("parallel_workers", 8)
        self.retry_count = dl_cfg.get("retry_count", 3)
        self.retry_delay = dl_cfg.get("retry_delay", 5)
        self.chunk_size = dl_cfg.get("chunk_size", 8192)

    def _get_station_data_dir(self, station: Station) -> Path:
        station_dir = self.data_dir / station.network / station.station
        station_dir.mkdir(parents=True, exist_ok=True)
        return station_dir

    def _compute_file_hash(self, filepath: Path) -> str:
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _validate_miniseed(self, filepath: Path, expected_sr: float = 100.0) -> dict:
        try:
            st = read(str(filepath), format="MSEED")
            if len(st) == 0:
                raise MiniSEEDValidationError("No traces in file")

            result = {
                "num_traces": len(st),
                "start_time": None,
                "end_time": None,
                "sample_rate": None,
                "is_valid": True,
                "errors": []
            }

            for tr in st:
                if tr.stats.sampling_rate != expected_sr:
                    result["errors"].append(
                        f"Sample rate mismatch: {tr.stats.sampling_rate} != {expected_sr}"
                    )
                    result["is_valid"] = False

                sr = tr.stats.sampling_rate
                expected_samples = int((tr.stats.endtime - tr.stats.starttime) * sr) + 1
                if abs(len(tr.data) - expected_samples) > 1:
                    result["errors"].append(
                        f"Sample count mismatch: {len(tr.data)} != {expected_samples}"
                    )
                    result["is_valid"] = False

                if result["start_time"] is None or tr.stats.starttime < result["start_time"]:
                    result["start_time"] = tr.stats.starttime.datetime
                if result["end_time"] is None or tr.stats.endtime > result["end_time"]:
                    result["end_time"] = tr.stats.endtime.datetime
                result["sample_rate"] = sr

            return result

        except ObsPyMSEEDError as e:
            raise MiniSEEDValidationError(f"MSEED parsing error: {e}") from e
        except Exception as e:
            raise MiniSEEDValidationError(f"Validation error: {e}") from e

    def _is_file_downloaded(self, station: Station, filename: str) -> bool:
        with self.db.get_session() as session:
            return session.query(DownloadRecord).filter(
                DownloadRecord.station_id == station.id,
                DownloadRecord.filename == filename,
                DownloadRecord.is_valid == True
            ).first() is not None

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_fixed(5),
        retry=retry_if_exception_type((FTPConnectionError, ftputil.error.FTPError)),
        reraise=True
    )
    def _download_single_file(self, station: Station, remote_path: str,
                              local_path: Path) -> dict:
        try:
            host = ftputil.FTPHost(
                station.ftp_host,
                station.ftp_user,
                station.ftp_password,
                port=station.ftp_port or 21
            )
        except Exception as e:
            raise FTPConnectionError(f"FTP connection failed: {e}") from e

        try:
            with host, tempfile.NamedTemporaryFile(
                dir=str(local_path.parent),
                suffix=".tmp",
                delete=False
            ) as tmp:
                tmp_path = Path(tmp.name)
                try:
                    host.download(remote_path, str(tmp_path), callback=None)

                    if not host.path.exists(remote_path):
                        raise FTPConnectionError(f"Remote file not found: {remote_path}")

                    remote_size = host.path.getsize(remote_path)
                    local_size = tmp_path.stat().st_size
                    if local_size != remote_size:
                        raise FTPConnectionError(
                            f"Size mismatch: {local_size} != {remote_size}"
                        )

                    validation = self._validate_miniseed(tmp_path, station.sample_rate)

                    if validation["is_valid"]:
                        tmp_path.rename(local_path)
                        file_hash = self._compute_file_hash(local_path)

                        with self.db.get_session() as session:
                            record = DownloadRecord(
                                station_id=station.id,
                                filename=Path(remote_path).name,
                                file_size=local_size,
                                file_hash=file_hash,
                                start_time=validation["start_time"],
                                end_time=validation["end_time"],
                                sample_rate=validation["sample_rate"],
                                is_valid=True
                            )
                            session.add(record)

                        return {
                            "station": f"{station.network}.{station.station}",
                            "file": local_path.name,
                            "size_mb": local_size / 1024 / 1024,
                            "status": "success",
                            "start_time": validation["start_time"],
                            "end_time": validation["end_time"]
                        }
                    else:
                        tmp_path.unlink(missing_ok=True)
                        raise MiniSEEDValidationError(
                            "; ".join(validation["errors"])
                        )

                finally:
                    tmp_path.unlink(missing_ok=True)

        except MiniSEEDValidationError:
            raise
        except Exception as e:
            raise FTPConnectionError(f"Download failed: {e}") from e

    def _list_ftp_files(self, station: Station, start_date: datetime,
                        end_date: datetime) -> list[str]:
        try:
            host = ftputil.FTPHost(
                station.ftp_host,
                station.ftp_user,
                station.ftp_password,
                port=station.ftp_port or 21
            )
        except Exception as e:
            logger.warning(
                f"[red]FTP connection failed for {station.network}.{station.station}: {e}[/red]"
            )
            return []

        files = []
        try:
            with host:
                remote_path = station.ftp_path or "/"
                if not host.path.exists(remote_path):
                    logger.warning(
                        f"[yellow]FTP path not found for {station.network}.{station.station}: {remote_path}[/yellow]"
                    )
                    return []

                for name in host.listdir(remote_path):
                    if not name.lower().endswith((".mseed", ".msd", ".seed")):
                        continue

                    full_path = posixpath.join(remote_path, name)
                    try:
                        mtime = host.path.getmtime(full_path)
                        file_date = datetime.fromtimestamp(mtime)
                        if start_date <= file_date <= end_date:
                            files.append(full_path)
                    except Exception:
                        continue

        except Exception as e:
            logger.warning(
                f"[yellow]FTP listing failed for {station.network}.{station.station}: {e}[/yellow]"
            )

        return files

    def sync_station(self, station: Station, start_date: Optional[datetime] = None,
                     end_date: Optional[datetime] = None) -> dict:
        if start_date is None:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=1)
        if end_date is None:
            end_date = datetime.now()

        station_dir = self._get_station_data_dir(station)
        remote_files = self._list_ftp_files(station, start_date, end_date)

        files_to_download = []
        for rf in remote_files:
            fname = Path(rf).name
            if not self._is_file_downloaded(station, fname):
                local_path = station_dir / fname
                files_to_download.append((rf, local_path))

        results = {
            "station": f"{station.network}.{station.station}",
            "total_files": len(remote_files),
            "downloaded": 0,
            "skipped": len(remote_files) - len(files_to_download),
            "failed": 0,
            "total_size_mb": 0,
            "errors": []
        }

        for remote_path, local_path in files_to_download:
            try:
                result = self._download_single_file(station, remote_path, local_path)
                results["downloaded"] += 1
                results["total_size_mb"] += result["size_mb"]
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"{Path(remote_path).name}: {e}")
                logger.warning(
                    f"[red]Download failed for {station.network}.{station.station}/"
                    f"{Path(remote_path).name}: {e}[/red]"
                )

        return results

    def sync_all(self, start_date: Optional[str] = None,
                 end_date: Optional[str] = None,
                 stations_filter: Optional[list[str]] = None,
                 parallel: bool = True) -> dict:
        sd = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
        ed = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None

        active_stations = []
        with self.db.get_session() as session:
            query = session.query(Station).filter(Station.is_active == True)
            if stations_filter:
                for s in stations_filter:
                    if "." in s:
                        net, sta = s.split(".", 1)
                        query = query.filter(
                            (Station.network == net) & (Station.station == sta)
                        )
                    else:
                        query = query.filter(Station.station == s)
            active_stations = query.all()

        if not active_stations:
            logger.warning("[yellow]No active stations found[/yellow]")
            return {"total_stations": 0}

        logger.info(
            f"[cyan]Starting sync for {len(active_stations)} stations "
            f"from {sd or 'yesterday'} to {ed or 'today'}[/cyan]"
        )

        summary = {
            "total_stations": len(active_stations),
            "total_files": 0,
            "downloaded": 0,
            "skipped": 0,
            "failed": 0,
            "total_size_mb": 0,
            "station_results": []
        }

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            main_task = progress.add_task(
                "[cyan]Syncing stations...",
                total=len(active_stations)
            )

            if parallel and self.parallel_workers > 1:
                with ThreadPoolExecutor(max_workers=self.parallel_workers) as executor:
                    futures = {
                        executor.submit(self.sync_station, st, sd, ed): st
                        for st in active_stations
                    }
                    for future in as_completed(futures):
                        st = futures[future]
                        try:
                            result = future.result()
                            summary["station_results"].append(result)
                            summary["total_files"] += result["total_files"]
                            summary["downloaded"] += result["downloaded"]
                            summary["skipped"] += result["skipped"]
                            summary["failed"] += result["failed"]
                            summary["total_size_mb"] += result["total_size_mb"]
                            progress.update(
                                main_task,
                                advance=1,
                                description=f"[green]Synced {result['station']}[/green]"
                            )
                        except Exception as e:
                            logger.error(
                                f"[red]Station {st.network}.{st.station} failed: {e}[/red]"
                            )
                            progress.update(
                                main_task,
                                advance=1,
                                description=f"[red]Failed {st.network}.{st.station}[/red]"
                            )
            else:
                for st in active_stations:
                    try:
                        result = self.sync_station(st, sd, ed)
                        summary["station_results"].append(result)
                        summary["total_files"] += result["total_files"]
                        summary["downloaded"] += result["downloaded"]
                        summary["skipped"] += result["skipped"]
                        summary["failed"] += result["failed"]
                        summary["total_size_mb"] += result["total_size_mb"]
                        progress.update(
                            main_task,
                            advance=1,
                            description=f"[green]Synced {result['station']}[/green]"
                        )
                    except Exception as e:
                        logger.error(
                            f"[red]Station {st.network}.{st.station} failed: {e}[/red]"
                        )
                        progress.update(
                            main_task,
                            advance=1,
                            description=f"[red]Failed {st.network}.{st.station}[/red]"
                        )

        logger.info(
            f"[green]Sync complete:[/green] "
            f"{summary['downloaded']} files downloaded, "
            f"{summary['skipped']} skipped, "
            f"{summary['failed']} failed, "
            f"{summary['total_size_mb']:.1f} MB total"
        )

        return summary

    def list_downloaded_files(self, network: Optional[str] = None,
                              station: Optional[str] = None,
                              limit: int = 100):
        with self.db.get_session() as session:
            query = session.query(DownloadRecord)
            if network or station:
                query = query.join(Station)
                if network:
                    query = query.filter(Station.network == network)
                if station:
                    query = query.filter(Station.station == station)

            records = query.order_by(DownloadRecord.download_time.desc()).limit(limit).all()

            from rich.table import Table
            table = Table(
                title=f"Downloaded Files ({len(records)})",
                show_header=True,
                header_style="bold cyan"
            )
            table.add_column("Station", style="bold")
            table.add_column("Filename")
            table.add_column("Size(MB)", justify="right")
            table.add_column("Start Time")
            table.add_column("End Time")
            table.add_column("Downloaded At")
            table.add_column("Status")

            for rec in records:
                st = rec.station
                status = "[green]VALID[/green]" if rec.is_valid else "[red]INVALID[/red]"
                table.add_row(
                    f"{st.network}.{st.station}" if st else "Unknown",
                    rec.filename,
                    f"{rec.file_size / 1024 / 1024:.2f}",
                    rec.start_time.strftime("%Y-%m-%d %H:%M:%S") if rec.start_time else "",
                    rec.end_time.strftime("%Y-%m-%d %H:%M:%S") if rec.end_time else "",
                    rec.download_time.strftime("%Y-%m-%d %H:%M:%S"),
                    status
                )

            console.print(table)


def get_downloader(config_path: Optional[str] = None) -> DataDownloader:
    return DataDownloader(config_path)
