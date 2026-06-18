import sys
from typing import Any, Optional

from colorama import Fore, Style, init
from tqdm import tqdm

init(autoreset=True)


class Console:
    @staticmethod
    def success(message: str) -> None:
        print(f"{Fore.GREEN}{Style.BRIGHT}[SUCCESS]{Style.RESET_ALL} {message}")

    @staticmethod
    def error(message: str) -> None:
        print(f"{Fore.RED}{Style.BRIGHT}[ERROR]{Style.RESET_ALL} {message}", file=sys.stderr)

    @staticmethod
    def warning(message: str) -> None:
        print(f"{Fore.YELLOW}{Style.BRIGHT}[WARNING]{Style.RESET_ALL} {message}")

    @staticmethod
    def info(message: str) -> None:
        print(f"{Fore.CYAN}[INFO]{Style.RESET_ALL} {message}")

    @staticmethod
    def header(message: str) -> None:
        print(f"\n{Fore.MAGENTA}{Style.BRIGHT}{'=' * 60}")
        print(f"  {message}")
        print(f"{'=' * 60}{Style.RESET_ALL}\n")

    @staticmethod
    def table(headers: list, rows: list) -> None:
        col_widths = [len(str(h)) for h in headers]
        for row in rows:
            for i, cell in enumerate(row):
                col_widths[i] = max(col_widths[i], len(str(cell)))

        header_line = " | ".join(
            f"{Fore.CYAN}{str(h).ljust(col_widths[i])}{Style.RESET_ALL}"
            for i, h in enumerate(headers)
        )
        separator = "-+-".join("-" * w for w in col_widths)
        print(header_line)
        print(separator)
        for row in rows:
            row_line = " | ".join(
                str(cell).ljust(col_widths[i]) for i, cell in enumerate(row)
            )
            print(row_line)

    @staticmethod
    def progress(iterable, desc: str = "Processing", total: Optional[int] = None):
        return tqdm(
            iterable,
            desc=f"{Fore.BLUE}{desc}{Style.RESET_ALL}",
            total=total,
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
        )

    @staticmethod
    def ask(prompt: str, default: Optional[str] = None) -> str:
        display = f"{Fore.YELLOW}{prompt}{Style.RESET_ALL}"
        if default:
            display += f" [{default}]"
        display += ": "
        value = input(display).strip()
        return value if value else (default or "")

    @staticmethod
    def confirm(prompt: str, default: bool = False) -> bool:
        default_str = "y/N" if not default else "Y/n"
        while True:
            value = input(f"{Fore.YELLOW}{prompt} ({default_str}){Style.RESET_ALL}: ").strip().lower()
            if not value:
                return default
            if value in ["y", "yes"]:
                return True
            if value in ["n", "no"]:
                return False
            Console.warning("Please enter y or n")
