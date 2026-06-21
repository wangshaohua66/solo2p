from datetime import datetime, timedelta
from typing import Optional
from typing_extensions import Annotated

import typer
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from . import __version__
from .logger import get_logger, get_console
from .station import get_station_manager
from .downloader import get_downloader
from .detector import get_detector
from .location import get_location_engine
from .catalog import get_catalog_manager
from .quality import get_quality_analyzer

logger = get_logger()
console = get_console()

app = typer.Typer(
    name="seedwork",
    help="Seismic waveform data quality monitoring and earthquake event catalog system",
    add_completion=False,
    no_args_is_help=True,
    rich_markup_mode="rich"
)


def _version_callback(value: bool) -> None:
    if value:
        console.print(
            Panel.fit(
                Text(f"seedwork v{__version__}", style="bold cyan"),
                title="Seismic Waveform Data Quality Monitoring System",
                border_style="cyan"
            )
        )
        raise typer.Exit()


@app.callback()
def main(
    version: Optional[bool] = typer.Option(
        None, "--version", "-V", callback=_version_callback,
        is_eager=True,
        help="Show version and exit."
    ),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose logging"),
) -> None:
    """seedwork - Seismic waveform data quality monitoring and earthquake event catalog system.

    Manages 85 seismic stations with 100Hz continuous waveform data (15GB/day),
    automatic event detection, phase picking, catalog management, and quality monitoring.
    """
    if verbose:
        import logging
        logger.setLevel(logging.DEBUG)
        for handler in logger.handlers:
            handler.setLevel(logging.DEBUG)


# ---------------------------------------------------------------------------
# sync command
# ---------------------------------------------------------------------------
@app.command("sync")
def sync(
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date (YYYY-MM-DD), defaults to yesterday")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end", "-e",
        help="End date (YYYY-MM-DD), defaults to today")
    ] = None,
    stations: Annotated[
        Optional[list[str]],
        typer.Option("--station", "-S",
        help="Filter by station (e.g., XX.STA01 or STA01), repeatable")
    ] = None,
    parallel: Annotated[
        bool,
        typer.Option("--parallel/--no-parallel",
        help="Enable parallel download")
    ] = True,
    workers: Annotated[
        int,
        typer.Option("--workers", "-w",
        help="Number of parallel workers")
    ] = 8,
    list_files: Annotated[
        bool,
        typer.Option("--list", "-l",
        help="List downloaded files instead of syncing")
    ] = False,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Limit for file listing")
    ] = 100,
) -> None:
    """Synchronize waveform data from station FTP servers.

    Supports incremental sync, parallel download, and MiniSEED validation.

    Examples:

      # Sync all stations for yesterday:
      $ seedwork sync

      # Sync specific stations for date range:
      $ seedwork sync --start 2026-06-01 --end 2026-06-10

      # Sync specific station with 4 workers:
      $ seedwork sync --station XX.STA01 --workers 4

      # List last 50 downloaded files:
      $ seedwork sync --list --limit 50
    """
    downloader = get_downloader()
    downloader.parallel_workers = workers

    if list_files:
        network = None
        station_name = None
        if stations and len(stations) > 0 and "." in stations[0]:
            network, station_name = stations[0].split(".", 1)
        elif stations:
            station_name = stations[0]
        downloader.list_downloaded_files(network, station_name, limit)
        return

    result = downloader.sync_all(start_date, end_date, stations, parallel)

    table = Table(
        title="Sync Summary",
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("Metric")
    table.add_column("Value", justify="right")

    table.add_row("Total Stations", str(result.get("total_stations", 0)))
    table.add_row("Total Files", str(result.get("total_files", 0)))
    table.add_row("Downloaded", f"[green]{result.get('downloaded', 0)}[/green]")
    table.add_row("Skipped", f"[yellow]{result.get('skipped', 0)}[/yellow]")
    table.add_row("Failed", f"[red]{result.get('failed', 0)}[/red]")
    table.add_row("Total Size", f"{result.get('total_size_mb', 0):.1f} MB")

    console.print(table)


# ---------------------------------------------------------------------------
# detect command
# ---------------------------------------------------------------------------
@app.command("detect")
def detect(
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date (YYYY-MM-DD")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end", "-e",
        help="End date (YYYY-MM-DD)")
    ] = None,
    stations: Annotated[
        Optional[list[str]],
        typer.Option("--station", "-S",
        help="Filter by station, repeatable")
    ] = None,
    algorithm: Annotated[
        str,
        typer.Option("--algorithm", "-a",
        help="Detection algorithm: recursive or zro")
    ] = "recursive",
    sta_window: Annotated[
        float,
        typer.Option("--sta",
        help="Short time window (seconds)")
    ] = 1.0,
    lta_window: Annotated[
        float,
        typer.Option("--lta",
        help="Long time window (seconds)")
    ] = 30.0,
    trigger: Annotated[
        float,
        typer.Option("--trigger", "-t",
        help="Trigger threshold (x LTA)")
    ] = 4.0,
    detrigger: Annotated[
        float,
        typer.Option("--detrigger", "-d",
        help="Detrigger threshold (x LTA)")
    ] = 2.0,
    list_events: Annotated[
        bool,
        typer.Option("--list", "-l",
        help="List detected events instead of detecting")
    ] = False,
    reviewed_only: Annotated[
        bool,
        typer.Option("--reviewed",
        help="Show only reviewed events")
    ] = False,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Limit for event listing")
    ] = 100,
) -> None:
    """Detect seismic events using STA/LTA algorithm.

    Supports classic ZRO and recursive STA/LTA detectors with configurable
    windows and thresholds. Automatically applies AIC P-wave picking and
    polarization S-wave analysis for detected events.

    Examples:

      # Detect events for yesterday:
      $ seedwork detect

      # Detect with custom thresholds:
      $ seedwork detect --sta 1.5 --lta 30 --trigger 4 --detrigger 2

      # Detect specific station with ZRO algorithm:
      $ seedwork detect --station XX.STA01 --algorithm zro

      # List last 50 events:
      $ seedwork detect --list --limit 50
    """
    detector = get_detector()
    detector.algorithm = algorithm
    detector.sta_window = sta_window
    detector.lta_window = lta_window
    detector.trigger_threshold = trigger
    detector.detrigger_threshold = detrigger

    if list_events:
        detector.list_events(start_date, end_date, reviewed_only, limit)
        return

    if start_date is None:
        start_dt = datetime.now() - timedelta(days=1)
        start_date = start_dt.strftime("%Y-%m-%d")
    if end_date is None:
        end_dt = datetime.now()
        end_date = end_dt.strftime("%Y-%m-%d")

    st = datetime.strptime(start_date, "%Y-%m-%d")
    et = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)

    result = detector.detect_and_pick(st, et, stations)

    table = Table(
        title="Detection Summary",
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("Metric")
    table.add_column("Value", justify="right")

    table.add_row("Stations Processed", str(result.get("total_stations", 0)))
    table.add_row("Events Detected", f"[green]{result.get('total_events', 0)}[/green]")
    table.add_row("Total Picks", f"[green]{result.get('total_picks', 0)}[/green]")

    console.print(table)

    if result.get("events"):
        events_table = Table(
            title="Detected Events",
            show_header=True,
            header_style="bold cyan"
        )
        events_table.add_column("Event ID", style="bold")
        events_table.add_column("Station")
        events_table.add_column("Start Time")
        events_table.add_column("Duration(s)", justify="right")
        events_table.add_column("Trigger", justify="right")
        events_table.add_column("Picks", justify="right")

        for evt in result["events"][:10]:
            duration = (evt["end_time"] - evt["start_time"]).total_seconds()
            events_table.add_row(
                evt["event_id"],
                evt["station"],
                evt["start_time"].strftime("%H:%M:%S"),
                f"{duration:.1f}",
                f"{evt['trigger_value']:.2f}",
                str(evt["num_picks"])
            )

        console.print(events_table)


# ---------------------------------------------------------------------------
# pick command
# ---------------------------------------------------------------------------
@app.command("pick")
def pick(
    event_id: Annotated[
        str,
        typer.Argument(..., help="Event ID for picking")
    ],
    interactive: Annotated[
        bool,
        typer.Option("--interactive", "-i",
        help="Interactive picking mode")
    ] = False,
    phase: Annotated[
        Optional[str],
        typer.Option("--phase", "-p",
        help="Phase to pick: P, S, or both")
    ] = "both",
) -> None:
    """Perform phase picking on detected events.

    Applies AIC algorithm for P-wave picking and polarization analysis
    analysis for S-wave identification.

    Examples:

      # Automatic picking for an event:
      $ seedwork pick EVT_ABC123DEF456

      # Interactive picking:
      $ seedwork pick EVT_ABC123DEF456 --interactive
    """
    from .db import Database, Event, Pick

    db = Database()
    detector = get_detector()

    with db.get_session() as session:
        event = session.query(Event).filter(
            Event.event_id == event_id
        ).first()

    if not event:
        console.print(f"[red]Event {event_id} not found[/red]")
        raise typer.Exit(code=1)

    console.print(
        Panel.fit(
            f"Event: {event_id}\n"
            f"Start: {event.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"End: {event.end_time.strftime('%H:%M:%S')}\n"
            f"Algorithm: {event.detection_algorithm}\n"
            f"Current picks: {len(event.picks)}",
            title="Phase Picking",
            border_style="cyan"
        )
    )

    if interactive:
        console.print(
            Panel.fit(
                "Interactive picking review mode\n"
                "Commands:\n"
                "  [cyan]<number>[/cyan] - Select pick by index\n"
                "  [cyan]c <number>[/cyan] - Confirm pick\n"
                "  [cyan]r <number>[/cyan] - Reject/delete pick\n"
                "  [cyan]t <number> <time>[/cyan] - Modify arrival time (HH:MM:SS.sss)\n"
                "  [cyan]a[/cyan] - Confirm all\n"
                "  [cyan]l[/cyan] - List picks again\n"
                "  [cyan]q[/cyan] - Quit and save",
                title="Interactive Picking",
                border_style="yellow"
            )
        )

        from datetime import datetime, timedelta

        while True:
            with db.get_session() as session:
                picks = session.query(Pick).filter(
                    Pick.event_id == event.id
                ).order_by(Pick.arrival_time).all()

                if not picks:
                    console.print("[yellow]No picks to review[/yellow]")
                    break

                table = Table(
                    title=f"Phase Picks ({len(picks)})",
                    show_header=True,
                    header_style="bold cyan"
                )
                table.add_column("#", justify="right", style="dim")
                table.add_column("Station")
                table.add_column("Phase")
                table.add_column("Arrival Time")
                table.add_column("Unc(s)", justify="right")
                table.add_column("Status")

                for i, p in enumerate(picks, 1):
                    if p.is_reviewed:
                        status = "[green]REVIEWED[/green]"
                    elif p.is_automatic:
                        status = "[yellow]AUTO[/yellow]"
                    else:
                        status = "[cyan]MANUAL[/cyan]"
                    table.add_row(
                        str(i),
                        f"{p.station.network}.{p.station.station}" if p.station else "Unknown",
                        p.phase,
                        p.arrival_time.strftime("%H:%M:%S.%f")[:-3],
                        f"{p.uncertainty or 0:.3f}",
                        status
                    )
            console.print(table)

            try:
                user_input = input("> ").strip()
            except EOFError:
                console.print("[yellow]EOF received, exiting interactive mode[/yellow]")
                break

            if not user_input:
                continue

            parts = user_input.split()
            cmd = parts[0].lower()

            if cmd == "q" or cmd == "quit":
                console.print("[green]Exiting interactive picking mode[/green]")
                break

            elif cmd == "l" or cmd == "list":
                continue

            elif cmd == "a" or cmd == "all":
                with db.get_session() as session:
                    picks_all = session.query(Pick).filter(
                        Pick.event_id == event.id
                    ).all()
                    for p in picks_all:
                        p.is_reviewed = True
                        p.reviewer = "interactive"
                        p.reviewed_at = datetime.utcnow()
                    session.commit()
                console.print(f"[green]Confirmed all {len(picks)} picks[/green]")
                continue

            elif cmd == "c" or cmd == "confirm":
                if len(parts) < 2:
                    console.print("[red]Usage: c <pick_number>[/red]")
                    continue
                try:
                    idx = int(parts[1]) - 1
                except ValueError:
                    console.print("[red]Invalid pick number[/red]")
                    continue
                if idx < 0 or idx >= len(picks):
                    console.print("[red]Pick number out of range[/red]")
                    continue
                pick_id = picks[idx].id
                with db.get_session() as session:
                    p = session.query(Pick).filter(Pick.id == pick_id).first()
                    if p:
                        p.is_reviewed = True
                        p.reviewer = "interactive"
                        p.reviewed_at = datetime.utcnow()
                        session.commit()
                        console.print(f"[green]Confirmed pick #{idx + 1}[/green]")
                continue

            elif cmd == "r" or cmd == "reject":
                if len(parts) < 2:
                    console.print("[red]Usage: r <pick_number>[/red]")
                    continue
                try:
                    idx = int(parts[1]) - 1
                except ValueError:
                    console.print("[red]Invalid pick number[/red]")
                    continue
                if idx < 0 or idx >= len(picks):
                    console.print("[red]Pick number out of range[/red]")
                    continue
                pick_id = picks[idx].id
                with db.get_session() as session:
                    p = session.query(Pick).filter(Pick.id == pick_id).first()
                    if p:
                        session.delete(p)
                        session.commit()
                        console.print(f"[green]Rejected/deleted pick #{idx + 1}[/green]")
                continue

            elif cmd == "t" or cmd == "time":
                if len(parts) < 3:
                    console.print("[red]Usage: t <pick_number> <HH:MM:SS.sss>[/red]")
                    continue
                try:
                    idx = int(parts[1]) - 1
                except ValueError:
                    console.print("[red]Invalid pick number[/red]")
                    continue
                if idx < 0 or idx >= len(picks):
                    console.print("[red]Pick number out of range[/red]")
                    continue
                time_str = parts[2]
                pick_id = picks[idx].id
                old_time = picks[idx].arrival_time
                try:
                    t = datetime.strptime(time_str, "%H:%M:%S.%f")
                except ValueError:
                    try:
                        t = datetime.strptime(time_str, "%H:%M:%S")
                    except ValueError:
                        console.print("[red]Invalid time format. Use HH:MM:SS or HH:MM:SS.sss[/red]")
                        continue
                new_time = old_time.replace(
                    hour=t.hour, minute=t.minute,
                    second=t.second, microsecond=t.microsecond
                )
                with db.get_session() as session:
                    p = session.query(Pick).filter(Pick.id == pick_id).first()
                    if p:
                        p.arrival_time = new_time
                        p.is_reviewed = True
                        p.reviewer = "interactive"
                        p.reviewed_at = datetime.utcnow()
                        p.is_automatic = False
                        session.commit()
                        console.print(
                            f"[green]Updated pick #{idx + 1}: "
                            f"{old_time.strftime('%H:%M:%S.%f')[:-3]} -> "
                            f"{new_time.strftime('%H:%M:%S.%f')[:-3]}[/green]"
                        )
                continue

            else:
                console.print("[red]Unknown command. Try: c, r, t, a, l, q[/red]")
                continue

        return

    table = Table(
        title="Phase Picks",
        show_header=True,
        header_style="bold cyan"
    )
    table.add_column("Station")
    table.add_column("Phase")
    table.add_column("Arrival Time")
    table.add_column("Unc(s)", justify="right")
    table.add_column("SNR(dB)", justify="right")
    table.add_column("Amp", justify="right")
    table.add_column("Algorithm")
    table.add_column("Status")

    with db.get_session() as session:
        picks = session.query(Pick).filter(
            Pick.event_id == event.id
        ).order_by(Pick.arrival_time).all()

    for p in picks:
        status = "[green]REVIEWED[/green]" if p.is_reviewed else "[yellow]AUTO[/yellow]"
        table.add_row(
            f"{p.station.network}.{p.station.station}" if p.station else "Unknown",
            p.phase,
            p.arrival_time.strftime("%H:%M:%S.%f")[:-3],
            f"{p.uncertainty or 0:.3f}",
            f"{p.snr or 0:.1f}",
            f"{p.amplitude or 0:.2e}",
            p.algorithm or "N/A",
            status
        )

    console.print(table)


# ---------------------------------------------------------------------------
# locate command
# ---------------------------------------------------------------------------
@app.command("locate")
def locate(
    event_id: Annotated[
        Optional[str],
        typer.Option("--event", "-e",
        help="Process single event")
    ] = None,
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date (YYYY-MM-DD)")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end", "-E",
        help="End date (YYYY-MM-DD)")
    ] = None,
    min_picks: Annotated[
        int,
        typer.Option("--min-picks", "-m",
        help="Minimum P picks required for location")
    ] = 3,
    analyst: Annotated[
        str,
        typer.Option("--analyst", "-a",
        help="Analyst name")
    ] = "automatic",
    status: Annotated[
        str,
        typer.Option("--status",
        help="Catalog status")
    ] = "preliminary",
    show_catalog: Annotated[
        bool,
        typer.Option("--catalog", "-c",
        help="Show catalog after processing")
    ] = False,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Limit for catalog listing")
    ] = 100,
) -> None:
    """Locate events and calculate magnitudes.

    Uses multi-station arrival time differences for intersection location,
    and Wood-Anderson ML magnitude calculation.

    Examples:

      # Locate a specific event:
      $ seedwork locate --event EVT_ABC123DEF456

      # Process all events for a date range:
      $ seedwork locate --start 2026-06-01 --end 2026-06-10

      # Process with analyst attribution:
      $ seedwork locate --analyst "Zhang Wei" --status preliminary
    """
    engine = get_location_engine()

    if event_id:
        from .db import Database, Event
        db = Database()
        with db.get_session() as session:
            evt = session.query(Event).filter(
                Event.event_id == event_id
            ).first()

        if not evt:
            console.print(f"[red]Event {event_id} not found[/red]")
            raise typer.Exit(code=1)

        entry = engine.process_event(evt.id, analyst, status)

        if entry:
            console.print(
                Panel.fit(
                    f"Origin Time: {entry.origin_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}\n"
                    f"Location: {entry.latitude:.4f}°N, {entry.longitude:.4f}°E\n"
                    f"Depth: {entry.depth:.1f} km\n"
                    f"Magnitude: M{entry.magnitude_type or 'L'} {entry.magnitude:.2f}\n"
                    f"Uncertainty: ±{entry.magnitude_uncertainty or 0:.2f}\n"
                    f"Stations: {entry.num_stations or 0}\n"
                    f"Azimuth Gap: {entry.azimuth_gap or 0:.1f}°\n"
                    f"Method: {entry.location_method or 'N/A'}\n"
                    f"Status: {entry.status or 'N/A'}\n"
                    f"Analyst: {entry.analyst or 'N/A'}",
                    title="Location Result",
                    border_style="green"
                )
            )
        else:
            console.print("[red]Location failed[/red]")
    else:
        result = engine.process_all(start_date, end_date, min_picks)

        table = Table(
            title="Location Processing Summary",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("Metric")
        table.add_column("Value", justify="right")

        table.add_row("Total Events", str(result.get("total_events", 0)))
        table.add_row("Successfully Located", f"[green]{result.get('processed', 0)}[/green]")
        table.add_row("Failed", f"[red]{result.get('failed', 0)}[/red]")

        console.print(table)

    if show_catalog:
        engine.show_catalog(start_date, end_date, limit=limit)


# ---------------------------------------------------------------------------
# catalog command
# ---------------------------------------------------------------------------
@app.command("catalog")
def catalog(
    action: Annotated[
        str,
        typer.Argument(...,
        help="Action: list, show, add, update, delete, search, export, stats, history, revert")
    ],
    event_id: Annotated[
        Optional[str],
        typer.Option("--event",
        help="Event ID")
    ] = None,
    catalog_id: Annotated[
        Optional[int],
        typer.Option("--id", "-i",
        help="Catalog entry ID")
    ] = None,
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date filter (YYYY-MM-DD)")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end",
        help="End date filter (YYYY-MM-DD)")
    ] = None,
    min_mag: Annotated[
        Optional[float],
        typer.Option("--min-mag",
        help="Minimum magnitude filter")
    ] = None,
    max_mag: Annotated[
        Optional[float],
        typer.Option("--max-mag",
        help="Maximum magnitude filter")
    ] = None,
    min_lat: Annotated[
        Optional[float],
        typer.Option("--min-lat",
        help="Minimum latitude filter")
    ] = None,
    max_lat: Annotated[
        Optional[float],
        typer.Option("--max-lat",
        help="Maximum latitude filter")
    ] = None,
    min_lon: Annotated[
        Optional[float],
        typer.Option("--min-lon",
        help="Minimum longitude filter")
    ] = None,
    max_lon: Annotated[
        Optional[float],
        typer.Option("--max-lon",
        help="Maximum longitude filter")
    ] = None,
    status: Annotated[
        Optional[str],
        typer.Option("--status",
        help="Status filter")
    ] = None,
    station: Annotated[
        Optional[str],
        typer.Option("--station", "-S",
        help="Station filter")
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Result limit")
    ] = 10000,
    origin_time: Annotated[
        Optional[str],
        typer.Option("--origin-time",
        help="Origin time for add (YYYY-MM-DD HH:MM:SS)")
    ] = None,
    latitude: Annotated[
        Optional[float],
        typer.Option("--lat",
        help="Latitude for add/update")
    ] = None,
    longitude: Annotated[
        Optional[float],
        typer.Option("--lon",
        help="Longitude for add/update")
    ] = None,
    depth: Annotated[
        float,
        typer.Option("--depth",
        help="Depth in km for add/update")
    ] = 10.0,
    magnitude: Annotated[
        Optional[float],
        typer.Option("--magnitude", "--mag",
        help="Magnitude for add/update")
    ] = None,
    magnitude_type: Annotated[
        str,
        typer.Option("--mag-type",
        help="Magnitude type")
    ] = "ML",
    entry_status: Annotated[
        Optional[str],
        typer.Option("--entry-status",
        help="Status for add/update")
    ] = None,
    output: Annotated[
        Optional[str],
        typer.Option("--output", "-o",
        help="Output file path for export")
    ] = None,
    analyst: Annotated[
        str,
        typer.Option("--analyst", "-a",
        help="Analyst name for modifications")
    ] = "anonymous",
    comment: Annotated[
        Optional[str],
        typer.Option("--comment", "-m",
        help="Comment or reason for change")
    ] = None,
    version: Annotated[
        Optional[int],
        typer.Option("--version", "-v",
        help="Version number for revert")
    ] = None,
) -> None:
    """Manage earthquake catalog with full CRUD and version tracking.

    Actions:
      list     - List catalog entries
      show     - Show detailed entry with picks
      add      - Add new catalog entry
      update   - Update existing entry
      delete   - Delete catalog entry
      search   - Search with filters
      export   - Export to CSV
      stats    - Show catalog statistics
      history  - Show version history
      revert   - Revert to previous version

    Examples:

      # List catalog entries:
      $ seedwork catalog list --start 2026-06-01 --min-mag 3.0

      # Show entry details:
      $ seedwork catalog show --id 42

      # Search by location:
      $ seedwork catalog search --min-lat 30 --max-lat 35 --min-lon 104 --max-lon 108

      # Export to CSV:
      $ seedwork catalog export --start 2026-06 --output catalog_june.csv

      # Show statistics:
      $ seedwork catalog stats --start 2026-06-01 --end 2026-06-30

      # Show version history:
      $ seedwork catalog history --id 42

      # Revert to version 2:
      $ seedwork catalog revert --id 42 --version 2 --analyst "Zhang Wei" --comment "Correct location"
    """
    cm = get_catalog_manager()

    action = action.lower()

    if action == "list":
        entries = cm.search(
            start_date, end_date, min_mag, max_mag,
            min_lat, max_lat, min_lon, max_lon, status, station, limit=limit)

        table = Table(
            title=f"Catalog Entries ({len(entries)})",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("#", justify="right", style="dim")
        table.add_column("ID", justify="right", style="dim")
        table.add_column("Origin Time", style="bold")
        table.add_column("Lat", justify="right")
        table.add_column("Lon", justify="right")
        table.add_column("Depth(km)", justify="right")
        table.add_column("Mag", justify="right")
        table.add_column("#Sta", justify="right")
        table.add_column("Status")
        table.add_column("Analyst")

        for i, e in enumerate(entries, 1):
            mag_color = "green" if (e.magnitude or 0) < 3 else "yellow" if (e.magnitude or 0) < 5 else "red"
            status_color = "green" if e.status == "final" else "yellow" if e.status == "preliminary" else "dim"
            table.add_row(
                str(i),
                str(e.id),
                e.origin_time.strftime("%Y-%m-%d %H:%M:%S"),
                f"{e.latitude:.4f}",
                f"{e.longitude:.4f}",
                f"{e.depth:.1f}",
                f"[{mag_color}]{e.magnitude:.2f}[/{mag_color}]" if e.magnitude is not None else "",
                str(e.num_stations or 0),
                f"[{status_color}]{e.status or ''}[/{status_color}]",
                e.analyst or ""
            )
        console.print(table)

    elif action == "show":
        if catalog_id is None and event_id is None:
            console.print("[red]--id or --event is required[/red]")
            raise typer.Exit(code=1)
        cm.show_entry_detail(catalog_id, event_id)

    elif action == "add":
        if event_id is None:
            console.print("[red]--event is required for add action[/red]")
            raise typer.Exit(code=1)
        if origin_time is None:
            console.print("[red]--origin-time is required for add action[/red]")
            raise typer.Exit(code=1)
        if latitude is None or longitude is None:
            console.print("[red]--lat and --lon are required for add action[/red]")
            raise typer.Exit(code=1)
        if magnitude is None:
            console.print("[red]--magnitude is required for add action[/red]")
            raise typer.Exit(code=1)

        try:
            ot = datetime.strptime(origin_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                ot = datetime.strptime(origin_time, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                console.print("[red]Invalid origin time format. Use 'YYYY-MM-DD HH:MM:SS'[/red]")
                raise typer.Exit(code=1)

        entry = cm.add_entry(
            event_id=event_id,
            origin_time=ot,
            latitude=latitude,
            longitude=longitude,
            depth=depth,
            magnitude=magnitude,
            magnitude_type=magnitude_type,
            status=entry_status or "preliminary",
            analyst=analyst,
            comments=comment
        )
        if entry:
            console.print(
                Panel.fit(
                    f"Catalog entry #{entry.id} created successfully\n"
                    f"Event: {event_id}\n"
                    f"Origin: {entry.origin_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                    f"Location: {entry.latitude:.4f}°N, {entry.longitude:.4f}°E\n"
                    f"Depth: {entry.depth:.1f} km\n"
                    f"Magnitude: M{magnitude_type} {magnitude:.2f}\n"
                    f"Status: {entry.status}\n"
                    f"Analyst: {entry.analyst}",
                    title="Catalog Entry Added",
                    border_style="green"
                )
            )

    elif action == "update":
        if catalog_id is None:
            console.print("[red]--id is required[/red]")
            raise typer.Exit(code=1)
        if comment is None:
            console.print("[red]--comment is required for update action[/red]")
            raise typer.Exit(code=1)

        update_kwargs = {}
        if origin_time is not None:
            try:
                ot = datetime.strptime(origin_time, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    ot = datetime.strptime(origin_time, "%Y-%m-%dT%H:%M:%S")
                except ValueError:
                    console.print("[red]Invalid origin time format. Use 'YYYY-MM-DD HH:MM:SS'[/red]")
                    raise typer.Exit(code=1)
            update_kwargs["origin_time"] = ot
        if latitude is not None:
            update_kwargs["latitude"] = latitude
        if longitude is not None:
            update_kwargs["longitude"] = longitude
        if depth is not None:
            update_kwargs["depth"] = depth
        if magnitude is not None:
            update_kwargs["magnitude"] = magnitude
            update_kwargs["magnitude_type"] = magnitude_type
        if entry_status is not None:
            update_kwargs["status"] = entry_status
        if comment is not None:
            update_kwargs["comments"] = comment

        if not update_kwargs:
            console.print("[yellow]No update parameters provided[/yellow]")
            return

        entry = cm.update_entry(catalog_id, analyst, comment, **update_kwargs)
        if entry:
            console.print(
                Panel.fit(
                    f"Catalog entry #{catalog_id} updated successfully\n"
                    f"Change: {comment}\n"
                    f"Analyst: {analyst}",
                    title="Catalog Entry Updated",
                    border_style="green"
                )
            )
        else:
            console.print(f"[red]Catalog entry #{catalog_id} not found[/red]")
            raise typer.Exit(code=1)

    elif action == "delete":
        if catalog_id is None:
            console.print("[red]--id is required[/red]")
            raise typer.Exit(code=1)
        if comment is None:
            console.print("[red]--comment is required[/red]")
            raise typer.Exit(code=1)
        success = cm.delete_entry(catalog_id, analyst, comment)
        if success:
            console.print(f"[green]Entry deleted successfully[/green]")

    elif action == "search":
        entries = cm.search(
            start_date, end_date, min_mag, max_mag,
            min_lat, max_lat, min_lon, max_lon, status, station, limit)

        table = Table(
            title=f"Search Results ({len(entries)})",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("#", justify="right", style="dim")
        table.add_column("Origin Time", style="bold")
        table.add_column("Lat", justify="right")
        table.add_column("Lon", justify="right")
        table.add_column("Depth", justify="right")
        table.add_column("Mag", justify="right")
        table.add_column("Status")
        table.add_column("Analyst")

        for i, e in enumerate(entries, 1):
            mag_color = "green" if e.magnitude < 3 else "yellow" if e.magnitude < 5 else "red"
            table.add_row(
                str(i),
                e.origin_time.strftime("%Y-%m-%d %H:%M:%S"),
                f"{e.latitude:.4f}",
                f"{e.longitude:.4f}",
                f"{e.depth:.1f}",
                f"[{mag_color}]{e.magnitude:.2f}[/{mag_color}]",
                e.status or "",
                e.analyst or ""
            )
        console.print(table)

    elif action == "export":
        if output is None:
            output = f"catalog_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        count = cm.export_to_csv(output, start_date, end_date, min_mag)
        console.print(f"[green]Exported {count} entries to {output}[/green]")

    elif action == "stats":
        stats = cm.get_statistics(start_date, end_date)
        table = Table(
            title="Catalog Statistics",
            show_header=True,
            header_style="bold cyan"
        )
        table.add_column("Metric")
        table.add_column("Value", justify="right")
        table.add_row("Total Events", str(stats.get("count", 0)))
        if stats.get("count", 0) > 0:
            table.add_row("Min Magnitude", f"{stats.get('min_magnitude', 0):.2f}")
            table.add_row("Max Magnitude", f"{stats.get('max_magnitude', 0):.2f}")
            table.add_row("Avg Magnitude", f"{stats.get('avg_magnitude', 0):.2f}")
            for s, c in stats.get("by_status", {}).items():
                table.add_row(f"Status: {s}", str(c))
            for r, c in stats.get("by_magnitude_range", {}).items():
                table.add_row(f"Mag {r}", str(c))
        console.print(table)

    elif action == "history":
        if catalog_id is None:
            console.print("[red]--id is required[/red]")
            raise typer.Exit(code=1)
        cm.show_version_history(catalog_id)

    elif action == "revert":
        if catalog_id is None:
            console.print("[red]--id is required[/red]")
            raise typer.Exit(code=1)
        if version is None:
            console.print("[red]--version is required[/red]")
            raise typer.Exit(code=1)
        if comment is None:
            console.print("[red]--comment is required[/red]")
            raise typer.Exit(code=1)
        entry = cm.revert_to_version(catalog_id, version, analyst, comment)
        if entry:
            console.print(f"[green]Reverted successfully[/green]")

    else:
        console.print(f"[red]Unknown action: {action}[/red]")
        raise typer.Exit(code=1)


# ---------------------------------------------------------------------------
# quality command
# ---------------------------------------------------------------------------
@app.command("quality")
def quality(
    action: Annotated[
        str,
        typer.Argument(...,
        help="Action: analyze, alerts, summary")
    ],
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date (YYYY-MM-DD)")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end", "-e",
        help="End date (YYYY-MM-DD)")
    ] = None,
    stations: Annotated[
        Optional[list[str]],
        typer.Option("--station", "-S",
        help="Filter by station, repeatable")
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Result limit")
    ] = 100,
    min_continuity: Annotated[
        float,
        typer.Option("--min-continuity",
        help="Minimum continuity rate threshold")
    ] = 0.95,
    min_snr: Annotated[
        float,
        typer.Option("--min-snr",
        help="Minimum SNR threshold (dB)")
    ] = 3.0,
    max_clock: Annotated[
        float,
        typer.Option("--max-clock",
        help="Maximum clock bias threshold (ms)")
    ] = 1.0,
    unresolved_only: Annotated[
        bool,
        typer.Option("--unresolved",
        help="Show only unresolved alerts")
    ] = True,
) -> None:
    """Analyze waveform quality and generate alerts.

    Computes continuity rate, SNR, clock bias, DC offset per station per day.
    Alerts on thresholds: continuity <95%, SNR <3dB, clock >1ms bias.

    Actions:
      analyze  - Analyze quality for date range
      alerts   - Show quality alerts
      summary  - Show quality summary

    Examples:

      # Analyze yesterday's quality:
      $ seedwork quality analyze --start 2026-06-20

      # Analyze date range:
      $ seedwork quality analyze --start 2026-06-01 --end 2026-06-10

      # Show active alerts:
      $ seedwork quality alerts --start 2026-06-01

      # Show quality summary:
      $ seedwork quality summary --start 2026-06-01 --end 2026-06-30
    """
    qa = get_quality_analyzer()
    qa.min_continuity_rate = min_continuity
    qa.min_snr_db = min_snr
    qa.max_clock_bias_ms = max_clock

    action = action.lower()

    if action == "analyze":
        if start_date is None:
            start_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        qa.analyze_range(start_date, end_date, stations)

    elif action == "alerts":
        qa.show_alerts(start_date, end_date, unresolved_only, limit)

    elif action == "summary":
        qa.show_quality_summary(start_date, end_date)

    else:
        console.print(f"[red]Unknown action: {action}[/red]")
        raise typer.Exit(code=1)


# ---------------------------------------------------------------------------
# station command
# ---------------------------------------------------------------------------
@app.command("station")
def station_cmd(
    action: Annotated[
        str,
        typer.Argument(...,
        help="Action: init, list, health, add, update")
    ],
    network: Annotated[
        Optional[str],
        typer.Option("--network", "-n",
        help="Network code")
    ] = None,
    station_name: Annotated[
        Optional[str],
        typer.Option("--station", "-S",
        help="Station code")
    ] = None,
    latitude: Annotated[
        Optional[float],
        typer.Option("--lat",
        help="Station latitude")
    ] = None,
    longitude: Annotated[
        Optional[float],
        typer.Option("--lon",
        help="Station longitude")
    ] = None,
    elevation: Annotated[
        Optional[float],
        typer.Option("--elev",
        help="Station elevation (m)")
    ] = None,
    channels: Annotated[
        Optional[str],
        typer.Option("--channels", "-c",
        help="Comma-separated channel codes")
    ] = None,
    sample_rate: Annotated[
        float,
        typer.Option("--sample-rate", "-r",
        help="Sample rate (Hz)")
    ] = 100.0,
    active_only: Annotated[
        bool,
        typer.Option("--active/--all",
        help="Show only active stations")
    ] = True,
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date for health query")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end", "-e",
        help="End date for health query")
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Result limit")
    ] = 85,
) -> None:
    """Manage station metadata and initialization.

    Actions:
      init    - Initialize stations from config.json (85 stations)
      list    - List all stations
      health  - Show station health statistics
      add     - Add a new station
      update  - Update station metadata

    Examples:

      # Initialize all 85 stations from config:
      $ seedwork station init

      # List all stations:
      $ seedwork station list

      # List active stations:
      $ seedwork station list --active

      # Show station health:
      $ seedwork station health --station SC.STA01 --start 2026-06-01

      # Add a new station:
      $ seedwork station add --network XX --station NEW01 \\
          --lat 30.5 --lon 105.0 --elev 500 --channels BHE,BHN,BHZ
    """
    sm = get_station_manager()
    action = action.lower()

    if action == "init":
        count = sm.init_stations_from_config()
        console.print(
            Panel.fit(
                f"[green]Initialized {count} stations from config.json[/green]",
                title="Station Initialization",
                border_style="green"
            )
        )

    elif action == "list":
        sm.list_stations(active_only)

    elif action == "health":
        if station_name is None:
            console.print("[red]--station is required for health action[/red]")
            raise typer.Exit(code=1)
        if "." in station_name:
            net, sta = station_name.split(".", 1)
        else:
            net = network or "SC"
            sta = station_name
        sm.show_station_health(net, sta, start_date, end_date)

    elif action == "add":
        if not network or not station_name or latitude is None or longitude is None:
            console.print("[red]--network, --station, --lat, --lon are required[/red]")
            raise typer.Exit(code=1)
        ch_list = channels.split(",") if channels else ["BHE", "BHN", "BHZ"]
        st = sm.add_station(
            network=network,
            station=station_name,
            latitude=latitude,
            longitude=longitude,
            elevation=elevation or 0.0,
            channels=ch_list,
            sample_rate=sample_rate
        )
        console.print(f"[green]Station {st.network}.{st.station} added successfully[/green]")

    elif action == "update":
        if not station_name:
            console.print("[red]--station is required for update action[/red]")
            raise typer.Exit(code=1)
        if "." in station_name:
            net, sta = station_name.split(".", 1)
        else:
            net = network or "SC"
            sta = station_name

        kwargs = {}
        if latitude is not None:
            kwargs["latitude"] = latitude
        if longitude is not None:
            kwargs["longitude"] = longitude
        if elevation is not None:
            kwargs["elevation"] = elevation
        if channels is not None:
            kwargs["channels"] = channels.split(",")

        if not kwargs:
            console.print("[yellow]No update parameters provided[/yellow]")
            return

        result = sm.update_station(net, sta, **kwargs)
        if result:
            console.print(f"[green]Station {net}.{sta} updated successfully[/green]")
        else:
            console.print(f"[red]Station {net}.{sta} not found[/red]")
            raise typer.Exit(code=1)

    else:
        console.print(f"[red]Unknown action: {action}[/red]")
        raise typer.Exit(code=1)


# ---------------------------------------------------------------------------
# report command
# ---------------------------------------------------------------------------
@app.command("report")
def report(
    year: Annotated[
        Optional[int],
        typer.Option("--year", "-y",
        help="Year for report")
    ] = None,
    month: Annotated[
        Optional[int],
        typer.Option("--month", "-m",
        help="Month for report (1-12)")
    ] = None,
    output_dir: Annotated[
        str,
        typer.Option("--output", "-o",
        help="Output directory")
    ] = "./reports",
    show_stations: Annotated[
        bool,
        typer.Option("--stations",
        help="Show station availability ranking")
    ] = False,
    show_health: Annotated[
        Optional[str],
        typer.Option("--health",
        help="Show station health")
    ] = None,
    limit: Annotated[
        int,
        typer.Option("--limit", "-n",
        help="Result limit")
    ] = 85,
    start_date: Annotated[
        Optional[str],
        typer.Option("--start", "-s",
        help="Start date for rankings")
    ] = None,
    end_date: Annotated[
        Optional[str],
        typer.Option("--end", "-e",
        help="End date for rankings")
    ] = None,
) -> None:
    """Generate station operation reports and rankings.

    Generates monthly CSV reports with station availability rankings,
    fault statistics, and quality trends.

    Examples:

      # Generate monthly report:
      $ seedwork report --year 2026 --month 6

      # Show station availability ranking:
      $ seedwork report --stations --limit 20

      # Show specific station health:
      $ seedwork report --health XX.STA01

      # Show ranking for date range:
      $ seedwork report --stations --start 2026-06-01 --end 2026-06-30
    """
    sm = get_station_manager()

    if show_stations:
        sm.show_availability_ranking(start_date, end_date, limit)
    elif show_health:
        if "." in show_health:
            net, sta = show_health.split(".", 1)
            sm.show_station_health(net, sta, start_date, end_date)
        else:
            sm.show_station_health("", show_health, start_date, end_date)
    elif year and month:
        qa = get_quality_analyzer()
        filepath = qa.generate_monthly_report(year, month, output_dir)
        console.print(f"[green]Report saved to: {filepath}[/green]")
    else:
        console.print("[yellow]Specify --year/--month or --stations or --health[/yellow]")
        raise typer.Exit(code=1)


def main_entry():
    """Entry point for the CLI."""
    try:
        app()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        raise typer.Exit(code=130)
    except Exception as e:
        logger.error(f"[red]Error: {e}[/red]")
        raise


if __name__ == "__main__":
    main_entry()
