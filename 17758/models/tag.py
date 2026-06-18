from typing import Optional

from pydantic import Field

from .base import BaseEntity


class Tag(BaseEntity):
    name: str = Field(..., min_length=1, max_length=50)
    color: Optional[str] = Field(default="#3498db", pattern=r"^#[0-9a-fA-F]{6}$")
    description: Optional[str] = Field(default=None, max_length=200)
