import argparse
from pathlib import Path
from uuid import UUID

from core import CRM
from utils import Console, DataExporter


def prompt_company_fields(crm: CRM, **kwargs) -> dict:
    data = {}
    data["name"] = kwargs.get("name") or Console.ask("Company name")
    if not data["name"]:
        raise ValueError("Company name is required")

    data["industry"] = kwargs.get("industry") or Console.ask("Industry (optional)")
    data["size"] = kwargs.get("size") or Console.ask("Size [1-10,11-50,51-200,201-500,500+] (optional)")
    data["website"] = kwargs.get("website") or Console.ask("Website (optional)")
    data["email"] = kwargs.get("email") or Console.ask("Email (optional)")
    data["phone"] = kwargs.get("phone") or Console.ask("Phone (optional)")
    data["address"] = kwargs.get("address") or Console.ask("Address (optional)")
    data["notes"] = kwargs.get("notes") or Console.ask("Notes (optional)")

    return data


def add_company_command(crm: CRM, args: argparse.Namespace) -> None:
    try:
        data = prompt_company_fields(
            crm,
            name=args.name,
            industry=args.industry,
            size=args.size,
            website=args.website,
            email=args.email,
            phone=args.phone,
            address=args.address,
            notes=args.notes,
        )
        company = crm.companies.create(**data)
        Console.success(f"Company created: {company.name} (ID: {company.id})")
    except Exception as e:
        Console.error(f"Failed to create company: {e}")


def list_companies_command(crm: CRM, args: argparse.Namespace) -> None:
    companies = crm.companies.list()

    if args.industry:
        companies = crm.companies.filter_by_industry(args.industry)

    if args.size:
        companies = crm.companies.filter_by_size(args.size)

    if args.search:
        companies = crm.companies.search(args.search)

    if not companies:
        Console.info("No companies found")
        return

    Console.header(f"Companies ({len(companies)})")

    rows = []
    for c in companies:
        rows.append([
            str(c.id)[:8],
            c.name,
            c.industry or "-",
            c.size or "-",
            c.email or "-",
            len(c.contact_ids),
        ])

    Console.table(
        ["ID", "Name", "Industry", "Size", "Email", "Contacts"],
        rows,
    )


def show_company_command(crm: CRM, args: argparse.Namespace) -> None:
    company = None
    try:
        company_id = UUID(args.id)
        company = crm.companies.get(company_id)
    except ValueError:
        company = crm.companies.get_by_name(args.id)

    if not company:
        Console.error(f"Company not found: {args.id}")
        return

    Console.header(f"Company: {company.name}")
    print(f"ID:         {company.id}")
    print(f"Name:       {company.name}")
    print(f"Industry:   {company.industry or '-'}")
    print(f"Size:       {company.size or '-'}")
    print(f"Website:    {company.website or '-'}")
    print(f"Email:      {company.email or '-'}")
    print(f"Phone:      {company.phone or '-'}")
    print(f"Address:    {company.address or '-'}")
    print(f"Notes:      {company.notes or '-'}")
    print(f"Created:    {company.created_at.strftime('%Y-%m-%d %H:%M')}")

    contacts = crm.companies.get_contacts(company.id)
    if contacts:
        Console.header(f"Contacts ({len(contacts)})")
        for contact in contacts:
            print(f"  {contact.name} - {contact.email or contact.phone or '-'}")

    comms = crm.communications.get_by_company(company.id)
    if comms:
        Console.header(f"Recent Communications ({len(comms)})")
        for comm in comms[:5]:
            print(f"  [{comm.date.strftime('%Y-%m-%d')}] ({comm.channel.value}) {comm.subject}")


def update_company_command(crm: CRM, args: argparse.Namespace) -> None:
    company = None
    try:
        company_id = UUID(args.id)
        company = crm.companies.get(company_id)
    except ValueError:
        company = crm.companies.get_by_name(args.id)

    if not company:
        Console.error(f"Company not found: {args.id}")
        return

    update_data = {}
    fields = ["name", "industry", "size", "website", "email", "phone", "address", "notes"]
    for field in fields:
        value = getattr(args, field)
        if value is not None:
            update_data[field] = value

    if update_data:
        crm.companies.update(company.id, **update_data)

    Console.success(f"Company updated: {company.name}")


def delete_company_command(crm: CRM, args: argparse.Namespace) -> None:
    company = None
    try:
        company_id = UUID(args.id)
        company = crm.companies.get(company_id)
    except ValueError:
        company = crm.companies.get_by_name(args.id)

    if not company:
        Console.error(f"Company not found: {args.id}")
        return

    if not args.force and not Console.confirm(f"Delete company '{company.name}'? This will remove association from {len(company.contact_ids)} contacts.", False):
        Console.info("Delete cancelled")
        return

    crm.companies.delete(company.id)
    Console.success(f"Company deleted: {company.name}")


def export_companies_command(crm: CRM, args: argparse.Namespace) -> None:
    companies = crm.companies.list()
    output_path = Path(args.output)

    if args.format == "csv":
        DataExporter.export_companies_csv(companies, output_path)
    else:
        DataExporter.export_json(companies, output_path)

    crm.logger.export("Company", args.format, str(output_path))
    Console.success(f"Exported {len(companies)} companies to {output_path}")


def register_company_commands(subparsers: argparse._SubParsersAction) -> None:
    parser = subparsers.add_parser(
        "company",
        help="Company management",
        description="Manage companies: add, list, show, update, delete",
    )
    company_sub = parser.add_subparsers(dest="company_command", required=True)

    add_parser = company_sub.add_parser(
        "add",
        help="Add a new company",
        description="Create a new company with interactive input if arguments missing",
    )
    add_parser.add_argument("--name", help="Company name")
    add_parser.add_argument("--industry", help="Industry sector")
    add_parser.add_argument("--size", choices=["1-10", "11-50", "51-200", "201-500", "500+"], help="Company size")
    add_parser.add_argument("--website", help="Company website")
    add_parser.add_argument("--email", help="Contact email")
    add_parser.add_argument("--phone", help="Contact phone")
    add_parser.add_argument("--address", help="Company address")
    add_parser.add_argument("--notes", help="Additional notes")

    list_parser = company_sub.add_parser(
        "list",
        help="List all companies",
        description="List companies with optional filtering by industry, size, or search query",
    )
    list_parser.add_argument("--industry", help="Filter by industry")
    list_parser.add_argument("--size", choices=["1-10", "11-50", "51-200", "201-500", "500+"], help="Filter by size")
    list_parser.add_argument("--search", help="Search by name, industry, email, or website")

    show_parser = company_sub.add_parser(
        "show",
        help="Show company details",
        description="Display detailed information about a company including its contacts and communications",
    )
    show_parser.add_argument("id", help="Company ID or name")

    update_parser = company_sub.add_parser(
        "update",
        help="Update a company",
        description="Update company information",
    )
    update_parser.add_argument("id", help="Company ID or name")
    update_parser.add_argument("--name", help="New name")
    update_parser.add_argument("--industry", help="New industry")
    update_parser.add_argument("--size", choices=["1-10", "11-50", "51-200", "201-500", "500+"], help="New size")
    update_parser.add_argument("--website", help="New website")
    update_parser.add_argument("--email", help="New email")
    update_parser.add_argument("--phone", help="New phone")
    update_parser.add_argument("--address", help="New address")
    update_parser.add_argument("--notes", help="New notes")

    delete_parser = company_sub.add_parser(
        "delete",
        help="Delete a company",
        description="Permanently delete a company (contacts remain but lose association)",
    )
    delete_parser.add_argument("id", help="Company ID or name")
    delete_parser.add_argument("--force", action="store_true", help="Skip confirmation")

    export_parser = company_sub.add_parser(
        "export",
        help="Export companies",
        description="Export all companies to CSV or JSON format",
    )
    export_parser.add_argument("output", help="Output file path")
    export_parser.add_argument("--format", choices=["csv", "json"], default="csv", help="Export format")
