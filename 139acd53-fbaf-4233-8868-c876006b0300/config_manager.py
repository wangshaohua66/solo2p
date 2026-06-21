import os
import yaml
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field


@dataclass
class GlobalSettings:
    sync_time: str
    price_threshold: float
    retry_max: int
    retry_backoff: float
    timeout_request: int
    timeout_ui: int
    db_path: str
    log_dir: str
    export_dir: str
    template_dir: str
    opencv_confidence: float
    page_load_wait: int
    page_flip_wait: int


@dataclass
class SupplierConfig:
    id: str
    name: str
    type: str
    group: str
    sync_frequency: str
    categories: List[str]
    connection: Dict[str, Any]
    ui_templates: Optional[Dict[str, Any]] = None
    fields: Dict[str, Any] = field(default_factory=dict)
    parsing: Optional[Dict[str, Any]] = None
    sku_count: int = 0


@dataclass
class ThresholdConfig:
    safety_stock: int
    lead_time_days: int
    daily_consumption: int


class ConfigManager:
    def __init__(self, config_path: str = None):
        if config_path is None:
            config_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
            "supplier_config.yaml"
        )
        self.config_path = config_path
        self._raw_config: Dict[str, Any] = {}
        self.global_settings: Optional[GlobalSettings] = None
        self.suppliers: Dict[str, SupplierConfig] = {}
        self.threshold_defaults: Optional[ThresholdConfig] = None
        self.threshold_by_category: Dict[str, ThresholdConfig] = {}
        self._load_config()

    def _load_config(self):
        with open(self.config_path, "r", encoding="utf-8") as f:
            self._raw_config = yaml.safe_load(f)
        self._parse_global_settings()
        self._parse_suppliers()
        self._parse_thresholds()

    def _parse_global_settings(self):
        gs = self._raw_config.get("global_settings", {})
        self.global_settings = GlobalSettings(
            sync_time=gs.get("sync_time", "08:00"),
            price_threshold=float(gs.get("price_threshold", 10.0)),
            retry_max=int(gs.get("retry_max", 3)),
            retry_backoff=float(gs.get("retry_backoff", 2.0)),
            timeout_request=int(gs.get("timeout_request", 30)),
            timeout_ui=int(gs.get("timeout_ui", 10)),
            db_path=gs.get("db_path", "data/inventory.db"),
            log_dir=gs.get("log_dir", "logs"),
            export_dir=gs.get("export_dir", "exports"),
            template_dir=gs.get("template_dir", "login_templates"),
            opencv_confidence=float(gs.get("opencv_confidence", 0.85)),
            page_load_wait=int(gs.get("page_load_wait", 3)),
            page_flip_wait=int(gs.get("page_flip_wait", 1)),
        )

    def _parse_suppliers(self):
        s_list = self._raw_config.get("suppliers", [])
        for s_data in s_list:
            supplier = SupplierConfig(
                id=s_data["id"],
                name=s_data["name"],
                type=s_data["type"],
                group=s_data.get("group", ""),
                sync_frequency=s_data.get("sync_frequency", "daily"),
                categories=s_data.get("categories", []),
                connection=s_data.get("connection", {}),
                ui_templates=s_data.get("ui_templates"),
                fields=s_data.get("fields", {}),
                parsing=s_data.get("parsing"),
                sku_count=s_data.get("sku_count", 0),
            )
            self.suppliers[supplier.id] = supplier

    def _parse_thresholds(self):
        th = self._raw_config.get("sku_warning_threshold", {})
        defaults = th.get("defaults", {})
        self.threshold_defaults = ThresholdConfig(
            safety_stock=int(defaults.get("safety_stock", 1000)),
            lead_time_days=int(defaults.get("lead_time_days", 7)),
            daily_consumption=int(defaults.get("daily_consumption", 100)),
        )
        for cat, cfg in th.get("by_category", {}).items():
            self.threshold_by_category[cat] = ThresholdConfig(
                safety_stock=int(cfg.get("safety_stock", 1000)),
                lead_time_days=int(cfg.get("lead_time_days", 7)),
                daily_consumption=int(cfg.get("daily_consumption", 100)),
            )

    def get_supplier(self, supplier_id: str) -> Optional[SupplierConfig]:
        return self.suppliers.get(supplier_id)

    def get_suppliers_by_type(self, supplier_type: str) -> List[SupplierConfig]:
        return [s for s in self.suppliers.values() if s.type == supplier_type]

    def get_suppliers_by_group(self, group: str) -> List[SupplierConfig]:
        return [s for s in self.suppliers.values() if s.group == group]

    def get_threshold(self, category: str) -> ThresholdConfig:
        return self.threshold_by_category.get(category, self.threshold_defaults)

    def all_supplier_ids(self) -> List[str]:
        return list(self.suppliers.keys())
