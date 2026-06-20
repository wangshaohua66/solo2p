import logging
import sys
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.logging import RichHandler
from rich.theme import Theme

from .config import DEFAULT_LOG_PATH


custom_theme = Theme({
    "logging.level.DEBUG": "dim cyan",
    "logging.level.INFO": "bright_green",
    "logging.level.WARNING": "bright_yellow",
    "logging.level.ERROR": "bright_red",
    "logging.level.CRITICAL": "bold bright_red on white",
    "timestamp": "dim",
    "level": "bold",
    "message": "white",
})


console = Console(theme=custom_theme)
error_console = Console(theme=custom_theme, stderr=True)


class CRiskFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        level = record.levelname
        message = record.getMessage()
        return f"[timestamp]{timestamp}[/timestamp] [level]{level:<8}[/level] [message]{message}[/message]"


def setup_logger(name: str = "crisk", log_file: Optional[Path] = None,
                 level: int = logging.INFO, console_output: bool = True) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.propagate = False

    if logger.handlers:
        logger.handlers.clear()

    if console_output:
        rich_handler = RichHandler(
            console=console,
            show_time=True,
            show_path=False,
            show_level=True,
            rich_tracebacks=True,
            tracebacks_show_locals=False,
            markup=True,
            log_time_format="%Y-%m-%d %H:%M:%S",
        )
        rich_handler.setLevel(level)
        logger.addHandler(rich_handler)

    log_file = log_file or DEFAULT_LOG_PATH
    log_file.parent.mkdir(parents=True, exist_ok=True)

    file_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(level)
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    return logger


def get_console() -> Console:
    return console


def get_error_console() -> Console:
    return error_console


def print_info(message: str) -> None:
    console.print(f"[bright_green]ℹ[/bright_green] {message}")


def print_success(message: str) -> None:
    console.print(f"[bright_green]✓[/bright_green] {message}")


def print_warning(message: str) -> None:
    console.print(f"[bright_yellow]⚠[/bright_yellow] {message}")


def print_error(message: str) -> None:
    error_console.print(f"[bright_red]✗[/bright_red] {message}")


def print_header(message: str) -> None:
    console.rule(f"[bold cyan]{message}[/bold cyan]", style="cyan")


def print_risk_level(level: str) -> str:
    if level == "高风险":
        return f"[bold bright_red]{level}[/bold bright_red]"
    elif level == "中风险":
        return f"[bold bright_yellow]{level}[/bold bright_yellow]"
    elif level == "低风险":
        return f"[bold bright_green]{level}[/bold bright_green]"
    else:
        return f"[bold white]{level}[/bold white]"
