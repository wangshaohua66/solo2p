import sys
import typer
from typing import Optional
from utils.logger import setup_logger, get_logger
from utils.config import load_config
from cli.commands.ink import app as ink_app
from cli.commands.mix import app as mix_app
from cli.commands.journal import app as journal_app
from cli.commands.match import app as match_app
from cli.commands.report import app as report_app
from cli.commands.export_import import app as export_app
from cli.commands.ui import print_error, set_no_color

config = load_config()
setup_logger(log_dir=config.log_dir, log_level=config.log_level)
logger = get_logger()

app = typer.Typer(
    help="InkMixer - Fountain pen ink mixing and inventory management",
    rich_markup_mode="rich",
    add_completion=False,
    no_args_is_help=True,
)

app.add_typer(ink_app, name="ink", help="Manage ink library")
app.add_typer(mix_app, name="mix", help="Create and predict ink mixes")
app.add_typer(journal_app, name="journal", help="Writing journal entries")
app.add_typer(match_app, name="match", help="Pen-ink-paper matching")
app.add_typer(report_app, name="report", help="Generate reports")
app.add_typer(export_app, name="export", help="Export and import data")


@app.callback()
def main(
    no_color: bool = typer.Option(
        False, "--no-color", help="Disable ANSI color output", is_eager=True
    ),
    config_file: Optional[str] = typer.Option(
        None, "--config", help="Path to custom config file"
    ),
    verbose: bool = typer.Option(
        False, "--verbose", "-v", help="Enable verbose output"
    ),
):
    if no_color:
        set_no_color(True)

    if verbose:
        import logging
        from loguru import logger as loguru_logger
        loguru_logger.remove()
        setup_logger(log_dir=config.log_dir, log_level="DEBUG")


@app.command("version")
def version():
    """Show version information."""
    typer.echo("InkMixer v0.1.0")


@app.command("config")
def show_config():
    """Show current configuration."""
    from rich.console import Console
    from rich.table import Table

    console = Console()
    table = Table(title="Configuration", show_header=True, header_style="bold")
    table.add_column("Setting")
    table.add_column("Value")

    config_dict = config.model_dump()
    for key, value in config_dict.items():
        table.add_row(key, str(value))

    console.print(table)


@app.command("self-check")
def self_check(
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Run self-diagnostic checks on color engine and inventory system."""
    from cli.commands.ui import print_success, print_warning, print_error, create_table, print_json
    from rich.console import Console
    from core import color_engine
    from core import inventory as inv_module

    console = Console()

    color_results = color_engine.self_check()
    inv_results = inv_module.self_check()

    all_results = {
        "color_engine": color_results,
        "inventory": inv_results,
        "all_passed": color_results["all_passed"] and inv_results["all_passed"],
    }

    if json_output:
        print_json(all_results)
        return

    table = create_table("Self-Check Results", ["Module", "Check", "Status", "Details"])

    color_checks = [
        ("Color Engine", "CIELAB ↔ RGB roundtrip", color_results.get("color_roundtrip", False),
         f"ΔE = {color_results.get('roundtrip_delta_e', 'N/A')}" if color_results.get("color_roundtrip") else "FAILED"),
        ("Color Engine", "ΔE identity (same color)", color_results.get("delta_e_identity", False), ""),
        ("Color Engine", "Paper white sanity", color_results.get("paper_white_sanity", False), ""),
    ]

    for module, check, passed, detail in color_checks:
        status = "[green]PASS[/]" if passed else "[red]FAIL[/]"
        table.add_row(module, check, status, detail)

    inv_checks = [
        ("Inventory", "Database connection", inv_results.get("db_connection", False), ""),
        ("Inventory", "Ink list structure", inv_results.get("ink_list_roundtrip", False), ""),
        ("Inventory", "Inventory list structure", inv_results.get("inventory_list_structure", False), ""),
    ]

    for module, check, passed, detail in inv_checks:
        status = "[green]PASS[/]" if passed else "[red]FAIL[/]"
        table.add_row(module, check, status, detail)

    console.print(table)

    all_errors = color_results.get("errors", []) + inv_results.get("errors", [])
    if all_errors:
        console.print()
        print_warning(f"Found {len(all_errors)} error(s):")
        for err in all_errors:
            console.print(f"  • {err}")

    if all_results["all_passed"]:
        console.print()
        print_success("All checks passed!")
    else:
        console.print()
        print_error("Some checks failed. See details above.")
        raise typer.Exit(code=1)


def _handle_exception(exc_type, exc_value, exc_traceback):
    if issubclass(exc_type, KeyboardInterrupt):
        print("\nOperation cancelled by user")
        sys.exit(130)

    if issubclass(exc_type, typer.Exit):
        sys.exit(exc_value.code if exc_value.code else 0)

    logger.critical("Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback))
    print_error(str(exc_value))
    sys.exit(1)


sys.excepthook = _handle_exception


def entry_point():
    try:
        app()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(130)
    except typer.Exit:
        raise
    except Exception as e:
        logger.error(f"Error: {e}")
        print_error(str(e))
        sys.exit(1)


if __name__ == "__main__":
    entry_point()
