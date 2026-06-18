from pathlib import Path

DEFAULT_CONFIG = {
    "data_dir": "~/.crm",
    "logging": {
        "level": "INFO",
        "file": None,
    },
    "reminders": {
        "default_days_ahead": 7,
    },
}

from .manager import ConfigManager

__all__ = ["ConfigManager", "DEFAULT_CONFIG"]
