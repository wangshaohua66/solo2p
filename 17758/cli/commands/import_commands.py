import argparse
from pathlib import Path
from typing import List
from uuid import UUID

from core import CRM
from models import Contact
from utils import Console, DataImporter


def _process_contact_tags(crm: CRM, contact_id: UUID, tag_names: List[str]) -> None:
    for tag_name in tag_names:
        tag = crm.tags.get_or_create(tag_name)
        crm.contacts.add_tag(contact_id, tag.id)


def _process_contact_company(crm: CRM, contact_id: UUID, company_name: str) -> None:
    if not company_name:
        return
    company = crm.companies.get_by_name(company_name)
    if not company:
        company = crm.companies.create(name=company_name)
    crm.contacts.set_company(contact_id, company.id)


def import_contacts_command(crm: CRM, args: argparse.Namespace) -> None:
    file_path = Path(args.file).expanduser()

    if not file_path.exists():
        Console.error(f"File not found: {file_path}")
        return

    try:
        if args.format == "csv":
            results, errors = DataImporter.import_csv_contacts(file_path)
        elif args.format == "vcard":
            contacts, errors = DataImporter.import_vcard(file_path)
            from utils.importer import ImportResult
            results = [ImportResult(contact=c) for c in contacts]
        else:
            Console.error(f"Unsupported format: {args.format}")
            return

        if errors:
            Console.warning(f"Found {len(errors)} errors:")
            for err in errors[:10]:
                print(f"  - {err}")
            if len(errors) > 10:
                print(f"  ... and {len(errors) - 10} more")

        if not results:
            Console.error("No valid contacts to import")
            return

        imported = 0
        skipped = 0
        overwritten = 0

        for result in Console.progress(results, desc="Saving contacts", total=len(results)):
            contact = result.contact
            existing = crm.contacts.get_by_name(contact.name)
            contact_id = None

            if existing and not args.force:
                if Console.confirm(f"Contact '{contact.name}' exists. Overwrite?", False):
                    update_data = contact.model_dump(exclude={"id", "created_at", "updated_at", "tag_ids"})
                    crm.contacts.update(existing.id, **update_data)
                    contact_id = existing.id
                    imported += 1
                    overwritten += 1
                else:
                    skipped += 1
                    continue
            else:
                if existing and args.force:
                    update_data = contact.model_dump(exclude={"id", "created_at", "updated_at", "tag_ids"})
                    crm.contacts.update(existing.id, **update_data)
                    contact_id = existing.id
                    overwritten += 1
                else:
                    create_data = contact.model_dump(exclude={"id", "created_at", "updated_at", "tag_ids"})
                    new_contact = crm.contacts.create(**create_data)
                    contact_id = new_contact.id
                imported += 1

            if contact_id:
                if result.tags:
                    _process_contact_tags(crm, contact_id, result.tags)
                if result.company_name:
                    _process_contact_company(crm, contact_id, result.company_name)

        crm.logger.import_("Contact", args.format, str(file_path), imported)
        if overwritten > 0:
            Console.warning(f"Overwritten {overwritten} existing contact(s) due to --force flag")
        Console.success(f"Import complete: {imported} imported ({overwritten} overwritten), {skipped} skipped")

    except Exception as e:
        Console.error(f"Import failed: {e}")
        crm.logger.error("Contact", "IMPORT", str(e))


def import_companies_command(crm: CRM, args: argparse.Namespace) -> None:
    file_path = Path(args.file).expanduser()

    if not file_path.exists():
        Console.error(f"File not found: {file_path}")
        return

    try:
        if args.format == "csv":
            companies, errors = DataImporter.import_csv_companies(file_path)
        else:
            Console.error(f"Unsupported format: {args.format}")
            return

        if errors:
            Console.warning(f"Found {len(errors)} errors:")
            for err in errors[:10]:
                print(f"  - {err}")

        if not companies:
            Console.error("No valid companies to import")
            return

        imported = 0
        skipped = 0
        overwritten = 0

        for company in Console.progress(companies, desc="Saving companies", total=len(companies)):
            existing = crm.companies.get_by_name(company.name)
            if existing and not args.force:
                if Console.confirm(f"Company '{company.name}' exists. Overwrite?", False):
                    crm.companies.update(existing.id, **company.model_dump(exclude={"id", "created_at", "updated_at"}))
                    imported += 1
                    overwritten += 1
                else:
                    skipped += 1
            else:
                if existing and args.force:
                    crm.companies.update(existing.id, **company.model_dump(exclude={"id", "created_at", "updated_at"}))
                    overwritten += 1
                else:
                    crm.companies.create(**company.model_dump(exclude={"id", "created_at", "updated_at"}))
                imported += 1

        crm.logger.import_("Company", args.format, str(file_path), imported)
        if overwritten > 0:
            Console.warning(f"Overwritten {overwritten} existing company(ies) due to --force flag")
        Console.success(f"Import complete: {imported} imported ({overwritten} overwritten), {skipped} skipped")

    except Exception as e:
        Console.error(f"Import failed: {e}")
        crm.logger.error("Company", "IMPORT", str(e))


def register_import_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "import",
        help="Import data",
        description="Import contacts and companies from CSV or vCard files",
    )
    import_sub = parser.add_subparsers(dest="import_command", required=True)

    contact_parser = import_sub.add_parser(
        "contacts",
        help="Import contacts",
        description="Import contacts from CSV or vCard format",
    )
    contact_parser.add_argument("file", help="Input file path")
    contact_parser.add_argument("--format", choices=["csv", "vcard"], required=True, help="File format")
    contact_parser.add_argument("--force", action="store_true", help="Overwrite existing without confirmation")

    company_parser = import_sub.add_parser(
        "companies",
        help="Import companies",
        description="Import companies from CSV format",
    )
    company_parser.add_argument("file", help="Input file path")
    company_parser.add_argument("--format", choices=["csv"], required=True, help="File format")
    company_parser.add_argument("--force", action="store_true", help="Overwrite existing without confirmation")
