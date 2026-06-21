import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
from obspy import Stream, Trace, UTCDateTime, read
from obspy.signal.trigger import (
    classic_sta_lta,
    recursive_sta_lta,
    trigger_onset,
    pk_baer,
    aic_simple,
)
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
    TimeRemainingColumn,
)
from rich.table import Table

from .db import Database, Station, Event, Pick, DownloadRecord, load_config
from .logger import get_logger, get_console

logger = get_logger()
console = get_console()


@dataclass
class CandidateEvent:
    start_time: datetime
    end_time: datetime
    trigger_value: float
    component_triggers: dict[str, bool] = field(default_factory=dict)
    snr: float = 0.0
    station_id: int = 0
    network: str = ""
    station: str = ""


@dataclass
class PickResult:
    phase: str
    arrival_time: datetime
    uncertainty: float
    snr: float
    amplitude: float
    period: float
    algorithm: str
    is_automatic: bool = True


class EventDetector:
    def __init__(self, config_path: Optional[str] = None):
        self.config = load_config(config_path)
        self.db = Database()
        det_cfg = self.config.get("detection", {})
        self.sta_window = det_cfg.get("sta_window", 1.0)
        self.lta_window = det_cfg.get("lta_window", 30.0)
        self.trigger_threshold = det_cfg.get("trigger_threshold", 4.0)
        self.detrigger_threshold = det_cfg.get("detrigger_threshold", 2.0)
        self.algorithm = det_cfg.get("algorithm", "recursive")
        self.min_event_duration = det_cfg.get("min_event_duration", 5.0)
        self.max_event_duration = det_cfg.get("max_event_duration", 300.0)
        dl_cfg = self.config.get("download", {})
        self.data_dir = Path(dl_cfg.get("data_dir", "./data")).expanduser().resolve()

    def _compute_sta_lta(self, data: np.ndarray, sampling_rate: float,
                         algorithm: str = "recursive") -> np.ndarray:
        nsta = int(self.sta_window * sampling_rate)
        nlta = int(self.lta_window * sampling_rate)

        if nsta < 1:
            nsta = 1
        if nlta < nsta:
            nlta = nsta * 2

        if algorithm == "zro":
            cft = classic_sta_lta(data, nsta, nlta)
        elif algorithm == "recursive":
            cft = recursive_sta_lta(data, nsta, nlta)
        else:
            cft = recursive_sta_lta(data, nsta, nlta)

        cft = np.nan_to_num(cft, nan=0.0, posinf=0.0, neginf=0.0)
        return cft

    def _detect_on_trace(self, tr: Trace, station_id: int) -> list[CandidateEvent]:
        data = tr.data.astype(np.float64)
        sampling_rate = tr.stats.sampling_rate

        cft = self._compute_sta_lta(data, sampling_rate, self.algorithm)

        if len(cft) == 0 or np.max(cft) == 0:
            return []

        onsets = trigger_onset(
            cft,
            self.trigger_threshold,
            self.detrigger_threshold
        )

        candidates = []
        for onset, offset in onsets:
            duration = (offset - onset) / sampling_rate
            if duration < self.min_event_duration:
                continue
            if duration > self.max_event_duration:
                continue

            start_idx = int(max(0, onset - int(self.lta_window * sampling_rate)))
            end_idx = int(min(len(data), offset + int(self.lta_window * sampling_rate)))

            trigger_val = float(np.max(cft[onset:offset]))
            noise_rms = np.sqrt(np.mean(data[start_idx:onset] ** 2)) if onset > start_idx else 1e-10
            signal_rms = np.sqrt(np.mean(data[onset:offset] ** 2))
            snr = 20 * np.log10(signal_rms / noise_rms) if noise_rms > 0 else 0

            start_time = (tr.stats.starttime + onset / sampling_rate).datetime
            end_time = (tr.stats.starttime + offset / sampling_rate).datetime

            candidate = CandidateEvent(
                start_time=start_time,
                end_time=end_time,
                trigger_value=trigger_val,
                snr=snr,
                station_id=station_id,
                network=tr.stats.network,
                station=tr.stats.station
            )
            candidate.component_triggers[tr.stats.channel] = True
            candidates.append(candidate)

        return candidates

    def _merge_candidates(self, candidates: list[CandidateEvent],
                          max_time_diff: float = 2.0) -> list[CandidateEvent]:
        if not candidates:
            return []

        candidates.sort(key=lambda c: c.start_time)
        merged = []
        current = candidates[0]

        for c in candidates[1:]:
            time_diff = abs((c.start_time - current.start_time).total_seconds())
            if time_diff <= max_time_diff:
                if c.end_time > current.end_time:
                    current.end_time = c.end_time
                current.trigger_value = max(current.trigger_value, c.trigger_value)
                current.snr = max(current.snr, c.snr)
                current.component_triggers.update(c.component_triggers)
            else:
                merged.append(current)
                current = c

        merged.append(current)
        return merged

    def detect_on_stream(self, st: Stream, station_id: int) -> list[CandidateEvent]:
        all_candidates = []
        for tr in st:
            try:
                tr.detrend("demean")
                tr.detrend("linear")
                tr.filter("bandpass", freqmin=1.0, freqmax=20.0)
                candidates = self._detect_on_trace(tr, station_id)
                all_candidates.extend(candidates)
            except Exception as e:
                logger.warning(
                    f"[yellow]Detection failed on {tr.id}: {e}[/yellow]"
                )

        return self._merge_candidates(all_candidates)

    def _aic_pick(self, data: np.ndarray, sampling_rate: float,
                  window_start: int, window_end: int) -> tuple[int, float]:
        window_data = data[window_start:window_end]
        if len(window_data) < 10:
            return window_start, 0.5

        aic = aic_simple(window_data)
        if len(aic) == 0:
            return window_start, 0.5

        pick_idx = int(np.argmin(aic))
        rel_uncertainty = 1.0 / (1.0 + np.abs(aic[pick_idx]))
        return window_start + pick_idx, rel_uncertainty

    def _polarization_analysis(self, st_z: Optional[Trace],
                               st_n: Optional[Trace],
                               st_e: Optional[Trace],
                               p_pick_idx: int,
                               sampling_rate: float,
                               window_len: float = 2.0) -> dict:
        n_samples = int(window_len * sampling_rate)
        start_idx = max(0, p_pick_idx - n_samples // 4)
        end_idx = start_idx + n_samples

        if st_z is None:
            return {"rectilinearity": 0, "polarity": 0, "is_p_wave": False}

        z_data = st_z.data[start_idx:end_idx] if start_idx + n_samples <= len(st_z.data) else None
        n_data = st_n.data[start_idx:end_idx] if st_n and start_idx + n_samples <= len(st_n.data) else None
        e_data = st_e.data[start_idx:end_idx] if st_e and start_idx + n_samples <= len(st_e.data) else None

        if z_data is None or len(z_data) < 10:
            return {"rectilinearity": 0, "polarity": 0, "is_p_wave": False}

        if n_data is None:
            n_data = np.zeros_like(z_data)
        if e_data is None:
            e_data = np.zeros_like(z_data)

        if len(n_data) != len(z_data):
            n_data = np.zeros_like(z_data)
        if len(e_data) != len(z_data):
            e_data = np.zeros_like(z_data)

        cov_matrix = np.cov([z_data, n_data, e_data])
        eigenvalues, _ = np.linalg.eigh(cov_matrix)
        eigenvalues = np.sort(eigenvalues)[::-1]

        rectilinearity = 1 - np.sqrt(eigenvalues[1] + eigenvalues[2]) / (np.sqrt(eigenvalues[0]) + 1e-10)
        rectilinearity = np.clip(rectilinearity, 0, 1)

        polarity = 1.0 if z_data[int(n_samples // 4)] > 0 else -1.0

        return {
            "rectilinearity": float(rectilinearity),
            "polarity": float(polarity),
            "is_p_wave": rectilinearity > 0.5
        }

    def _find_s_wave(self, st_z: Optional[Trace],
                     st_n: Optional[Trace],
                     st_e: Optional[Trace],
                     p_pick_idx: int,
                     sampling_rate: float,
                     min_delay: float = 1.0,
                     max_delay: float = 15.0) -> Optional[tuple[int, float]]:
        min_idx = p_pick_idx + int(min_delay * sampling_rate)
        max_idx = p_pick_idx + int(max_delay * sampling_rate)

        if st_n is None and st_e is None:
            return None

        sh_data = None
        if st_n is not None and st_e is not None:
            if min_idx < len(st_n.data) and max_idx <= len(st_n.data) and \
               min_idx < len(st_e.data) and max_idx <= len(st_e.data):
                sh_data = np.sqrt(st_n.data[min_idx:max_idx] ** 2 + st_e.data[min_idx:max_idx] ** 2)
        elif st_n is not None:
            if min_idx < len(st_n.data) and max_idx <= len(st_n.data):
                sh_data = np.abs(st_n.data[min_idx:max_idx])
        elif st_e is not None:
            if min_idx < len(st_e.data) and max_idx <= len(st_e.data):
                sh_data = np.abs(st_e.data[min_idx:max_idx])

        if sh_data is None or len(sh_data) < 10:
            return None

        try:
            cft_s = self._compute_sta_lta(sh_data, sampling_rate, "recursive")
            if np.max(cft_s) > self.trigger_threshold:
                onsets = trigger_onset(cft_s, self.trigger_threshold, self.detrigger_threshold)
                if len(onsets) > 0:
                    s_idx_rel, uncertainty = self._aic_pick(sh_data, sampling_rate,
                                                            int(max(0, onsets[0][0] - 100)),
                                                            int(min(len(sh_data), onsets[0][0] + 100)))
                    return min_idx + s_idx_rel, float(uncertainty)
        except Exception as e:
            logger.debug(f"[yellow]S-wave detection failed: {e}[/yellow]")

        return None

    def pick_arrivals(self, st: Stream, candidate: CandidateEvent,
                      station_id: int) -> list[PickResult]:
        sampling_rate = st[0].stats.sampling_rate if st else 100.0

        tr_z = None
        tr_n = None
        tr_e = None

        for tr in st:
            chan = tr.stats.channel.upper()
            if chan.endswith("Z"):
                tr_z = tr
            elif chan.endswith("N") or chan.endswith("1"):
                tr_n = tr
            elif chan.endswith("E") or chan.endswith("2"):
                tr_e = tr

        if tr_z is None:
            tr_z = st[0] if st else None

        if tr_z is None:
            return []

        pick_start = max(0, int((candidate.start_time - tr_z.stats.starttime.datetime).total_seconds() * sampling_rate))
        pick_end = min(len(tr_z.data), int((candidate.end_time - tr_z.stats.starttime.datetime).total_seconds() * sampling_rate))

        if pick_end - pick_start < 10:
            return []

        p_idx, p_uncertainty = self._aic_pick(tr_z.data, sampling_rate, pick_start, pick_end)
        p_time = (tr_z.stats.starttime + p_idx / sampling_rate).datetime

        window_start = max(0, p_idx - int(self.lta_window * sampling_rate))
        window_end = min(len(tr_z.data), p_idx + int(self.sta_window * sampling_rate))
        noise_rms = np.sqrt(np.mean(tr_z.data[window_start:p_idx] ** 2)) if p_idx > window_start else 1e-10
        signal_rms = np.sqrt(np.mean(tr_z.data[p_idx:window_end] ** 2))
        p_snr = 20 * np.log10(signal_rms / noise_rms) if noise_rms > 0 else 0

        p_amplitude = float(np.max(np.abs(tr_z.data[p_idx:min(p_idx + 1000, len(tr_z.data))])))
        p_period = 1.0 / sampling_rate * 10

        pol_result = self._polarization_analysis(tr_z, tr_n, tr_e, p_idx, sampling_rate)

        picks = []
        picks.append(PickResult(
            phase="P",
            arrival_time=p_time,
            uncertainty=p_uncertainty * 0.1,
            snr=p_snr,
            amplitude=p_amplitude,
            period=p_period,
            algorithm="AIC"
        ))

        s_result = self._find_s_wave(tr_z, tr_n, tr_e, p_idx, sampling_rate)
        if s_result is not None:
            s_idx, s_uncertainty = s_result
            s_time = (tr_z.stats.starttime + s_idx / sampling_rate).datetime

            if tr_n is not None and s_idx < len(tr_n.data):
                s_amp_data = tr_n.data
            elif tr_e is not None and s_idx < len(tr_e.data):
                s_amp_data = tr_e.data
            else:
                s_amp_data = tr_z.data

            s_amplitude = float(np.max(np.abs(s_amp_data[s_idx:min(s_idx + 1000, len(s_amp_data))])))

            noise_window = max(0, s_idx - int(self.lta_window * sampling_rate))
            noise_rms_s = np.sqrt(np.mean(s_amp_data[noise_window:s_idx] ** 2)) if s_idx > noise_window else 1e-10
            signal_rms_s = np.sqrt(np.mean(s_amp_data[s_idx:s_idx + int(self.sta_window * sampling_rate)] ** 2))
            s_snr = 20 * np.log10(signal_rms_s / noise_rms_s) if noise_rms_s > 0 else 0

            picks.append(PickResult(
                phase="S",
                arrival_time=s_time,
                uncertainty=s_uncertainty * 0.2,
                snr=s_snr,
                amplitude=s_amplitude,
                period=1.0 / sampling_rate * 20,
                algorithm="STA/LTA+AIC"
            ))

        return picks

    def detect_and_pick(self, start_time: datetime, end_time: datetime,
                        stations_filter: Optional[list[str]] = None) -> dict:
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
            stations = query.all()

        results = {
            "total_stations": len(stations),
            "total_events": 0,
            "total_picks": 0,
            "events": []
        }

        if not stations:
            logger.warning("[yellow]No active stations found[/yellow]")
            return results

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console
        ) as progress:
            main_task = progress.add_task(
                "[cyan]Detecting events...",
                total=len(stations)
            )

            for station in stations:
                station_dir = self.data_dir / station.network / station.station
                if not station_dir.exists():
                    progress.update(main_task, advance=1)
                    continue

                mseed_files = sorted(station_dir.glob("*.mseed")) + \
                             sorted(station_dir.glob("*.msd"))

                relevant_files = []
                for f in mseed_files:
                    try:
                        with self.db.get_session() as s:
                            rec = s.query(DownloadRecord).filter(
                                DownloadRecord.station_id == station.id,
                                DownloadRecord.filename == f.name,
                                DownloadRecord.is_valid == True
                            ).first()
                            if rec and rec.start_time and rec.end_time:
                                if (rec.start_time <= end_time and rec.end_time >= start_time):
                                    relevant_files.append(str(f))
                    except Exception:
                        pass

                if not relevant_files:
                    progress.update(main_task, advance=1)
                    continue

                try:
                    st = read(relevant_files, format="MSEED",
                              starttime=UTCDateTime(start_time),
                              endtime=UTCDateTime(end_time))
                    if len(st) == 0:
                        progress.update(main_task, advance=1)
                        continue

                    st.merge(fill_value=0)

                    candidates = self.detect_on_stream(st, station.id)

                    for candidate in candidates:
                        event_id = f"EVT_{uuid.uuid4().hex[:12].upper()}"

                        with self.db.get_session() as session:
                            event = Event(
                                event_id=event_id,
                                start_time=candidate.start_time,
                                end_time=candidate.end_time,
                                detection_algorithm=self.algorithm,
                                trigger_value=candidate.trigger_value,
                                is_candidate=True,
                                is_reviewed=False
                            )
                            session.add(event)
                            session.flush()

                            picks = self.pick_arrivals(st, candidate, station.id)
                            for pick in picks:
                                p = Pick(
                                    event_id=event.id,
                                    station_id=station.id,
                                    phase=pick.phase,
                                    arrival_time=pick.arrival_time,
                                    uncertainty=pick.uncertainty,
                                    snr=pick.snr,
                                    amplitude=pick.amplitude,
                                    period=pick.period,
                                    algorithm=pick.algorithm,
                                    is_automatic=pick.is_automatic
                                )
                                session.add(p)

                            results["events"].append({
                                "event_id": event_id,
                                "station": f"{station.network}.{station.station}",
                                "start_time": candidate.start_time,
                                "end_time": candidate.end_time,
                                "trigger_value": candidate.trigger_value,
                                "num_picks": len(picks)
                            })
                            results["total_events"] += 1
                            results["total_picks"] += len(picks)

                    progress.update(
                        main_task,
                        advance=1,
                        description=f"[green]{station.network}.{station.station}: "
                                    f"{len(candidates)} events[/green]"
                    )

                except Exception as e:
                    logger.error(
                        f"[red]Detection failed for {station.network}.{station.station}: {e}[/red]"
                    )
                    progress.update(
                        main_task,
                        advance=1,
                        description=f"[red]Failed {station.network}.{station.station}[/red]"
                    )

        logger.info(
            f"[green]Detection complete:[/green] "
            f"{results['total_events']} events, "
            f"{results['total_picks']} picks"
        )

        return results

    def list_events(self, start_time: Optional[str] = None,
                    end_time: Optional[str] = None,
                    reviewed_only: bool = False,
                    limit: int = 100):
        with self.db.get_session() as session:
            query = session.query(Event)
            if start_time:
                st = datetime.strptime(start_time, "%Y-%m-%d")
                query = query.filter(Event.start_time >= st)
            if end_time:
                et = datetime.strptime(end_time, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(Event.start_time < et)
            if reviewed_only:
                query = query.filter(Event.is_reviewed == True)

            events = query.order_by(Event.start_time.desc()).limit(limit).all()

            table = Table(
                title=f"Detected Events ({len(events)})",
                show_header=True,
                header_style="bold cyan"
            )
            table.add_column("Event ID", style="bold")
            table.add_column("Start Time")
            table.add_column("End Time")
            table.add_column("Duration(s)", justify="right")
            table.add_column("Trigger", justify="right")
            table.add_column("Picks", justify="right")
            table.add_column("Status")

            for evt in events:
                duration = (evt.end_time - evt.start_time).total_seconds()
                status = "[green]REVIEWED[/green]" if evt.is_reviewed else "[yellow]CANDIDATE[/yellow]"
                table.add_row(
                    evt.event_id,
                    evt.start_time.strftime("%Y-%m-%d %H:%M:%S"),
                    evt.end_time.strftime("%H:%M:%S"),
                    f"{duration:.1f}",
                    f"{evt.trigger_value:.2f}",
                    str(len(evt.picks)),
                    status
                )

            console.print(table)


def get_detector(config_path: Optional[str] = None) -> EventDetector:
    return EventDetector(config_path)
