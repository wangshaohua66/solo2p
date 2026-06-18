import argparse
from datetime import datetime, timedelta
from uuid import UUID

from core import CRM
from models import Priority, ReminderStatus
from utils import Console


def parse_date(date_str: str) -> datetime:
    for fmt in ["%Y-%m-%d", "%Y-%m-%d %H:%M", "%Y/%m/%d"]:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD or YYYY-MM-DD HH:MM")


def add_reminder_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        title = args.title or Console.ask("Title")
        if not title:
            raise ValueError("Title is required")

        due_date_str = args.due or Console.ask("Due date (YYYY-MM-DD or YYYY-MM-DD HH:MM)")
        if not due_date_str:
            default_date = datetime.now() + timedelta(days=crm.config.reminders.default_days_ahead)
            due_date_str = Console.ask("Due date", default_date.strftime("%Y-%m-%d"))
        due_date = parse_date(due_date_str)

        priority_str = args.priority or Console.ask(
            f"Priority [{','.join(p.value for p in Priority)}]",
            Priority.MEDIUM.value,
        )
        try:
            priority = Priority(priority_str)
        except ValueError:
            priority = Priority.MEDIUM
            Console.warning(f"Invalid priority, using default: {priority.value}")

        description = args.description or Console.ask("Description (optional)")

        contact_id = None
        contact_name = args.contact or Console.ask("Contact name/ID (optional)")
        if contact_name:
            try:
                contact_uuid = UUID(contact_name)
                contact = crm.contacts.get(contact_uuid)
            except ValueError:
                contact = crm.contacts.get_by_name(contact_name)
            if contact:
                contact_id = contact.id
            else:
                Console.warning(f"Contact not found: {contact_name}")

        company_id = None
        company_name = args.company or Console.ask("Company name/ID (optional)")
        if company_name:
            try:
                company_uuid = UUID(company_name)
                company = crm.companies.get(company_uuid)
            except ValueError:
                company = crm.companies.get_by_name(company_name)
            if company:
                company_id = company.id
            else:
                Console.warning(f"Company not found: {company_name}")

        reminder = crm.reminders.create(
            title=title,
            due_date=due_date,
            priority=priority,
            description=description,
            contact_id=contact_id,
            company_id=company_id,
        )
        Console.success(f"Reminder created: {reminder.title} (ID: {reminder.id})")
    except Exception as e:
        Console.error(f"Failed to create reminder: {e}")


def list_reminders_command(crm: CRM, args: argparse.Namespace) -> None:
    crm.reminders.mark_overdue()

    if args.today:
        reminders = crm.reminders.get_today()
        title = "Today's Reminders"
    elif args.upcoming:
        reminders = crm.reminders.get_upcoming(args.days or 7)
        title = f"Upcoming Reminders (next {args.days or 7} days)"
    elif args.overdue:
        reminders = crm.reminders.get_overdue()
        title = "Overdue Reminders"
    elif args.priority:
        try:
            priority = Priority(args.priority)
            reminders = crm.reminders.get_by_priority(priority)
            title = f"Reminders - Priority: {priority.value}"
        except ValueError:
            Console.error(f"Invalid priority: {args.priority}")
            return
    else:
        reminders = crm.reminders.list()
        title = "All Reminders"

    if args.contact:
        contact = None
        try:
            contact_uuid = UUID(args.contact)
            contact = crm.contacts.get(contact_uuid)
        except ValueError:
            contact = crm.contacts.get_by_name(args.contact)
        if contact:
            reminders = [r for r in reminders if r.contact_id == contact.id]
        else:
            Console.error(f"Contact not found: {args.contact}")
            return

    if not reminders:
        Console.info(f"No {title.lower()}")
        return

    Console.header(f"{title} ({len(reminders)})")

    contact_map = {c.id: c.name for c in crm.contacts.list()}
    company_map = {c.id: c.name for c in crm.companies.list()}

    rows = []
    for r in reminders:
        status_display = r.status.value
        if r.status == ReminderStatus.OVERDUE:
            status_display = f"{status_display}!"
        contact = contact_map.get(r.contact_id, "-")
        company = company_map.get(r.company_id, "-")
        rows.append([
            r.due_date.strftime("%Y-%m-%d"),
            r.priority.value,
            status_display,
            r.title,
            contact,
            company,
        ])

    Console.table(
        ["Due Date", "Priority", "Status", "Title", "Contact", "Company"],
        rows,
    )


def today_reminders_command(crm: CRM, args: argparse.Namespace) -> None:
    crm.reminders.mark_overdue()
    reminders = crm.reminders.get_today()

    if not reminders:
        Console.info("No reminders for today")
        return

    Console.header(f"Today's Reminders ({len(reminders)})")

    contact_map = {c.id: c.name for c in crm.contacts.list()}

    for i, r in enumerate(reminders, 1):
        priority_color = {
            Priority.HIGH: "\033[91m",
            Priority.MEDIUM: "\033[93m",
            Priority.LOW: "\033[92m",
        }.get(r.priority, "")
        reset = "\033[0m"

        contact = contact_map.get(r.contact_id, "")
        contact_str = f" - {contact}" if contact else ""

        print(f"  {i}. [{r.due_date.strftime('%H:%M')}] {priority_color}●{reset} {r.title}{contact_str}")
        if r.description:
            print(f"     {r.description}")


def complete_reminder_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        reminder_id = UUID(args.id)
        reminder = crm.reminders.get(reminder_id)
    except ValueError:
        Console.error(f"Invalid ID: {args.id}")
        return

    if not reminder:
        Console.error(f"Reminder not found: {args.id}")
        return

    crm.reminders.complete(reminder.id)
    Console.success(f"Reminder completed: {reminder.title}")


def update_reminder_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        reminder_id = UUID(args.id)
        reminder = crm.reminders.get(reminder_id)
    except ValueError:
        Console.error(f"Invalid ID: {args.id}")
        return

    if not reminder:
        Console.error(f"Reminder not found: {args.id}")
        return

    update_data = {}
    if args.title:
        update_data["title"] = args.title
    if args.due:
        update_data["due_date"] = parse_date(args.due)
    if args.priority:
        try:
            update_data["priority"] = Priority(args.priority)
        except ValueError:
            Console.error(f"Invalid priority: {args.priority}")
            return
    if args.status:
        try:
            update_data["status"] = ReminderStatus(args.status)
        except ValueError:
            Console.error(f"Invalid status: {args.status}")
            return
    if args.description is not None:
        update_data["description"] = args.description

    if update_data:
        crm.reminders.update(reminder.id, **update_data)

    Console.success(f"Reminder updated: {reminder.title}")


def delete_reminder_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        reminder_id = UUID(args.id)
        reminder = crm.reminders.get(reminder_id)
    except ValueError:
        Console.error(f"Invalid ID: {args.id}")
        return

    if not reminder:
        Console.error(f"Reminder not found: {args.id}")
        return

    if not args.force and not Console.confirm(f"Delete reminder '{reminder.title}'?", False):
        Console.info("Delete cancelled")
        return

    crm.reminders.delete(reminder.id)
    Console.success(f"Reminder deleted: {reminder.title}")


def register_reminder_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "reminder",
        help="Follow-up reminder management",
        description="Manage follow-up reminders for contacts and companies",
    )
    reminder_sub = parser.add_subparsers(dest="reminder_command", required=True)

    add_parser = reminder_sub.add_parser(
        "add",
        help="Add a new reminder",
        description="Create a follow-up reminder with due date and priority",
    )
    add_parser.add_argument("--title", help="Reminder title")
    add_parser.add_argument("--due", help="Due date (YYYY-MM-DD or YYYY-MM-DD HH:MM)")
    add_parser.add_argument("--priority", choices=[p.value for p in Priority], help="Priority level")
    add_parser.add_argument("--description", help="Detailed description")
    add_parser.add_argument("--contact", help="Associated contact name/ID")
    add_parser.add_argument("--company", help="Associated company name/ID")

    list_parser = reminder_sub.add_parser(
        "list",
        help="List reminders",
        description="List reminders with various filtering options",
    )
    list_parser.add_argument("--today", action="store_true", help="Show only today's reminders")
    list_parser.add_argument("--upcoming", action="store_true", help="Show upcoming reminders")
    list_parser.add_argument("--overdue", action="store_true", help="Show only overdue reminders")
    list_parser.add_argument("--days", type=int, help="Days ahead for upcoming (default: 7)")
    list_parser.add_argument("--priority", choices=[p.value for p in Priority], help="Filter by priority")
    list_parser.add_argument("--contact", help="Filter by contact name/ID")

    today_parser = reminder_sub.add_parser(
        "today",
        help="Show today's reminders",
        description="Display all reminders due today",
    )

    complete_parser = reminder_sub.add_parser(
        "complete",
        help="Mark reminder as completed",
        description="Mark a reminder as completed",
    )
    complete_parser.add_argument("id", help="Reminder ID")

    update_parser = reminder_sub.add_parser(
        "update",
        help="Update a reminder",
        description="Update reminder details",
    )
    update_parser.add_argument("id", help="Reminder ID")
    update_parser.add_argument("--title", help="New title")
    update_parser.add_argument("--due", help="New due date")
    update_parser.add_argument("--priority", choices=[p.value for p in Priority], help="New priority")
    update_parser.add_argument("--status", choices=[s.value for s in ReminderStatus], help="New status")
    update_parser.add_argument("--description", help="New description")

    delete_parser = reminder_sub.add_parser(
        "delete",
        help="Delete a reminder",
        description="Permanently delete a reminder",
    )
    delete_parser.add_argument("id", help="Reminder ID")
    delete_parser.add_argument("--force", action="store_true", help="Skip confirmation")
