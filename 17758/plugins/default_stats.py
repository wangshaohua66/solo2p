from typing import Any, Dict

from storage import Database
from utils import BasePlugin, Console


class DefaultStatsPlugin(BasePlugin):
    name = "default_stats"
    description = "Default statistics and reporting plugin"

    def get_commands(self) -> Dict[str, str]:
        return {
            "monthly_report": "Generate a comprehensive monthly report",
            "inactive_contacts": "Find contacts with no recent communication",
        }

    def run(self, db: Database, **kwargs) -> Any:
        command = kwargs.get("command", "default")

        if command == "monthly_report":
            return self._monthly_report(db)
        elif command == "inactive_contacts":
            return self._inactive_contacts(db)
        else:
            return self._default_help()

    def _default_help(self) -> str:
        help_text = "Default Stats Plugin Commands:\n"
        help_text += "  monthly_report    - Generate a comprehensive monthly report\n"
        help_text += "  inactive_contacts - Find contacts with no recent communication\n"
        return help_text

    def _monthly_report(self, db: Database) -> str:
        from datetime import datetime, timedelta

        now = datetime.now()
        thirty_days_ago = now - timedelta(days=30)

        contacts = db.contacts.list()
        companies = db.companies.list()
        comms = db.communications.list()
        reminders = db.reminders.list()

        new_contacts = [c for c in contacts if c.created_at >= thirty_days_ago]
        new_companies = [c for c in companies if c.created_at >= thirty_days_ago]
        recent_comms = [c for c in comms if c.date >= thirty_days_ago]
        completed_reminders = [r for r in reminders if r.status.value == "completed" and r.updated_at >= thirty_days_ago]

        report = []
        report.append("=" * 60)
        report.append("  MONTHLY CRM REPORT")
        report.append("=" * 60)
        report.append(f"  Period: {thirty_days_ago.strftime('%Y-%m-%d')} to {now.strftime('%Y-%m-%d')}")
        report.append("")
        report.append("  NEW ITEMS:")
        report.append(f"    Contacts:    {len(new_contacts)}")
        report.append(f"    Companies:   {len(new_companies)}")
        report.append("")
        report.append("  ACTIVITY:")
        report.append(f"    Communications: {len(recent_comms)}")
        report.append(f"    Reminders done: {len(completed_reminders)}")
        report.append("")
        report.append("  TOTALS:")
        report.append(f"    Contacts:    {len(contacts)}")
        report.append(f"    Companies:   {len(companies)}")
        report.append(f"    Reminders:   {len(reminders)}")
        report.append("=" * 60)

        return "\n".join(report)

    def _inactive_contacts(self, db: Database) -> Any:
        from datetime import datetime, timedelta

        days = 30
        cutoff = datetime.now() - timedelta(days=days)

        contacts = db.contacts.list()
        comms = db.communications.list()

        active_contact_ids = set()
        for comm in comms:
            if comm.date >= cutoff:
                active_contact_ids.update(comm.contact_ids)

        inactive = [c for c in contacts if c.id not in active_contact_ids]

        if not inactive:
            return f"No inactive contacts found (threshold: {days} days)"

        results = []
        results.append(f"Inactive Contacts (no communication in {days} days):")
        results.append("")
        for c in inactive:
            last_comm = None
            for comm in sorted(comms, key=lambda x: x.date, reverse=True):
                if c.id in comm.contact_ids:
                    last_comm = comm.date
                    break
            last_contact_str = last_comm.strftime("%Y-%m-%d") if last_comm else "Never"
            results.append(f"  - {c.name} ({c.email or 'no email'}) - Last contact: {last_contact_str}")

        return "\n".join(results)
