from datetime import datetime

import pytest
from models import (
    Communication,
    CommunicationChannel,
    Company,
    Contact,
    ContactStatus,
    Priority,
    Reminder,
    ReminderStatus,
    Tag,
)
from pydantic import ValidationError


class TestContactModel:
    def test_valid_contact(self):
        contact = Contact(name="John Doe", email="john@example.com")
        assert contact.name == "John Doe"
        assert contact.email == "john@example.com"
        assert contact.status == ContactStatus.POTENTIAL
        assert contact.id is not None
        assert isinstance(contact.created_at, datetime)

    def test_contact_status_enum(self):
        contact = Contact(name="Jane Doe", status=ContactStatus.IN_COMMUNICATION)
        assert contact.status == ContactStatus.IN_COMMUNICATION

    def test_invalid_email(self):
        with pytest.raises(ValidationError):
            Contact(name="John", email="invalid-email")

    def test_name_required(self):
        with pytest.raises(ValidationError):
            Contact(email="john@example.com")

    def test_name_too_long(self):
        with pytest.raises(ValidationError):
            Contact(name="a" * 101)


class TestCompanyModel:
    def test_valid_company(self):
        company = Company(name="Acme Corp", industry="Tech", size="11-50")
        assert company.name == "Acme Corp"
        assert company.industry == "Tech"
        assert company.size == "11-50"

    def test_invalid_size(self):
        with pytest.raises(ValidationError):
            Company(name="Test", size="invalid")


class TestTagModel:
    def test_valid_tag(self):
        tag = Tag(name="VIP", color="#ff0000")
        assert tag.name == "VIP"
        assert tag.color == "#ff0000"

    def test_invalid_color(self):
        with pytest.raises(ValidationError):
            Tag(name="Test", color="red")


class TestReminderModel:
    def test_valid_reminder(self):
        reminder = Reminder(
            title="Follow up with John",
            due_date=datetime.now(),
            priority=Priority.HIGH,
        )
        assert reminder.title == "Follow up with John"
        assert reminder.priority == Priority.HIGH
        assert reminder.status == ReminderStatus.PENDING


class TestCommunicationModel:
    def test_valid_communication(self):
        comm = Communication(
            subject="Project discussion",
            channel=CommunicationChannel.EMAIL,
        )
        assert comm.subject == "Project discussion"
        assert comm.channel == CommunicationChannel.EMAIL
        assert isinstance(comm.date, datetime)
