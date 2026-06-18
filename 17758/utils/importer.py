import csv
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from models import Company, Contact, ContactStatus
from pydantic import ValidationError

from .console import Console


class ImportResult:
    def __init__(self, contact: Contact, tags: List[str] = None, company_name: str = None):
        self.contact = contact
        self.tags = tags or []
        self.company_name = company_name


class DataImporter:
    @staticmethod
    def import_csv_contacts(file_path: Path) -> Tuple[List[ImportResult], List[str]]:
        results = []
        errors = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(Console.progress(reader, desc="Importing contacts")):
                try:
                    contact_data, tags, company_name = DataImporter._map_csv_row_to_contact(row)
                    contact = Contact(**contact_data)
                    results.append(ImportResult(contact, tags, company_name))
                except (ValidationError, KeyError) as e:
                    errors.append(f"Row {i + 2}: {str(e)}")

        return results, errors

    @staticmethod
    def _map_csv_row_to_contact(row: Dict[str, str]) -> Tuple[Dict, List[str], Optional[str]]:
        def get(*keys: str, default=None):
            for key in keys:
                if key in row and row[key].strip():
                    return row[key].strip()
            return default

        contact_data = {
            "name": get("name", "姓名", "Name") or "",
            "email": get("email", "邮箱", "Email"),
            "phone": get("phone", "电话", "Phone", "mobile"),
            "position": get("position", "职位", "title", "Title"),
            "notes": get("notes", "备注", "Notes"),
        }

        status_str = get("status", "状态", "Status")
        if status_str:
            try:
                contact_data["status"] = ContactStatus(status_str.lower())
            except ValueError:
                pass

        tags_str = get("tags", "标签", "Tags")
        tags = []
        if tags_str:
            tags = [t.strip() for t in tags_str.replace("，", ",").split(",") if t.strip()]

        company_name = get("company", "公司", "Company", "company_name", "所属公司")

        return contact_data, tags, company_name

    @staticmethod
    def import_vcard(file_path: Path) -> Tuple[List[Contact], List[str]]:
        contacts = []
        errors = []
        vcards = DataImporter._parse_vcards(file_path)

        for i, vcard in enumerate(Console.progress(vcards, desc="Importing vCards")):
            try:
                contact = Contact(
                    name=vcard.get("FN", "") or vcard.get("N", "").split(";")[0] or "",
                    email=vcard.get("EMAIL"),
                    phone=vcard.get("TEL"),
                    position=vcard.get("TITLE"),
                )
                if contact.name:
                    contacts.append(contact)
                else:
                    errors.append(f"vCard {i + 1}: Missing name")
            except ValidationError as e:
                errors.append(f"vCard {i + 1}: {str(e)}")

        return contacts, errors

    @staticmethod
    def _parse_vcards(file_path: Path) -> List[Dict[str, str]]:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        vcards = []
        vcard_blocks = re.findall(r"BEGIN:VCARD(.*?)END:VCARD", content, re.DOTALL)

        for block in vcard_blocks:
            vcard = {}
            lines = block.strip().split("\n")
            for line in lines:
                line = line.strip()
                if not line or ":" not in line:
                    continue
                match = re.match(r"^([A-Z]+)(?:;[^:]+)?:(.*)$", line)
                if match:
                    key, value = match.groups()
                    if key not in vcard:
                        vcard[key] = value.strip()
            vcards.append(vcard)

        return vcards

    @staticmethod
    def import_csv_companies(file_path: Path) -> Tuple[List[Company], List[str]]:
        companies = []
        errors = []

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for i, row in enumerate(Console.progress(reader, desc="Importing companies")):
                try:
                    company_data = DataImporter._map_csv_row_to_company(row)
                    company = Company(**company_data)
                    companies.append(company)
                except (ValidationError, KeyError) as e:
                    errors.append(f"Row {i + 2}: {str(e)}")

        return companies, errors

    @staticmethod
    def _map_csv_row_to_company(row: Dict[str, str]) -> Dict:
        def get(*keys: str, default=None):
            for key in keys:
                if key in row and row[key].strip():
                    return row[key].strip()
            return default

        return {
            "name": get("name", "公司名称", "company", "Company") or "",
            "industry": get("industry", "行业"),
            "size": get("size", "规模"),
            "website": get("website", "网站"),
            "email": get("email", "邮箱"),
            "phone": get("phone", "电话"),
            "address": get("address", "地址"),
            "notes": get("notes", "备注"),
        }
