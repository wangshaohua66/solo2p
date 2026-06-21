from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    app_name: str = "跨境电商综合试验区运营服务中心"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-this-secret-key"
    access_token_expire_minutes: int = 1440

    database_url: str = "postgresql://postgres:postgres@localhost:5432/cross_border_ecommerce"

    cors_origins: str = "http://localhost:5173"

    host: str = "0.0.0.0"
    port: int = 8000

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
