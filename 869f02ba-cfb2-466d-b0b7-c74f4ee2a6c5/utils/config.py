import os
import re
import yaml
from pathlib import Path
from typing import Any, Dict
from dotenv import load_dotenv

load_dotenv()


def _resolve_env_vars(value: str) -> str:
    pattern = re.compile(r'\$\{([^}]+)\}')
    matches = pattern.findall(value)
    for match in matches:
        env_value = os.getenv(match, '')
        value = value.replace(f'${{{match}}}', env_value)
    return value


def _process_dict(d: Dict[str, Any]) -> Dict[str, Any]:
    result = {}
    for k, v in d.items():
        if isinstance(v, dict):
            result[k] = _process_dict(v)
        elif isinstance(v, str):
            result[k] = _resolve_env_vars(v)
        else:
            result[k] = v
    return result


class Config:
    _instance = None
    _config: Dict[str, Any] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self) -> None:
        config_path = Path(__file__).parent.parent / 'config.yaml'
        if not config_path.exists():
            raise FileNotFoundError(f"Config file not found: {config_path}")

        if not os.access(config_path, os.R_OK):
            raise PermissionError(f"No read permission for config file: {config_path}")

        with open(config_path, 'r', encoding='utf-8') as f:
            raw_config = yaml.safe_load(f)

        self._config = _process_dict(raw_config)
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        dirs = [
            self.get('database.path').rsplit('/', 1)[0],
            self.get('templates.certificate_dir'),
            self.get('templates.publication_dir'),
            self.get('certificate.output_dir'),
            self.get('publication.output_dir'),
            self.get('payment.bank_receipt_dir'),
            self.get('logging.file').rsplit('/', 1)[0],
            self.get('cache.feature_dir'),
        ]
        for d in dirs:
            Path(d).mkdir(parents=True, exist_ok=True)

    def get(self, key: str, default: Any = None) -> Any:
        keys = key.split('.')
        value = self._config
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default

    def __getitem__(self, key: str) -> Any:
        return self.get(key)

    def get_all(self) -> Dict[str, Any]:
        return self._config.copy()


config = Config()
