import json
import os
from typing import Dict, List, Optional, Any


class ConfigManager:
    DEFAULT_CONFIG = {
        "stations": [],
        "thresholds": {
            "water_level_jump": 0.5,
            "flow_surge": 200,
            "water_level_min": -999,
            "water_level_max": 9999,
            "flow_min": 0,
            "flow_max": 10000,
            "rainfall_min": 0,
            "rainfall_max": 500
        },
        "database": {
            "path": "hydro_data.db"
        },
        "logging": {
            "level": "INFO",
            "file": "hydro_import.log",
            "max_bytes": 10 * 1024 * 1024,
            "backup_count": 7
        },
        "deduplication": {
            "strategy": "skip"
        }
    }

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path
        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        config = self.DEFAULT_CONFIG.copy()

        if self.config_path and os.path.exists(self.config_path):
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                config = self._merge_config(config, user_config)
            except (json.JSONDecodeError, IOError) as e:
                raise ValueError(f"配置文件加载失败: {e}")

        return config

    def _merge_config(self, base: Dict, override: Dict) -> Dict:
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                base[key] = self._merge_config(base[key], value)
            else:
                base[key] = value
        return base

    def get_valid_stations(self) -> List[str]:
        return [s["code"] for s in self.config.get("stations", [])]

    def get_station_info(self, station_code: str) -> Optional[Dict]:
        for station in self.config.get("stations", []):
            if station["code"] == station_code:
                return station
        return None

    def get_threshold(self, key: str) -> float:
        return self.config.get("thresholds", {}).get(key)

    def set_threshold(self, key: str, value: float) -> None:
        if "thresholds" not in self.config:
            self.config["thresholds"] = {}
        self.config["thresholds"][key] = value

    def get_db_path(self) -> str:
        return self.config.get("database", {}).get("path", "hydro_data.db")

    def set_db_path(self, path: str) -> None:
        if "database" not in self.config:
            self.config["database"] = {}
        self.config["database"]["path"] = path

    def get_log_config(self) -> Dict:
        return self.config.get("logging", {})

    def set_log_level(self, level: str) -> None:
        if "logging" not in self.config:
            self.config["logging"] = {}
        self.config["logging"]["level"] = level

    def get_dedup_strategy(self) -> str:
        return self.config.get("deduplication", {}).get("strategy", "skip")

    def set_dedup_strategy(self, strategy: str) -> None:
        if strategy not in ["skip", "overwrite", "mark"]:
            raise ValueError(f"无效的去重策略: {strategy}，必须是 skip、overwrite 或 mark")
        if "deduplication" not in self.config:
            self.config["deduplication"] = {}
        self.config["deduplication"]["strategy"] = strategy

    def save_config(self, path: Optional[str] = None) -> None:
        save_path = path or self.config_path
        if not save_path:
            raise ValueError("未指定配置文件保存路径")

        os.makedirs(os.path.dirname(save_path) or '.', exist_ok=True)
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(self.config, f, ensure_ascii=False, indent=2)

    def update_stations(self, stations: List[Dict]) -> None:
        self.config["stations"] = stations

    def reload(self) -> None:
        self.config = self._load_config()
