import os
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from utils.logger import get_logger

logger = get_logger()


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="INKMIXER_",
        env_file=".env",
        extra="ignore",
    )

    db_path: str = Field(
        default="~/.config/inkmixer/inkmixer.db",
        description="Path to SQLite database file",
    )
    log_level: str = Field(
        default="INFO",
        description="Logging level: DEBUG, INFO, WARNING, ERROR",
    )
    log_dir: str = Field(
        default="logs",
        description="Directory for log files",
    )
    delta_e_threshold: float = Field(
        default=3.0,
        description="ΔE2000 color difference threshold",
    )
    dominant_colors: int = Field(
        default=5,
        description="Number of dominant colors to extract from images",
    )
    low_stock_threshold: int = Field(
        default=1,
        description="Low stock warning threshold (bottles)",
    )
    expiration_warning_days: int = Field(
        default=180,
        description="Days before expiration to warn",
    )


def get_config_path() -> Path:
    if os.name == "nt":
        base = os.environ.get("APPDATA", str(Path.home()))
        return Path(base) / "inkmixer" / "config.toml"
    return Path.home() / ".config" / "inkmixer" / "config.toml"


def load_config() -> AppConfig:
    config_path = get_config_path()
    config = AppConfig()

    if config_path.exists():
        try:
            import tomli

            with open(config_path, "rb") as f:
                toml_data = tomli.load(f)

            for key, value in toml_data.items():
                if hasattr(config, key):
                    setattr(config, key, value)

            logger.info(f"Loaded configuration from {config_path}")
        except Exception as e:
            logger.warning(f"Failed to load config from {config_path}: {e}. Using defaults.")
    else:
        logger.info("No config file found. Using default configuration.")
        try:
            config_path.parent.mkdir(parents=True, exist_ok=True)
            default_config = """# InkMixer Configuration
db_path = "~/.config/inkmixer/inkmixer.db"
log_level = "INFO"
log_dir = "logs"
delta_e_threshold = 3.0
dominant_colors = 5
low_stock_threshold = 1
expiration_warning_days = 180
"""
            with open(config_path, "w", encoding="utf-8") as f:
                f.write(default_config)
            logger.info(f"Created default configuration at {config_path}")
        except Exception as e:
            logger.warning(f"Could not create default config: {e}")

    return config
