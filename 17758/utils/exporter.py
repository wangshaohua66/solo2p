import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, List, TypeVar

from models import BaseEntity

from .console import Console

T = TypeVar("T", bound=BaseEntity)


class DataExporter:
    @staticmethod
    def export_json(entities: List[T], file_path: Path) -> None:
        data = []
        for entity in Console.progress(entities, desc="Exporting to JSON"):
            entity_dict = json.loads(entity.model_dump_json())
            data.append(entity_dict)

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    @staticmethod
    def export_csv(entities: List[T], file_path: Path, fields: List[str]) -> None:
        if not entities:
            return

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for entity in Console.progress(entities, desc="Exporting to CSV"):
                entity_dict = json.loads(entity.model_dump_json())
                writer.writerow(entity_dict)

    @staticmethod
    def export_contacts_csv(entities: List, file_path: Path) -> None:
        fields = ["id", "name", "email", "phone", "position", "status", "company_id", "tag_ids", "notes", "created_at", "updated_at"]
        DataExporter.export_csv(entities, file_path, fields)

    @staticmethod
    def export_companies_csv(entities: List, file_path: Path) -> None:
        fields = ["id", "name", "industry", "size", "website", "email", "phone", "address", "contact_ids", "notes", "created_at", "updated_at"]
        DataExporter.export_csv(entities, file_path, fields)

    @staticmethod
    def export_full_backup(db, backup_dir: Path) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"backup_{timestamp}.json"

        backup_data = {
            "timestamp": timestamp,
            "contacts": [json.loads(c.model_dump_json()) for c in db.contacts.list()],
            "companies": [json.loads(c.model_dump_json()) for c in db.companies.list()],
            "communications": [json.loads(c.model_dump_json()) for c in db.communications.list()],
            "reminders": [json.loads(r.model_dump_json()) for r in db.reminders.list()],
            "tags": [json.loads(t.model_dump_json()) for t in db.tags.list()],
        }

        backup_path.parent.mkdir(parents=True, exist_ok=True)
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)

        return backup_path
