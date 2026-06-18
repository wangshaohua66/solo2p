import argparse

from core import CRM
from utils import Console


def list_plugins_command(crm: CRM, args: argparse.Namespace) -> None:
    plugins = crm.plugin_loader.list_plugins()

    if not plugins:
        Console.info("No plugins loaded")
        return

    Console.header(f"Loaded Plugins ({len(plugins)})")

    rows = []
    for name in plugins:
        plugin = crm.plugin_loader.get_plugin(name)
        rows.append([
            name,
            plugin.description,
        ])

    Console.table(
        ["Name", "Description"],
        rows,
    )

    if plugins:
        print("\n  Commands available:")
        for name in plugins:
            plugin = crm.plugin_loader.get_plugin(name)
            commands = plugin.get_commands()
            for cmd, desc in commands.items():
                print(f"    crm plugin run {name} {cmd} - {desc}")


def run_plugin_command(crm: CRM, args: argparse.Namespace) -> None:
    plugin = crm.plugin_loader.get_plugin(args.plugin)
    if not plugin:
        Console.error(f"Plugin not found: {args.plugin}")
        return

    try:
        result = crm.plugin_loader.run_plugin(args.plugin, crm.db, command=args.command)
        if result is not None:
            Console.success(f"Plugin '{args.plugin}' executed successfully")
            if isinstance(result, str):
                print(result)
            elif isinstance(result, list):
                for item in result:
                    print(f"  - {item}")
            elif isinstance(result, dict):
                for key, value in result.items():
                    print(f"  {key}: {value}")
    except Exception as e:
        Console.error(f"Plugin execution failed: {e}")


def register_plugin_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "plugin",
        help="Plugin management",
        description="List and run installed plugins",
    )
    plugin_sub = parser.add_subparsers(dest="plugin_command", required=True)

    list_parser = plugin_sub.add_parser(
        "list",
        help="List installed plugins",
        description="Show all loaded plugins and their available commands",
    )

    run_parser = plugin_sub.add_parser(
        "run",
        help="Run a plugin command",
        description="Execute a specific command from a plugin",
    )
    run_parser.add_argument("plugin", help="Plugin name")
    run_parser.add_argument("command", help="Command to run", nargs="?", default="default")
