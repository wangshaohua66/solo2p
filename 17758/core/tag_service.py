from typing import List, Optional
from uuid import UUID

from models import Tag
from storage import Database, EntityNotFoundError
from utils import AuditLogger


class TagService:
    def __init__(self, db: Database, logger: AuditLogger):
        self.db = db
        self.logger = logger

    def create(self, **kwargs) -> Tag:
        existing = self.get_by_name(kwargs.get("name", ""))
        if existing:
            return existing
        tag = Tag(**kwargs)
        self.db.tags.add(tag)
        self.logger.create("Tag", str(tag.id), f"name={tag.name}")
        return tag

    def get(self, tag_id: UUID) -> Optional[Tag]:
        return self.db.tags.get(tag_id)

    def get_by_name(self, name: str) -> Optional[Tag]:
        tags = self.db.tags.list()
        for t in tags:
            if t.name.lower() == name.lower():
                return t
        return None

    def list(self) -> List[Tag]:
        return sorted(self.db.tags.list(), key=lambda t: t.name)

    def update(self, tag_id: UUID, **kwargs) -> Tag:
        tag = self.db.tags.get(tag_id)
        if not tag:
            raise EntityNotFoundError("Tag", str(tag_id))

        for key, value in kwargs.items():
            if value is not None and hasattr(tag, key):
                setattr(tag, key, value)

        updated = self.db.tags.update(tag)
        changes = ",".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
        self.logger.update("Tag", str(tag_id), changes)
        return updated

    def delete(self, tag_id: UUID) -> None:
        tag = self.db.tags.get(tag_id)
        if not tag:
            raise EntityNotFoundError("Tag", str(tag_id))

        for contact in self.db.contacts.list():
            if tag_id in contact.tag_ids:
                contact.tag_ids.remove(tag_id)
                self.db.contacts.update(contact)

        self.db.tags.delete(tag_id)
        self.logger.delete("Tag", str(tag_id), f"name={tag.name}")

    def get_or_create(self, name: str, **kwargs) -> Tag:
        existing = self.get_by_name(name)
        if existing:
            return existing
        return self.create(name=name, **kwargs)

    def get_usage_count(self, tag_id: UUID) -> int:
        count = 0
        for contact in self.db.contacts.list():
            if tag_id in contact.tag_ids:
                count += 1
        return count
