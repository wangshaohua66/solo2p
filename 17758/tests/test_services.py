import pytest
from core import (
    CommunicationService,
    CompanyService,
    ContactService,
    ReminderService,
    StatsService,
    TagService,
)
from models import ContactStatus, Priority
from storage import EntityNotFoundError


class TestContactService:
    def test_create_contact(self, db, logger):
        service = ContactService(db, logger)
        contact = service.create(name="John Doe", email="john@example.com")
        assert contact.name == "John Doe"
        assert contact.email == "john@example.com"

    def test_get_contact(self, db, logger):
        service = ContactService(db, logger)
        contact = service.create(name="John Doe")
        fetched = service.get(contact.id)
        assert fetched is not None
        assert fetched.name == "John Doe"

    def test_update_contact(self, db, logger):
        service = ContactService(db, logger)
        contact = service.create(name="John Doe")
        updated = service.update(contact.id, email="new@example.com")
        assert updated.email == "new@example.com"

    def test_delete_contact(self, db, logger):
        service = ContactService(db, logger)
        contact = service.create(name="John Doe")
        service.delete(contact.id)
        assert service.get(contact.id) is None

    def test_delete_nonexistent(self, db, logger):
        service = ContactService(db, logger)
        from uuid import uuid4
        with pytest.raises(EntityNotFoundError):
            service.delete(uuid4())

    def test_set_status(self, db, logger):
        service = ContactService(db, logger)
        contact = service.create(name="John Doe")
        updated = service.set_status(contact.id, ContactStatus.CLOSED)
        assert updated.status == ContactStatus.CLOSED

    def test_filter_by_status(self, db, logger):
        service = ContactService(db, logger)
        service.create(name="John", status=ContactStatus.POTENTIAL)
        service.create(name="Jane", status=ContactStatus.CLOSED)
        potential = service.filter_by_status(ContactStatus.POTENTIAL)
        assert len(potential) == 1
        assert potential[0].name == "John"

    def test_search(self, db, logger):
        service = ContactService(db, logger)
        service.create(name="John Doe", email="john@example.com")
        service.create(name="Jane Smith", email="jane@example.com")
        results = service.search("john")
        assert len(results) == 1
        assert results[0].name == "John Doe"


class TestTagService:
    def test_create_tag(self, db, logger):
        service = TagService(db, logger)
        tag = service.create(name="VIP")
        assert tag.name == "VIP"

    def test_get_or_create(self, db, logger):
        service = TagService(db, logger)
        tag1 = service.get_or_create("VIP")
        tag2 = service.get_or_create("VIP")
        assert tag1.id == tag2.id

    def test_add_tag_to_contact(self, db, logger):
        contact_service = ContactService(db, logger)
        tag_service = TagService(db, logger)
        contact = contact_service.create(name="John Doe")
        tag = tag_service.create(name="VIP")
        contact_service.add_tag(contact.id, tag.id)
        updated = contact_service.get(contact.id)
        assert tag.id in updated.tag_ids


class TestReminderService:
    def test_create_reminder(self, db, logger):
        from datetime import datetime, timedelta
        service = ReminderService(db, logger)
        due_date = datetime.now() + timedelta(days=1)
        reminder = service.create(
            title="Follow up",
            due_date=due_date,
            priority=Priority.HIGH,
        )
        assert reminder.title == "Follow up"

    def test_get_today_reminders(self, db, logger):
        from datetime import datetime, timedelta
        service = ReminderService(db, logger)
        today = datetime.now()
        tomorrow = datetime.now() + timedelta(days=1)
        service.create(title="Today", due_date=today)
        service.create(title="Tomorrow", due_date=tomorrow)
        today_reminders = service.get_today()
        assert len(today_reminders) == 1
        assert today_reminders[0].title == "Today"


class TestStatsService:
    def test_overall_stats(self, db, logger):
        contact_service = ContactService(db, logger)
        tag_service = TagService(db, logger)
        contact_service.create(name="John Doe")
        contact_service.create(name="Jane Doe", status=ContactStatus.CLOSED)
        tag_service.create(name="VIP")
        stats_service = StatsService(db)
        stats = stats_service.get_overall_stats()
        assert stats["total_contacts"] == 2
        assert stats["total_tags"] == 1
        assert stats["by_status"]["closed"] == 1
