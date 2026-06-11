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
