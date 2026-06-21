import os
import re
import time
import hashlib
import threading
from pathlib import Path
from copy import deepcopy
from typing import Any, Optional

import yaml
from cryptography.fernet import Fernet
from loguru import logger


_BASE_DIR = Path(__file__).resolve().parent
_YAML_PATH = _BASE_DIR / "channels.yaml"
_DICT_PATH = _BASE_DIR / "custom_dict.txt"

_AES_KEY_ENV = "COMPLAINT_MONITOR_AES_KEY"
_AES_KEY_FILE = _BASE_DIR / ".aes_key"

_ENCRYPTED_PREFIX = "ENCRYPTED"
_ENV_VAR_PATTERN = re.compile(r"\$\{([^}:]+)(?::([^}]*))?\}")


def _load_or_create_aes_key() -> bytes:
    key_str = os.environ.get(_AES_KEY_ENV)
    if key_str:
        key_bytes = key_str.encode()
    elif _AES_KEY_FILE.exists():
        key_bytes = _AES_KEY_FILE.read_bytes().strip()
    else:
        key_bytes = Fernet.generate_key()
        _AES_KEY_FILE.write_bytes(key_bytes)
        _AES_KEY_FILE.chmod(0o600)
    if len(key_bytes) != 44:
        raise ValueError("AES key must be a 44-byte Fernet key")
    return key_bytes


_FERNET = Fernet(_load_or_create_aes_key())


def encrypt_value(plaintext: str) -> str:
    return _FERNET.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    try:
        return _FERNET.decrypt(ciphertext.encode()).decode()
    except Exception:
        return ciphertext


def _resolve_env_vars(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    def _replace(match):
        var_name = match.group(1)
        default = match.group(2) if match.group(2) is not None else ""
        env_val = os.environ.get(var_name)
        if env_val is not None:
            return env_val
        return default
    return _ENV_VAR_PATTERN.sub(_replace, value)


def _resolve_dict(d: dict) -> dict:
    resolved = {}
    for k, v in d.items():
        if isinstance(v, dict):
            resolved[k] = _resolve_dict(v)
        elif isinstance(v, list):
            resolved[k] = _resolve_list(v)
        elif isinstance(v, str):
            resolved[k] = _resolve_env_vars(v)
        else:
            resolved[k] = v
    return resolved


def _resolve_list(lst: list) -> list:
    resolved = []
    for item in lst:
        if isinstance(item, dict):
            resolved.append(_resolve_dict(item))
        elif isinstance(item, list):
            resolved.append(_resolve_list(item))
        elif isinstance(item, str):
            resolved.append(_resolve_env_vars(item))
        else:
            resolved.append(item)
    return resolved


def _decrypt_sensitive(d: dict, sensitive_keys: set) -> dict:
    result = {}
    for k, v in d.items():
        if isinstance(v, dict):
            result[k] = _decrypt_sensitive(v, sensitive_keys)
        elif isinstance(v, str) and k in sensitive_keys and v == _ENCRYPTED_PREFIX:
            logger.warning(f"Sensitive field '{k}' is marked ENCRYPTED but has no ciphertext; leave as placeholder")
            result[k] = v
        elif isinstance(v, str) and k in sensitive_keys and v and v != _ENCRYPTED_PREFIX:
            try:
                result[k] = decrypt_value(v)
            except Exception:
                result[k] = v
        elif isinstance(v, dict):
            result[k] = _decrypt_sensitive(v, sensitive_keys)
        else:
            result[k] = v
    return result


_SENSITIVE_KEYS = {"password", "secret", "token", "webhook", "api_key"}

CONFIG_SCHEMA = {
    "global": {
        "required_keys": ["concurrency", "collection_interval_minutes"],
        "types": {"concurrency": dict, "collection_interval_minutes": int},
    },
    "redis": {
        "required_keys": ["host", "port"],
        "types": {"host": str, "port": int},
    },
    "mysql": {
        "required_keys": ["host", "port", "user", "database"],
        "types": {"host": str, "port": int, "user": str, "database": str},
    },
}


def validate_config(cfg: dict) -> list:
    errors = []
    for section, schema in CONFIG_SCHEMA.items():
        if section not in cfg:
            errors.append(f"Missing required section: {section}")
            continue
        for key in schema.get("required_keys", []):
            if key not in cfg[section]:
                errors.append(f"Missing required key: {section}.{key}")
        for key, expected_type in schema.get("types", {}).items():
            if key in cfg[section] and not isinstance(cfg[section][key], expected_type):
                errors.append(f"Type mismatch: {section}.{key} expected {expected_type.__name__}")
    channel_sections = ["government", "ecommerce", "weixin"]
    for cs in channel_sections:
        if cs in cfg.get("channels", {}):
            for ch in cfg["channels"][cs]:
                if not ch.get("code"):
                    errors.append(f"Channel in {cs} missing 'code' field")
                if not ch.get("name"):
                    errors.append(f"Channel in {cs} missing 'name' field")
    return errors


def _compute_config_hash(cfg: dict) -> str:
    content = yaml.dump(cfg, allow_unicode=True, sort_keys=True)
    return hashlib.md5(content.encode()).hexdigest()


class Settings:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self, yaml_path: Optional[str] = None, auto_reload: bool = True):
        if self._initialized:
            return
        self._yaml_path = Path(yaml_path) if yaml_path else _YAML_PATH
        self._auto_reload = auto_reload
        self._config: dict = {}
        self._config_hash: str = ""
        self._last_load_time: float = 0
        self._reload_interval: float = 30.0
        self._rw_lock = threading.RLock()
        self._load_and_validate()
        self._initialized = True

    def _load_and_validate(self):
        with self._rw_lock:
            raw = self._read_yaml()
            resolved = _resolve_dict(raw)
            decrypted = _decrypt_sensitive(resolved, _SENSITIVE_KEYS)
            errors = validate_config(decrypted)
            if errors:
                for e in errors:
                    logger.error(f"Config validation error: {e}")
                raise ValueError(f"Config validation failed: {errors}")
            self._config = decrypted
            self._config_hash = _compute_config_hash(decrypted)
            self._last_load_time = time.time()
            logger.info(f"Config loaded, hash={self._config_hash[:8]}")

    def _read_yaml(self) -> dict:
        if not self._yaml_path.exists():
            raise FileNotFoundError(f"Config file not found: {self._yaml_path}")
        with open(self._yaml_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not isinstance(data, dict):
            raise ValueError("Config file must contain a YAML mapping")
        return data

    def _check_reload(self):
        if not self._auto_reload:
            return
        if time.time() - self._last_load_time < self._reload_interval:
            return
        try:
            raw = self._read_yaml()
            new_hash = _compute_config_hash(raw)
            if new_hash != self._config_hash:
                logger.info("Config file changed, reloading...")
                self._load_and_validate()
        except Exception as e:
            logger.error(f"Config reload failed: {e}")

    def get(self, key_path: str, default: Any = None) -> Any:
        self._check_reload()
        with self._rw_lock:
            keys = key_path.split(".")
            value = self._config
            for k in keys:
                if isinstance(value, dict) and k in value:
                    value = value[k]
                else:
                    return default
            return value

    def set(self, key_path: str, value: Any):
        with self._rw_lock:
            keys = key_path.split(".")
            cfg = self._config
            for k in keys[:-1]:
                if k not in cfg or not isinstance(cfg[k], dict):
                    cfg[k] = {}
                cfg = cfg[k]
            cfg[keys[-1]] = value
            logger.info(f"Config updated: {key_path}")

    @property
    def config(self) -> dict:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config)

    def get_channels_by_type(self, channel_type: str) -> list:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config.get("channels", {}).get(channel_type, []))

    def get_channel_by_code(self, code: str) -> Optional[dict]:
        self._check_reload()
        with self._rw_lock:
            for ctype in ["government", "ecommerce", "weixin"]:
                for ch in self._config.get("channels", {}).get(ctype, []):
                    if ch.get("code") == code:
                        return deepcopy(ch)
        return None

    def get_proxy_config(self, channel_type: str) -> dict:
        self._check_reload()
        with self._rw_lock:
            categories = self._config.get("proxy", {}).get("categories", {})
            return deepcopy(categories.get(channel_type, categories.get("government", {})))

    def get_redis_config(self) -> dict:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config.get("redis", {}))

    def get_mysql_config(self) -> dict:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config.get("mysql", {}))

    def get_notify_config(self) -> dict:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config.get("notify", {}))

    def get_risk_keywords(self) -> dict:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config.get("risk_keywords", {}))

    def get_complaint_categories(self) -> list:
        self._check_reload()
        with self._rw_lock:
            return deepcopy(self._config.get("complaint_categories", []))

    def get_all_channels(self) -> list:
        self._check_reload()
        with self._rw_lock:
            result = []
            for ctype in ["government", "ecommerce", "weixin"]:
                for ch in self._config.get("channels", {}).get(ctype, []):
                    ch_copy = deepcopy(ch)
                    ch_copy["channel_type"] = ctype
                    result.append(ch_copy)
            return result

    def get_enabled_channels(self) -> list:
        return [ch for ch in self.get_all_channels() if ch.get("enabled", False)]

    def force_reload(self):
        self._load_and_validate()

    @property
    def dict_path(self) -> Path:
        return _DICT_PATH

    @property
    def yaml_path(self) -> Path:
        return self._yaml_path
