import sys
import json
from typing import Any, Dict, List, Optional, Union
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.progress import Progress, BarColumn, TextColumn, TimeElapsedColumn
from rich import print as rprint
from core.ink_model import CIELAB
from core.color_engine import cielab_to_rgb

console = Console()
no_color_mode = False


def set_no_color(no_color: bool) -> None:
    global no_color_mode
    no_color_mode = no_color
    if no_color:
        console.no_color = True


def color_block(lab: CIELAB, width: int = 4) -> str:
    if no_color_mode:
        return "[ ]"
    rgb = cielab_to_rgb(lab)
    hex_color = rgb.to_hex()
    return f"[{hex_color} on {hex_color}]{' ' * width}[/]"


def color_block_hex(hex_color: str, width: int = 4) -> str:
    if no_color_mode:
        return "[ ]"
    return f"[{hex_color} on {hex_color}]{' ' * width}[/]"


def get_color_hex(lab: CIELAB) -> str:
    rgb = cielab_to_rgb(lab)
    return rgb.to_hex()


def print_error(message: str) -> None:
    if no_color_mode:
        print(f"ERROR: {message}", file=sys.stderr)
    else:
        console.print(f"[bold red]✗ Error:[/bold red] {message}")


def print_warning(message: str) -> None:
    if no_color_mode:
        print(f"WARNING: {message}")
    else:
        console.print(f"[bold yellow]⚠ Warning:[/bold yellow] {message}")


def print_success(message: str) -> None:
    if no_color_mode:
        print(f"SUCCESS: {message}")
    else:
        console.print(f"[bold green]✓ Success:[/bold green] {message}")


def print_info(message: str) -> None:
    if no_color_mode:
        print(f"INFO: {message}")
    else:
        console.print(f"[bold blue]ℹ Info:[/bold blue] {message}")


def print_json(data: Any) -> None:
    print(json.dumps(data, indent=2, ensure_ascii=False, default=str))


def print_panel(title: str, content: str, style: str = "blue") -> None:
    if no_color_mode:
        print(f"=== {title} ===")
        print(content)
    else:
        panel = Panel(content, title=title, border_style=style)
        console.print(panel)


def create_table(title: str, columns: List[str], **kwargs) -> Table:
    table = Table(
        title=title,
        show_header=True,
        header_style="bold",
        **kwargs,
    )
    for col in columns:
        table.add_column(col)
    return table


def bar_chart(value: float, max_value: float, width: int = 20) -> str:
    if max_value <= 0:
        return "░" * width
    ratio = min(max(value / max_value, 0), 1)
    filled = int(ratio * width)
    empty = width - filled

    if no_color_mode:
        return "#" * filled + "-" * empty

    if ratio < 0.2:
        style = "red"
    elif ratio < 0.5:
        style = "yellow"
    else:
        style = "green"

    return f"[{style}]{'█' * filled}[/]{'░' * empty}"


def rating_stars(rating: int, max_stars: int = 5) -> str:
    if no_color_mode:
        return f"{rating}/{max_stars}"
    filled = "★" * rating
    empty = "☆" * (max_stars - rating)
    return f"[yellow]{filled}[/][dim]{empty}[/]"


def delta_e_display(delta_e: float, threshold: float = 3.0) -> str:
    if no_color_mode:
        return f"{delta_e:.2f}"

    if delta_e <= threshold:
        color = "green"
        indicator = "✓"
    elif delta_e <= threshold * 2:
        color = "yellow"
        indicator = "◯"
    else:
        color = "red"
        indicator = "✗"

    return f"[{color}]{indicator} {delta_e:.2f} ΔE[/]"


def create_progress() -> Progress:
    return Progress(
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console,
        disable=no_color_mode,
    )


def print_header(title: str) -> None:
    if no_color_mode:
        print("=" * 60)
        print(title)
        print("=" * 60)
    else:
        console.print()
        console.print(f"[bold blue]{'=' * 60}[/]")
        console.print(f"[bold blue]{title:^60}[/]")
        console.print(f"[bold blue]{'=' * 60}[/]")
        console.print()


def print_footer() -> None:
    if no_color_mode:
        print()
    else:
        console.print()


def two_column_layout(left: str, right: str, left_width: int = 30) -> str:
    lines_left = left.split("\n")
    lines_right = right.split("\n")
    max_lines = max(len(lines_left), len(lines_right))

    while len(lines_left) < max_lines:
        lines_left.append("")
    while len(lines_right) < max_lines:
        lines_right.append("")

    result = []
    for ll, rr in zip(lines_left, lines_right):
        result.append(f"{ll:<{left_width}} {rr}")

    return "\n".join(result)


class OutputFormatter:
    def __init__(self, json_output: bool = False):
        self.json_output = json_output

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def output(self, data: Any, render_func=None) -> None:
        if self.json_output:
            print_json(data)
        elif render_func:
            render_func(data)
        else:
            print(data)
