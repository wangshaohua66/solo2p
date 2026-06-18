from pathlib import Path
from typing import Dict, Type

from models import (
    BaseEntity,
    Communication,
    Company,
    Contact,
    Reminder,
    Tag,
)

from .repository import JSONRepository, Repository


class Database:
    def __init__(self, data_dir: Path):
        self.data_dir = Path(data_dir).expanduser()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._repos: Dict[str, Repository] = {}
        self._init_repos()

    def _init_repos(self) -> None:
        repo_configs = [
            ("contacts", Contact, "contacts.json"),
            ("companies", Company, "companies.json"),
            ("communications", Communication, "communications.json"),
            ("reminders", Reminder, "reminders.json"),
            ("tags", Tag, "tags.json"),
        ]
        for name, entity_class, filename in repo_configs:
            self._repos[name] = JSONRepository(
                entity_class,
                self.data_dir / filename,
            )

    @property
    def contacts(self) -> Repository[Contact]:
        return self._repos["contacts"]

    @property
    def companies(self) -> Repository[Company]:
        return self._repos["companies"]

    @property
    def communications(self) -> Repository[Communication]:
        return self._repos["communications"]

    @property
    def reminders(self) -> Repository[Reminder]:
        return self._repos["reminders"]

    @property
    def tags(self) -> Repository[Tag]:
        return self._repos["tags"]
