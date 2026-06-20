import os
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from pydantic import BaseModel, Field


def _get_base_dir() -> Path:
    env_dir = os.environ.get("ARCHAEO_HOME")
    if env_dir:
        base_dir = Path(env_dir).expanduser().resolve()
    else:
        try:
            home_dir = Path.home() / ".archaeo"
            home_dir.mkdir(parents=True, exist_ok=True)
            base_dir = home_dir
        except (PermissionError, OSError):
            base_dir = Path(__file__).parent.parent / ".archaeo"
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


class DatabaseConfig(BaseModel):
    path: str = ""


class InstituteConfig(BaseModel):
    name: str = "考古研究所"
    code: str = "ARCH"
    sites: int = 150


class LogConfig(BaseModel):
    directory: str = ""
    retention_days: int = 30
    level: str = "INFO"


class PhotoConfig(BaseModel):
    thumbnail_size: List[int] = Field(default_factory=lambda: [200, 200])
    thumbnail_suffix: str = "_thumb"


class AppConfig(BaseModel):
    current_institute: str = "default"
    institutes: Dict[str, InstituteConfig] = Field(default_factory=dict)
    database: DatabaseConfig = Field(default_factory=DatabaseConfig)
    log: LogConfig = Field(default_factory=LogConfig)
    photo: PhotoConfig = Field(default_factory=PhotoConfig)


def _get_default_config() -> AppConfig:
    base_dir = _get_base_dir()
    return AppConfig(
        institutes={
            "default": InstituteConfig(
                name="考古研究所",
                code="ARCH",
                sites=150,
            )
        },
        database=DatabaseConfig(path=str(base_dir / "archaeo.db")),
        log=LogConfig(directory=str(base_dir / "logs")),
    )


DEFAULT_CONFIG: Optional[AppConfig] = None


def get_config_dir() -> Path:
    base_dir = _get_base_dir()
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir


def get_config_path() -> Path:
    return get_config_dir() / "config.yaml"


def load_config() -> AppConfig:
    config_path = get_config_path()
    default_config = _get_default_config()
    if not config_path.exists():
        save_config(default_config)
        return default_config
    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not data:
        return default_config
    config = AppConfig(**data)
    if not config.database.path:
        config.database.path = str(_get_base_dir() / "archaeo.db")
    if not config.log.directory:
        config.log.directory = str(_get_base_dir() / "logs")
    return config


def save_config(config: AppConfig) -> None:
    config_path = get_config_path()
    config_dir = config_path.parent
    config_dir.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(config.model_dump(), f, allow_unicode=True, default_flow_style=False)


def get_current_institute() -> InstituteConfig:
    config = load_config()
    return config.institutes.get(config.current_institute, InstituteConfig())


def switch_institute(name: str) -> bool:
    config = load_config()
    if name not in config.institutes:
        return False
    config.current_institute = name
    save_config(config)
    return True


def add_institute(name: str, code: str, site_count: int = 0) -> None:
    config = load_config()
    config.institutes[name] = InstituteConfig(
        name=name,
        code=code,
        sites=site_count,
    )
    save_config(config)


def remove_institute(name: str) -> bool:
    config = load_config()
    if name not in config.institutes or name == "default":
        return False
    if config.current_institute == name:
        config.current_institute = "default"
    del config.institutes[name]
    save_config(config)
    return True


def get_db_path() -> Path:
    config = load_config()
    db_path = Path(os.path.expanduser(config.database.path))
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path
