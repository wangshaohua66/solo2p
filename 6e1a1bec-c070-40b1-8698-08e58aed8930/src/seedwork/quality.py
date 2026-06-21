import csv
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
from obspy import read, UTCDateTime
from obspy.signal.filter import bandpass
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
    TimeRemainingColumn,
)
from rich.table import Table

from .db import Database, Station, DownloadRecord, QualityMetric, load_config
from .logger import get_logger, get_console

logger = get_logger()
console = get_console()


class QualityAnalyzer:
    def __init__(self, config_path: Optional[str] = None):
        self.config = load_config(config_path)
        self.db = Database()
        q_cfg = self.config.get("quality", {})
        self.min_continuity_rate = q_cfg.get("min_continuity_rate", 0.95)
        self.min_snr_db = q_cfg.get("min_snr_db", 3.0)
        self.max_clock_bias_ms = q_cfg.get("max_clock_bias_ms", 1.0)
        self.max_dc_offset = q_cfg.get("max_dc_offset", 1000.0)
        dl_cfg = self.config.get("download", {})
        self.data_dir = Path(dl_cfg.get("data_dir", "./data")).expanduser().resolve()

    def _find_gaps(self, times: np.ndarray, sampling_rate: float,
                   max_gap: float = 1.5) -> list[tuple[int, int, float]]:
        if len(times) < 2:
            return []

        gaps = []
        expected_interval = 1.0 / sampling_rate
        for i in range(1, len(times)):
            diff = times[i] - times[i - 1]
            if diff > expected_interval * max_gap:
                gap_samples = int(diff * sampling_rate) - 1
                gaps.append((i - 1, i, gap_samples))

        return gaps

    def _compute_snr(self, data: np.ndarray, sampling_rate: float,
                     signal_start_idx: int, signal_end_idx: int) -> float:
        noise_start = max(0, signal_start_idx - int(30 * sampling_rate))
        noise_end = signal_start_idx

        if noise_end <= noise_start:
            return 0.0

        noise = data[noise_start:noise_end]
        signal = data[signal_start_idx:signal_end_idx]

        if len(noise) < 10 or len(signal) < 10:
            return 0.0

        noise_rms = np.sqrt(np.mean(noise ** 2))
        signal_rms = np.sqrt(np.mean(signal ** 2))

        if noise_rms <= 0:
            return 60.0

        return float(20 * np.log10(signal_rms / noise_rms))

    def _estimate_clock_bias(self, st) -> float:
        if len(st) < 2:
            return 0.0

        st_z = st.select(component="Z")
        if not st_z:
            st_z = st[0]

        tr = st_z[0] if isinstance(st_z, list) else st_z
        sr = tr.stats.sampling_rate

        data = tr.data
        n = len(data)
        if n < int(sr * 60):
            return 0.0

        segment_len = int(sr * 10)
        num_segments = min(10, n // segment_len)

        phase_shifts = []
        for i in range(num_segments - 1):
            seg1 = data[i * segment_len:(i + 1) * segment_len]
            seg2 = data[(i + 1) * segment_len:(i + 2) * segment_len]

            if len(seg1) < 100 or len(seg2) < 100:
                continue

            xcorr = np.correlate(
                seg1 - np.mean(seg1),
                seg2 - np.mean(seg2),
                mode="full"
            )
            if len(xcorr) == 0:
                continue

            lag = np.argmax(xcorr) - len(seg1) + 1
            phase_shifts.append(lag / sr * 1000)

        if phase_shifts:
            return float(np.mean(np.abs(phase_shifts)))
        return 0.0

    def analyze_station_day(self, station: Station, date: datetime) -> Optional[QualityMetric]:
        station_dir = self.data_dir / station.network / station.station
        if not station_dir.exists():
            return None

        day_start = datetime(date.year, date.month, date.day)
        day_end = day_start + timedelta(days=1)

        mseed_files = sorted(station_dir.glob("*.mseed")) + \
                     sorted(station_dir.glob("*.msd"))

        day_files = []
        for f in mseed_files:
            try:
                with self.db.get_session() as s:
                    rec = s.query(DownloadRecord).filter(
                        DownloadRecord.station_id == station.id,
                        DownloadRecord.filename == f.name,
                        DownloadRecord.is_valid == True
                    ).first()
                    if rec and rec.start_time and rec.end_time:
                        if rec.start_time < day_end and rec.end_time >= day_start:
                            day_files.append(str(f))
            except Exception:
                pass

        if not day_files:
            return None

        try:
            st = read(
                day_files,
                format="MSEED",
                starttime=UTCDateTime(day_start),
                endtime=UTCDateTime(day_end)
            )
            if len(st) == 0:
                return None

            st.merge(fill_value=np.nan)
            st.detrend("demean")

            total_samples = 0
            actual_samples = 0
            all_gaps = []
            total_gap_duration = 0.0
            max_gap_duration = 0.0
            snr_values = []
            dc_offsets = []

            for tr in st:
                sr = tr.stats.sampling_rate
                expected_samples = int(24 * 3600 * sr)
                total_samples += expected_samples

                data = tr.data
                valid_mask = ~np.isnan(data)
                actual_samples += np.sum(valid_mask)

                times = np.arange(len(data)) / sr
                gaps = self._find_gaps(times[valid_mask], sr)
                all_gaps.extend(gaps)

                for _, _, gap_samples in gaps:
                    gap_dur = gap_samples / sr
                    total_gap_duration += gap_dur
                    if gap_dur > max_gap_duration:
                        max_gap_duration = gap_dur

                if np.any(valid_mask):
                    dc_offset = float(np.mean(data[valid_mask]))
                    dc_offsets.append(dc_offset)

                    bp_data = bandpass(
                        data[valid_mask].astype(np.float64),
                        freqmin=1.0,
                        freqmax=20.0,
                        df=sr
                    )
                    mid_idx = len(bp_data) // 2
                    snr = self._compute_snr(bp_data, sr, mid_idx, min(mid_idx + int(5 * sr), len(bp_data)))
                    if snr > 0:
                        snr_values.append(snr)

            continuity_rate = actual_samples / total_samples if total_samples > 0 else 0.0
            avg_snr = float(np.mean(snr_values)) if snr_values else 0.0
            avg_dc_offset = float(np.mean(np.abs(dc_offsets))) if dc_offsets else 0.0
            clock_bias = self._estimate_clock_bias(st)

            alerts = []
            if continuity_rate < self.min_continuity_rate:
                alerts.append(
                    f"Continuity rate {continuity_rate*100:.1f}% < {self.min_continuity_rate*100:.1f}%"
                )
            if avg_snr < self.min_snr_db:
                alerts.append(
                    f"SNR {avg_snr:.2f} dB < {self.min_snr_db:.1f} dB"
                )
            if clock_bias > self.max_clock_bias_ms:
                alerts.append(
                    f"Clock bias {clock_bias:.3f} ms > {self.max_clock_bias_ms} ms"
                )
            if avg_dc_offset > self.max_dc_offset:
                alerts.append(
                    f"DC offset {avg_dc_offset:.1f} > {self.max_dc_offset}"
                )

            has_alert = len(alerts) > 0
            alert_message = "; ".join(alerts) if alerts else None

            with self.db.get_session() as session:
                existing = session.query(QualityMetric).filter(
                    QualityMetric.station_id == station.id,
                    QualityMetric.date == day_start
                ).first()

                if existing:
                    existing.continuity_rate = continuity_rate
                    existing.snr_db = avg_snr
                    existing.clock_bias_ms = clock_bias
                    existing.dc_offset = avg_dc_offset
                    existing.num_gaps = len(all_gaps)
                    existing.total_gap_duration = total_gap_duration
                    existing.max_gap_duration = max_gap_duration
                    existing.has_alert = has_alert
                    existing.alert_message = alert_message
                else:
                    metric = QualityMetric(
                        station_id=station.id,
                        date=day_start,
                        continuity_rate=continuity_rate,
                        snr_db=avg_snr,
                        clock_bias_ms=clock_bias,
                        dc_offset=avg_dc_offset,
                        num_gaps=len(all_gaps),
                        total_gap_duration=total_gap_duration,
                        max_gap_duration=max_gap_duration,
                        has_alert=has_alert,
                        alert_message=alert_message
                    )
                    session.add(metric)

            if has_alert:
                logger.warning(
                    f"[red]Quality alert for {station.network}.{station.station} "
                    f"on {day_start.strftime('%Y-%m-%d')}: {alert_message}[/red]"
                )

            return QualityMetric(
                station_id=station.id,
                date=day_start,
                continuity_rate=continuity_rate,
                snr_db=avg_snr,
                clock_bias_ms=clock_bias,
                dc_offset=avg_dc_offset,
                num_gaps=len(all_gaps),
                total_gap_duration=total_gap_duration,
                max_gap_duration=max_gap_duration,
                has_alert=has_alert,
                alert_message=alert_message
            )

        except Exception as e:
            logger.error(
                f"[red]Quality analysis failed for {station.network}.{station.station} "
                f"on {date.strftime('%Y-%m-%d')}: {e}[/red]"
            )
            return None

    def analyze_range(self, start_date: str, end_date: Optional[str] = None,
                      stations_filter: Optional[list[str]] = None) -> dict:
        sd = datetime.strptime(start_date, "%Y-%m-%d")
        ed = datetime.strptime(end_date, "%Y-%m-%d") if end_date else sd

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

        if not stations:
            logger.warning("[yellow]No active stations found[/yellow]")
            return {"total_stations": 0}

        days = []
        current = sd
        while current <= ed:
            days.append(current)
            current += timedelta(days=1)

        results = {
            "total_stations": len(stations),
            "total_days": len(days),
            "total_analyses": 0,
            "alerts": 0,
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
                "[cyan]Analyzing quality...",
                total=len(stations) * len(days)
            )

            for station in stations:
                station_alerts = 0
                for day in days:
                    try:
                        metric = self.analyze_station_day(station, day)
                        if metric:
                            results["total_analyses"] += 1
                            if metric.has_alert:
                                results["alerts"] += 1
                                station_alerts += 1
                        progress.update(main_task, advance=1)
                    except Exception as e:
                        logger.error(
                            f"[red]Quality analysis failed for "
                            f"{station.network}.{station.station} "
                            f"{day.strftime('%Y-%m-%d')}: {e}[/red]"
                        )
                        progress.update(main_task, advance=1)

                results["station_results"].append({
                    "station": f"{station.network}.{station.station}",
                    "alerts": station_alerts
                })

        logger.info(
            f"[green]Quality analysis complete:[/green] "
            f"{results['total_analyses']} analyses, "
            f"{results['alerts']} alerts"
        )

        return results

    def show_alerts(self, start_date: Optional[str] = None,
                    end_date: Optional[str] = None,
                    unresolved_only: bool = True,
                    limit: int = 100):
        with self.db.get_session() as session:
            query = session.query(QualityMetric).filter(
                QualityMetric.has_alert == True
            )
            if start_date:
                sd = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(QualityMetric.date >= sd)
            if end_date:
                ed = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(QualityMetric.date < ed)

            metrics = query.order_by(QualityMetric.date.desc()).limit(limit).all()

            table = Table(
                title=f"Quality Alerts ({len(metrics)})",
                show_header=True,
                header_style="bold cyan"
            )
            table.add_column("Date", style="bold")
            table.add_column("Station", style="bold")
            table.add_column("Cont(%)", justify="right")
            table.add_column("SNR(dB)", justify="right")
            table.add_column("Clock(ms)", justify="right")
            table.add_column("DC Offset", justify="right")
            table.add_column("#Gaps", justify="right")
            table.add_column("Alert Message")

            for m in metrics:
                cont = m.continuity_rate * 100 if m.continuity_rate else 0
                cont_str = f"[red]{cont:.1f}[/red]" if cont < self.min_continuity_rate * 100 else f"{cont:.1f}"
                snr_str = f"[red]{m.snr_db:.1f}[/red]" if m.snr_db < self.min_snr_db else f"{m.snr_db:.1f}"
                clock_str = f"[red]{m.clock_bias_ms:.3f}[/red]" if m.clock_bias_ms > self.max_clock_bias_ms else f"{m.clock_bias_ms:.3f}"
                dc_str = f"[red]{m.dc_offset:.1f}[/red]" if m.dc_offset > self.max_dc_offset else f"{m.dc_offset:.1f}"

                table.add_row(
                    m.date.strftime("%Y-%m-%d"),
                    f"{m.station.network}.{m.station.station}" if m.station else "Unknown",
                    cont_str,
                    snr_str,
                    clock_str,
                    dc_str,
                    str(m.num_gaps or 0),
                    m.alert_message or ""
                )

            console.print(table)

    def show_quality_summary(self, start_date: Optional[str] = None,
                             end_date: Optional[str] = None):
        with self.db.get_session() as session:
            query = session.query(QualityMetric)
            if start_date:
                sd = datetime.strptime(start_date, "%Y-%m-%d")
                query = query.filter(QualityMetric.date >= sd)
            if end_date:
                ed = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                query = query.filter(QualityMetric.date < ed)

            metrics = query.all()

            if not metrics:
                console.print("[yellow]No quality metrics found[/yellow]")
                return

            from collections import defaultdict
            by_station = defaultdict(list)
            for m in metrics:
                st_key = f"{m.station.network}.{m.station.station}" if m.station else "Unknown"
                by_station[st_key].append(m)

            table = Table(
                title=f"Quality Summary ({len(by_station)} stations, {len(metrics)} records)",
                show_header=True,
                header_style="bold cyan"
            )
            table.add_column("Station", style="bold")
            table.add_column("Days", justify="right")
            table.add_column("Avg Cont(%)", justify="right")
            table.add_column("Avg SNR(dB)", justify="right")
            table.add_column("Avg Clock(ms)", justify="right")
            table.add_column("Avg DC", justify="right")
            table.add_column("Alerts", justify="right")
            table.add_column("Availability", justify="right")

            for st_key, st_metrics in sorted(by_station.items()):
                days = len(st_metrics)
                avg_cont = np.mean([m.continuity_rate for m in st_metrics if m.continuity_rate is not None]) * 100
                avg_snr = np.mean([m.snr_db for m in st_metrics if m.snr_db is not None])
                avg_clock = np.mean([m.clock_bias_ms for m in st_metrics if m.clock_bias_ms is not None])
                avg_dc = np.mean([m.dc_offset for m in st_metrics if m.dc_offset is not None])
                alerts = sum(1 for m in st_metrics if m.has_alert)
                availability = (days - alerts) / days * 100 if days > 0 else 0

                cont_str = f"[green]{avg_cont:.1f}[/green]" if avg_cont >= self.min_continuity_rate * 100 else f"[red]{avg_cont:.1f}[/red]"
                snr_str = f"[green]{avg_snr:.1f}[/green]" if avg_snr >= self.min_snr_db else f"[red]{avg_snr:.1f}[/red]"
                clock_str = f"[green]{avg_clock:.3f}[/green]" if avg_clock <= self.max_clock_bias_ms else f"[red]{avg_clock:.3f}[/red]"
                alerts_str = f"[red]{alerts}[/red]" if alerts > 0 else str(alerts)
                avail_str = f"[green]{availability:.1f}%[/green]" if availability >= 95 else f"[red]{availability:.1f}%[/red]"

                table.add_row(
                    st_key,
                    str(days),
                    cont_str,
                    snr_str,
                    clock_str,
                    f"{avg_dc:.1f}",
                    alerts_str,
                    avail_str
                )

            console.print(table)

    def generate_monthly_report(self, year: int, month: int,
                                output_dir: str = "./reports") -> Path:
        start_date = datetime(year, month, 1)
        if month == 12:
            end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = datetime(year, month + 1, 1) - timedelta(days=1)

        self.analyze_range(
            start_date.strftime("%Y-%m-%d"),
            end_date.strftime("%Y-%m-%d")
        )

        with self.db.get_session() as session:
            stations = session.query(Station).filter(Station.is_active == True).all()

            report_data = []
            for station in stations:
                metrics = session.query(QualityMetric).filter(
                    QualityMetric.station_id == station.id,
                    QualityMetric.date >= start_date,
                    QualityMetric.date <= end_date
                ).all()

                if not metrics:
                    continue

                days = len(metrics)
                avg_cont = float(np.mean([m.continuity_rate for m in metrics if m.continuity_rate is not None])) * 100
                avg_snr = float(np.mean([m.snr_db for m in metrics if m.snr_db is not None]))
                avg_clock = float(np.mean([m.clock_bias_ms for m in metrics if m.clock_bias_ms is not None]))
                alerts = sum(1 for m in metrics if m.has_alert)
                availability = (days - alerts) / days * 100 if days > 0 else 0

                total_gaps = sum(m.num_gaps or 0 for m in metrics)
                total_gap_dur = sum(m.total_gap_duration or 0 for m in metrics)

                fault_periods = []
                for m in metrics:
                    if m.has_alert:
                        fault_periods.append(m.date.strftime("%Y-%m-%d"))

                report_data.append({
                    "station": f"{station.network}.{station.station}",
                    "days": days,
                    "avg_continuity": avg_cont,
                    "avg_snr": avg_snr,
                    "avg_clock_bias": avg_clock,
                    "alerts": alerts,
                    "availability": availability,
                    "total_gaps": total_gaps,
                    "total_gap_duration": total_gap_dur,
                    "fault_periods": ", ".join(fault_periods)
                })

        report_data.sort(key=lambda x: x["availability"], reverse=True)

        daily_trend = []
        from collections import defaultdict
        daily_metrics = defaultdict(list)
        for station in stations:
            metrics = session.query(QualityMetric).filter(
                QualityMetric.station_id == station.id,
                QualityMetric.date >= start_date,
                QualityMetric.date <= end_date
            ).all()
            for m in metrics:
                day_key = m.date.strftime("%Y-%m-%d")
                daily_metrics[day_key].append(m)

        for day in sorted(daily_metrics.keys()):
            day_metrics = daily_metrics[day]
            if not day_metrics:
                continue
            n = len(day_metrics)
            cont_vals = [m.continuity_rate for m in day_metrics if m.continuity_rate is not None]
            snr_vals = [m.snr_db for m in day_metrics if m.snr_db is not None]
            clock_vals = [m.clock_bias_ms for m in day_metrics if m.clock_bias_ms is not None]
            alert_count = sum(1 for m in day_metrics if m.has_alert)

            daily_trend.append({
                "date": day,
                "stations": n,
                "avg_continuity": float(np.mean(cont_vals)) * 100 if cont_vals else 0.0,
                "avg_snr": float(np.mean(snr_vals)) if snr_vals else 0.0,
                "avg_clock_bias": float(np.mean(clock_vals)) if clock_vals else 0.0,
                "alerts": alert_count,
                "availability": (n - alert_count) / n * 100 if n > 0 else 0.0
            })

        weekly_trend = []
        week_data = defaultdict(list)
        for d in daily_trend:
            dt = datetime.strptime(d["date"], "%Y-%m-%d")
            week_num = dt.isocalendar()[1]
            week_key = f"Week {week_num}"
            week_data[week_key].append(d)

        for wk in sorted(week_data.keys()):
            wk_days = week_data[wk]
            if not wk_days:
                continue
            n_days = len(wk_days)
            weekly_trend.append({
                "week": wk,
                "days": n_days,
                "avg_continuity": float(np.mean([d["avg_continuity"] for d in wk_days])),
                "avg_snr": float(np.mean([d["avg_snr"] for d in wk_days])),
                "avg_clock_bias": float(np.mean([d["avg_clock_bias"] for d in wk_days])),
                "avg_alerts": float(np.mean([d["alerts"] for d in wk_days])),
                "avg_availability": float(np.mean([d["availability"] for d in wk_days])),
                "total_alerts": sum(d["alerts"] for d in wk_days)
            })

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        filepath = output_dir / f"station_report_{year}_{month:02d}.csv"

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Rank", "Station", "Days", "Avg Continuity (%)", "Avg SNR (dB)",
                "Avg Clock Bias (ms)", "Alerts", "Availability (%)",
                "Total Gaps", "Total Gap Duration (s)", "Fault Periods"
            ])

            for i, row in enumerate(report_data, 1):
                writer.writerow([
                    i,
                    row["station"],
                    row["days"],
                    f"{row['avg_continuity']:.2f}",
                    f"{row['avg_snr']:.2f}",
                    f"{row['avg_clock_bias']:.4f}",
                    row["alerts"],
                    f"{row['availability']:.2f}",
                    row["total_gaps"],
                    f"{row['total_gap_duration']:.1f}",
                    row["fault_periods"]
                ])

        table = Table(
            title=f"Monthly Station Report - {year}/{month:02d}",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("#", justify="right", style="dim")
        table.add_column("Station", style="bold")
        table.add_column("Days", justify="right")
        table.add_column("Cont(%)", justify="right")
        table.add_column("SNR(dB)", justify="right")
        table.add_column("Clock(ms)", justify="right")
        table.add_column("Alerts", justify="right")
        table.add_column("Avail(%)", justify="right")

        for i, row in enumerate(report_data, 1):
            cont_str = f"[green]{row['avg_continuity']:.1f}[/green]" if row["avg_continuity"] >= self.min_continuity_rate * 100 else f"[red]{row['avg_continuity']:.1f}[/red]"
            snr_str = f"[green]{row['avg_snr']:.1f}[/green]" if row["avg_snr"] >= self.min_snr_db else f"[red]{row['avg_snr']:.1f}[/red]"
            clock_str = f"[green]{row['avg_clock_bias']:.3f}[/green]" if row["avg_clock_bias"] <= self.max_clock_bias_ms else f"[red]{row['avg_clock_bias']:.3f}[/red]"
            alerts_str = f"[red]{row['alerts']}[/red]" if row["alerts"] > 0 else str(row["alerts"])
            avail_str = f"[green]{row['availability']:.1f}[/green]" if row["availability"] >= 95 else f"[red]{row['availability']:.1f}[/red]"

            table.add_row(
                str(i),
                row["station"],
                str(row["days"]),
                cont_str,
                snr_str,
                clock_str,
                alerts_str,
                avail_str
            )

        console.print(table)

        if daily_trend:
            daily_filepath = output_dir / f"daily_trend_{year}_{month:02d}.csv"
            with open(daily_filepath, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Date", "Stations", "Avg Continuity (%)", "Avg SNR (dB)",
                    "Avg Clock Bias (ms)", "Alerts", "Availability (%)"
                ])
                for d in daily_trend:
                    writer.writerow([
                        d["date"],
                        d["stations"],
                        f"{d['avg_continuity']:.2f}",
                        f"{d['avg_snr']:.2f}",
                        f"{d['avg_clock_bias']:.4f}",
                        d["alerts"],
                        f"{d['availability']:.2f}"
                    ])

            daily_table = Table(
                title=f"Daily Quality Trend - {year}/{month:02d}",
                show_header=True,
                header_style="bold magenta"
            )
            daily_table.add_column("Date", style="bold")
            daily_table.add_column("Stations", justify="right")
            daily_table.add_column("Cont(%)", justify="right")
            daily_table.add_column("SNR(dB)", justify="right")
            daily_table.add_column("Clock(ms)", justify="right")
            daily_table.add_column("Alerts", justify="right")
            daily_table.add_column("Avail(%)", justify="right")

            for d in daily_trend:
                cont_str = f"[green]{d['avg_continuity']:.1f}[/green]" if d["avg_continuity"] >= self.min_continuity_rate * 100 else f"[red]{d['avg_continuity']:.1f}[/red]"
                snr_str = f"[green]{d['avg_snr']:.1f}[/green]" if d["avg_snr"] >= self.min_snr_db else f"[red]{d['avg_snr']:.1f}[/red]"
                clock_str = f"[green]{d['avg_clock_bias']:.3f}[/green]" if d["avg_clock_bias"] <= self.max_clock_bias_ms else f"[red]{d['avg_clock_bias']:.3f}[/red]"
                alerts_str = f"[red]{d['alerts']}[/red]" if d["alerts"] > 0 else str(d["alerts"])
                avail_str = f"[green]{d['availability']:.1f}[/green]" if d["availability"] >= 95 else f"[red]{d['availability']:.1f}[/red]"

                daily_table.add_row(
                    d["date"],
                    str(d["stations"]),
                    cont_str,
                    snr_str,
                    clock_str,
                    alerts_str,
                    avail_str
                )

            console.print()
            console.print(daily_table)
            logger.info(f"[green]Daily trend report: {daily_filepath}[/green]")

        if weekly_trend:
            weekly_filepath = output_dir / f"weekly_trend_{year}_{month:02d}.csv"
            with open(weekly_filepath, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "Week", "Days", "Avg Continuity (%)", "Avg SNR (dB)",
                    "Avg Clock Bias (ms)", "Avg Alerts", "Total Alerts",
                    "Avg Availability (%)"
                ])
                for w in weekly_trend:
                    writer.writerow([
                        w["week"],
                        w["days"],
                        f"{w['avg_continuity']:.2f}",
                        f"{w['avg_snr']:.2f}",
                        f"{w['avg_clock_bias']:.4f}",
                        f"{w['avg_alerts']:.1f}",
                        w["total_alerts"],
                        f"{w['avg_availability']:.2f}"
                    ])

            weekly_table = Table(
                title=f"Weekly Quality Trend - {year}/{month:02d}",
                show_header=True,
                header_style="bold blue"
            )
            weekly_table.add_column("Week", style="bold")
            weekly_table.add_column("Days", justify="right")
            weekly_table.add_column("Cont(%)", justify="right")
            weekly_table.add_column("SNR(dB)", justify="right")
            weekly_table.add_column("Clock(ms)", justify="right")
            weekly_table.add_column("Avg Alerts", justify="right")
            weekly_table.add_column("Total Alerts", justify="right")
            weekly_table.add_column("Avail(%)", justify="right")

            for w in weekly_trend:
                cont_str = f"[green]{w['avg_continuity']:.1f}[/green]" if w["avg_continuity"] >= self.min_continuity_rate * 100 else f"[red]{w['avg_continuity']:.1f}[/red]"
                snr_str = f"[green]{w['avg_snr']:.1f}[/green]" if w["avg_snr"] >= self.min_snr_db else f"[red]{w['avg_snr']:.1f}[/red]"
                clock_str = f"[green]{w['avg_clock_bias']:.3f}[/green]" if w["avg_clock_bias"] <= self.max_clock_bias_ms else f"[red]{w['avg_clock_bias']:.3f}[/red]"
                alerts_str = f"[red]{w['total_alerts']}[/red]" if w["total_alerts"] > 0 else str(w["total_alerts"])
                avail_str = f"[green]{w['avg_availability']:.1f}[/green]" if w["avg_availability"] >= 95 else f"[red]{w['avg_availability']:.1f}[/red]"

                weekly_table.add_row(
                    w["week"],
                    str(w["days"]),
                    cont_str,
                    snr_str,
                    clock_str,
                    f"{w['avg_alerts']:.1f}",
                    alerts_str,
                    avail_str
                )

            console.print()
            console.print(weekly_table)
            logger.info(f"[green]Weekly trend report: {weekly_filepath}[/green]")

        logger.info(f"[green]Monthly report generated: {filepath}[/green]")

        return filepath


def get_quality_analyzer(config_path: Optional[str] = None) -> QualityAnalyzer:
    return QualityAnalyzer(config_path)
