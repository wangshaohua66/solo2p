from pathlib import Path
from typing import Optional

from config import ConfigManager
from storage import Database
from utils import AuditLogger, Console, PluginLoader

from .communication_service import CommunicationService
from .company_service import CompanyService
from .contact_service import ContactService
from .reminder_service import ReminderService
from .stats_service import StatsService
from .tag_service import TagService


class CRM:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_manager = ConfigManager(config_path)
        self.config = self.config_manager.get()

        data_dir = Path(self.config.data_dir).expanduser()
        data_dir.mkdir(parents=True, exist_ok=True)

        self.db = Database(data_dir)
        self.logger = AuditLogger(data_dir / "logs", self.config.logging.level)
        self.plugin_loader = PluginLoader()

        self.contacts = ContactService(self.db, self.logger)
        self.companies = CompanyService(self.db, self.logger)
        self.communications = CommunicationService(self.db, self.logger)
        self.reminders = ReminderService(self.db, self.logger)
        self.tags = TagService(self.db, self.logger)
        self.stats = StatsService(self.db)

        self.config_manager.set_reload_callback(self._on_config_reload)

    def _on_config_reload(self, old_config, new_config) -> None:
        self.config = new_config
        old_data_dir = str(Path(old_config.data_dir).expanduser())
        new_data_dir = str(Path(new_config.data_dir).expanduser())

        if old_data_dir != new_data_dir:
            data_dir = Path(new_data_dir)
            data_dir.mkdir(parents=True, exist_ok=True)

            self.db = Database(data_dir)
            self.logger = AuditLogger(data_dir / "logs", new_config.logging.level)

            self.contacts = ContactService(self.db, self.logger)
            self.companies = CompanyService(self.db, self.logger)
            self.communications = CommunicationService(self.db, self.logger)
            self.reminders = ReminderService(self.db, self.logger)
            self.tags = TagService(self.db, self.logger)
            self.stats = StatsService(self.db)

            Console.info(f"Data directory changed to: {new_data_dir}")
        elif new_config.logging.level != old_config.logging.level:
            data_dir = Path(new_data_dir)
            self.logger = AuditLogger(data_dir / "logs", new_config.logging.level)
            Console.info(f"Log level changed to: {new_config.logging.level}")

    def start_watching_config(self) -> None:
        self.config_manager.start_watching()

    def stop_watching_config(self) -> None:
        self.config_manager.stop_watching()

    def reload_config(self) -> None:
        old_config = self.config
        self.config_manager.reload()
        new_config = self.config_manager.get()
        self._on_config_reload(old_config, new_config)

    def export_backup(self, backup_dir: Optional[Path] = None) -> Path:
        from utils import DataExporter

        data_dir = Path(self.config.data_dir).expanduser()
        backup_dir = backup_dir or (data_dir / "backups")
        backup_path = DataExporter.export_full_backup(self.db, backup_dir)
        self.logger.export("Backup", "json", str(backup_path))
        return backup_path
