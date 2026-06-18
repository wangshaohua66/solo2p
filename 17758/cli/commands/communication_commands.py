import argparse
from datetime import datetime
from typing import Optional
from uuid import UUID

from core import CRM
from models import CommunicationChannel
from utils import Console


def parse_date(date_str: Optional[str]) -> datetime:
    if not date_str:
        return datetime.now()
    for fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M", "%Y/%m/%d"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD or YYYY-MM-DD HH:MM")


def add_communication_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        subject = args.subject or Console.ask("Subject")
        if not subject:
            raise ValueError("Subject is required")

        channel_str = args.channel or Console.ask(
            f"Channel [{','.join(c.value for c in CommunicationChannel)}]",
            CommunicationChannel.EMAIL.value,
        )
        try:
            channel = CommunicationChannel(channel_str)
        except ValueError:
            channel = CommunicationChannel.EMAIL
            Console.warning(f"Invalid channel, using default: {channel.value}")

        date = parse_date(args.date)
        content = args.content or Console.ask("Content (optional)")

        contact_ids = []
        contacts_str = args.contacts or Console.ask("Contact names/IDs (comma-separated, optional)")
        if contacts_str:
            for cid in [c.strip() for c in contacts_str.split(",") if c.strip()]:
                try:
                    contact_uuid = UUID(cid)
                    contact = crm.contacts.get(contact_uuid)
                except ValueError:
                    contact = crm.contacts.get_by_name(cid)
                if contact:
                    contact_ids.append(contact.id)
                else:
                    Console.warning(f"Contact not found: {cid}")

        company_id = None
        company_name = args.company or Console.ask("Company name (optional)")
        if company_name:
            company = crm.companies.get_by_name(company_name)
            if company:
                company_id = company.id
            else:
                Console.warning(f"Company not found: {company_name}")

        comm = crm.communications.create(
            subject=subject,
            channel=channel,
            date=date,
            content=content,
            contact_ids=contact_ids,
            company_id=company_id,
        )
        Console.success(f"Communication logged: {comm.subject} (ID: {comm.id})")
    except Exception as e:
        Console.error(f"Failed to log communication: {e}")


def list_communications_command(crm: CRM, args: argparse.Namespace) -> None:
    comms = crm.communications.list()

    if args.days:
        comms = crm.communications.get_recent(args.days)

    if args.contact:
        contact = None
        try:
            contact_uuid = UUID(args.contact)
            contact = crm.contacts.get(contact_uuid)
        except ValueError:
            contact = crm.contacts.get_by_name(args.contact)
        if contact:
            comms = crm.communications.get_by_contact(contact.id)
        else:
            Console.error(f"Contact not found: {args.contact}")
            return

    if args.company:
        company = None
        try:
            company_uuid = UUID(args.company)
            company = crm.companies.get(company_uuid)
        except ValueError:
            company = crm.companies.get_by_name(args.company)
        if company:
            comms = crm.communications.get_by_company(company.id)
        else:
            Console.error(f"Company not found: {args.company}")
            return

    if not comms:
        Console.info("No communications found")
        return

    Console.header(f"Communications ({len(comms)})")

    contact_map = {c.id: c.name for c in crm.contacts.list()}
    company_map = {c.id: c.name for c in crm.companies.list()}

    rows = []
    for c in comms[:args.limit if args.limit else len(comms)]:
        contacts = ", ".join([contact_map.get(cid, str(cid)) for cid in c.contact_ids]) or "-"
        company = company_map.get(c.company_id, "-")
        rows.append([
            c.date.strftime("%Y-%m-%d"),
            c.channel.value,
            c.subject,
            contacts,
            company,
        ])

    Console.table(
        ["Date", "Channel", "Subject", "Contacts", "Company"],
        rows,
    )


def show_communication_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        comm_id = UUID(args.id)
        comm = crm.communications.get(comm_id)
    except ValueError:
        Console.error(f"Invalid ID: {args.id}")
        return

    if not comm:
        Console.error(f"Communication not found: {args.id}")
        return

    Console.header(f"Communication: {comm.subject}")
    print(f"ID:         {comm.id}")
    print(f"Date:       {comm.date.strftime('%Y-%m-%d %H:%M')}")
    print(f"Channel:    {comm.channel.value}")
    print(f"Subject:    {comm.subject}")

    if comm.contact_ids:
        contact_names = []
        for cid in comm.contact_ids:
            contact = crm.contacts.get(cid)
            if contact:
                contact_names.append(contact.name)
        print(f"Contacts:   {', '.join(contact_names)}")

    if comm.company_id:
        company = crm.companies.get(comm.company_id)
        print(f"Company:    {company.name if company else '-'}")

    if comm.content:
        print(f"\nContent:")
        print(f"  {comm.content}")

    print(f"\nCreated:    {comm.created_at.strftime('%Y-%m-%d %H:%M')}")


def delete_communication_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        comm_id = UUID(args.id)
        comm = crm.communications.get(comm_id)
    except ValueError:
        Console.error(f"Invalid ID: {args.id}")
        return

    if not comm:
        Console.error(f"Communication not found: {args.id}")
        return

    if not args.force and not Console.confirm(f"Delete communication '{comm.subject}'?", False):
        Console.info("Delete cancelled")
        return

    crm.communications.delete(comm.id)
    Console.success(f"Communication deleted: {comm.subject}")


def frequency_command(crm: CRM, args: argparse.Namespace) -> None:
    freq = crm.communications.get_frequency(args.days)

    Console.header(f"Communication Frequency (last {args.days} days)")

    for date, count in sorted(freq.items()):
        bar = "█" * count if count > 0 else "░"
        print(f"  {date} | {bar} ({count})")

    total = sum(freq.values())
    avg = total / args.days if args.days > 0 else 0
    print(f"\nTotal: {total} communications | Avg: {avg:.1f} per day")


def register_communication_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "communication",
        help="Communication log management",
        description="Log and manage communications with contacts",
    )
    comm_sub = parser.add_subparsers(dest="communication_command", required=True)

    add_parser = comm_sub.add_parser(
        "add",
        help="Log a new communication",
        description="Record a communication (email, call, meeting, etc.)",
    )
    add_parser.add_argument("--subject", help="Communication subject")
    add_parser.add_argument("--channel", choices=[c.value for c in CommunicationChannel], help="Communication channel")
    add_parser.add_argument("--date", help="Date (YYYY-MM-DD or YYYY-MM-DD HH:MM, default: now)")
    add_parser.add_argument("--content", help="Communication content/notes")
    add_parser.add_argument("--contacts", help="Comma-separated contact names/IDs")
    add_parser.add_argument("--company", help="Company name/ID")

    list_parser = comm_sub.add_parser(
        "list",
        help="List communications",
        description="List communications with optional filtering",
    )
    list_parser.add_argument("--days", type=int, help="Show only recent N days")
    list_parser.add_argument("--contact", help="Filter by contact name/ID")
    list_parser.add_argument("--company", help="Filter by company name/ID")
    list_parser.add_argument("--limit", type=int, help="Limit number of results")

    show_parser = comm_sub.add_parser(
        "show",
        help="Show communication details",
        description="Display full details of a communication record",
    )
    show_parser.add_argument("id", help="Communication ID")

    delete_parser = comm_sub.add_parser(
        "delete",
        help="Delete a communication",
        description="Permanently delete a communication record",
    )
    delete_parser.add_argument("id", help="Communication ID")
    delete_parser.add_argument("--force", action="store_true", help="Skip confirmation")

    freq_parser = comm_sub.add_parser(
        "frequency",
        help="Show communication frequency",
        description="Display a bar chart of communication frequency over time",
    )
    freq_parser.add_argument("--days", type=int, default=30, help="Number of days to show (default: 30)")
