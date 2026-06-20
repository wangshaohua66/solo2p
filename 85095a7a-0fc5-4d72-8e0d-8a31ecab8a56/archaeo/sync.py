import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .config import get_config_dir
from .logger import get_logger
from .models import SyncConflict, SyncRecord
from . import db

logger = get_logger(__name__)


def generate_sync_batch() -> str:
    return f"sync_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def get_sync_dir() -> Path:
    sync_dir = get_config_dir() / "sync"
    sync_dir.mkdir(parents=True, exist_ok=True)
    return sync_dir


def package_incremental_data(batch_id: Optional[str] = None, limit: int = 10000) -> Tuple[str, int]:
    batch_id = batch_id or generate_sync_batch()

    unsynced = db.get_unsynced_records(limit=limit)
    if not unsynced:
        return batch_id, 0

    sync_dir = get_sync_dir()
    package_file = sync_dir / f"{batch_id}.json"

    sync_data = {
        "batch_id": batch_id,
        "generated_at": datetime.now().isoformat(),
        "record_count": len(unsynced),
        "records": [
            {
                "id": rec.id,
                "table_name": rec.table_name,
                "record_id": rec.record_id,
                "operation": rec.operation,
                "data": rec.data,
                "created_at": rec.created_at.isoformat() if rec.created_at else None,
            }
            for rec in unsynced
        ],
    }

    with open(package_file, "w", encoding="utf-8") as f:
        json.dump(sync_data, f, ensure_ascii=False, indent=2)

    record_ids = [rec.id for rec in unsynced]
    db.mark_synced(record_ids, batch_id)

    logger.info(f"打包完成: {len(unsynced)} 条记录到 {package_file}")
    return batch_id, len(unsynced)


def load_sync_package(package_path: Path) -> Dict[str, Any]:
    with open(package_path, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_conflicts(local_records: List[Dict[str, Any]], batch_id: str) -> List[SyncConflict]:
    conflicts: List[SyncConflict] = []

    for record in local_records:
        table_name = record["table_name"]
        record_id = record["record_id"]
        remote_data = record["data"]

        local_data = _get_local_record(table_name, record_id)
        if local_data and record["operation"] in ("update", "delete"):
            if _has_conflict(local_data, remote_data):
                conflict = SyncConflict(
                    sync_batch=batch_id,
                    table_name=table_name,
                    record_id=record_id,
                    local_data=local_data,
                    remote_data=remote_data,
                    resolved=False,
                    resolution="",
                )
                saved_conflict = db.create_sync_conflict(conflict)
                conflicts.append(saved_conflict)

    logger.info(f"检测到 {len(conflicts)} 个冲突")
    return conflicts


def _get_local_record(table_name: str, record_id: int) -> Optional[Dict[str, Any]]:
    try:
        if table_name == "projects":
            project = db.get_project(record_id)
            return project.model_dump() if project else None
        elif table_name == "trenches":
            trench = db.get_trench(record_id)
            return trench.model_dump() if trench else None
        elif table_name == "strata":
            stratum = db.get_stratum(record_id)
            return stratum.model_dump() if stratum else None
        elif table_name == "artifacts":
            artifact = db.get_artifact(record_id)
            return artifact.model_dump() if artifact else None
        elif table_name == "samples":
            sample = db.get_sample(record_id)
            return sample.model_dump() if sample else None
        else:
            return None
    except Exception:
        return None


def _has_conflict(local_data: Dict[str, Any], remote_data: Dict[str, Any]) -> bool:
    if not local_data or not remote_data:
        return False

    local_updated = local_data.get("updated_at")
    remote_updated = remote_data.get("updated_at")

    if local_updated and remote_updated:
        try:
            local_time = datetime.fromisoformat(str(local_updated))
            remote_time = datetime.fromisoformat(str(remote_updated))
            return remote_time < local_time
        except (ValueError, TypeError):
            pass

    for key in remote_data:
        if key in local_data and local_data[key] != remote_data[key]:
            if key not in ("id", "created_at", "updated_at"):
                return True

    return False


def apply_sync_package(package_path: Path, resolve_conflicts: bool = False) -> Dict[str, Any]:
    sync_data = load_sync_package(package_path)
    batch_id = sync_data.get("batch_id", "unknown")
    records = sync_data.get("records", [])

    result = {
        "batch_id": batch_id,
        "total": len(records),
        "applied": 0,
        "conflicts": 0,
        "skipped": 0,
        "conflict_details": [],
    }

    conflicts = detect_conflicts(records, batch_id)
    conflict_keys = {(c.table_name, c.record_id) for c in conflicts}
    result["conflicts"] = len(conflicts)

    for record in records:
        table_name = record["table_name"]
        record_id = record["record_id"]
        operation = record["operation"]
        data = record["data"]

        if (table_name, record_id) in conflict_keys and not resolve_conflicts:
            result["skipped"] += 1
            continue

        try:
            success = _apply_record(table_name, operation, data)
            if success:
                result["applied"] += 1
            else:
                result["skipped"] += 1
        except Exception as e:
            logger.error(f"应用同步记录失败 {table_name}:{record_id}: {e}")
            result["skipped"] += 1

    logger.info(
        f"同步完成: 总共 {result['total']} 条, "
        f"成功 {result['applied']} 条, "
        f"冲突 {result['conflicts']} 条, "
        f"跳过 {result['skipped']} 条"
    )
    return result


def _apply_record(table_name: str, operation: str, data: Dict[str, Any]) -> bool:
    from .models import (
        Artifact,
        ArtifactCategory,
        Project,
        ProjectPhase,
        ProjectStatus,
        Sample,
        SampleStatus,
        SampleType,
        Stratum,
        Trench,
    )

    try:
        if operation == "delete":
            record_id = data.get("id")
            if not record_id:
                return False
            if table_name == "projects":
                return db.delete_project(record_id)
            elif table_name == "trenches":
                return db.delete_trench(record_id)
            elif table_name == "strata":
                return db.delete_stratum(record_id)
            elif table_name == "artifacts":
                return db.delete_artifact(record_id)
            elif table_name == "samples":
                return db.delete_sample(record_id)
            return False

        if operation in ("insert", "update"):
            if table_name == "projects":
                project = Project(**data)
                if operation == "insert":
                    existing = db.get_project_by_code(project.code)
                    if existing:
                        project.id = existing.id
                        db.update_project(project)
                    else:
                        db.create_project(project)
                else:
                    if project.id:
                        db.update_project(project)
                    else:
                        existing = db.get_project_by_code(project.code)
                        if existing:
                            project.id = existing.id
                            db.update_project(project)
                        else:
                            db.create_project(project)
                return True

            elif table_name == "trenches":
                trench = Trench(**data)
                if operation == "insert" or not trench.id:
                    db.create_trench(trench)
                else:
                    db.update_trench(trench)
                return True

            elif table_name == "strata":
                stratum = Stratum(**data)
                if operation == "insert" or not stratum.id:
                    db.create_stratum(stratum)
                else:
                    db.update_stratum(stratum)
                return True

            elif table_name == "artifacts":
                artifact = Artifact(**data)
                if operation == "insert" or not artifact.id:
                    existing = db.get_artifact_by_code(artifact.code)
                    if existing:
                        artifact.id = existing.id
                        db.update_artifact(artifact)
                    else:
                        db.create_artifact(artifact)
                else:
                    db.update_artifact(artifact)
                return True

            elif table_name == "samples":
                sample = Sample(**data)
                if operation == "insert" or not sample.id:
                    existing = db.get_sample_by_code(sample.code)
                    if existing:
                        sample.id = existing.id
                        db.update_sample(sample)
                    else:
                        db.create_sample(sample)
                else:
                    db.update_sample(sample)
                return True

        return False
    except Exception as e:
        logger.error(f"应用记录失败 {table_name} {operation}: {e}")
        return False


def list_sync_packages() -> List[Dict[str, Any]]:
    sync_dir = get_sync_dir()
    packages = []

    for package_file in sorted(sync_dir.glob("*.json"), reverse=True):
        try:
            data = load_sync_package(package_file)
            packages.append({
                "batch_id": data.get("batch_id", ""),
                "file": str(package_file),
                "record_count": data.get("record_count", 0),
                "generated_at": data.get("generated_at", ""),
            })
        except Exception:
            continue

    return packages


def get_sync_status() -> Dict[str, Any]:
    unsynced = db.get_unsynced_records(limit=100000)
    packages = list_sync_packages()
    conflicts = db.list_sync_conflicts(resolved=False)

    return {
        "unsynced_count": len(unsynced),
        "package_count": len(packages),
        "unresolved_conflicts": len(conflicts),
        "last_package": packages[0] if packages else None,
    }


def resolve_conflict(conflict_id: int, use_local: bool = True) -> bool:
    conflicts = db.list_sync_conflicts(resolved=False)
    target = None
    for c in conflicts:
        if c.id == conflict_id:
            target = c
            break

    if not target:
        return False

    resolution = "使用本地版本" if use_local else "使用远程版本"
    db.resolve_sync_conflict(conflict_id, resolution, use_local)

    if not use_local:
        _apply_record(
            target.table_name,
            "update",
            target.remote_data,
        )

    return True


def export_all_conflicts(use_local: bool = True) -> int:
    conflicts = db.list_sync_conflicts(resolved=False)
    count = 0
    for conflict in conflicts:
        if resolve_conflict(conflict.id, use_local=use_local):
            count += 1
    return count
