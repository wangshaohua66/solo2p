import typer
from typing import Optional
from datetime import date
from rich.console import Console
from rich.table import Table
from cli.commands.ui import (
    color_block, get_color_hex, print_success, print_error, print_warning,
    print_info, print_json, create_table, set_no_color, rating_stars,
    print_header, two_column_layout
)
from core.journal import JournalManager
from core.inventory import InkManager
from core.ink_model import JournalEntryCreate
from utils.logger import get_logger

logger = get_logger()
app = typer.Typer(help="Writing journal and pen-ink-paper tracking")
console = Console()


@app.command("add")
def add_entry(
    entry_date: Optional[str] = typer.Option(None, "--date", "-d", help="Date (YYYY-MM-DD, default today)"),
    pen: str = typer.Option(..., "--pen", "-p", help="Pen model"),
    nib: Optional[str] = typer.Option(None, "--nib", "-n", help="Nib size/type"),
    ink_id: int = typer.Option(..., "--ink", "-i", help="Ink ID"),
    paper: str = typer.Option(..., "--paper", help="Paper brand/type"),
    humidity: Optional[int] = typer.Option(None, "--humidity", help="Humidity %"),
    rating: int = typer.Option(..., "--rating", "-r", min=1, max=5, help="Rating 1-5"),
    notes: Optional[str] = typer.Option(None, "--notes", help="Writing notes"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Add a writing journal entry with pen-ink-paper combination."""
    try:
        set_no_color(no_color)

        if entry_date:
            d = date.fromisoformat(entry_date)
        else:
            d = date.today()

        ink_mgr = InkManager()
        ink = ink_mgr.get_ink(ink_id)

        entry_create = JournalEntryCreate(
            date=d,
            pen=pen,
            nib=nib,
            ink_id=ink_id,
            paper=paper,
            humidity=humidity,
            rating=rating,
            notes=notes,
        )

        journal_mgr = JournalManager()
        entry = journal_mgr.add_entry(entry_create)

        if json_output:
            print_json({
                "id": entry.id,
                "date": entry.date.isoformat(),
                "pen": entry.pen,
                "nib": entry.nib,
                "ink_id": entry.ink_id,
                "ink_name": ink.full_name(),
                "paper": entry.paper,
                "humidity": entry.humidity,
                "rating": entry.rating,
                "notes": entry.notes,
            })
            return

        print_success(f"Added journal entry #{entry.id}")

        left_panel = f"""
[bold]Date[/bold]: {entry.date.isoformat()}
[bold]Pen[/bold]: {entry.pen}
[bold]Nib[/bold]: {entry.nib or 'N/A'}
[bold]Humidity[/bold]: {entry.humidity or 'N/A'}%
        """.strip()

        right_panel = f"""
[bold]Ink[/bold]: {color_block(ink.cielab)} {ink.full_name()}
[bold]Paper[/bold]: {entry.paper}
[bold]Rating[/bold]: {rating_stars(entry.rating)}
        """.strip()

        console.print()
        console.print(two_column_layout(left_panel, right_panel, left_width=35))

        if entry.notes:
            console.print()
            console.print(f"[bold]Notes:[/bold] {entry.notes}")

    except Exception as e:
        logger.error(f"Failed to add journal entry: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("list")
def list_entries(
    pen: Optional[str] = typer.Option(None, "--pen", help="Filter by pen"),
    ink_id: Optional[int] = typer.Option(None, "--ink", help="Filter by ink ID"),
    paper: Optional[str] = typer.Option(None, "--paper", help="Filter by paper"),
    min_rating: Optional[int] = typer.Option(None, "--min-rating", help="Minimum rating"),
    max_rating: Optional[int] = typer.Option(None, "--max-rating", help="Maximum rating"),
    date_from: Optional[str] = typer.Option(None, "--from", help="From date (YYYY-MM-DD)"),
    date_to: Optional[str] = typer.Option(None, "--to", help="To date (YYYY-MM-DD)"),
    limit: Optional[int] = typer.Option(50, "--limit", help="Limit results"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """List journal entries with multi-dimensional filtering."""
    try:
        set_no_color(no_color)

        d_from = date.fromisoformat(date_from) if date_from else None
        d_to = date.fromisoformat(date_to) if date_to else None

        journal_mgr = JournalManager()
        entries = journal_mgr.list_entries(
            pen=pen,
            ink_id=ink_id,
            paper=paper,
            min_rating=min_rating,
            max_rating=max_rating,
            date_from=d_from,
            date_to=d_to,
            limit=limit,
        )

        if json_output:
            result = []
            for entry in entries:
                ink_name = entry.ink.full_name() if entry.ink else f"Ink #{entry.ink_id}"
                result.append({
                    "id": entry.id,
                    "date": entry.date.isoformat(),
                    "pen": entry.pen,
                    "nib": entry.nib,
                    "ink_id": entry.ink_id,
                    "ink_name": ink_name,
                    "paper": entry.paper,
                    "humidity": entry.humidity,
                    "rating": entry.rating,
                    "notes": entry.notes,
                })
            print_json(result)
            return

        if not entries:
            print_warning("No journal entries found")
            return

        table = create_table(f"Journal Entries ({len(entries)})", [
            "ID", "Date", "Pen", "Ink", "Paper", "Rating", "Humidity"
        ])

        for entry in entries:
            ink_color = ""
            ink_name = f"Ink #{entry.ink_id}"
            if entry.ink:
                ink_color = color_block(entry.ink.cielab)
                ink_name = entry.ink.color_name

            table.add_row(
                str(entry.id),
                entry.date.isoformat(),
                entry.pen,
                f"{ink_color} {ink_name}",
                entry.paper,
                rating_stars(entry.rating),
                f"{entry.humidity}%" if entry.humidity else "N/A",
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to list journal entries: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("show")
def show_entry(
    entry_id: int = typer.Argument(..., help="Journal entry ID"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Show detailed information about a journal entry."""
    try:
        set_no_color(no_color)

        journal_mgr = JournalManager()
        entry = journal_mgr.get_entry(entry_id)

        if json_output:
            ink_name = entry.ink.full_name() if entry.ink else f"Ink #{entry.ink_id}"
            print_json({
                "id": entry.id,
                "date": entry.date.isoformat(),
                "pen": entry.pen,
                "nib": entry.nib,
                "ink_id": entry.ink_id,
                "ink_name": ink_name,
                "paper": entry.paper,
                "humidity": entry.humidity,
                "rating": entry.rating,
                "notes": entry.notes,
                "created_at": entry.created_at.isoformat(),
            })
            return

        print_header(f"Journal Entry #{entry.id}")

        ink_name = f"Ink #{entry.ink_id}"
        if entry.ink:
            ink_name = entry.ink.full_name()

        left_panel = f"""
[bold]Date[/bold]: {entry.date.isoformat()}
[bold]Pen[/bold]: {entry.pen}
[bold]Nib[/bold]: {entry.nib or 'N/A'}
[bold]Humidity[/bold]: {entry.humidity or 'N/A'}%
        """.strip()

        right_panel = f"""
[bold]Ink[/bold]: {color_block(entry.ink.cielab) if entry.ink else ''} {ink_name}
[bold]Paper[/bold]: {entry.paper}
[bold]Rating[/bold]: {rating_stars(entry.rating)}
        """.strip()

        console.print(two_column_layout(left_panel, right_panel, left_width=35))

        if entry.notes:
            console.print()
            console.print(f"[bold]Notes:[/bold] {entry.notes}")

    except Exception as e:
        logger.error(f"Failed to show journal entry: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("delete")
def delete_entry(
    entry_id: int = typer.Argument(..., help="Journal entry ID to delete"),
    force: bool = typer.Option(False, "--force", "-f", help="Skip confirmation"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Delete a journal entry."""
    try:
        set_no_color(no_color)

        from storage.sqlite_db import get_db
        db = get_db()

        row = db.query_one("SELECT * FROM journal WHERE id = ?", (entry_id,))
        if not row:
            print_error(f"Journal entry #{entry_id} not found")
            raise typer.Exit(code=1)

        if not force:
            confirm = typer.confirm(f"Are you sure you want to delete journal entry #{entry_id}?")
            if not confirm:
                print_info("Deletion cancelled")
                raise typer.Exit(code=0)

        db.execute("DELETE FROM journal WHERE id = ?", (entry_id,))

        if json_output:
            print_json({"deleted": entry_id})
        else:
            print_success(f"Deleted journal entry #{entry_id}")

    except Exception as e:
        logger.error(f"Failed to delete journal entry: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)
