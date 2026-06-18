import argparse
from uuid import UUID

from core import CRM
from utils import Console


def add_tag_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        name = args.name or Console.ask("Tag name")
        if not name:
            raise ValueError("Tag name is required")

        color = args.color or Console.ask("Color (hex, e.g. #3498db)", "#3498db")
        description = args.description or Console.ask("Description (optional)")

        tag = crm.tags.create(name=name, color=color, description=description)
        Console.success(f"Tag created: {tag.name} (ID: {tag.id})")
    except Exception as e:
        Console.error(f"Failed to create tag: {e}")


def list_tags_command(crm: CRM, args: argparse.Namespace) -> None:
    tags = crm.tags.list()

    if not tags:
        Console.info("No tags found")
        return

    Console.header(f"Tags ({len(tags)})")

    rows = []
    for t in tags:
        usage = crm.tags.get_usage_count(t.id)
        rows.append([
            str(t.id)[:8],
            t.name,
            t.color,
            t.description or "-",
            usage,
        ])

    Console.table(
        ["ID", "Name", "Color", "Description", "Usage"],
        rows,
    )


def update_tag_command(crm: CRM, args: argparse.Namespace) -> None:
    tag = None
    try:
        tag_id = UUID(args.id)
        tag = crm.tags.get(tag_id)
    except ValueError:
        tag = crm.tags.get_by_name(args.id)

    if not tag:
        Console.error(f"Tag not found: {args.id}")
        return

    update_data = {}
    if args.name:
        update_data["name"] = args.name
    if args.color:
        update_data["color"] = args.color
    if args.description is not None:
        update_data["description"] = args.description

    if update_data:
        crm.tags.update(tag.id, **update_data)

    Console.success(f"Tag updated: {tag.name}")


def delete_tag_command(crm: CRM, args: argparse.Namespace) -> None:
    tag = None
    try:
        tag_id = UUID(args.id)
        tag = crm.tags.get(tag_id)
    except ValueError:
        tag = crm.tags.get_by_name(args.id)

    if not tag:
        Console.error(f"Tag not found: {args.id}")
        return

    usage = crm.tags.get_usage_count(tag.id)
    if not args.force and not Console.confirm(
        f"Delete tag '{tag.name}'? This will remove it from {usage} contacts.",
        False,
    ):
        Console.info("Delete cancelled")
        return

    crm.tags.delete(tag.id)
    Console.success(f"Tag deleted: {tag.name}")


def register_tag_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "tag",
        help="Tag management",
        description="Manage custom tags for categorizing contacts",
    )
    tag_sub = parser.add_subparsers(dest="tag_command", required=True)

    add_parser = tag_sub.add_parser(
        "add",
        help="Add a new tag",
        description="Create a new custom tag with optional color and description",
    )
    add_parser.add_argument("--name", help="Tag name")
    add_parser.add_argument("--color", help="Tag color (hex format)")
    add_parser.add_argument("--description", help="Tag description")

    list_parser = tag_sub.add_parser(
        "list",
        help="List all tags",
        description="List all tags with their usage counts",
    )

    update_parser = tag_sub.add_parser(
        "update",
        help="Update a tag",
        description="Update tag name, color, or description",
    )
    update_parser.add_argument("id", help="Tag ID or name")
    update_parser.add_argument("--name", help="New tag name")
    update_parser.add_argument("--color", help="New tag color")
    update_parser.add_argument("--description", help="New description")

    delete_parser = tag_sub.add_parser(
        "delete",
        help="Delete a tag",
        description="Permanently delete a tag (removes from all contacts)",
    )
    delete_parser.add_argument("id", help="Tag ID or name")
    delete_parser.add_argument("--force", action="store_true", help="Skip confirmation")
