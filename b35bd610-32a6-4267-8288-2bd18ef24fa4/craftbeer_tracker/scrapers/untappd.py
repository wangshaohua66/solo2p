from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import aiohttp
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, RawBeerItem, ScrapeResult, SourcePlatform


class UntappdScraper(BaseScraper):
    SOURCE = SourcePlatform.UNTAPPD
    RATE_LIMIT_SECONDS = 3.0
    TIMEOUT_SECONDS = 30.0
    BASE_URL = "https://untappd.com"

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self._brewery_ids: list[str] = config.get("brewery_ids", []) if config else []
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

        for brewery_id in self._brewery_ids:
            try:
                url = f"{self.BASE_URL}/brewery/{brewery_id}"
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36"
                    )
                }
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        result.errors.append(f"HTTP {resp.status} for brewery {brewery_id}")
                        continue
                    html = await resp.text()
                    items = await self._parse_page(html)
                    result.items.extend(items)
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)
            except Exception as exc:
                result.errors.append(f"Brewery {brewery_id}: {exc}")

        end = datetime.now(timezone.utc)
        result.duration_seconds = (end - start).total_seconds()
        return result

    async def _parse_page(self, content: str) -> list[RawBeerItem]:
        items: list[RawBeerItem] = []
        soup = BeautifulSoup(content, "html.parser")
        beer_items = soup.select(".beer-item, .beer-list-item, [data-beer-id]")

        for el in beer_items:
            try:
                brewery_el = el.select_one(".brewery a, [data-brewery]")
                brewery_name = brewery_el.get_text(strip=True) if brewery_el else ""

                beer_el = el.select_one(".beer-name a, .name a")
                beer_name = beer_el.get_text(strip=True) if beer_el else ""
                beer_href = beer_el.get("href", "") if beer_el else ""
                source_url = f"{self.BASE_URL}{beer_href}" if beer_href.startswith("/") else beer_href

                style_el = el.select_one(".style, .beer-style")
                style = style_el.get_text(strip=True) if style_el else None

                abv_el = el.select_one(".abv, [data-abv]")
                abv_text = abv_el.get_text(strip=True) if abv_el else None
                abv_val = None
                if abv_text:
                    import re
                    m = re.search(r"(\d+\.?\d*)", abv_text)
                    abv_val = float(m.group(1)) if m else None

                ibu_el = el.select_one(".ibu, [data-ibu]")
                ibu_text = ibu_el.get_text(strip=True) if ibu_el else None
                ibu_val = None
                if ibu_text:
                    import re
                    m = re.search(r"(\d+)", ibu_text)
                    ibu_val = int(m.group(1)) if m else None

                desc_el = el.select_one(".desc, .beer-desc, .caption")
                description = desc_el.get_text(strip=True) if desc_el else None

                img_el = el.select_one("img.beer-label, img.beer-img")
                image_url = img_el.get("src") if img_el else None

                badge_els = el.select(".badge, .tag")
                limited_tags = []
                is_limited = False
                for badge in badge_els:
                    tag_text = badge.get_text(strip=True).lower()
                    if tag_text in {"limited", "taproom only", "exclusive", "rare"}:
                        is_limited = True
                        limited_tags.append(tag_text)

                items.append(RawBeerItem(
                    source=self.SOURCE,
                    source_url=source_url or f"{self.BASE_URL}/brewery/",
                    brewery_name=brewery_name,
                    beer_name=beer_name,
                    style=style,
                    abv=abv_val,
                    ibu=ibu_val,
                    is_limited=is_limited,
                    limited_tags=limited_tags,
                    description=description,
                    image_url=image_url,
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                ))
            except Exception:
                continue

        return items

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
