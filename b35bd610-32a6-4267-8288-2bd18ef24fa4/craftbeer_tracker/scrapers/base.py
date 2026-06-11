from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from loguru import logger


class SourcePlatform(str, Enum):
    UNTAPPD = "untappd"
    RATEBEER = "ratebeer"
    KICKSTARTER = "kickstarter"
    BREWER = "brewer"
    DISTRIBUTOR = "distributor"
    NEWSLETTER = "newsletter"


@dataclass
class RawBeerItem:
    source: SourcePlatform
    source_url: str
    brewery_name: str
    beer_name: str
    batch_name: str | None = None
    style: str | None = None
    abv: float | None = None
    ibu: int | None = None
    release_date: str | None = None
    price: float | None = None
    currency: str = "USD"
    is_limited: bool = False
    limited_tags: list[str] = field(default_factory=list)
    description: str | None = None
    image_url: str | None = None
    screenshot_path: str | None = None
    availability_raw: dict[str, Any] = field(default_factory=dict)
    raw_data: dict[str, Any] = field(default_factory=dict)
    scraped_at: str | None = None


@dataclass
class ScrapeResult:
    source: SourcePlatform
    items: list[RawBeerItem] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    duration_seconds: float = 0.0
    items_count: int = 0


class BaseScraper(ABC):
    SOURCE: SourcePlatform
    RATE_LIMIT_SECONDS: float = 2.0
    TIMEOUT_SECONDS: float = 30.0
    MAX_RETRIES: int = 3

    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self._failure_count = 0
        self._in_manual_queue = False

    @abstractmethod
    async def fetch(self) -> ScrapeResult:
        ...

    @abstractmethod
    async def _parse_page(self, content: Any) -> list[RawBeerItem]:
        ...

    async def run(self) -> ScrapeResult:
        retries = 0
        backoff = 1.0
        while retries < self.MAX_RETRIES:
            try:
                logger.info(
                    "Starting scrape for {source}",
                    source=self.SOURCE.value,
                )
                result = await asyncio.wait_for(
                    self.fetch(),
                    timeout=self.TIMEOUT_SECONDS,
                )
                self._failure_count = 0
                self._in_manual_queue = False
                result.items_count = len(result.items)
                logger.info(
                    "Scrape complete for {source}: {count} items",
                    source=self.SOURCE.value,
                    count=result.items_count,
                )
                return result
            except asyncio.TimeoutError:
                retries += 1
                logger.warning(
                    "Timeout scraping {source} (attempt {n}/{max})",
                    source=self.SOURCE.value,
                    n=retries,
                    max=self.MAX_RETRIES,
                )
            except Exception as exc:
                retries += 1
                logger.error(
                    "Error scraping {source}: {err} (attempt {n}/{max})",
                    source=self.SOURCE.value,
                    err=str(exc),
                    n=retries,
                    max=self.MAX_RETRIES,
                )
            if retries < self.MAX_RETRIES:
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 30.0)

        self._failure_count += 1
        if self._failure_count >= 3 and not self._in_manual_queue:
            self._in_manual_queue = True
            logger.critical(
                "Source {source} moved to manual queue after {fail} failures",
                source=self.SOURCE.value,
                fail=self._failure_count,
            )
        return ScrapeResult(
            source=self.SOURCE,
            errors=[f"Failed after {self.MAX_RETRIES} retries"],
        )

    @property
    def needs_manual_intervention(self) -> bool:
        return self._in_manual_queue
