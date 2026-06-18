import argparse
from pathlib import Path

from core import CRM
from utils import Console, DataExporter


def export_backup_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        backup_dir = Path(args.output).expanduser() if args.output else None
        backup_path = crm.export_backup(backup_dir)
        Console.success(f"Full backup created: {backup_path}")
    except Exception as e:
        Console.error(f"Backup failed: {e}")


def register_export_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "export",
        help="Export data",
        description="Export data to various formats or create full backups",
    )
    export_sub = parser.add_subparsers(dest="export_command", required=True)

    backup_parser = export_sub.add_parser(
        "backup",
        help="Create full backup",
        description="Create a complete JSON backup of all CRM data",
    )
    backup_parser.add_argument("--output", help="Output directory (default: data_dir/backups)")
