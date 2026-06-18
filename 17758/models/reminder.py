from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from .base import BaseEntity
from .enums import Priority, ReminderStatus


class Reminder(BaseEntity):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    due_date: datetime = Field(...)
    priority: Priority = Field(default=Priority.MEDIUM)
    status: ReminderStatus = Field(default=ReminderStatus.PENDING)
    contact_id: Optional[UUID] = None
    company_id: Optional[UUID] = None
