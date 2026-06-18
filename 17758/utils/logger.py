import logging
import os
from pathlib import Path
from typing import Optional


class AuditLogger:
    def __init__(self, log_dir: Path, level: str = "INFO"):
        self.log_dir = Path(log_dir).expanduser()
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.audit_file = self.log_dir / "audit.log"
        self.logger = self._setup_logger(level)

    def _setup_logger(self, level: str) -> logging.Logger:
        logger = logging.getLogger("crm.audit")
        logger.setLevel(getattr(logging, level.upper()))
        logger.propagate = False

        if not logger.handlers:
            formatter = logging.Formatter(
                "%(asctime)s | %(levelname)s | %(action)s | %(entity)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )

            file_handler = logging.FileHandler(self.audit_file, encoding="utf-8")
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)

        return logger

    def _log(self, level: str, action: str, entity: str, message: str, **extra) -> None:
        self.logger.log(
            getattr(logging, level.upper()),
            message,
            extra={"action": action, "entity": entity, **extra},
        )

    def create(self, entity: str, entity_id: str, details: str = "") -> None:
        self._log("INFO", "CREATE", entity, f"id={entity_id} {details}".strip())

    def update(self, entity: str, entity_id: str, changes: str = "") -> None:
        self._log("INFO", "UPDATE", entity, f"id={entity_id} changes={changes}".strip())

    def delete(self, entity: str, entity_id: str, details: str = "") -> None:
        self._log("WARNING", "DELETE", entity, f"id={entity_id} {details}".strip())

    def export(self, entity: str, format: str, path: str) -> None:
        self._log("INFO", "EXPORT", entity, f"format={format} path={path}")

    def import_(self, entity: str, format: str, path: str, count: int) -> None:
        self._log("INFO", "IMPORT", entity, f"format={format} path={path} count={count}")

    def error(self, entity: str, action: str, error_msg: str) -> None:
        self._log("ERROR", action, entity, error_msg)
