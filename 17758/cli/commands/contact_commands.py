import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import UUID

from core import CRM
from models import ContactStatus
from utils import Console, DataExporter


def prompt_contact_fields(crm: CRM, interactive: bool = True, **kwargs) -> dict:
    def _get(key: str, prompt_text: str, default=None, is_required: bool = False):
        value = kwargs.get(key)
        if value is not None:
            return value
        if not interactive:
            if is_required:
                raise ValueError(f"{key} is required")
            return default
        return Console.ask(prompt_text, default)

    data = {}
    data["name"] = _get("name", "Name", is_required=True)
    if not data["name"]:
        raise ValueError("Name is required")

    data["email"] = _get("email", "Email (optional)")
    data["phone"] = _get("phone", "Phone (optional)")
    data["position"] = _get("position", "Position (optional)")

    company_name = _get("company", "Company name (optional)")
    if company_name:
        company = crm.companies.get_by_name(company_name)
        if not company:
            if interactive and Console.confirm(f"Company '{company_name}' not found. Create it?", True):
                company = crm.companies.create(name=company_name)
            elif not interactive:
                company = crm.companies.create(name=company_name)
        if company:
            data["company_id"] = company.id

    default_status = ContactStatus.POTENTIAL.value
    status_str = _get(
        "status",
        f"Status [{','.join(s.value for s in ContactStatus)}]",
        default_status,
    )
    if status_str:
        try:
            data["status"] = ContactStatus(status_str)
        except ValueError:
            data["status"] = ContactStatus.POTENTIAL
            if interactive:
                Console.warning(f"Invalid status, using default: {data['status'].value}")
    else:
        data["status"] = ContactStatus.POTENTIAL

    tags_str = _get("tags", "Tags (comma-separated, optional)")
    if tags_str:
        tag_ids = []
        for tag_name in [t.strip() for t in tags_str.split(",") if t.strip()]:
            tag = crm.tags.get_or_create(tag_name)
            tag_ids.append(tag.id)
        data["tag_ids"] = tag_ids

    data["notes"] = _get("notes", "Notes (optional)")
    return data


def add_contact_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        interactive = not getattr(args, "no_interactive", False)
        data = prompt_contact_fields(
            crm,
            interactive=interactive,
            name=args.name,
            email=args.email,
            phone=args.phone,
            position=args.position,
            company=args.company,
            status=args.status,
            tags=args.tags,
            notes=args.notes,
        )
        contact = crm.contacts.create(**data)
        Console.success(f"Contact created: {contact.name} (ID: {contact.id})")
    except Exception as e:
        Console.error(f"Failed to create contact: {e}")


def list_contacts_command(crm: CRM, args: argparse.Namespace) -> None:
    contacts = crm.contacts.list()

    if args.status:
        try:
            status = ContactStatus(args.status)
            contacts = crm.contacts.filter_by_status(status)
        except ValueError:
            Console.error(f"Invalid status: {args.status}")
            return

    if args.tag:
        tag = crm.tags.get_by_name(args.tag)
        if tag:
            contacts = crm.contacts.filter_by_tag(tag.id)
        else:
            Console.warning(f"Tag '{args.tag}' not found")
            return

    if args.search:
        contacts = crm.contacts.search(args.search)

    if not contacts:
        Console.info("No contacts found")
        return

    Console.header(f"Contacts ({len(contacts)})")

    company_map = {c.id: c.name for c in crm.companies.list()}
    tag_map = {t.id: t.name for t in crm.tags.list()}

    rows = []
    for c in contacts:
        company = company_map.get(c.company_id, "-")
        tags = ", ".join([tag_map.get(tid, str(tid)) for tid in c.tag_ids]) or "-"
        rows.append([
            str(c.id)[:8],
            c.name,
            c.email or "-",
            c.phone or "-",
            company,
            c.status.value,
            tags,
        ])

    Console.table(
        ["ID", "Name", "Email", "Phone", "Company", "Status", "Tags"],
        rows,
    )


def show_contact_command(crm: CRM, args: argparse.Namespace) -> None:
    contact = None
    try:
        contact_id = UUID(args.id)
        contact = crm.contacts.get(contact_id)
    except ValueError:
        contact = crm.contacts.get_by_name(args.id)

    if not contact:
        Console.error(f"Contact not found: {args.id}")
        return

    Console.header(f"Contact: {contact.name}")
    print(f"ID:         {contact.id}")
    print(f"Name:       {contact.name}")
    print(f"Email:      {contact.email or '-'}")
    print(f"Phone:      {contact.phone or '-'}")
    print(f"Position:   {contact.position or '-'}")
    print(f"Status:     {contact.status.value}")

    if contact.company_id:
        company = crm.companies.get(contact.company_id)
        print(f"Company:    {company.name if company else '-'}")

    if contact.tag_ids:
        tag_names = []
        for tid in contact.tag_ids:
            tag = crm.tags.get(tid)
            if tag:
                tag_names.append(tag.name)
        print(f"Tags:       {', '.join(tag_names)}")

    print(f"Notes:      {contact.notes or '-'}")
    print(f"Created:    {contact.created_at.strftime('%Y-%m-%d %H:%M')}")
    print(f"Updated:    {contact.updated_at.strftime('%Y-%m-%d %H:%M')}")

    comms = crm.communications.get_by_contact(contact.id)
    if comms:
        Console.header(f"Recent Communications ({len(comms)})")
        for comm in comms[:5]:
            print(f"  [{comm.date.strftime('%Y-%m-%d')}] ({comm.channel.value}) {comm.subject}")

    reminders = crm.reminders.get_by_contact(contact.id)
    pending_reminders = [r for r in reminders if r.status.value != "completed"]
    if pending_reminders:
        Console.header(f"Pending Reminders ({len(pending_reminders)})")
        for r in pending_reminders:
            print(f"  [{r.due_date.strftime('%Y-%m-%d')}] ({r.priority.value}) {r.title}")


def update_contact_command(crm: CRM, args: argparse.Namespace) -> None:
    contact = None
    try:
        contact_id = UUID(args.id)
        contact = crm.contacts.get(contact_id)
    except ValueError:
        contact = crm.contacts.get_by_name(args.id)

    if not contact:
        Console.error(f"Contact not found: {args.id}")
        return

    update_data = {}
    fields = ["name", "email", "phone", "position", "notes"]
    for field in fields:
        value = getattr(args, field)
        if value is not None:
            update_data[field] = value

    if args.status:
        try:
            update_data["status"] = ContactStatus(args.status)
        except ValueError:
            Console.error(f"Invalid status: {args.status}")
            return

    if args.company is not None:
        if args.company:
            company = crm.companies.get_by_name(args.company)
            if not company and Console.confirm(f"Create company '{args.company}'?", True):
                company = crm.companies.create(name=args.company)
            if company:
                crm.contacts.set_company(contact.id, company.id)
        else:
            if contact.company_id:
                old_company = crm.companies.get(contact.company_id)
                if old_company and contact.id in old_company.contact_ids:
                    old_company.contact_ids.remove(contact.id)
                    crm.companies.update(old_company)
                contact.company_id = None
                crm.contacts.update(contact.id, company_id=None)

    if args.add_tag:
        for tag_name in args.add_tag:
            tag = crm.tags.get_or_create(tag_name)
            crm.contacts.add_tag(contact.id, tag.id)

    if args.remove_tag:
        for tag_name in args.remove_tag:
            tag = crm.tags.get_by_name(tag_name)
            if tag:
                crm.contacts.remove_tag(contact.id, tag.id)

    if update_data:
        crm.contacts.update(contact.id, **update_data)

    Console.success(f"Contact updated: {contact.name}")


def delete_contact_command(crm: CRM, args: argparse.Namespace) -> None:
    contact = None
    try:
        contact_id = UUID(args.id)
        contact = crm.contacts.get(contact_id)
    except ValueError:
        contact = crm.contacts.get_by_name(args.id)

    if not contact:
        Console.error(f"Contact not found: {args.id}")
        return

    if not args.force and not Console.confirm(f"Delete contact '{contact.name}'?", False):
        Console.info("Delete cancelled")
        return

    crm.contacts.delete(contact.id)
    Console.success(f"Contact deleted: {contact.name}")


def set_status_command(crm: CRM, args: argparse.Namespace) -> None:
    contact = None
    try:
        contact_id = UUID(args.id)
        contact = crm.contacts.get(contact_id)
    except ValueError:
        contact = crm.contacts.get_by_name(args.id)

    if not contact:
        Console.error(f"Contact not found: {args.id}")
        return

    try:
        status = ContactStatus(args.status)
        crm.contacts.set_status(contact.id, status)
        Console.success(f"Contact '{contact.name}' status updated to {status.value}")
    except ValueError:
        Console.error(f"Invalid status: {args.status}")


def export_contacts_command(crm: CRM, args: argparse.Namespace) -> None:
    contacts = crm.contacts.list()
    output_path = Path(args.output)

    if args.format == "csv":
        DataExporter.export_contacts_csv(contacts, output_path)
    else:
        DataExporter.export_json(contacts, output_path)

    crm.logger.export("Contact", args.format, str(output_path))
    Console.success(f"Exported {len(contacts)} contacts to {output_path}")


def register_contact_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "contact",
        help="Contact management",
        description="Manage your contacts: add, list, show, update, delete",
    )
    contact_sub = parser.add_subparsers(dest="contact_command", required=True)

    add_parser = contact_sub.add_parser(
        "add",
        help="Add a new contact",
        description="Create a new contact with interactive input if arguments missing. Use --no-interactive for programmatic use.",
    )
    add_parser.add_argument("--name", help="Contact name")
    add_parser.add_argument("--email", help="Email address")
    add_parser.add_argument("--phone", help="Phone number")
    add_parser.add_argument("--position", help="Job position")
    add_parser.add_argument("--company", help="Company name")
    add_parser.add_argument("--status", choices=[s.value for s in ContactStatus], help="Contact status")
    add_parser.add_argument("--tags", help="Comma-separated tags")
    add_parser.add_argument("--notes", help="Additional notes")
    add_parser.add_argument("--no-interactive", action="store_true", help="Disable interactive prompts, fail on missing required args")

    list_parser = contact_sub.add_parser(
        "list",
        help="List all contacts",
        description="List contacts with optional filtering by status, tag, or search query",
    )
    list_parser.add_argument("--status", choices=[s.value for s in ContactStatus], help="Filter by status")
    list_parser.add_argument("--tag", help="Filter by tag name")
    list_parser.add_argument("--search", help="Search by name, email, phone, or position")

    show_parser = contact_sub.add_parser(
        "show",
        help="Show contact details",
        description="Display detailed information about a contact including communications and reminders",
    )
    show_parser.add_argument("id", help="Contact ID or name")

    update_parser = contact_sub.add_parser(
        "update",
        help="Update a contact",
        description="Update contact information, tags, or company association",
    )
    update_parser.add_argument("id", help="Contact ID or name")
    update_parser.add_argument("--name", help="New name")
    update_parser.add_argument("--email", help="New email")
    update_parser.add_argument("--phone", help="New phone")
    update_parser.add_argument("--position", help="New position")
    update_parser.add_argument("--company", help="New company name (empty to remove)")
    update_parser.add_argument("--status", choices=[s.value for s in ContactStatus], help="New status")
    update_parser.add_argument("--add-tag", action="append", help="Add a tag (repeatable)")
    update_parser.add_argument("--remove-tag", action="append", help="Remove a tag (repeatable)")
    update_parser.add_argument("--notes", help="New notes")

    delete_parser = contact_sub.add_parser(
        "delete",
        help="Delete a contact",
        description="Permanently delete a contact",
    )
    delete_parser.add_argument("id", help="Contact ID or name")
    delete_parser.add_argument("--force", action="store_true", help="Skip confirmation")

    status_parser = contact_sub.add_parser(
        "status",
        help="Set contact status",
        description="Quickly update a contact's status (potential, in_communication, closed, lost)",
    )
    status_parser.add_argument("id", help="Contact ID or name")
    status_parser.add_argument("status", choices=[s.value for s in ContactStatus], help="New status")

    export_parser = contact_sub.add_parser(
        "export",
        help="Export contacts",
        description="Export all contacts to CSV or JSON format",
    )
    export_parser.add_argument("output", help="Output file path")
    export_parser.add_argument("--format", choices=["csv", "json"], default="csv", help="Export format")
