import argparse
from pathlib import Path

from core import CRM
from utils import Console


def show_config_command(crm: CRM, args: argparse.Namespace) -> None:
    config = crm.config

    Console.header("Current Configuration")
    print(f"  Config file: {crm.config_manager.config_path}")
    print(f"  Data dir:    {config.data_dir}")
    print()
    print(f"  Logging:")
    print(f"    Level: {config.logging.level}")
    print(f"    File:  {config.logging.file or '(none)'}")
    print()
    print(f"  Reminders:")
    print(f"    Default days ahead: {config.reminders.default_days_ahead}")
    print()
    print(f"  Hot reload: {'watching' if crm.config_manager._watcher else 'not active'}")


def reload_config_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        crm.reload_config()
    except Exception as e:
        Console.error(f"Failed to reload config: {e}")


def set_config_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        updates = {}

        if args.data_dir:
            updates["data_dir"] = args.data_dir

        if args.log_level:
            updates["logging"] = {"level": args.log_level}

        if args.reminder_days:
            updates["reminders"] = {"default_days_ahead": args.reminder_days}

        if updates:
            crm.config_manager.update(**updates)
        else:
            Console.warning("No configuration values provided")

    except Exception as e:
        Console.error(f"Failed to update config: {e}")


def register_config_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "config",
        help="Configuration management",
        description="View and manage CRM configuration settings",
    )
    config_sub = parser.add_subparsers(dest="config_command", required=True)

    show_parser = config_sub.add_parser(
        "show",
        help="Show current configuration",
        description="Display all current configuration values",
    )

    reload_parser = config_sub.add_parser(
        "reload",
        help="Reload configuration",
        description="Reload configuration from disk",
    )

    set_parser = config_sub.add_parser(
        "set",
        help="Set configuration values",
        description="Update configuration values and save to disk",
    )
    set_parser.add_argument("--data-dir", help="Set data directory path")
    set_parser.add_argument("--log-level", choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"], help="Set logging level")
    set_parser.add_argument("--reminder-days", type=int, help="Set default reminder days ahead")
