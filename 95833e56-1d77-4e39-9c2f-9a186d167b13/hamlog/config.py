"""Configuration management for HAMLOG.

Supports YAML config file at ~/.hamlog/config.yaml with env var overrides.
Falls back to configparser (INI) if PyYAML is not available.
"""

import os
import logging
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CONFIG_DIR = Path(os.environ.get("HAMLOG_DATA_DIR", str(Path.home() / ".hamlog")))
CONFIG_FILE = CONFIG_DIR / "config.yaml"
CONFIG_FILE_INI = CONFIG_DIR / "config.ini"

DEFAULT_CONFIG: Dict[str, Any] = {
    "operator": {
        "callsign": "",
        "name": "",
        "grid": "",
        "qth": "",
        "latitude": 0.0,
        "longitude": 0.0,
        "tx_pwr": 100.0,
        "rig": "",
        "antenna": "",
    },
    "preferences": {
        "units": "metric",
        "date_format": "%Y-%m-%d",
        "time_format": "%H:%M",
        "default_band": "20m",
        "default_mode": "SSB",
        "contest_mode": False,
    },
    "logging": {
        "level": "INFO",
        "file": str(Path.home() / ".hamlog" / "hamlog.log"),
    },
    "propagation": {
        "cache_ttl": 3600,
        "hamqsl_url": "https://www.hamqsl.com/solarxml.php",
    },
}


def _load_yaml_config(path: Path) -> Optional[Dict[str, Any]]:
    """Try to load YAML config. Returns None if PyYAML not available."""
    try:
        import yaml
        if path.exists():
            with open(path, "r") as f:
                return yaml.safe_load(f) or {}
    except ImportError:
        logger.debug("PyYAML not available, falling back to INI")
    except Exception as e:
        logger.warning("Failed to load YAML config: %s", e)
    return None


def _load_ini_config(path: Path) -> Dict[str, Any]:
    """Load INI config file."""
    import configparser
    config = {}
    if path.exists():
        parser = configparser.ConfigParser()
        parser.read(str(path))
        for section in parser.sections():
            config[section] = dict(parser[section])
    return config


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Deep merge two dictionaries."""
    result = base.copy()
    for key, value in override.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _apply_env_overrides(config: Dict[str, Any]) -> Dict[str, Any]:
    """Apply environment variable overrides.

    HAMLOG_OPERATOR_CALLSIGN, HAMLOG_PREFERENCES_DEFAULT_BAND, etc.
    """
    for key, value in os.environ.items():
        if not key.startswith("HAMLOG_"):
            continue
        parts = key[len("HAMLOG_"):].lower().split("_", 1)
        if len(parts) == 2:
            section, option = parts
            if section in config:
                if isinstance(config[section], dict):
                    current = config[section].get(option)
                    if isinstance(current, bool):
                        config[section][option] = value.lower() in ("true", "1", "yes")
                    elif isinstance(current, int):
                        try:
                            config[section][option] = int(value)
                        except ValueError:
                            pass
                    elif isinstance(current, float):
                        try:
                            config[section][option] = float(value)
                        except ValueError:
                            pass
                    else:
                        config[section][option] = value
    return config


def get_config() -> Dict[str, Any]:
    """Load and return the configuration.

    Priority: env vars > config file > defaults
    """
    config = _deep_merge({}, DEFAULT_CONFIG)

    yaml_config = _load_yaml_config(CONFIG_FILE)
    if yaml_config is not None:
        config = _deep_merge(config, yaml_config)
    else:
        ini_config = _load_ini_config(CONFIG_FILE_INI)
        config = _deep_merge(config, ini_config)

    config = _apply_env_overrides(config)

    return config


def save_config(config: Dict[str, Any]) -> None:
    """Save configuration to file.

    Uses YAML if available, otherwise INI.
    """
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    try:
        import yaml
        with open(CONFIG_FILE, "w") as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False)
        logger.info("Config saved to %s", CONFIG_FILE)
        return
    except ImportError:
        logger.debug("PyYAML not available, using INI format")
    except Exception as e:
        logger.warning("Failed to save YAML config: %s", e)

    import configparser
    parser = configparser.ConfigParser()
    for section, values in config.items():
        if isinstance(values, dict):
            parser[section] = {k: str(v) for k, v in values.items()}
        else:
            parser[section] = {"value": str(values)}

    with open(CONFIG_FILE_INI, "w") as f:
        parser.write(f)
    logger.info("Config saved to %s", CONFIG_FILE_INI)


def generate_default_config() -> None:
    """Generate a default config file template on first run."""
    if CONFIG_FILE.exists() or CONFIG_FILE_INI.exists():
        return

    template = _deep_merge({}, DEFAULT_CONFIG)
    template["operator"]["callsign"] = "YOURCALL"
    template["operator"]["name"] = "Your Name"
    template["operator"]["grid"] = "AB12cd"
    template["operator"]["qth"] = "Your City"

    save_config(template)
    logger.info("Default config template generated")


def get_config_path() -> Path:
    """Get the active config file path."""
    if CONFIG_FILE.exists():
        return CONFIG_FILE
    return CONFIG_FILE_INI
