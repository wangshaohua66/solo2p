from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LoggingConfig(BaseModel):
    level: str = Field(default="INFO", pattern=r"^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    file: Optional[str] = None


class ReminderConfig(BaseModel):
    default_days_ahead: int = Field(default=7, ge=1, le=365)


class Config(BaseModel):
    data_dir: str = Field(default="~/.crm")
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    reminders: ReminderConfig = Field(default_factory=ReminderConfig)
