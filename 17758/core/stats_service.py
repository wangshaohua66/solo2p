from collections import Counter
from datetime import datetime, timedelta
from typing import Dict, List

from models import ContactStatus
from storage import Database


class StatsService:
    def __init__(self, db: Database):
        self.db = db

    def get_contact_stats_by_status(self) -> Dict[str, int]:
        contacts = self.db.contacts.list()
        counter = Counter(c.status.value for c in contacts)
        return {status.value: counter.get(status.value, 0) for status in ContactStatus}

    def get_contact_stats_by_tag(self) -> Dict[str, int]:
        tag_counts: Dict[str, int] = {}
        tags = {str(t.id): t.name for t in self.db.tags.list()}
        for contact in self.db.contacts.list():
            for tag_id in contact.tag_ids:
                tag_name = tags.get(str(tag_id), str(tag_id))
                tag_counts[tag_name] = tag_counts.get(tag_name, 0) + 1
        return dict(sorted(tag_counts.items(), key=lambda x: x[1], reverse=True))

    def get_company_stats_by_industry(self) -> Dict[str, int]:
        companies = self.db.companies.list()
        counter = Counter(c.industry or "Unknown" for c in companies)
        return dict(counter)

    def get_communication_frequency(self, days: int = 30) -> Dict[str, int]:
        cutoff = datetime.now() - timedelta(days=days)
        comms = [c for c in self.db.communications.list() if c.date >= cutoff]
        freq = {}
        for i in range(days):
            day = (datetime.now() - timedelta(days=i)).date().strftime("%Y-%m-%d")
            freq[day] = 0
        for c in comms:
            date_str = c.date.date().strftime("%Y-%m-%d")
            if date_str in freq:
                freq[date_str] += 1
        return dict(sorted(freq.items()))

    def get_reminder_stats(self) -> Dict[str, int]:
        reminders = self.db.reminders.list()
        return {
            "total": len(reminders),
            "pending": sum(1 for r in reminders if r.status.value == "pending"),
            "completed": sum(1 for r in reminders if r.status.value == "completed"),
            "overdue": sum(1 for r in reminders if r.status.value == "overdue"),
        }

    def get_overall_stats(self) -> Dict:
        return {
            "total_contacts": len(self.db.contacts.list()),
            "total_companies": len(self.db.companies.list()),
            "total_communications": len(self.db.communications.list()),
            "total_reminders": len(self.db.reminders.list()),
            "total_tags": len(self.db.tags.list()),
            "by_status": self.get_contact_stats_by_status(),
            "by_tag": self.get_contact_stats_by_tag(),
            "reminders": self.get_reminder_stats(),
        }

    def get_funnel_report(self) -> List[Dict]:
        status_order = [
            ContactStatus.POTENTIAL,
            ContactStatus.IN_COMMUNICATION,
            ContactStatus.CLOSED,
            ContactStatus.LOST,
        ]
        stats = self.get_contact_stats_by_status()
        report = []
        for status in status_order:
            count = stats.get(status.value, 0)
            report.append({"status": status.value, "count": count, "label": status.name})
        return report
