import json
import os
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Dict, List, Optional, Any


WORKSPACE_DIR = Path(os.environ.get("CRISK_WORKSPACE", Path.cwd() / ".crisk"))

DEFAULT_DB_PATH = WORKSPACE_DIR / "crisk.db"
DEFAULT_RULES_PATH = WORKSPACE_DIR / "rules.json"
DEFAULT_LOG_PATH = WORKSPACE_DIR / "crisk.log"
DEFAULT_REPORT_DIR = WORKSPACE_DIR / "reports"


REQUIRED_FIELDS = [
    "报关单号", "品名", "HS编码", "申报货值", "数量", "原产地",
    "目的地", "经营单位", "运输方式", "申报日期", "收货人"
]


FIELD_MAPPING = {
    "报关单号": ["报关单号", "declaration_no", "entry_id", "bill_no"],
    "品名": ["品名", "货物名称", "product_name", "description"],
    "HS编码": ["HS编码", "hs_code", "hs", "商品编码"],
    "申报货值": ["申报货值", "货值", "declared_value", "value", "amount"],
    "数量": ["数量", "quantity", "qty"],
    "原产地": ["原产地", "origin_country", "origin", "起运国"],
    "目的地": ["目的地", "destination_country", "destination", "运抵国"],
    "经营单位": ["经营单位", "company", "enterprise", "operator"],
    "运输方式": ["运输方式", "transport_mode", "shipping_method", "transport"],
    "申报日期": ["申报日期", "declare_date", "date", "申报时间"],
    "收货人": ["收货人", "consignee", "收货单位"],
}


@dataclass
class DetectionThresholds:
    lowprice_deviation: float = 0.30
    split_window_days: int = 7
    split_min_shipments: int = 5
    split_value_threshold: float = 1000000.0
    category_overrides: Dict[str, float] = field(default_factory=dict)

    def get_threshold_for_category(self, hs_category: str) -> float:
        hs_prefix = hs_category[:6]
        for prefix, threshold in self.category_overrides.items():
            if hs_prefix.startswith(prefix):
                return threshold
        return self.lowprice_deviation


@dataclass
class HSRule:
    hs_prefix: str
    keywords: List[str]
    description: str = ""

    def matches(self, product_name: str) -> bool:
        name_lower = product_name.lower()
        return any(kw.lower() in name_lower for kw in self.keywords)


@dataclass
class RuleSet:
    hs_rules: List[HSRule] = field(default_factory=list)
    custom_thresholds: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "hs_rules": [asdict(r) for r in self.hs_rules],
            "custom_thresholds": self.custom_thresholds,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RuleSet":
        hs_rules = [HSRule(**r) for r in data.get("hs_rules", [])]
        return cls(
            hs_rules=hs_rules,
            custom_thresholds=data.get("custom_thresholds", {}),
        )


class ConfigManager:
    def __init__(self, rules_path: Optional[Path] = None):
        self.rules_path = rules_path or DEFAULT_RULES_PATH
        self.rules_path.parent.mkdir(parents=True, exist_ok=True)
        self._rule_set: Optional[RuleSet] = None
        self._thresholds: Optional[DetectionThresholds] = None

    @property
    def thresholds(self) -> DetectionThresholds:
        if self._thresholds is None:
            self._thresholds = DetectionThresholds()
            if self._rule_set:
                self._thresholds.category_overrides = self._rule_set.custom_thresholds
        return self._thresholds

    @property
    def rule_set(self) -> RuleSet:
        if self._rule_set is None:
            self.load_rules()
        return self._rule_set

    def load_rules(self) -> RuleSet:
        if self.rules_path.exists():
            try:
                with open(self.rules_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._rule_set = RuleSet.from_dict(data)
            except (json.JSONDecodeError, KeyError) as e:
                self._rule_set = self._get_default_rules()
                self._log_operation(f"加载规则文件失败，使用默认规则: {str(e)}", "ERROR")
        else:
            self._rule_set = self._get_default_rules()
            self.save_rules()
        self._thresholds = None
        return self._rule_set

    def save_rules(self) -> None:
        if self._rule_set is None:
            self._rule_set = self._get_default_rules()
        with open(self.rules_path, "w", encoding="utf-8") as f:
            json.dump(self._rule_set.to_dict(), f, ensure_ascii=False, indent=2)
        self._log_operation("保存规则文件", "INFO")

    def add_hs_rule(self, hs_prefix: str, keywords: List[str], description: str = "") -> None:
        rule_set = self.rule_set
        for rule in rule_set.hs_rules:
            if rule.hs_prefix == hs_prefix:
                rule.keywords.extend([k for k in keywords if k not in rule.keywords])
                if description:
                    rule.description = description
                self._log_operation(f"更新HS规则: {hs_prefix}", "INFO")
                self.save_rules()
                return
        rule_set.hs_rules.append(HSRule(hs_prefix=hs_prefix, keywords=keywords, description=description))
        self._log_operation(f"新增HS规则: {hs_prefix}", "INFO")
        self.save_rules()

    def delete_hs_rule(self, hs_prefix: str) -> bool:
        rule_set = self.rule_set
        original_len = len(rule_set.hs_rules)
        rule_set.hs_rules = [r for r in rule_set.hs_rules if r.hs_prefix != hs_prefix]
        if len(rule_set.hs_rules) < original_len:
            self._log_operation(f"删除HS规则: {hs_prefix}", "INFO")
            self.save_rules()
            return True
        return False

    def list_hs_rules(self) -> List[HSRule]:
        return self.rule_set.hs_rules

    def set_category_threshold(self, hs_prefix: str, threshold: float) -> None:
        rule_set = self.rule_set
        rule_set.custom_thresholds[hs_prefix] = threshold
        self._log_operation(f"设置分类阈值: {hs_prefix} = {threshold}", "INFO")
        self.save_rules()

    def delete_category_threshold(self, hs_prefix: str) -> bool:
        rule_set = self.rule_set
        if hs_prefix in rule_set.custom_thresholds:
            del rule_set.custom_thresholds[hs_prefix]
            self._log_operation(f"删除分类阈值: {hs_prefix}", "INFO")
            self.save_rules()
            return True
        return False

    def _get_default_rules(self) -> RuleSet:
        default_rules = [
            HSRule(hs_prefix="851712", keywords=["手机", "移动电话", "smartphone", "mobile phone"], description="手机及移动通信设备"),
            HSRule(hs_prefix="847130", keywords=["笔记本电脑", "laptop", "notebook", "便携式电脑"], description="便携式自动数据处理设备"),
            HSRule(hs_prefix="847141", keywords=["台式电脑", "desktop", "计算机"], description="台式微型机"),
            HSRule(hs_prefix="852580", keywords=["摄像机", "照相机", "camera", "camcorder"], description="摄影设备"),
            HSRule(hs_prefix="271019", keywords=["汽油", "柴油", "燃料油", "gasoline", "diesel"], description="成品油"),
            HSRule(hs_prefix="220890", keywords=["白酒", "威士忌", "白兰地", "wine", "whiskey"], description="酒精饮料"),
            HSRule(hs_prefix="240220", keywords=["香烟", "卷烟", "cigarette"], description="烟草制品"),
            HSRule(hs_prefix="710239", keywords=["钻石", "diamond", "珠宝"], description="钻石及珠宝"),
            HSRule(hs_prefix="870323", keywords=["汽车", "小轿车", "car", "vehicle"], description="机动车辆"),
            HSRule(hs_prefix="300490", keywords=["药品", "药", "medicine", "drug"], description="药品制剂"),
        ]
        return RuleSet(hs_rules=default_rules)

    def _log_operation(self, message: str, level: str = "INFO") -> None:
        log_path = WORKSPACE_DIR / "operation.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] [{level}] {message}\n")


def get_config_manager() -> ConfigManager:
    return ConfigManager()


def get_default_thresholds() -> DetectionThresholds:
    return DetectionThresholds()
