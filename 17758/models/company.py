from typing import List, Optional
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from .base import BaseEntity


class Company(BaseEntity):
    name: str = Field(..., min_length=1, max_length=200)
    industry: Optional[str] = Field(default=None, max_length=100)
    size: Optional[str] = Field(default=None, pattern=r"^(1-10|11-50|51-200|201-500|500+)$")
    website: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=500)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = None
    contact_ids: List[UUID] = Field(default_factory=list)
