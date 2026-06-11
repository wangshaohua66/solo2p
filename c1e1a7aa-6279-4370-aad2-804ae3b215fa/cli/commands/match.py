import typer
from typing import Optional
from rich.console import Console
from cli.commands.ui import (
    color_block, get_color_hex, print_success, print_error, print_warning,
    print_info, print_json, create_table, set_no_color, rating_stars,
    print_header
)
from core.journal import JournalManager
from core.inventory import InkManager
from utils.logger import get_logger

logger = get_logger()
app = typer.Typer(help="Pen-ink-paper matching recommendations")
console = Console()


@app.command("ink")
def match_ink(
    pen: str = typer.Option(..., "--pen", "-p", help="Pen model"),
    paper: str = typer.Option(..., "--paper", help="Paper type"),
    min_entries: int = typer.Option(1, "--min-entries", help="Minimum entries per ink"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Find the best inks for a specific pen and paper combination."""
    try:
        set_no_color(no_color)

        journal_mgr = JournalManager()
        ink_mgr = InkManager()

        results = journal_mgr.find_best_ink_for_pen_paper(
            pen=pen, paper=paper, min_entries=min_entries
        )

        if json_output:
            output = []
            for ink_id, avg_rating, count in results:
                try:
                    ink = ink_mgr.get_ink(ink_id)
                    output.append({
                        "ink_id": ink_id,
                        "ink_name": ink.full_name(),
                        "hex": get_color_hex(ink.cielab),
                        "avg_rating": round(avg_rating, 2),
                        "entries": count,
                    })
                except Exception:
                    output.append({
                        "ink_id": ink_id,
                        "avg_rating": round(avg_rating, 2),
                        "entries": count,
                    })
            print_json(output)
            return

        if not results:
            print_warning(f"No matches found for pen '{pen}' and paper '{paper}'")
            return

        print_header(f"Best Inks for: {pen} + {paper}")

        table = create_table("Recommendations", [
            "Rank", "Ink", "Color", "Avg Rating", "Entries"
        ])

        for rank, (ink_id, avg_rating, count) in enumerate(results, 1):
            try:
                ink = ink_mgr.get_ink(ink_id)
                color_display = f"{color_block(ink.cielab)} {get_color_hex(ink.cielab)}"
                ink_name = ink.full_name()
            except Exception:
                color_display = "N/A"
                ink_name = f"Ink #{ink_id}"

            table.add_row(
                str(rank),
                ink_name,
                color_display,
                f"{rating_stars(int(round(avg_rating)))} ({avg_rating:.2f})",
                str(count),
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to match ink: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("pen-paper")
def match_pen_paper(
    ink_id: int = typer.Option(..., "--ink", "-i", help="Ink ID"),
    min_entries: int = typer.Option(1, "--min-entries", help="Minimum entries per combo"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Find the best pen and paper combinations for a specific ink."""
    try:
        set_no_color(no_color)

        journal_mgr = JournalManager()
        ink_mgr = InkManager()
        ink = ink_mgr.get_ink(ink_id)

        results = journal_mgr.find_best_pen_paper_for_ink(
            ink_id=ink_id, min_entries=min_entries
        )

        if json_output:
            output = {
                "ink_id": ink_id,
                "ink_name": ink.full_name(),
                "hex": get_color_hex(ink.cielab),
                "recommendations": [
                    {
                        "pen": pen,
                        "paper": paper,
                        "avg_rating": round(avg_rating, 2),
                        "entries": count,
                    }
                    for pen, paper, avg_rating, count in results
                ],
            }
            print_json(output)
            return

        if not results:
            print_warning(f"No matches found for ink '{ink.full_name()}'")
            return

        print_header(f"Best Pen + Paper for: {color_block(ink.cielab)} {ink.full_name()}")

        table = create_table("Recommendations", [
            "Rank", "Pen", "Paper", "Avg Rating", "Entries"
        ])

        for rank, (pen, paper, avg_rating, count) in enumerate(results, 1):
            table.add_row(
                str(rank),
                pen,
                paper,
                f"{rating_stars(int(round(avg_rating)))} ({avg_rating:.2f})",
                str(count),
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to match pen-paper: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("pens")
def list_pens(
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """List all pens in the journal."""
    try:
        set_no_color(no_color)
        journal_mgr = JournalManager()
        pens = journal_mgr.get_all_pens()

        if json_output:
            print_json(pens)
            return

        if not pens:
            print_warning("No pens found in journal")
            return

        print_info(f"Found {len(pens)} pens in journal:")
        for pen in pens:
            console.print(f"  • {pen}")

    except Exception as e:
        logger.error(f"Failed to list pens: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("papers")
def list_papers(
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """List all papers in the journal."""
    try:
        set_no_color(no_color)
        journal_mgr = JournalManager()
        papers = journal_mgr.get_all_papers()

        if json_output:
            print_json(papers)
            return

        if not papers:
            print_warning("No papers found in journal")
            return

        print_info(f"Found {len(papers)} papers in journal:")
        for paper in papers:
            console.print(f"  • {paper}")

    except Exception as e:
        logger.error(f"Failed to list papers: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)
