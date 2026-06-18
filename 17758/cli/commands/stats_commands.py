import argparse
from datetime import datetime

from core import CRM
from models import ContactStatus
from utils import Console


def overall_stats_command(crm: CRM, args: argparse.Namespace) -> None:
    stats = crm.stats.get_overall_stats()

    Console.header("Overall Statistics")

    print(f"  Contacts:      {stats['total_contacts']}")
    print(f"  Companies:     {stats['total_companies']}")
    print(f"  Communications:{stats['total_communications']}")
    print(f"  Reminders:     {stats['total_reminders']}")
    print(f"  Tags:          {stats['total_tags']}")

    Console.header("Contacts by Status")
    status_stats = stats["by_status"]
    total = sum(status_stats.values()) if status_stats else 1
    for status, count in status_stats.items():
        pct = (count / total) * 100 if total > 0 else 0
        bar_length = int(pct / 2)
        bar = "█" * bar_length + "░" * (50 - bar_length)
        status_display = status.replace("_", " ").title()
        print(f"  {status_display:20} | {bar} | {count:3d} ({pct:5.1f}%)")

    if stats["by_tag"]:
        Console.header("Contacts by Tag")
        for tag, count in sorted(stats["by_tag"].items(), key=lambda x: x[1], reverse=True):
            pct = (count / stats["total_contacts"]) * 100 if stats["total_contacts"] > 0 else 0
            print(f"  {tag:20} | {count:3d} ({pct:5.1f}%)")

    Console.header("Reminders Summary")
    rem = stats["reminders"]
    print(f"  Pending:   {rem['pending']}")
    print(f"  Completed: {rem['completed']}")
    print(f"  Overdue:   {rem['overdue']}")


def status_stats_command(crm: CRM, args: argparse.Namespace) -> None:
    stats = crm.stats.get_contact_stats_by_status()

    Console.header("Contacts by Status")

    total = sum(stats.values()) if stats else 1
    for status in ContactStatus:
        count = stats.get(status.value, 0)
        pct = (count / total) * 100 if total > 0 else 0
        bar_length = int(pct / 2)
        bar = "█" * bar_length + "░" * (50 - bar_length)
        status_display = status.value.replace("_", " ").title()
        print(f"  {status_display:20} | {bar} | {count:3d} ({pct:5.1f}%)")


def tag_stats_command(crm: CRM, args: argparse.Namespace) -> None:
    stats = crm.stats.get_contact_stats_by_tag()

    if not stats:
        Console.info("No tag statistics available")
        return

    Console.header("Contacts by Tag")

    total_contacts = len(crm.contacts.list())
    for tag, count in sorted(stats.items(), key=lambda x: x[1], reverse=True):
        pct = (count / total_contacts) * 100 if total_contacts > 0 else 0
        bar_length = int(pct / 2)
        bar = "█" * bar_length + "░" * (50 - bar_length)
        print(f"  {tag:20} | {bar} | {count:3d} ({pct:5.1f}%)")


def frequency_stats_command(crm: CRM, args: argparse.Namespace) -> None:
    freq = crm.stats.get_communication_frequency(args.days)

    Console.header(f"Communication Frequency (last {args.days} days)")

    total = 0
    for date, count in sorted(freq.items()):
        total += count
        bar = "█" * count if count > 0 else "░"
        print(f"  {date} | {bar} ({count})")

    avg = total / args.days if args.days > 0 else 0
    print(f"\nTotal: {total} communications | Avg: {avg:.1f} per day")

    if total > 0:
        max_day = max(freq, key=freq.get)
        min_day = min((k for k, v in freq.items() if v > 0), default=None)
        print(f"Most active: {max_day} ({freq[max_day]} communications)")
        if min_day:
            print(f"Least active: {min_day} ({freq[min_day]} communications)")


def funnel_command(crm: CRM, args: argparse.Namespace) -> None:
    funnel = crm.stats.get_funnel_report()

    Console.header("Sales Funnel")

    total = sum(item["count"] for item in funnel) if funnel else 1

    for i, item in enumerate(funnel):
        count = item["count"]
        pct = (count / total) * 100 if total > 0 else 0
        bar_length = int(pct / 2)
        bar = "█" * bar_length + "░" * (50 - bar_length)

        conversion = 0
        if i > 0 and funnel[i - 1]["count"] > 0:
            conversion = (count / funnel[i - 1]["count"]) * 100

        label = item["status"].replace("_", " ").title()
        conversion_str = f" ({conversion:.1f}% from prev)" if i > 0 else ""
        print(f"  {i + 1}. {label:20} | {bar} | {count:3d} ({pct:5.1f}%){conversion_str}")


def register_stats_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "stats",
        help="Statistics and reports",
        description="View statistics and generate reports about your CRM data",
    )
    stats_sub = parser.add_subparsers(dest="stats_command", required=True)

    overall_parser = stats_sub.add_parser(
        "overall",
        help="Show overall statistics",
        description="Display complete overview of all CRM statistics",
    )

    status_parser = stats_sub.add_parser(
        "status",
        help="Show status statistics",
        description="Display contact distribution by status",
    )

    tag_parser = stats_sub.add_parser(
        "tag",
        help="Show tag statistics",
        description="Display contact distribution by tags",
    )

    freq_parser = stats_sub.add_parser(
        "frequency",
        help="Show communication frequency",
        description="Display communication frequency over time",
    )
    freq_parser.add_argument("--days", type=int, default=30, help="Number of days to analyze (default: 30)")

    funnel_parser = stats_sub.add_parser(
        "funnel",
        help="Show sales funnel",
        description="Display sales funnel with conversion rates between statuses",
    )
