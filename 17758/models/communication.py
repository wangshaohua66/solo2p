from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import Field

from .base import BaseEntity
from .enums import CommunicationChannel


class Communication(BaseEntity):
    date: datetime = Field(default_factory=datetime.now)
    channel: CommunicationChannel = Field(default=CommunicationChannel.EMAIL)
    subject: str = Field(..., min_length=1, max_length=200)
    content: Optional[str] = None
    contact_ids: List[UUID] = Field(default_factory=list)
    company_id: Optional[UUID] = None
