from typing import List, Optional
from uuid import UUID

from models import Company
from storage import Database, EntityNotFoundError
from utils import AuditLogger


class CompanyService:
    def __init__(self, db: Database, logger: AuditLogger):
        self.db = db
        self.logger = logger

    def create(self, **kwargs) -> Company:
        company = Company(**kwargs)
        self.db.companies.add(company)
        self.logger.create("Company", str(company.id), f"name={company.name}")
        return company

    def get(self, company_id: UUID) -> Optional[Company]:
        return self.db.companies.get(company_id)

    def get_by_name(self, name: str) -> Optional[Company]:
        companies = self.db.companies.list()
        for c in companies:
            if c.name.lower() == name.lower():
                return c
        return None

    def list(self) -> List[Company]:
        return self.db.companies.list()

    def update(self, company_id: UUID, **kwargs) -> Company:
        company = self.db.companies.get(company_id)
        if not company:
            raise EntityNotFoundError("Company", str(company_id))

        for key, value in kwargs.items():
            if value is not None and hasattr(company, key):
                setattr(company, key, value)

        updated = self.db.companies.update(company)
        changes = ",".join(f"{k}={v}" for k, v in kwargs.items() if v is not None)
        self.logger.update("Company", str(company_id), changes)
        return updated

    def delete(self, company_id: UUID) -> None:
        company = self.db.companies.get(company_id)
        if not company:
            raise EntityNotFoundError("Company", str(company_id))

        for contact_id in company.contact_ids:
            contact = self.db.contacts.get(contact_id)
            if contact:
                contact.company_id = None
                self.db.contacts.update(contact)

        self.db.companies.delete(company_id)
        self.logger.delete("Company", str(company_id), f"name={company.name}")

    def filter_by_industry(self, industry: str) -> List[Company]:
        return self.db.companies.filter(industry=industry)

    def filter_by_size(self, size: str) -> List[Company]:
        return self.db.companies.filter(size=size)

    def get_contacts(self, company_id: UUID) -> List:
        company = self.db.companies.get(company_id)
        if not company:
            raise EntityNotFoundError("Company", str(company_id))
        contacts = []
        for contact_id in company.contact_ids:
            contact = self.db.contacts.get(contact_id)
            if contact:
                contacts.append(contact)
        return contacts

    def search(self, query: str) -> List[Company]:
        query = query.lower()
        companies = self.db.companies.list()
        results = []
        for c in companies:
            if (
                query in c.name.lower()
                or (c.industry and query in c.industry.lower())
                or (c.email and query in c.email.lower())
                or (c.website and query in c.website.lower())
            ):
                results.append(c)
        return results
