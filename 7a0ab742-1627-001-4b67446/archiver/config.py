import os
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field

try:
    import yaml
except ImportError:
    yaml = None


class ConfigValidationError(Exception):
    pass


@dataclass
class ConfigField:
    name: str
    type: str
    required: bool = False
    default: Any = None
    valid_values: Optional[List[Any]] = None
    min_value: Optional[Any] = None
    max_value: Optional[Any] = None
    nested_schema: Optional[Dict[str, "ConfigField"]] = None


class ConfigSchema:
    def __init__(self):
        self.fields: Dict[str, ConfigField] = {}

    def add_field(self, name: str, field_type: str, required: bool = False,
                    default: Any = None, valid_values: Optional[List[Any]] = None,
                    min_value: Optional[Any] = None, max_value: Optional[Any] = None,
                    nested_schema: Optional[Dict[str, ConfigField]] = None):
        self.fields[name] = ConfigField(
            name=name,
            type=field_type,
            required=required,
            default=default,
            valid_values=valid_values,
            min_value=min_value,
            max_value=max_value,
            nested_schema=nested_schema,
        )

    def validate(self, config: Dict[str, Any], path: str = "") -> Tuple[bool, List[str]]:
        errors = []

        for field_name, field_schema in self.fields.items():
            full_path = f"{path}.{field_name}" if path else field_name

            if field_name not in config:
                if field_schema.required:
                    errors.append(f"缺少必填配置项: {full_path}")
                elif field_schema.default is not None:
                    config[field_name] = field_schema.default
                continue

            value = config[field_name]

            if not self._check_type(value, field_schema.type):
                errors.append(
                    f"配置项 {full_path} 类型错误，应为 {field_schema.type}"
                )
                continue

            if field_schema.valid_values is not None:
                if value not in field_schema.valid_values:
                    errors.append(
                        f"配置项 {full_path} 值无效，有效值为: {field_schema.valid_values}"
                    )

            if field_schema.min_value is not None:
                if isinstance(value, (int, float)) and value < field_schema.min_value:
                    errors.append(
                    f"配置项 {full_path} 不能小于 {field_schema.min_value}"
                    )

            if field_schema.max_value is not None:
                if isinstance(value, (int, float)) and value > field_schema.max_value:
                    errors.append(
                        f"配置项 {full_path} 不能大于 {field_schema.max_value}"
                    )

            if field_schema.nested_schema and isinstance(value, dict):
                nested_schema_obj = ConfigSchema()
                for k, v in field_schema.nested_schema.items():
                    nested_schema_obj.fields[k] = v
                _, nested_errors = nested_schema_obj.validate(value, full_path)
                errors.extend(nested_errors)

        return len(errors) == 0, errors

    def _check_type(self, value: Any, expected_type: str) -> bool:
        type_map = {
            "str": str,
            "int": int,
            "float": (int, float),
            "bool": bool,
            "list": list,
            "dict": dict,
        }

        if expected_type in type_map:
            return isinstance(value, type_map[expected_type])
        elif expected_type == "number":
            return isinstance(value, (int, float))
        return True


def get_default_schema() -> ConfigSchema:
    schema = ConfigSchema()

    validation_fields = {
        "required_fields": ConfigField("required_fields", "list", required=False,
                                   default=["title", "author", "created_date", "archive_number", "retention_period"]),
        "date_format": ConfigField("date_format", "str", required=False, default="%Y-%m-%d"),
        "retention_periods": ConfigField("retention_periods", "list", required=False,
                                        default=["永久", "30年", "10年", "5年", "3年"]),
        "secrecy_levels": ConfigField("secrecy_levels", "list", required=False,
                                        default=["公开", "内部", "秘密", "机密", "绝密"]),
        "archive_number_pattern": ConfigField("archive_number_pattern", "str", required=False,
                                               default="^[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+$"),
        "archive_number_separator": ConfigField("archive_number_separator", "str", required=False, default="-"),
        "archive_number_segments": ConfigField("archive_number_segments", "list", required=False,
                                                  default=["fonds_number", "directory_number", "volume_number", "item_number"]),
    }
    schema.add_field("validation", "dict", required=False, default={}, nested_schema=validation_fields)

    archive_number_fields = {
        "fonds_number": ConfigField("fonds_number", "str", required=False, default="DA"),
        "directory_number": ConfigField("directory_number", "str", required=False, default="01"),
        "volume_number": ConfigField("volume_number", "str", required=False, default="001"),
        "item_number_digits": ConfigField("item_number_digits", "int", required=False, default=4,
                                             min_value=1, max_value=10),
        "separator": ConfigField("separator", "str", required=False, default="-"),
        "start_item": ConfigField("start_item", "int", required=False, default=1, min_value=1),
    }
    schema.add_field("archive_number", "dict", required=False, default={}, nested_schema=archive_number_fields)

    scanner_fields = {
        "min_dpi": ConfigField("min_dpi", "int", required=False, default=300, min_value=72, max_value=1200),
        "max_tilt_degrees": ConfigField("max_tilt_degrees", "float", required=False, default=5.0,
                                          min_value=0.1, max_value=45.0),
        "blank_page_threshold": ConfigField("blank_page_threshold", "float", required=False, default=0.05,
                                              min_value=0.0, max_value=1.0),
        "color_modes": ConfigField("color_modes", "list", required=False,
                                   default=["1", "L", "RGB", "CMYK"]),
    }
    schema.add_field("scanner", "dict", required=False, default={}, nested_schema=scanner_fields)

    file_validation_fields = {
        "allowed_extensions": ConfigField("allowed_extensions", "list", required=False,
                                         default=[".pdf", ".ofd", ".docx", ".xlsx", ".jpg", ".jpeg", ".png", ".tiff", ".tif"]),
        "max_file_size_mb": ConfigField("max_file_size_mb", "int", required=False, default=500,
                                           min_value=1, max_value=10000),
    }
    schema.add_field("file_validation", "dict", required=False, default={}, nested_schema=file_validation_fields)

    logging_fields = {
        "level": ConfigField("level", "str", required=False, default="INFO",
                              valid_values=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]),
        "format": ConfigField("format", "str", required=False, default="json"),
        "rotation": ConfigField("rotation", "str", required=False, default="daily"),
        "retention_days": ConfigField("retention_days", "int", required=False, default=90,
                                       min_value=1, max_value=3650),
        "log_dir": ConfigField("log_dir", "str", required=False, default="logs"),
    }
    schema.add_field("logging", "dict", required=False, default={}, nested_schema=logging_fields)

    processing_fields = {
        "max_batch_size": ConfigField("max_batch_size", "int", required=False, default=100000,
                                        min_value=1, max_value=1000000),
        "enable_progress": ConfigField("enable_progress", "bool", required=False, default=True),
        "progress_dir": ConfigField("progress_dir", "str", required=False, default=".progress"),
        "incremental_mode": ConfigField("incremental_mode", "bool", required=False, default=False),
    }
    schema.add_field("processing", "dict", required=False, default={}, nested_schema=processing_fields)

    standards_fields = {
        "enable_gbt18894": ConfigField("enable_gbt18894", "bool", required=False, default=True),
        "enable_dat46": ConfigField("enable_dat46", "bool", required=False, default=True),
    }
    schema.add_field("standards", "dict", required=False, default={}, nested_schema=standards_fields)

    return schema


class AppConfig:
    def __init__(self, config_dict: Optional[Dict[str, Any]] = None):
        self._config: Dict[str, Any] = {}
        self._schema = get_default_schema()

        if config_dict:
            self._config = config_dict
        else:
            self._apply_defaults()

    def _apply_defaults(self):
        for field_name, field_schema in self._schema.fields.items():
            if field_schema.default is not None:
                self._config[field_name] = field_schema.default

    @classmethod
    def from_file(cls, file_path: str) -> "AppConfig":
        if yaml is None:
            raise ImportError("需要安装 PyYAML 库来加载配置文件")

        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            config_data = yaml.safe_load(f)

        if config_data is None:
            config_data = {}

        if not isinstance(config_data, dict):
            raise ConfigValidationError("配置文件格式错误，应为 YAML 字典格式")

        config = cls(config_data)
        config.validate()
        return config

    def validate(self) -> Tuple[bool, List[str]]:
        is_valid, errors = self._schema.validate(self._config)
        if not is_valid:
            raise ConfigValidationError("\n".join(errors))
        return is_valid, errors

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split(".")
        value = self._config
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        return value

    def set(self, key: str, value: Any):
        keys = key.split(".")
        config = self._config
        for k in keys[:-1]:
            if k not in config:
                config[k] = {}
            config = config[k]
        config[keys[-1]] = value

    def to_dict(self) -> Dict[str, Any]:
        return self._config.copy()

    def get_validation_config(self) -> Dict[str, Any]:
        return self._config.get("validation", {})

    def get_archive_number_config(self) -> Dict[str, Any]:
        return self._config.get("archive_number", {})

    def get_scanner_config(self) -> Dict[str, Any]:
        return self._config.get("scanner", {})

    def get_file_validation_config(self) -> Dict[str, Any]:
        return self._config.get("file_validation", {})

    def get_logging_config(self) -> Dict[str, Any]:
        return self._config.get("logging", {})

    def get_processing_config(self) -> Dict[str, Any]:
        return self._config.get("processing", {})

    def get_standards_config(self) -> Dict[str, Any]:
        return self._config.get("standards", {})
