import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict


@dataclass
class ProgressItem:
    id: str
    status: str
    processed_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    file_hash: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ProgressRecord:
    task_id: str
    task_type: str
    input_path: str
    total_items: int = 0
    processed_items: int = 0
    failed_items: int = 0
    items: Dict[str, ProgressItem] = field(default_factory=dict)
    created_at: str = ""
    updated_at: str = ""
    is_complete: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "input_path": self.input_path,
            "total_items": self.total_items,
            "processed_items": self.processed_items,
            "failed_items": self.failed_items,
            "items": {k: v.to_dict() for k, v in self.items.items()},
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "is_complete": self.is_complete,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProgressRecord":
        items = {}
        if "items" in data:
            for k, v in data["items"].items():
                items[k] = ProgressItem(**v)

        return cls(
            task_id=data.get("task_id", ""),
            task_type=data.get("task_type", ""),
            input_path=data.get("input_path", ""),
            total_items=data.get("total_items", 0),
            processed_items=data.get("processed_items", 0),
            failed_items=data.get("failed_items", 0),
            items=items,
            created_at=data.get("created_at", ""),
            updated_at=data.get("updated_at", ""),
            is_complete=data.get("is_complete", False),
        )


class ProgressManager:
    def __init__(self, progress_dir: str = ".progress", logger=None):
        self.progress_dir = Path(progress_dir)
        self.progress_dir.mkdir(parents=True, exist_ok=True)
        self.logger = logger

    def _get_progress_file(self, task_id: str) -> Path:
        safe_id = "".join(c if c.isalnum() or c in "_-" else "_" for c in task_id)
        return self.progress_dir / f"{safe_id}.json"

    def generate_task_id(self, input_path: str, task_type: str) -> str:
        path_hash = hashlib.md5(str(input_path).encode()).hexdigest()[:8]
        return f"{task_type}_{path_hash}"

    def generate_file_hash(self, file_path: str) -> str:
        if not os.path.exists(file_path):
            return ""
        stat = os.stat(file_path)
        hash_input = f"{file_path}_{stat.st_size}_{stat.st_mtime}"
        return hashlib.md5(hash_input.encode()).hexdigest()

    def create_task(self, task_type: str, input_path: str,
                    item_ids: List[str]) -> ProgressRecord:
        task_id = self.generate_task_id(input_path, task_type)
        now = datetime.now().isoformat()

        record = ProgressRecord(
            task_id=task_id,
            task_type=task_type,
            input_path=input_path,
            total_items=len(item_ids),
            created_at=now,
            updated_at=now,
            is_complete=False,
        )

        for item_id in item_ids:
            record.items[item_id] = ProgressItem(
                id=item_id,
                status="pending",
            )

        self._save(record)

        if self.logger:
            self.logger.info(
                f"创建处理任务: {task_id}, 共 {len(item_ids)} 项",
                operation_type="progress_create",
                obj=task_id,
            )

        return record

    def load_task(self, task_id: str) -> Optional[ProgressRecord]:
        progress_file = self._get_progress_file(task_id)
        if not progress_file.exists():
            return None

        try:
            with open(progress_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ProgressRecord.from_dict(data)
        except Exception:
            return None

    def find_existing_task(self, input_path: str, task_type: str) -> Optional[ProgressRecord]:
        task_id = self.generate_task_id(input_path, task_type)
        return self.load_task(task_id)

    def _save(self, record: ProgressRecord):
        record.updated_at = datetime.now().isoformat()
        progress_file = self._get_progress_file(record.task_id)

        with open(progress_file, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)

    def mark_item_started(self, record: ProgressRecord, item_id: str):
        if item_id in record.items:
            record.items[item_id].status = "processing"
            record.items[item_id].processed_at = datetime.now().isoformat()
            self._save(record)

    def mark_item_completed(self, record: ProgressRecord, item_id: str,
                            result: Optional[Dict[str, Any]] = None):
        if item_id in record.items:
            record.items[item_id].status = "completed"
            record.items[item_id].result = result
            record.processed_items += 1

            if record.processed_items >= record.total_items:
                record.is_complete = True

            self._save(record)

    def mark_item_failed(self, record: ProgressRecord, item_id: str,
                         error: str, result: Optional[Dict[str, Any]] = None):
        if item_id in record.items:
            record.items[item_id].status = "failed"
            record.items[item_id].error = error
            record.items[item_id].result = result
            record.processed_items += 1
            record.failed_items += 1

            if record.processed_items >= record.total_items:
                record.is_complete = True

            self._save(record)

    def get_pending_items(self, record: ProgressRecord) -> List[str]:
        return [
            item_id for item_id, item in record.items.items()
            if item.status in ("pending", "failed")
        ]

    def get_completed_items(self, record: ProgressRecord) -> List[str]:
        return [
            item_id for item_id, item in record.items.items()
            if item.status == "completed"
        ]

    def get_failed_items(self, record: ProgressRecord) -> List[str]:
        return [
            item_id for item_id, item in record.items.items()
            if item.status == "failed"
        ]

    def resume_task(self, input_path: str, task_type: str) -> Tuple[Optional[ProgressRecord], bool]:
        existing = self.find_existing_task(input_path, task_type)

        if existing and not existing.is_complete:
            if self.logger:
                pending = self.get_pending_items(existing)
                self.logger.info(
                    f"恢复任务: {existing.task_id}, 待处理 {len(pending)} / {existing.total_items} 项",
                    operation_type="progress_resume",
                    obj=existing.task_id,
                )
            return existing, True

        return None, False

    def get_incremental_items(self, record: ProgressRecord,
                              current_item_ids: List[str],
                              file_hashes: Optional[Dict[str, str]] = None) -> List[str]:
        new_items = []

        for item_id in current_item_ids:
            if item_id not in record.items:
                new_items.append(item_id)
            elif file_hashes and item_id in file_hashes:
                item = record.items.get(item_id)
                if item and item.file_hash != file_hashes[item_id]:
                    new_items.append(item_id)

        if self.logger:
            self.logger.info(
                f"增量检测: 新增/变更 {len(new_items)} 项 (总 {len(current_item_ids)} 项)",
                operation_type="progress_incremental",
                obj=record.task_id if record else "new",
            )

        return new_items

    def add_items(self, record: ProgressRecord, item_ids: List[str]):
        for item_id in item_ids:
            if item_id not in record.items:
                record.items[item_id] = ProgressItem(
                    id=item_id,
                    status="pending",
                )
                record.total_items += 1

        if record.is_complete and item_ids:
            record.is_complete = False

        self._save(record)

    def update_item_file_hash(self, record: ProgressRecord, item_id: str, file_hash: str):
        if item_id in record.items:
            record.items[item_id].file_hash = file_hash
            self._save(record)

    def list_tasks(self) -> List[Dict[str, Any]]:
        tasks = []
        for f in self.progress_dir.glob("*.json"):
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    data = json.load(fp)
                tasks.append({
                    "task_id": data.get("task_id", ""),
                    "task_type": data.get("task_type", ""),
                    "total_items": data.get("total_items", 0),
                    "processed_items": data.get("processed_items", 0),
                    "is_complete": data.get("is_complete", False),
                    "updated_at": data.get("updated_at", ""),
                })
            except Exception:
                pass
        return tasks

    def delete_task(self, task_id: str) -> bool:
        progress_file = self._get_progress_file(task_id)
        if progress_file.exists():
            progress_file.unlink()
            if self.logger:
                self.logger.info(
                    f"删除进度记录: {task_id}",
                    operation_type="progress_delete",
                    obj=task_id,
                )
            return True
        return False

    def get_progress_percentage(self, record: ProgressRecord) -> float:
        if record.total_items == 0:
            return 0.0
        return (record.processed_items / record.total_items) * 100
