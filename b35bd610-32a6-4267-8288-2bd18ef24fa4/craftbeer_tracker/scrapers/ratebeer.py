from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

import aiohttp
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, RawBeerItem, ScrapeResult, SourcePlatform


class RateBeerScraper(BaseScraper):
    SOURCE = SourcePlatform.RATEBEER
    RATE_LIMIT_SECONDS = 2.5
    TIMEOUT_SECONDS = 30.0
    BASE_URL = "https://www.ratebeer.com"

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self._brewery_slugs: list[str] = config.get("brewery_slugs", []) if config else []
        self._session: aiohttp.ClientSession | None = None

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.TIMEOUT_SECONDS)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def fetch(self) -> ScrapeResult:
        result = ScrapeResult(source=self.SOURCE)
        session = await self._get_session()
        start = datetime.now(timezone.utc)

        for slug in self._brewery_slugs:
            try:
                url = f"{self.BASE_URL}/brewers/{slug}/0/"
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36"
                    )
                }
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        result.errors.append(f"HTTP {resp.status} for brewery {slug}")
                        continue
                    html = await resp.text()
                    items = await self._parse_page(html)
                    result.items.extend(items)
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)
            except Exception as exc:
                result.errors.append(f"Brewery {slug}: {exc}")

        end = datetime.now(timezone.utc)
        result.duration_seconds = (end - start).total_seconds()
        return result

    async def _parse_page(self, content: str) -> list[RawBeerItem]:
        items: list[RawBeerItem] = []
        soup = BeautifulSoup(content, "html.parser")
        beer_rows = soup.select("tr.beer, .beer-item, [data-beer-url]")

        for row in beer_rows:
            try:
                name_el = row.select_one("a[href*='/beer/'], .beer-name a")
                beer_name = name_el.get_text(strip=True) if name_el else ""
                beer_href = name_el.get("href", "") if name_el else ""
                source_url = f"{self.BASE_URL}{beer_href}" if beer_href.startswith("/") else beer_href

                brewery_el = row.select_one("a[href*='/brewers/'], .brewery-name")
                brewery_name = brewery_el.get_text(strip=True) if brewery_el else ""

                style_el = row.select_one(".style-name, td:nth-child(3)")
                style = style_el.get_text(strip=True) if style_el else None

                cells = row.select("td")
                abv_val = None
                ibu_val = None
                for cell in cells:
                    text = cell.get_text(strip=True)
                    abv_match = re.search(r"(\d+\.?\d*)\s*%?\s*ABV", text, re.I)
                    if abv_match:
                        abv_val = float(abv_match.group(1))
                    ibu_match = re.search(r"(\d+)\s*IBU", text, re.I)
                    if ibu_match:
                        ibu_val = int(ibu_match.group(1))

                rating_el = row.select_one(".rating, [data-rating]")
                desc_el = row.select_one(".beer-desc, .description")

                is_limited = False
                limited_tags: list[str] = []
                tag_els = row.select(".tag, .badge, .label")
                for tag_el in tag_els:
                    tag_text = tag_el.get_text(strip=True).lower()
                    if tag_text in {"limited", "seasonal", "retired", "exclusive"}:
                        is_limited = True
                        limited_tags.append(tag_text)

                items.append(RawBeerItem(
                    source=self.SOURCE,
                    source_url=source_url or f"{self.BASE_URL}",
                    brewery_name=brewery_name,
                    beer_name=beer_name,
                    style=style,
                    abv=abv_val,
                    ibu=ibu_val,
                    is_limited=is_limited,
                    limited_tags=limited_tags,
                    description=desc_el.get_text(strip=True) if desc_el else None,
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                ))
            except Exception:
                continue

        return items

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
