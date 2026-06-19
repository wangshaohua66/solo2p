import os
import yaml
import json
from typing import Dict, List, Any, Optional


class ConfigLoader:
    DEFAULT_CONFIG = {
        'crawl': {
            'concurrent_requests': 3,
            'download_delay': 1.0,
            'random_delay_range': [0.5, 2.0],
            'max_retry_times': 3,
            'retry_intervals': [3, 10, 30],
            'timeout': 30,
            'user_agent_rotation': True,
            'proxy_enabled': False,
            'cookie_pool_enabled': False,
            'max_memory_mb': 1024,
            'daily_time_limit_hours': 8
        },
        'incremental': {
            'enabled': True,
            'update_frequency': 'weekly',
            'force_full_crawl': False,
            'check_field_changes': True
        },
        'storage': {
            'default_format': 'sqlite',
            'output_dir': 'output',
            'sqlite_db_path': 'output/journal_metadata.db',
            'csv_filename': 'journal_metadata_{timestamp}.csv',
            'json_filename': 'journal_metadata_{timestamp}.json',
            'resume_db_path': 'output/crawl_state.db'
        },
        'logging': {
            'log_dir': 'logs',
            'log_level': 'INFO',
            'verbose': False,
            'quiet': False,
            'retention_days': 90
        },
        'sources': {
            'cnki': {'enabled': True, 'priority': 1, 'weight': 0.95, 'ip_auth_required': True},
            'wanfang': {'enabled': True, 'priority': 2, 'weight': 0.90, 'ip_auth_required': True},
            'vip': {'enabled': True, 'priority': 3, 'weight': 0.85},
            'webofscience': {'enabled': True, 'priority': 4, 'weight': 0.98, 'login_required': True},
            'scopus': {'enabled': True, 'priority': 5, 'weight': 0.97, 'login_required': True},
            'pubmed': {'enabled': True, 'priority': 6, 'weight': 0.92},
            'doaj': {'enabled': True, 'priority': 7, 'weight': 0.88},
            'crossref': {'enabled': True, 'priority': 8, 'weight': 0.90},
            'google_scholar': {'enabled': True, 'priority': 9, 'weight': 0.80, 'anti_crawl': True},
            'baidu_scholar': {'enabled': True, 'priority': 10, 'weight': 0.75},
            'microsoft_academic': {'enabled': True, 'priority': 11, 'weight': 0.78},
            'cnki_journal_nav': {'enabled': True, 'priority': 12, 'weight': 0.92, 'ip_auth_required': True}
        },
        'target_journals': [],
        'auth': {
            'cnki': {'username': '', 'password': '', 'ip_range': ''},
            'wanfang': {'username': '', 'password': '', 'ip_range': ''},
            'webofscience': {'username': '', 'password': ''},
            'scopus': {'username': '', 'password': '', 'api_key': ''}
        },
        'proxies': {
            'proxy_sources': [],
            'proxy_list': [],
            'check_interval': 300,
            'max_failures': 5
        },
        'validation': {
            'issn_check': True,
            'impact_factor_range': [0, 200],
            'required_fields': ['journal_name_cn', 'issn_print', 'data_source']
        },
        'deduplication': {
            'primary_key': 'issn_print',
            'secondary_keys': ['issn_online', 'cn_number', 'eissn'],
            'merge_strategy': 'weighted_latest',
            'conflict_resolution': 'highest_weight'
        }
    }

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path
        self.config = self._deep_copy(self.DEFAULT_CONFIG)
        if config_path and os.path.exists(config_path):
            self._load_from_file(config_path)
        else:
            self._auto_discover_config()

    def _deep_copy(self, obj):
        if isinstance(obj, dict):
            return {k: self._deep_copy(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._deep_copy(item) for item in obj]
        return obj

    def _auto_discover_config(self):
        candidates = [
            'config/config.yaml',
            'config/config.yml',
            'config.yaml',
            'config.yml'
        ]
        for candidate in candidates:
            if os.path.exists(candidate):
                self._load_from_file(candidate)
                self.config_path = candidate
                break

    def _load_from_file(self, path: str):
        ext = os.path.splitext(path)[1].lower()
        try:
            with open(path, 'r', encoding='utf-8') as f:
                if ext in ('.yaml', '.yml'):
                    user_config = yaml.safe_load(f) or {}
                elif ext == '.json':
                    user_config = json.load(f)
                else:
                    raise ValueError(f'Unsupported config format: {ext}')
            self._merge_config(self.config, user_config)
        except Exception as e:
            print(f'Warning: Failed to load config {path}: {e}')

    def _merge_config(self, base: Dict, override: Dict):
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._merge_config(base[key], value)
            else:
                base[key] = value

    def get(self, key_path: str, default: Any = None) -> Any:
        keys = key_path.split('.')
        value = self.config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value

    def set(self, key_path: str, value: Any):
        keys = key_path.split('.')
        config = self.config
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]
        config[keys[-1]] = value

    def get_enabled_sources(self) -> List[str]:
        sources = self.get('sources', {})
        return [name for name, cfg in sources.items() if cfg.get('enabled', False)]

    def get_source_config(self, source_name: str) -> Dict:
        return self.get(f'sources.{source_name}', {})

    def get_target_issns(self) -> List[str]:
        journals = self.get('target_journals', [])
        issns = []
        for j in journals:
            if isinstance(j, dict):
                for key in ['issn', 'issn_print', 'ISSN']:
                    if key in j and j[key]:
                        issns.append(j[key])
            elif isinstance(j, str):
                issns.append(j)
        return list(set(issns))

    def get_crawl_settings(self) -> Dict:
        return self.get('crawl', {})

    def get_storage_settings(self) -> Dict:
        return self.get('storage', {})

    def get_proxy_list(self) -> List[str]:
        return self.get('proxies.proxy_list', [])

    def get_auth_config(self, source_name: str) -> Dict:
        return self.get(f'auth.{source_name}', {})

    def save(self, path: Optional[str] = None):
        save_path = path or self.config_path or 'config/config.yaml'
        os.makedirs(os.path.dirname(save_path), exist_ok=True)
        with open(save_path, 'w', encoding='utf-8') as f:
            yaml.dump(self.config, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
