import importlib
import sys
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List

from storage import Database

from .console import Console


class BasePlugin(ABC):
    name: str = "base_plugin"
    description: str = "Base plugin class"

    @abstractmethod
    def run(self, db: Database, **kwargs) -> Any: ...

    def get_commands(self) -> Dict[str, str]:
        return {}


class PluginLoader:
    def __init__(self):
        self.plugins: Dict[str, BasePlugin] = {}
        self._discover_entry_points()
        self._discover_local_plugins()

    def _discover_entry_points(self) -> None:
        try:
            from importlib.metadata import entry_points
            eps = entry_points(group="crm.plugins")
            for ep in eps:
                try:
                    plugin_class = ep.load()
                    plugin = plugin_class()
                    self.plugins[plugin.name] = plugin
                    Console.info(f"Loaded plugin: {plugin.name}")
                except Exception as e:
                    Console.warning(f"Failed to load plugin {ep.name}: {e}")
        except Exception as e:
            Console.warning(f"Entry point discovery failed: {e}")

    def _discover_local_plugins(self) -> None:
        plugins_dir = Path(__file__).parent.parent / "plugins"
        if not plugins_dir.exists():
            return

        if str(plugins_dir.parent) not in sys.path:
            sys.path.insert(0, str(plugins_dir.parent))

        for file in plugins_dir.glob("*.py"):
            if file.name.startswith("_"):
                continue
            try:
                module_name = f"plugins.{file.stem}"
                module = importlib.import_module(module_name)
                for attr_name in dir(module):
                    attr = getattr(module, attr_name)
                    if (
                        isinstance(attr, type)
                        and issubclass(attr, BasePlugin)
                        and attr is not BasePlugin
                    ):
                        plugin = attr()
                        self.plugins[plugin.name] = plugin
                        Console.info(f"Loaded local plugin: {plugin.name}")
            except Exception as e:
                Console.warning(f"Failed to load plugin {file.name}: {e}")

    def get_plugin(self, name: str) -> BasePlugin:
        return self.plugins.get(name)

    def list_plugins(self) -> List[str]:
        return list(self.plugins.keys())

    def run_plugin(self, name: str, db: Database, **kwargs) -> Any:
        plugin = self.get_plugin(name)
        if not plugin:
            raise ValueError(f"Plugin '{name}' not found")
        return plugin.run(db, **kwargs)
