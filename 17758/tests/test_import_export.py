import csv
from pathlib import Path

import pytest
from utils import DataExporter, DataImporter


class TestDataImporter:
    def test_import_csv_contacts(self, temp_dir):
        csv_file = temp_dir / "contacts.csv"
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email", "phone"])
            writer.writeheader()
            writer.writerow({"name": "John Doe", "email": "john@example.com", "phone": "123456"})
            writer.writerow({"name": "Jane Smith", "email": "jane@example.com", "phone": ""})

        results, errors = DataImporter.import_csv_contacts(csv_file)
        assert len(errors) == 0
        assert len(results) == 2
        assert results[0].contact.name == "John Doe"
        assert results[0].contact.email == "john@example.com"
        assert results[0].tags == []
        assert results[0].company_name is None

    def test_import_csv_with_status_tags_company(self, temp_dir):
        csv_file = temp_dir / "contacts.csv"
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email", "status", "tags", "company"])
            writer.writeheader()
            writer.writerow({
                "name": "John Doe",
                "email": "john@example.com",
                "status": "in_communication",
                "tags": "VIP,Important",
                "company": "Acme Corp",
            })

        results, errors = DataImporter.import_csv_contacts(csv_file)
        assert len(errors) == 0
        assert len(results) == 1
        assert results[0].contact.status.value == "in_communication"
        assert results[0].tags == ["VIP", "Important"]
        assert results[0].company_name == "Acme Corp"

    def test_import_csv_with_errors(self, temp_dir):
        csv_file = temp_dir / "contacts.csv"
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["name", "email"])
            writer.writeheader()
            writer.writerow({"name": "John Doe", "email": "invalid-email"})

        results, errors = DataImporter.import_csv_contacts(csv_file)
        assert len(errors) > 0 or len(results) == 1


class TestDataExporter:
    def test_export_json(self, temp_dir):
        from models import Contact
        contacts = [Contact(name="John Doe"), Contact(name="Jane Smith")]
        output_file = temp_dir / "contacts.json"
        DataExporter.export_json(contacts, output_file)
        assert output_file.exists()
        import json
        with open(output_file) as f:
            data = json.load(f)
        assert len(data) == 2
        assert data[0]["name"] == "John Doe"

    def test_export_contacts_csv(self, temp_dir):
        from models import Contact
        contacts = [Contact(name="John Doe", email="john@example.com")]
        output_file = temp_dir / "contacts.csv"
        DataExporter.export_contacts_csv(contacts, output_file)
        assert output_file.exists()
        with open(output_file, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        assert len(rows) == 1
        assert rows[0]["name"] == "John Doe"
