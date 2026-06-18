from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from models import Priority, Reminder, ReminderStatus
from storage import Database, EntityNotFoundError
from utils import AuditLogger


class ReminderService:
    def __init__(self, db: Database, logger: AuditLogger):
        self.db = db
        self.logger = logger

    def create(self, **kwargs) -> Reminder:
        reminder = Reminder(**kwargs)
        self.db.reminders.add(reminder)
        self.logger.create("Reminder", str(reminder.id), f"title={reminder.title}")
        return reminder

    def get(self, reminder_id: UUID) -> Optional[Reminder]:
        return self.db.reminders.get(reminder_id)

    def list(self) -> List[Reminder]:
        return sorted(
            self.db.reminders.list(),
            key=lambda r: (r.priority != Priority.HIGH, r.priority != Priority.MEDIUM, r.due_date),
        )

    def update(self, reminder_id: UUID, **kwargs) -> Reminder:
        reminder = self.db.reminders.get(reminder_id)
        if not reminder:
            raise EntityNotFoundError("Reminder", str(reminder_id))

        for key, value in kwargs.items():
            if value is not None and hasattr(reminder, key):
                setattr(reminder, key, value)

        updated = self.db.reminders.update(reminder)
        changes = ",".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
        self.logger.update("Reminder", str(reminder_id), changes)
        return updated

    def delete(self, reminder_id: UUID) -> None:
        reminder = self.db.reminders.get(reminder_id)
        if not reminder:
            raise EntityNotFoundError("Reminder", str(reminder_id))
        self.db.reminders.delete(reminder_id)
        self.logger.delete("Reminder", str(reminder_id), f"title={reminder.title}")

    def complete(self, reminder_id: UUID) -> Reminder:
        return self.update(reminder_id, status=ReminderStatus.COMPLETED)

    def mark_overdue(self) -> None:
        now = datetime.now()
        for reminder in self.db.reminders.list():
            if reminder.status == ReminderStatus.PENDING and reminder.due_date < now:
                self.update(reminder.id, status=ReminderStatus.OVERDUE)

    def get_today(self) -> List[Reminder]:
        today = datetime.now().date()
        reminders = self.db.reminders.list()
        return sorted(
            [r for r in reminders if r.due_date.date() == today and r.status != ReminderStatus.COMPLETED],
            key=lambda r: (r.priority != Priority.HIGH, r.due_date),
        )

    def get_upcoming(self, days: int = 7) -> List[Reminder]:
        now = datetime.now()
        cutoff = now + timedelta(days=days)
        reminders = self.db.reminders.list()
        return sorted(
            [
                r
                for r in reminders
                if r.due_date <= cutoff and r.due_date >= now and r.status != ReminderStatus.COMPLETED
            ],
            key=lambda r: (r.priority != Priority.HIGH, r.due_date),
        )

    def get_overdue(self) -> List[Reminder]:
        now = datetime.now()
        reminders = self.db.reminders.list()
        return sorted(
            [r for r in reminders if r.status == ReminderStatus.OVERDUE],
            key=lambda r: (r.priority != Priority.HIGH, r.due_date),
        )

    def get_by_priority(self, priority: Priority) -> List[Reminder]:
        return sorted(
            self.db.reminders.filter(priority=priority, status=ReminderStatus.PENDING),
            key=lambda r: r.due_date,
        )

    def get_by_contact(self, contact_id: UUID) -> List[Reminder]:
        reminders = self.db.reminders.list()
        return [r for r in reminders if r.contact_id == contact_id]
