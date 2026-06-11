from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

import aiohttp
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, RawBeerItem, ScrapeResult, SourcePlatform


class BrewerScraper(BaseScraper):
    SOURCE = SourcePlatform.BREWER
    RATE_LIMIT_SECONDS = 5.0
    TIMEOUT_SECONDS = 30.0

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self._breweries: list[dict[str, str]] = config.get("breweries", []) if config else []
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

        for brewery in self._breweries:
            name = brewery.get("name", "Unknown")
            url = brewery.get("url", "")
            rss_url = brewery.get("rss_url", "")
            if not url and not rss_url:
                continue

            try:
                if rss_url:
                    items = await self._fetch_rss(session, name, rss_url)
                else:
                    items = await self._fetch_html(session, name, url)
                result.items.extend(items)
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)
            except Exception as exc:
                result.errors.append(f"Brewery {name}: {exc}")

        end = datetime.now(timezone.utc)
        result.duration_seconds = (end - start).total_seconds()
        return result

    async def _fetch_html(self, session: aiohttp.ClientSession, brewery_name: str, url: str) -> list[RawBeerItem]:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            )
        }
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                return []
            html = await resp.text()
            return await self._parse_brewery_page(brewery_name, url, html)

    async def _fetch_rss(self, session: aiohttp.ClientSession, brewery_name: str, rss_url: str) -> list[RawBeerItem]:
        import feedparser
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36"
            )
        }
        async with session.get(rss_url, headers=headers) as resp:
            if resp.status != 200:
                return []
            content = await resp.text()

        feed = feedparser.parse(content)
        items: list[RawBeerItem] = []
        for entry in feed.entries:
            title = entry.get("title", "")
            link = entry.get("link", rss_url)
            summary = entry.get("summary", entry.get("description", ""))
            published = entry.get("published", entry.get("updated", ""))

            items.append(RawBeerItem(
                source=self.SOURCE,
                source_url=link,
                brewery_name=brewery_name,
                beer_name=title,
                description=summary[:500] if summary else None,
                release_date=published,
                raw_data={"rss_entry": True, "published": published},
                scraped_at=datetime.now(timezone.utc).isoformat(),
            ))
        return items

    async def _parse_brewery_page(self, brewery_name: str, url: str, html: str) -> list[RawBeerItem]:
        items: list[RawBeerItem] = []
        soup = BeautifulSoup(html, "html.parser")

        beer_els = soup.select(
            ".beer-item, .product-item, .tap-list-item, "
            ".beer-card, [data-beer], .menu-item"
        )

        if not beer_els:
            beer_els = soup.select("article, .post, .entry")

        for el in beer_els:
            try:
                name_el = el.select_one("h2, h3, .name, .title, .beer-name")
                beer_name = name_el.get_text(strip=True) if name_el else ""
                if not beer_name:
                    continue

                style_el = el.select_one(".style, .type, .category")
                style = style_el.get_text(strip=True) if style_el else None

                abv_val = None
                ibu_val = None
                text_content = el.get_text()
                abv_match = re.search(r"(\d+\.?\d*)\s*%?\s*ABV", text_content, re.I)
                if abv_match:
                    abv_val = float(abv_match.group(1))
                ibu_match = re.search(r"(\d+)\s*IBU", text_content, re.I)
                if ibu_match:
                    ibu_val = int(ibu_match.group(1))

                price_val = None
                price_match = re.search(r"\$\s*(\d+\.?\d*)", text_content)
                if price_match:
                    price_val = float(price_match.group(1))

                desc_el = el.select_one(".description, .desc, p")
                description = desc_el.get_text(strip=True) if desc_el else None

                img_el = el.select_one("img")
                image_url = img_el.get("src") if img_el else None

                is_limited = False
                limited_tags: list[str] = []
                lower = text_content.lower()
                for kw in ["limited", "taproom only", "exclusive", "seasonal", "special release"]:
                    if kw in lower:
                        is_limited = True
                        limited_tags.append(kw)

                items.append(RawBeerItem(
                    source=self.SOURCE,
                    source_url=url,
                    brewery_name=brewery_name,
                    beer_name=beer_name,
                    style=style,
                    abv=abv_val,
                    ibu=ibu_val,
                    price=price_val,
                    is_limited=is_limited,
                    limited_tags=limited_tags,
                    description=description,
                    image_url=image_url,
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                ))
            except Exception:
                continue

        return items

    async def _parse_page(self, content: Any) -> list[RawBeerItem]:
        return []

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
