import os
import threading
import time
from pathlib import Path
from typing import Callable, Optional

import yaml
from models import Config
from pydantic import ValidationError
from storage import ConfigError
from utils import Console

from . import DEFAULT_CONFIG


class ConfigManager:
    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = Path(config_path) if config_path else Path("~/.crm/config.yaml").expanduser()
        self.config: Config = self._load_config()
        self._watcher = None
        self._watch_thread = None
        self._reload_callback: Optional[Callable] = None
        self._stop_watching = threading.Event()

    def _load_config(self) -> Config:
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    config_data = yaml.safe_load(f) or {}
                return Config(**config_data)
            except (yaml.YAMLError, ValidationError) as e:
                Console.warning(f"Failed to load config from {self.config_path}: {e}. Using defaults.")
                return Config(**DEFAULT_CONFIG)
        else:
            self._save_default_config()
            return Config(**DEFAULT_CONFIG)

    def _save_default_config(self) -> None:
        try:
            self.config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.config_path, "w", encoding="utf-8") as f:
                yaml.dump(DEFAULT_CONFIG, f, default_flow_style=False, allow_unicode=True)
            Console.info(f"Default config created at {self.config_path}")
        except Exception as e:
            raise ConfigError(f"Failed to save default config: {e}")

    def reload(self) -> None:
        old_config = self.config
        self.config = self._load_config()
        if self._reload_callback:
            try:
                self._reload_callback(old_config, self.config)
            except Exception as e:
                Console.error(f"Config reload callback failed: {e}")
        Console.success("Configuration reloaded successfully")

    def set_reload_callback(self, callback: Callable) -> None:
        self._reload_callback = callback

    def start_watching(self) -> None:
        try:
            from watchdog.events import FileSystemEventHandler
            from watchdog.observers import Observer
        except ImportError:
            Console.warning("watchdog not installed, config hot reload disabled")
            return

        class ConfigChangeHandler(FileSystemEventHandler):
            def __init__(self, manager):
                self.manager = manager
                self.last_modified = 0

            def on_modified(self, event):
                if event.src_path == str(self.manager.config_path):
                    now = time.time()
                    if now - self.last_modified > 1:
                        self.last_modified = now
                        Console.info(f"Config file changed, reloading...")
                        self.manager.reload()

        self._stop_watching.clear()
        handler = ConfigChangeHandler(self)
        observer = Observer()
        observer.schedule(handler, str(self.config_path.parent), recursive=False)
        observer.start()
        self._watcher = observer
        Console.info(f"Watching config file for changes: {self.config_path}")

    def stop_watching(self) -> None:
        if self._watcher:
            self._stop_watching.set()
            self._watcher.stop()
            self._watcher.join()
            self._watcher = None

    def get(self) -> Config:
        return self.config

    def update(self, **kwargs) -> None:
        config_dict = self.config.model_dump()
        for key, value in kwargs.items():
            if key in config_dict:
                if isinstance(value, dict) and isinstance(config_dict[key], dict):
                    config_dict[key].update(value)
                else:
                    config_dict[key] = value

        try:
            self.config = Config(**config_dict)
            with open(self.config_path, "w", encoding="utf-8") as f:
                yaml.dump(config_dict, f, default_flow_style=False, allow_unicode=True)
            Console.success("Configuration updated successfully")
        except ValidationError as e:
            raise ConfigError(f"Invalid configuration: {e}")
