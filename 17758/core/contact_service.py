from typing import List, Optional
from uuid import UUID

from models import Contact, ContactStatus
from storage import Database, EntityNotFoundError
from utils import AuditLogger


class ContactService:
    def __init__(self, db: Database, logger: AuditLogger):
        self.db = db
        self.logger = logger

    def create(self, **kwargs) -> Contact:
        contact = Contact(**kwargs)
        self.db.contacts.add(contact)
        self.logger.create("Contact", str(contact.id), f"name={contact.name}")
        return contact

    def get(self, contact_id: UUID) -> Optional[Contact]:
        return self.db.contacts.get(contact_id)

    def get_by_name(self, name: str) -> Optional[Contact]:
        contacts = self.db.contacts.list()
        for c in contacts:
            if c.name.lower() == name.lower():
                return c
        return None

    def list(self) -> List[Contact]:
        return self.db.contacts.list()

    def update(self, contact_id: UUID, **kwargs) -> Contact:
        contact = self.db.contacts.get(contact_id)
        if not contact:
            raise EntityNotFoundError("Contact", str(contact_id))

        for key, value in kwargs.items():
            if value is not None and hasattr(contact, key):
                setattr(contact, key, value)

        updated = self.db.contacts.update(contact)
        changes = ",".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
        self.logger.update("Contact", str(contact_id), changes)
        return updated

    def delete(self, contact_id: UUID) -> None:
        contact = self.db.contacts.get(contact_id)
        if not contact:
            raise EntityNotFoundError("Contact", str(contact_id))
        self.db.contacts.delete(contact_id)
        self.logger.delete("Contact", str(contact_id), f"name={contact.name}")

    def set_status(self, contact_id: UUID, status: ContactStatus) -> Contact:
        return self.update(contact_id, status=status)

    def add_tag(self, contact_id: UUID, tag_id: UUID) -> Contact:
        contact = self.db.contacts.get(contact_id)
        if not contact:
            raise EntityNotFoundError("Contact", str(contact_id))
        if tag_id not in contact.tag_ids:
            contact.tag_ids.append(tag_id)
        return self.db.contacts.update(contact)

    def remove_tag(self, contact_id: UUID, tag_id: UUID) -> Contact:
        contact = self.db.contacts.get(contact_id)
        if not contact:
            raise EntityNotFoundError("Contact", str(contact_id))
        if tag_id in contact.tag_ids:
            contact.tag_ids.remove(tag_id)
        return self.db.contacts.update(contact)

    def filter_by_status(self, status: ContactStatus) -> List[Contact]:
        return self.db.contacts.filter(status=status)

    def filter_by_tag(self, tag_id: UUID) -> List[Contact]:
        contacts = self.db.contacts.list()
        return [c for c in contacts if tag_id in c.tag_ids]

    def search(self, query: str) -> List[Contact]:
        query = query.lower()
        contacts = self.db.contacts.list()
        results = []
        for c in contacts:
            if (
                query in c.name.lower()
                or (c.email and query in c.email.lower())
                or (c.phone and query in c.phone)
                or (c.position and query in c.position.lower())
            ):
                results.append(c)
        return results

    def set_company(self, contact_id: UUID, company_id: UUID) -> Contact:
        contact = self.db.contacts.get(contact_id)
        if not contact:
            raise EntityNotFoundError("Contact", str(contact_id))
        company = self.db.companies.get(company_id)
        if not company:
            raise EntityNotFoundError("Company", str(company_id))

        old_company_id = contact.company_id
        if old_company_id and old_company_id != company_id:
            old_company = self.db.companies.get(old_company_id)
            if old_company and contact_id in old_company.contact_ids:
                old_company.contact_ids.remove(contact_id)
                self.db.companies.update(old_company)

        contact.company_id = company_id
        if contact_id not in company.contact_ids:
            company.contact_ids.append(contact_id)
            self.db.companies.update(company)

        return self.db.contacts.update(contact)
