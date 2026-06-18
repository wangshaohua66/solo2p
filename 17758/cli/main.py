import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.WARNING,
    format="%(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)

from colorama import Fore, Style, init

from cli.commands.company_commands import (
    add_company_command,
    delete_company_command,
    export_companies_command,
    list_companies_command,
    register_company_commands,
    show_company_command,
    update_company_command,
)
from cli.commands.communication_commands import (
    add_communication_command,
    delete_communication_command,
    frequency_command,
    list_communications_command,
    register_communication_commands,
    show_communication_command,
)
from cli.commands.config_commands import (
    register_config_commands,
    reload_config_command,
    set_config_command,
    show_config_command,
)
from cli.commands.contact_commands import (
    add_contact_command,
    delete_contact_command,
    export_contacts_command,
    list_contacts_command,
    register_contact_commands,
    set_status_command,
    show_contact_command,
    update_contact_command,
)
from cli.commands.export_commands import (
    export_backup_command,
    register_export_commands,
)
from cli.commands.import_commands import (
    import_companies_command,
    import_contacts_command,
    register_import_commands,
)
from cli.commands.plugin_commands import (
    list_plugins_command,
    register_plugin_commands,
    run_plugin_command,
)
from cli.commands.reminder_commands import (
    add_reminder_command,
    complete_reminder_command,
    delete_reminder_command,
    list_reminders_command,
    register_reminder_commands,
    today_reminders_command,
    update_reminder_command,
)
from cli.commands.stats_commands import (
    frequency_stats_command,
    funnel_command,
    overall_stats_command,
    register_stats_commands,
    status_stats_command,
    tag_stats_command,
)
from cli.commands.tag_commands import (
    add_tag_command,
    delete_tag_command,
    list_tags_command,
    register_tag_commands,
    update_tag_command,
)
from core import CRM
from storage import (
    ConfigError,
    DuplicateEntityError,
    EntityNotFoundError,
    StorageError,
    ValidationError,
)
from utils import Console

init(autoreset=True)


def create_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="crm",
        description="Personal CRM - Manage your clients and relationships",
        epilog=f"{Fore.CYAN}Example:{Style.RESET_ALL} crm contact add --name \"John Doe\" --email john@example.com",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "--config",
        type=Path,
        help="Path to configuration file",
        default=None,
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Enable config file hot reload",
    )
    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 0.1.0",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    register_contact_commands(subparsers)
    register_company_commands(subparsers)
    register_communication_commands(subparsers)
    register_reminder_commands(subparsers)
    register_tag_commands(subparsers)
    register_stats_commands(subparsers)
    register_import_commands(subparsers)
    register_export_commands(subparsers)
    register_config_commands(subparsers)
    register_plugin_commands(subparsers)

    return parser


def handle_contact_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "add": add_contact_command,
        "list": list_contacts_command,
        "show": show_contact_command,
        "update": update_contact_command,
        "delete": delete_contact_command,
        "status": set_status_command,
        "export": export_contacts_command,
    }
    handler = handlers.get(args.contact_command)
    if handler:
        handler(crm, args)


def handle_company_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "add": add_company_command,
        "list": list_companies_command,
        "show": show_company_command,
        "update": update_company_command,
        "delete": delete_company_command,
        "export": export_companies_command,
    }
    handler = handlers.get(args.company_command)
    if handler:
        handler(crm, args)


def handle_communication_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "add": add_communication_command,
        "list": list_communications_command,
        "show": show_communication_command,
        "delete": delete_communication_command,
        "frequency": frequency_command,
    }
    handler = handlers.get(args.communication_command)
    if handler:
        handler(crm, args)


def handle_reminder_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "add": add_reminder_command,
        "list": list_reminders_command,
        "today": today_reminders_command,
        "complete": complete_reminder_command,
        "update": update_reminder_command,
        "delete": delete_reminder_command,
    }
    handler = handlers.get(args.reminder_command)
    if handler:
        handler(crm, args)


def handle_tag_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "add": add_tag_command,
        "list": list_tags_command,
        "update": update_tag_command,
        "delete": delete_tag_command,
    }
    handler = handlers.get(args.tag_command)
    if handler:
        handler(crm, args)


def handle_stats_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "overall": overall_stats_command,
        "status": status_stats_command,
        "tag": tag_stats_command,
        "frequency": frequency_stats_command,
        "funnel": funnel_command,
    }
    handler = handlers.get(args.stats_command)
    if handler:
        handler(crm, args)


def handle_import_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "contacts": import_contacts_command,
        "companies": import_companies_command,
    }
    handler = handlers.get(args.import_command)
    if handler:
        handler(crm, args)


def handle_export_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "backup": export_backup_command,
    }
    handler = handlers.get(args.export_command)
    if handler:
        handler(crm, args)


def handle_config_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "show": show_config_command,
        "reload": reload_config_command,
        "set": set_config_command,
    }
    handler = handlers.get(args.config_command)
    if handler:
        handler(crm, args)


def handle_plugin_command(crm: CRM, args: argparse.Namespace) -> None:
    handlers = {
        "list": list_plugins_command,
        "run": run_plugin_command,
    }
    handler = handlers.get(args.plugin_command)
    if handler:
        handler(crm, args)


def dispatch_command(crm: CRM, args: argparse.Namespace) -> None:
    dispatchers = {
        "contact": handle_contact_command,
        "company": handle_company_command,
        "communication": handle_communication_command,
        "reminder": handle_reminder_command,
        "tag": handle_tag_command,
        "stats": handle_stats_command,
        "import": handle_import_command,
        "export": handle_export_command,
        "config": handle_config_command,
        "plugin": handle_plugin_command,
    }

    dispatcher = dispatchers.get(args.command)
    if dispatcher:
        dispatcher(crm, args)
    else:
        Console.error(f"Unknown command: {args.command}")
        sys.exit(1)


def main(argv: Optional[list] = None) -> int:
    parser = create_parser()
    args = parser.parse_args(argv)

    try:
        crm = CRM(args.config)

        if args.watch:
            crm.start_watching_config()

        try:
            dispatch_command(crm, args)
            return 0
        finally:
            if args.watch:
                crm.stop_watching_config()

    except EntityNotFoundError as e:
        Console.error(str(e))
        return 1
    except DuplicateEntityError as e:
        Console.error(str(e))
        return 1
    except ValidationError as e:
        Console.error(f"Validation error: {e}")
        return 1
    except ConfigError as e:
        Console.error(f"Configuration error: {e}")
        return 1
    except StorageError as e:
        Console.error(f"Storage error: {e}")
        return 1
    except KeyboardInterrupt:
        print()
        Console.info("Operation cancelled by user")
        return 130
    except Exception as e:
        Console.error(f"Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
