import typer
from typing import Optional
from rich.console import Console
from cli.commands.ui import (
    print_success, print_error, print_warning,
    print_info, print_json, set_no_color
)
from core.exporter import Exporter
from utils.logger import get_logger

logger = get_logger()
app = typer.Typer(help="Import and export data")
console = Console()


@app.command("json")
def export_json(
    output: str = typer.Option("backup.json", "--output", "-o", help="Output JSON file path"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output result as JSON"),
):
    """Export all data as a full JSON backup."""
    try:
        set_no_color(no_color)

        exporter = Exporter()
        path = exporter.export_all_json(output)

        if json_output:
            print_json({"exported": True, "file": path, "format": "json"})
        else:
            print_success(f"Full database exported to {path}")

    except Exception as e:
        logger.error(f"Failed to export JSON: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("csv-inks")
def export_csv_inks(
    output: str = typer.Option("inks.csv", "--output", "-o", help="Output CSV file path"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output result as JSON"),
):
    """Export ink library as CSV."""
    try:
        set_no_color(no_color)

        exporter = Exporter()
        path = exporter.export_inks_csv(output)

        if json_output:
            print_json({"exported": True, "file": path, "format": "csv", "type": "inks"})
        else:
            print_success(f"Inks exported to {path}")

    except Exception as e:
        logger.error(f"Failed to export inks CSV: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("csv-journal")
def export_csv_journal(
    output: str = typer.Option("journal.csv", "--output", "-o", help="Output CSV file path"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output result as JSON"),
):
    """Export journal entries as CSV."""
    try:
        set_no_color(no_color)

        exporter = Exporter()
        path = exporter.export_journal_csv(output)

        if json_output:
            print_json({"exported": True, "file": path, "format": "csv", "type": "journal"})
        else:
            print_success(f"Journal exported to {path}")

    except Exception as e:
        logger.error(f"Failed to export journal CSV: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("recipe-pdf")
def export_recipe_pdf(
    recipe_id: int = typer.Argument(..., help="Recipe ID"),
    output: str = typer.Option("recipe.pdf", "--output", "-o", help="Output PDF file path"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output result as JSON"),
):
    """Export a recipe as a PDF recipe card."""
    try:
        set_no_color(no_color)

        exporter = Exporter()
        path = exporter.export_recipe_pdf(recipe_id, output)

        if json_output:
            print_json({"exported": True, "file": path, "format": "pdf", "recipe_id": recipe_id})
        else:
            print_success(f"Recipe PDF exported to {path}")

    except ImportError as e:
        print_error("reportlab is required for PDF export. Install with: pip install reportlab")
        raise typer.Exit(code=1)
    except Exception as e:
        logger.error(f"Failed to export recipe PDF: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("import")
def import_json(
    input_file: str = typer.Argument(..., help="Input JSON file path"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output result as JSON"),
):
    """Import data from a JSON backup file."""
    try:
        set_no_color(no_color)

        exporter = Exporter()
        counts = exporter.import_all_json(input_file)

        if json_output:
            print_json({"imported": True, "file": input_file, "counts": counts})
        else:
            print_success(f"Import completed from {input_file}")
            print_info(f"  Inks: {counts['inks']}")
            print_info(f"  Inventory: {counts['inventory']}")
            print_info(f"  Recipes: {counts['recipes']}")
            print_info(f"  Journal: {counts['journal']}")

    except FileNotFoundError as e:
        print_error(str(e))
        raise typer.Exit(code=1)
    except Exception as e:
        logger.error(f"Failed to import JSON: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)
