from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from models import Communication
from storage import Database, EntityNotFoundError
from utils import AuditLogger


class CommunicationService:
    def __init__(self, db: Database, logger: AuditLogger):
        self.db = db
        self.logger = logger

    def create(self, **kwargs) -> Communication:
        comm = Communication(**kwargs)
        self.db.communications.add(comm)
        self.logger.create("Communication", str(comm.id), f"subject={comm.subject}")
        return comm

    def get(self, comm_id: UUID) -> Optional[Communication]:
        return self.db.communications.get(comm_id)

    def list(self) -> List[Communication]:
        return sorted(
            self.db.communications.list(),
            key=lambda c: c.date,
            reverse=True,
        )

    def update(self, comm_id: UUID, **kwargs) -> Communication:
        comm = self.db.communications.get(comm_id)
        if not comm:
            raise EntityNotFoundError("Communication", str(comm_id))

        for key, value in kwargs.items():
            if value is not None and hasattr(comm, key):
                setattr(comm, key, value)

        updated = self.db.communications.update(comm)
        changes = ",".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
        self.logger.update("Communication", str(comm_id), changes)
        return updated

    def delete(self, comm_id: UUID) -> None:
        comm = self.db.communications.get(comm_id)
        if not comm:
            raise EntityNotFoundError("Communication", str(comm_id))
        self.db.communications.delete(comm_id)
        self.logger.delete("Communication", str(comm_id), f"subject={comm.subject}")

    def add_contact(self, comm_id: UUID, contact_id: UUID) -> Communication:
        comm = self.db.communications.get(comm_id)
        if not comm:
            raise EntityNotFoundError("Communication", str(comm_id))
        if contact_id not in comm.contact_ids:
            comm.contact_ids.append(contact_id)
        return self.db.communications.update(comm)

    def get_by_contact(self, contact_id: UUID) -> List[Communication]:
        comms = self.db.communications.list()
        return sorted(
            [c for c in comms if contact_id in c.contact_ids],
            key=lambda c: c.date,
            reverse=True,
        )

    def get_by_company(self, company_id: UUID) -> List[Communication]:
        comms = self.db.communications.list()
        return sorted(
            [c for c in comms if c.company_id == company_id],
            key=lambda c: c.date,
            reverse=True,
        )

    def get_recent(self, days: int = 30) -> List[Communication]:
        cutoff = datetime.now() - timedelta(days=days)
        comms = self.db.communications.list()
        return sorted(
            [c for c in comms if c.date >= cutoff],
            key=lambda c: c.date,
            reverse=True,
        )

    def get_frequency(self, days: int = 30) -> dict:
        cutoff = datetime.now() - timedelta(days=days)
        comms = [c for c in self.db.communications.list() if c.date >= cutoff]
        freq = {}
        for c in comms:
            date_str = c.date.strftime("%Y-%m-%d")
            freq[date_str] = freq.get(date_str, 0) + 1
        return freq
