#!/usr/bin/env python3
"""HAMLOG - Amateur Radio Logging Tool

A fast, terminal-based QSO logger with DXCC/WAS/WAZ award tracking
and propagation prediction.

Usage:
    hamlog qso add [options]
    hamlog qso search [options]
    hamlog qso export [options]
    hamlog qso import <file>
    hamlog award status [--band <band>]
    hamlog propagation [--band <band>]
    hamlog contest
    hamlog config [show|set]
"""

import argparse
import logging
import os
import sys
import datetime
from pathlib import Path
from typing import List, Optional

from .db import Database, get_db_path
from .config import get_config, save_config, generate_default_config, get_config_path
from .qso import QSO, QSOMANAGER, BANDS, MODES, now_utc_datetime, format_date, format_time
from .adif import parse_adif_file, export_adif, export_csv
from .awards import AwardManager
from .propagation import PropagationManager, rating_to_level
from .dxcc_data import get_continent_name

logger = logging.getLogger("hamlog")


def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    log_dir = Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "hamlog.log"

    level = logging.DEBUG if verbose else logging.INFO

    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(level)
    file_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_handler.setFormatter(file_formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    root_logger.addHandler(file_handler)


def try_rich_import():
    """Try to import rich library. Returns (Console, Table) or (None, None)."""
    try:
        from rich.console import Console
        from rich.table import Table
        from rich import box
        return Console(), Table, box
    except ImportError:
        return None, None, None


def print_info(msg: str):
    """Print info message."""
    console, _, _ = try_rich_import()
    if console:
        console.print(f"[green]INFO:[/green] {msg}")
    else:
        print(f"INFO: {msg}")


def print_warning(msg: str):
    """Print warning message."""
    console, _, _ = try_rich_import()
    if console:
        console.print(f"[yellow]WARNING:[/yellow] {msg}")
    else:
        print(f"WARNING: {msg}")


def print_error(msg: str):
    """Print error message."""
    console, _, _ = try_rich_import()
    if console:
        console.print(f"[red]ERROR:[/red] {msg}")
    else:
        print(f"ERROR: {msg}", file=sys.stderr)


def get_band_color(band: str) -> str:
    """Get color code for a band."""
    colors = {
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
    return colors.get(band, "white")


def cmd_qso_add(args, config, db):
    """Handle 'qso add' command."""
    qso_mgr = QSOMANAGER(db)

    if args.batch:
        _cmd_qso_add_batch(args, config, db, qso_mgr)
        return

    if not args.callsign:
        print_error("Callsign is required (use -c/--callsign)")
        sys.exit(1)

    now = now_utc_datetime()

    qso_date = args.date or format_date(now)
    qso_time = args.time or format_time(now)

    qso = QSO(
        callsign=args.callsign,
        qso_date=qso_date,
        qso_time=qso_time,
        band=args.band or config["preferences"].get("default_band", "20m"),
        mode=args.mode or config["preferences"].get("default_mode", "SSB"),
        freq=args.freq,
        rst_sent=args.rst_sent,
        rst_rcvd=args.rst_rcvd,
        grid=args.grid,
        name=args.name,
        qth=args.qth,
        state=args.state,
        cq_zone=args.cq_zone,
        ituzone=args.ituzone,
        dxcc=args.dxcc,
        country=args.country,
        operator=config["operator"].get("callsign") or None,
        station_callsign=config["operator"].get("callsign") or None,
        my_grid=config["operator"].get("grid") or None,
        tx_pwr=config["operator"].get("tx_pwr") or None,
        rig=config["operator"].get("rig") or None,
        antenna=config["operator"].get("antenna") or None,
        comment=args.comment,
        notes=args.notes,
        contest_id=args.contest_id,
        srx=args.srx,
        srx_string=args.srx_string,
        stx=args.stx,
        stx_string=args.stx_string,
    )

    try:
        qso_id = qso_mgr.add(qso)
        print_info(f"Added QSO #{qso_id}: {qso.callsign} on {qso.band} {qso.mode} at {qso.qso_date} {qso.qso_time}Z")
    except ValueError as e:
        print_error(str(e))
        sys.exit(1)


def _cmd_qso_add_batch(args, config, db, qso_mgr):
    """Handle batch QSO addition from stdin."""
    import sys

    default_band = args.band or config["preferences"].get("default_band", "20m")
    default_mode = args.mode or config["preferences"].get("default_mode", "SSB")

    success = 0
    skipped = 0
    errors = 0

    for line in sys.stdin:
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        parts = line.split(None, 3)
        if not parts:
            continue

        callsign = parts[0].upper()
        band = default_band
        mode = default_mode
        rst_rcvd = None

        if len(parts) >= 2:
            if parts[1].lower() in [b.lower() for b in BANDS]:
                band = parts[1].lower()
            elif parts[1].upper() in MODES:
                mode = parts[1].upper()
            else:
                rst_rcvd = parts[1]

        if len(parts) >= 3:
            if parts[2].upper() in MODES:
                mode = parts[2].upper()
            else:
                rst_rcvd = parts[2]

        if len(parts) >= 4:
            rst_rcvd = parts[3]

        now = now_utc_datetime()

        qso = QSO(
            callsign=callsign,
            qso_date=format_date(now),
            qso_time=format_time(now),
            band=band,
            mode=mode,
            rst_sent=args.rst_sent or "59",
            rst_rcvd=rst_rcvd,
            operator=config["operator"].get("callsign") or None,
            station_callsign=config["operator"].get("callsign") or None,
            my_grid=config["operator"].get("grid") or None,
        )

        try:
            qso_mgr.add(qso)
            success += 1
            print_info(f"Added: {callsign} on {band} {mode}")
        except ValueError as e:
            if "Duplicate" in str(e):
                skipped += 1
                print_warning(f"Duplicate: {callsign}")
            else:
                errors += 1
                print_error(f"Error ({callsign}): {e}")

    print_info(f"Batch import complete: {success} added, {skipped} duplicates, {errors} errors")


def cmd_qso_search(args, config, db):
    """Handle 'qso search' command."""
    qso_mgr = QSOMANAGER(db)

    bands = [args.band] if args.band else None
    modes = [args.mode] if args.mode else None

    qsos = qso_mgr.search(
        callsign=args.callsign,
        callsign_regex=args.regex,
        date_from=args.date_from,
        date_to=args.date_to,
        bands=bands,
        modes=modes,
        dxcc=args.dxcc,
        state=args.state,
        cq_zone=args.cq_zone,
        limit=args.limit or 1000,
        offset=args.offset or 0,
    )

    if not qsos:
        print_info("No QSOs found.")
        return

    console, Table, box = try_rich_import()

    if console and Table:
        table = Table(
            title=f"QSO Search Results ({len(qsos)} found)",
            box=box.SIMPLE,
        )
        table.add_column("Call", style="bold")
        table.add_column("Date")
        table.add_column("Time")
        table.add_column("Band", style=get_band_color(args.band or ""))
        table.add_column("Mode")
        table.add_column("RST Rcvd")
        table.add_column("Grid")
        table.add_column("Country")

        for qso in qsos:
            band_color = get_band_color(qso.band)
            table.add_row(
                qso.callsign,
                qso.qso_date,
                qso.qso_time + "Z",
                f"[{band_color}]{qso.band}[/{band_color}]",
                qso.mode,
                qso.rst_rcvd or "",
                qso.grid or "",
                qso.country or "",
            )

        console.print(table)
    else:
        print(f"Found {len(qsos)} QSOs:")
        print(f"{'Call':<12} {'Date':<10} {'Time':<7} {'Band':<6} {'Mode':<6} {'Grid':<7} {'Country'}")
        print("-" * 80)
        for qso in qsos:
            print(
                f"{qso.callsign:<12} {qso.qso_date:<10} {qso.qso_time + 'Z':<7} "
                f"{qso.band:<6} {qso.mode:<6} {(qso.grid or ''):<7} {qso.country or ''}"
            )


def cmd_qso_export(args, config, db):
    """Handle 'qso export' command."""
    qso_mgr = QSOMANAGER(db)

    bands = args.band.split(",") if args.band else None
    modes = args.mode.split(",") if args.mode else None

    qsos = qso_mgr.search(
        callsign=args.callsign,
        date_from=args.date_from,
        date_to=args.date_to,
        bands=bands,
        modes=modes,
        limit=100000,
    )

    if not qsos:
        print_info("No QSOs to export.")
        return

    fmt = args.format.lower()

    if fmt == "adif":
        output = export_adif(qsos)
    elif fmt == "csv":
        output = export_csv(qsos)
    else:
        print_error(f"Unknown format: {fmt}")
        sys.exit(1)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print_info(f"Exported {len(qsos)} QSOs to {args.output}")
    else:
        print(output)


def cmd_qso_import(args, config, db):
    """Handle 'qso import' command."""
    qso_mgr = QSOMANAGER(db)

    if not os.path.exists(args.file):
        print_error(f"File not found: {args.file}")
        sys.exit(1)

    try:
        qsos = parse_adif_file(args.file)
    except Exception as e:
        print_error(f"Failed to parse ADIF file: {e}")
        sys.exit(1)

    success = 0
    skipped = 0
    errors = 0

    for qso in qsos:
        try:
            qso_mgr.add(qso)
            success += 1
        except ValueError as e:
            if "Duplicate" in str(e):
                skipped += 1
            else:
                errors += 1
                logger.warning("Import error: %s", e)

    print_info(
        f"Import complete: {success} added, {skipped} duplicates skipped, {errors} errors"
    )


def cmd_award_status(args, config, db):
    """Handle 'award status' command."""
    award_mgr = AwardManager(db)
    band = args.band

    console, Table, box = try_rich_import()

    dxcc = award_mgr.dxcc_status(band=band)
    was = award_mgr.was_status(band=band)
    waz = award_mgr.waz_status(band=band)
    dxcc_by_cont = award_mgr.dxcc_by_continent(band=band)

    band_info = f" ({band})" if band else ""

    if console and Table:
        table = Table(
            title=f"Award Progress{band_info}",
            box=box.SIMPLE,
        )
        table.add_column("Award")
        table.add_column("Worked", justify="right")
        table.add_column("Total", justify="right")
        table.add_column("Progress", justify="right")
        table.add_column("Status")

        status_color = "green" if dxcc.percentage >= 90 else "yellow" if dxcc.percentage >= 50 else "red"
        table.add_row(
            "DXCC",
            str(dxcc.worked),
            str(dxcc.total),
            f"[{status_color}]{dxcc.percentage:.1f}%[/{status_color}]",
            f"{len(dxcc.missing)} missing",
        )

        was_color = "green" if was.percentage >= 90 else "yellow" if was.percentage >= 50 else "red"
        table.add_row(
            "WAS",
            str(was.worked),
            str(was.total),
            f"[{was_color}]{was.percentage:.1f}%[/{was_color}]",
            f"{len(was.missing)} missing",
        )

        waz_color = "green" if waz.percentage >= 90 else "yellow" if waz.percentage >= 50 else "red"
        table.add_row(
            "WAZ (CQ Zones)",
            str(waz.worked),
            str(waz.total),
            f"[{waz_color}]{waz.percentage:.1f}%[/{waz_color}]",
            f"{len(waz.missing)} missing",
        )

        console.print(table)

        cont_table = Table(title="DXCC by Continent", box=box.SIMPLE)
        cont_table.add_column("Continent")
        cont_table.add_column("Worked", justify="right")
        cont_table.add_column("Total", justify="right")
        cont_table.add_column("%", justify="right")

        for cont, (worked, total) in dxcc_by_cont.items():
            pct = f"{worked/total*100:.1f}%" if total > 0 else "N/A"
            cont_table.add_row(get_continent_name(cont), str(worked), str(total), pct)

        console.print(cont_table)

        if args.show_missing and dxcc.missing:
            print("\nMissing DXCC entities:")
            for i, name in enumerate(dxcc.missing[:20], 1):
                print(f"  {i:2d}. {name}")
            if len(dxcc.missing) > 20:
                print(f"  ... and {len(dxcc.missing) - 20} more")
    else:
        print(f"Award Progress{band_info}")
        print("=" * 50)
        print(f"DXCC:    {dxcc.worked}/{dxcc.total} ({dxcc.percentage:.1f}%) - {len(dxcc.missing)} missing")
        print(f"WAS:     {was.worked}/{was.total} ({was.percentage:.1f}%) - {len(was.missing)} missing")
        print(f"WAZ:     {waz.worked}/{waz.total} ({waz.percentage:.1f}%) - {len(waz.missing)} missing")
        print()
        print("DXCC by Continent:")
        for cont, (worked, total) in dxcc_by_cont.items():
            pct = f"{worked/total*100:.1f}%" if total > 0 else "N/A"
            print(f"  {get_continent_name(cont):<20} {worked:>3d}/{total:<3d} {pct}")


def cmd_propagation(args, config, db):
    """Handle 'propagation' command."""
    prop_mgr = PropagationManager(db)
    console, Table, box = try_rich_import()

    print_info("Fetching solar data...")
    solar = prop_mgr.get_solar_data()

    if not solar:
        print_warning("Could not fetch solar data. Showing cached data if available.")
        solar = prop_mgr.get_solar_data(force_refresh=False)

    if not solar:
        print_error("No solar data available.")
        sys.exit(1)

    if console and Table:
        table = Table(title="Solar Activity Indices", box=box.SIMPLE)
        table.add_column("Index")
        table.add_column("Value", justify="right")
        table.add_column("Status")

        sfi_status = "Excellent" if solar.sfi > 150 else "Good" if solar.sfi > 100 else "Fair" if solar.sfi > 70 else "Poor"
        a_status = "Calm" if solar.a_index < 15 else "Active" if solar.a_index < 30 else "Stormy"
        k_status = "Calm" if solar.k_index < 3 else "Active" if solar.k_index < 5 else "Stormy"

        sfi_color = "green" if solar.sfi > 100 else "yellow" if solar.sfi > 70 else "red"
        a_color = "green" if solar.a_index < 15 else "yellow" if solar.a_index < 30 else "red"
        k_color = "green" if solar.k_index < 3 else "yellow" if solar.k_index < 5 else "red"

        table.add_row("SFI (Solar Flux Index)", f"[{sfi_color}]{solar.sfi:.0f}[/{sfi_color}]", sfi_status)
        table.add_row("A-Index", f"[{a_color}]{solar.a_index}[/{a_color}]", a_status)
        table.add_row("K-Index", f"[{k_color}]{solar.k_index:.1f}[/{k_color}]", k_status)
        table.add_row("SSN (Sunspot Number)", str(solar.ssn), "")
        table.add_row("Solar Wind Speed", f"{solar.solar_wind_speed:.1f} km/s", "")

        console.print(table)

        band_props = prop_mgr.calculate_band_propagation(solar)

        if args.band:
            for bp in band_props:
                if bp.band == args.band:
                    band_table = Table(title=f"Propagation: {bp.band}", box=box.SIMPLE)
                    band_table.add_column("Time")
                    band_table.add_column("Rating", justify="right")
                    band_table.add_column("Level")
                    band_table.add_column("Best Direction")

                    day_level = rating_to_level(bp.day_rating)
                    night_level = rating_to_level(bp.night_rating)

                    day_color = get_prop_color(bp.day_rating)
                    night_color = get_prop_color(bp.night_rating)

                    band_table.add_row(
                        "Day", f"[{day_color}]{bp.day_rating}[/{day_color}]", day_level, bp.best_direction
                    )
                    band_table.add_row(
                        "Night", f"[{night_color}]{bp.night_rating}[/{night_color}]", night_level, bp.best_direction
                    )

                    console.print(band_table)
                    break
        else:
            band_table = Table(title="Band Propagation Outlook", box=box.SIMPLE)
            band_table.add_column("Band")
            band_table.add_column("Day", justify="right")
            band_table.add_column("Night", justify="right")
            band_table.add_column("Best Direction")

            for bp in band_props:
                band_color = get_band_color(bp.band)
                day_color = get_prop_color(bp.day_rating)
                night_color = get_prop_color(bp.night_rating)

                band_table.add_row(
                    f"[{band_color}]{bp.band}[/{band_color}]",
                    f"[{day_color}]{bp.day_rating}[/{day_color}]",
                    f"[{night_color}]{bp.night_rating}[/{night_color}]",
                    bp.best_direction,
                )

            console.print(band_table)

        suggested = prop_mgr.get_suggested_band()
        print_info(f"Recommended band right now: {suggested}")
    else:
        print("Solar Activity Indices")
        print("=" * 50)
        print(f"SFI:  {solar.sfi:.0f}")
        print(f"A-Index: {solar.a_index}")
        print(f"K-Index: {solar.k_index:.1f}")
        print(f"SSN:  {solar.ssn}")
        print()

        band_props = prop_mgr.calculate_band_propagation(solar)
        print(f"{'Band':<8} {'Day':>5} {'Night':>5}  Best Direction")
        print("-" * 50)
        for bp in band_props:
            print(
                f"{bp.band:<8} {bp.day_rating:>5d} {bp.night_rating:>5d}  {bp.best_direction}"
            )

        suggested = prop_mgr.get_suggested_band()
        print(f"\nRecommended band: {suggested}")


def get_prop_color(rating: int) -> str:
    """Get color for propagation rating."""
    if rating >= 80:
        return "green"
    elif rating >= 50:
        return "yellow"
    elif rating >= 30:
        return "orange"
    else:
        return "red"


def cmd_contest(args, config, db):
    """Handle 'contest' command - fast QSO entry mode."""
    qso_mgr = QSOMANAGER(db)

    print("Contest Mode - Fast QSO Entry")
    print("=" * 50)
    print("Enter callsign to log QSO. Press Ctrl+D or 'q' to quit.")
    print()

    default_band = args.band or config["preferences"].get("default_band", "20m")
    default_mode = args.mode or config["preferences"].get("default_mode", "SSB")

    count = 0

    try:
        while True:
            try:
                line = input(f"[{default_band} {default_mode}] Callsign: ").strip()
            except EOFError:
                break

            if line.lower() in ("q", "quit", "exit"):
                break

            if not line:
                continue

            parts = line.split()
            callsign = parts[0].upper()

            rst_rcvd = None
            if len(parts) > 1:
                rst_rcvd = parts[1]

            now = now_utc_datetime()

            qso = QSO(
                callsign=callsign,
                qso_date=format_date(now),
                qso_time=format_time(now),
                band=default_band,
                mode=default_mode,
                rst_rcvd=rst_rcvd,
                rst_sent=args.rst_sent or "59",
                operator=config["operator"].get("callsign") or None,
                station_callsign=config["operator"].get("callsign") or None,
                my_grid=config["operator"].get("grid") or None,
                contest_id=args.contest_id,
            )

            try:
                qso_id = qso_mgr.add(qso)
                count += 1
                print_info(f"#{count} QSO logged: {callsign} (ID: {qso_id})")
            except ValueError as e:
                if "Duplicate" in str(e):
                    print_warning(f"Duplicate: {callsign}")
                else:
                    print_error(str(e))

    except KeyboardInterrupt:
        pass

    print()
    print_info(f"Contest session ended. {count} QSOs logged.")


def cmd_config_show(args, config, db):
    """Handle 'config show' command."""
    console, Table, box = try_rich_import()

    config_path = get_config_path()

    if console and Table:
        table = Table(title=f"Configuration ({config_path})", box=box.SIMPLE)
        table.add_column("Section")
        table.add_column("Key")
        table.add_column("Value")

        for section, values in config.items():
            if isinstance(values, dict):
                first = True
                for key, value in values.items():
                    if first:
                        table.add_row(f"[bold]{section}[/bold]", key, str(value))
                        first = False
                    else:
                        table.add_row("", key, str(value))

        console.print(table)
    else:
        print(f"Configuration file: {config_path}")
        print()
        for section, values in config.items():
            if isinstance(values, dict):
                print(f"[{section}]")
                for key, value in values.items():
                    print(f"  {key} = {value}")
                print()


def cmd_config_set(args, config, db):
    """Handle 'config set' command."""
    keys = args.key.split(".")
    if len(keys) != 2:
        print_error("Key must be in format: section.key")
        sys.exit(1)

    section, option = keys

    if section not in config:
        print_error(f"Unknown section: {section}")
        sys.exit(1)

    if not isinstance(config[section], dict):
        print_error(f"Cannot set value in non-dict section: {section}")
        sys.exit(1)

    current = config[section].get(option)
    if isinstance(current, bool):
        config[section][option] = args.value.lower() in ("true", "1", "yes", "on")
    elif isinstance(current, int):
        try:
            config[section][option] = int(args.value)
        except ValueError:
            print_error(f"Value must be an integer")
            sys.exit(1)
    elif isinstance(current, float):
        try:
            config[section][option] = float(args.value)
        except ValueError:
            print_error(f"Value must be a number")
            sys.exit(1)
    else:
        config[section][option] = args.value

    save_config(config)
    print_info(f"Set {section}.{option} = {args.value}")


def cmd_stats(args, config, db):
    """Handle 'stats' command - show overall statistics."""
    qso_mgr = QSOMANAGER(db)
    award_mgr = AwardManager(db)
    console, Table, box = try_rich_import()

    total = qso_mgr.count()
    unique_calls = len(qso_mgr.unique_callsigns())

    dxcc = award_mgr.dxcc_status()
    was = award_mgr.was_status()
    waz = award_mgr.waz_status()

    yearly = award_mgr.yearly_summary()
    band_summary = award_mgr.band_summary()

    if console and Table:
        table = Table(title="HAMLOG Statistics", box=box.SIMPLE)
        table.add_column("Metric")
        table.add_column("Value", justify="right")

        table.add_row("Total QSOs", str(total))
        table.add_row("Unique Callsigns", str(unique_calls))
        table.add_row("DXCC Entities", str(dxcc.worked))
        table.add_row("US States (WAS)", str(was.worked))
        table.add_row("CQ Zones (WAZ)", str(waz.worked))

        console.print(table)

        if yearly:
            yr_table = Table(title="Annual Summary", box=box.SIMPLE)
            yr_table.add_column("Year")
            yr_table.add_column("QSOs", justify="right")
            yr_table.add_column("Unique Calls", justify="right")
            yr_table.add_column("DXCC", justify="right")

            for yr in yearly:
                yr_table.add_row(
                    yr["year"] or "Unknown",
                    str(yr["qso_count"]),
                    str(yr["unique_calls"]),
                    str(yr["dxcc_count"]),
                )

            console.print(yr_table)

        if band_summary:
            bd_table = Table(title="Band Summary", box=box.SIMPLE)
            bd_table.add_column("Band")
            bd_table.add_column("QSOs", justify="right")
            bd_table.add_column("DXCC", justify="right")

            for bs in band_summary:
                band_color = get_band_color(bs["band"])
                bd_table.add_row(
                    f"[{band_color}]{bs['band']}[/{band_color}]",
                    str(bs["qso_count"]),
                    str(bs["dxcc_count"]),
                )

            console.print(bd_table)
    else:
        print("HAMLOG Statistics")
        print("=" * 50)
        print(f"Total QSOs:        {total}")
        print(f"Unique Callsigns:  {unique_calls}")
        print(f"DXCC Entities:     {dxcc.worked}/{dxcc.total}")
        print(f"US States:         {was.worked}/{was.total}")
        print(f"CQ Zones:          {waz.worked}/{waz.total}")
        print()

        if yearly:
            print("Annual Summary:")
            print(f"{'Year':<8} {'QSOs':>6} {'Unique':>8} {'DXCC':>6}")
            print("-" * 35)
            for yr in yearly:
                print(
                    f"{yr['year'] or 'Unknown':<8} "
                    f"{yr['qso_count']:>6} "
                    f"{yr['unique_calls']:>8} "
                    f"{yr['dxcc_count']:>6}"
                )


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser."""
    parser = argparse.ArgumentParser(
        prog="hamlog",
        description="HAMLOG - Amateur Radio Logging Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  hamlog qso add --callsign W1AW --band 20m --mode SSB
  hamlog qso search --callsign "K1%%"
  hamlog qso export --format adif --output log.adi
  hamlog qso import logbook.adi
  hamlog award status
  hamlog propagation --band 20m
  hamlog contest --band 20m --mode CW
  hamlog config show
  hamlog config set operator.callsign N0CALL
        """,
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose debug logging",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="HAMLOG 1.0.0",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    qso_parser = subparsers.add_parser(
        "qso",
        help="QSO record management",
        description="Manage QSO records",
    )
    qso_sub = qso_parser.add_subparsers(dest="qso_command")

    add_parser = qso_sub.add_parser(
        "add",
        help="Add a new QSO",
        description="Add a new QSO record. Use --batch for stdin batch mode.",
        epilog="Example: hamlog qso add -c W1AW -b 20m -m SSB\n  Batch: echo -e 'W1AW\\nK1ABC' | hamlog qso add --batch -b 20m",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    add_parser.add_argument("-c", "--callsign", help="Callsign")
    add_parser.add_argument("--batch", action="store_true", help="Batch mode: read callsigns from stdin")
    add_parser.add_argument("-b", "--band", help="Band (e.g., 20m, 40m)")
    add_parser.add_argument("-m", "--mode", help="Mode (SSB, CW, FT8, etc.)")
    add_parser.add_argument("-f", "--freq", type=float, help="Frequency in MHz")
    add_parser.add_argument("--rst-sent", help="RST sent")
    add_parser.add_argument("--rst-rcvd", help="RST received")
    add_parser.add_argument("-g", "--grid", help="Grid square")
    add_parser.add_argument("-n", "--name", help="Operator name")
    add_parser.add_argument("--qth", help="QTH location")
    add_parser.add_argument("-s", "--state", help="US State")
    add_parser.add_argument("--cq-zone", type=int, help="CQ zone")
    add_parser.add_argument("--ituzone", type=int, help="ITU zone")
    add_parser.add_argument("--dxcc", type=int, help="DXCC entity ID")
    add_parser.add_argument("--country", help="Country name")
    add_parser.add_argument("--comment", help="Comment")
    add_parser.add_argument("--notes", help="Notes")
    add_parser.add_argument("--date", help="QSO date (YYYYMMDD, default: today UTC)")
    add_parser.add_argument("--time", help="QSO time (HHMM, default: now UTC)")
    add_parser.add_argument("--contest-id", help="Contest identifier")
    add_parser.add_argument("--srx", type=int, help="Received serial number")
    add_parser.add_argument("--srx-string", help="Received exchange string")
    add_parser.add_argument("--stx", type=int, help="Sent serial number")
    add_parser.add_argument("--stx-string", help="Sent exchange string")

    search_parser = qso_sub.add_parser(
        "search",
        help="Search QSO records",
        description="Search QSO records with various filters",
        epilog="Examples:\n  hamlog qso search -c K1%%\n  hamlog qso search --from 20240101 --to 20241231 -b 20m",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    search_parser.add_argument("-c", "--callsign", help="Callsign pattern (use %% for wildcard)")
    search_parser.add_argument("--regex", help="Callsign regex pattern")
    search_parser.add_argument("--from", dest="date_from", help="Start date (YYYYMMDD)")
    search_parser.add_argument("--to", dest="date_to", help="End date (YYYYMMDD)")
    search_parser.add_argument("-b", "--band", help="Band filter")
    search_parser.add_argument("-m", "--mode", help="Mode filter")
    search_parser.add_argument("--dxcc", type=int, help="DXCC entity filter")
    search_parser.add_argument("--state", help="US State filter")
    search_parser.add_argument("--cq-zone", type=int, help="CQ zone filter")
    search_parser.add_argument("-l", "--limit", type=int, help="Max results")
    search_parser.add_argument("--offset", type=int, help="Result offset")

    export_parser = qso_sub.add_parser(
        "export",
        help="Export QSO records",
        description="Export QSO records to ADIF or CSV format",
    )
    export_parser.add_argument(
        "-f", "--format",
        choices=["adif", "csv"],
        default="adif",
        help="Export format (default: adif)",
    )
    export_parser.add_argument("-o", "--output", help="Output file (default: stdout)")
    export_parser.add_argument("-c", "--callsign", help="Filter by callsign pattern")
    export_parser.add_argument("--from", dest="date_from", help="Start date (YYYYMMDD)")
    export_parser.add_argument("--to", dest="date_to", help="End date (YYYYMMDD)")
    export_parser.add_argument("-b", "--band", help="Filter by band (comma-separated)")
    export_parser.add_argument("-m", "--mode", help="Filter by mode (comma-separated)")

    import_parser = qso_sub.add_parser(
        "import",
        help="Import QSO records from ADIF file",
        description="Import QSO records from an ADIF file",
    )
    import_parser.add_argument("file", help="ADIF file to import")

    award_parser = subparsers.add_parser(
        "award",
        help="Award progress tracking",
        description="Track DXCC, WAS, and WAZ award progress",
    )
    award_sub = award_parser.add_subparsers(dest="award_command")

    status_parser = award_sub.add_parser(
        "status",
        help="Show award progress status",
        description="Show DXCC, WAS, and WAZ award progress",
    )
    status_parser.add_argument("-b", "--band", help="Filter by band")
    status_parser.add_argument("-m", "--show-missing", action="store_true", help="Show missing entities")

    prop_parser = subparsers.add_parser(
        "propagation",
        help="Propagation prediction",
        description="Show solar activity and band propagation forecasts",
    )
    prop_parser.add_argument("-b", "--band", help="Show detailed info for a specific band")
    prop_parser.add_argument("--refresh", action="store_true", help="Force refresh from HamQSL")

    contest_parser = subparsers.add_parser(
        "contest",
        help="Contest fast entry mode",
        description="Fast QSO entry mode for contests",
    )
    contest_parser.add_argument("-b", "--band", help="Default band")
    contest_parser.add_argument("-m", "--mode", help="Default mode")
    contest_parser.add_argument("--rst-sent", default="59", help="Default RST sent")
    contest_parser.add_argument("--contest-id", help="Contest identifier")

    config_parser = subparsers.add_parser(
        "config",
        help="Configuration management",
        description="View and edit configuration",
    )
    config_sub = config_parser.add_subparsers(dest="config_command")

    config_sub.add_parser("show", help="Show current configuration")

    set_parser = config_sub.add_parser("set", help="Set a configuration value")
    set_parser.add_argument("key", help="Config key (section.key)")
    set_parser.add_argument("value", help="New value")

    subparsers.add_parser(
        "stats",
        help="Show overall statistics",
        description="Show overall logging statistics",
    )

    return parser


def main():
    """Main entry point."""
    parser = build_parser()
    args = parser.parse_args()

    setup_logging(verbose=args.verbose)

    generate_default_config()
    config = get_config()

    db = Database()
    db.init_schema()

    try:
        if args.command == "qso":
            if args.qso_command == "add":
                cmd_qso_add(args, config, db)
            elif args.qso_command == "search":
                cmd_qso_search(args, config, db)
            elif args.qso_command == "export":
                cmd_qso_export(args, config, db)
            elif args.qso_command == "import":
                cmd_qso_import(args, config, db)
            else:
                parser.parse_args(["qso", "--help"])

        elif args.command == "award":
            if args.award_command == "status":
                cmd_award_status(args, config, db)
            else:
                parser.parse_args(["award", "--help"])

        elif args.command == "propagation":
            cmd_propagation(args, config, db)

        elif args.command == "contest":
            cmd_contest(args, config, db)

        elif args.command == "config":
            if args.config_command == "show":
                cmd_config_show(args, config, db)
            elif args.config_command == "set":
                cmd_config_set(args, config, db)
            else:
                parser.parse_args(["config", "--help"])

        elif args.command == "stats":
            cmd_stats(args, config, db)

        else:
            parser.print_help()

    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(130)
    finally:
        db.close()


if __name__ == "__main__":
    main()
