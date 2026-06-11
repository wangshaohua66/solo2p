from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

import aiohttp
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, RawBeerItem, ScrapeResult, SourcePlatform


class DistributorScraper(BaseScraper):
    SOURCE = SourcePlatform.DISTRIBUTOR
    RATE_LIMIT_SECONDS = 3.0
    TIMEOUT_SECONDS = 30.0

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self._distributors: list[dict[str, str]] = config.get("distributors", []) if config else []
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

        for dist in self._distributors:
            name = dist.get("name", "Unknown")
            url = dist.get("url", "")
            if not url:
                continue
            try:
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36"
                    )
                }
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        result.errors.append(f"HTTP {resp.status} for distributor {name}")
                        continue
                    html = await resp.text()
                    items = await self._parse_page(html)
                    for item in items:
                        item.raw_data["distributor_name"] = name
                    result.items.extend(items)
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)
            except Exception as exc:
                result.errors.append(f"Distributor {name}: {exc}")

        end = datetime.now(timezone.utc)
        result.duration_seconds = (end - start).total_seconds()
        return result

    async def _parse_page(self, content: str) -> list[RawBeerItem]:
        items: list[RawBeerItem] = []
        soup = BeautifulSoup(content, "html.parser")
        product_els = soup.select(
            ".product-item, .beer-item, .product-card, "
            "[data-product], .inventory-item"
        )

        if not product_els:
            product_els = soup.select("article, .item, .entry")

        for el in product_els:
            try:
                name_el = el.select_one("h2, h3, .name, .title, .product-name")
                beer_name = name_el.get_text(strip=True) if name_el else ""
                if not beer_name:
                    continue

                brewery_el = el.select_one(".brewery, .brand, .producer")
                brewery_name = brewery_el.get_text(strip=True) if brewery_el else ""

                style_el = el.select_one(".style, .type, .category")
                style = style_el.get_text(strip=True) if style_el else None

                text_content = el.get_text()
                abv_val = None
                abv_match = re.search(r"(\d+\.?\d*)\s*%?\s*ABV", text_content, re.I)
                if abv_match:
                    abv_val = float(abv_match.group(1))

                price_val = None
                price_match = re.search(r"\$\s*(\d+\.?\d*)", text_content)
                if price_match:
                    price_val = float(price_match.group(1))

                availability_raw: dict[str, Any] = {}
                shipping_el = el.select_one(".shipping, .availability, .delivery")
                if shipping_el:
                    avail_text = shipping_el.get_text(strip=True)
                    availability_raw["notes"] = avail_text
                    zip_patterns = self._extract_zipcode_patterns(avail_text)
                    if zip_patterns:
                        availability_raw["zipcode_pattern"] = zip_patterns
                        availability_raw["is_available"] = True

                    state_block = re.search(
                        r"(?:ships?\s+to|available\s+in|delivers?\s+to)[:\s]+([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)",
                        avail_text, re.I,
                    )
                    if state_block:
                        availability_raw["states"] = [
                            s.strip() for s in state_block.group(1).split(",")
                        ]
                        availability_raw["region"] = ",".join(availability_raw["states"])

                no_ship_match = re.search(
                    r"(?:cannot|does not|no)\s+ship\s+(?:to\s+)?([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)",
                    text_content, re.I,
                )
                if no_ship_match:
                    availability_raw["excluded_states"] = [
                        s.strip() for s in no_ship_match.group(1).split(",")
                    ]

                img_el = el.select_one("img")
                image_url = img_el.get("src") if img_el else None

                is_limited = False
                limited_tags: list[str] = []
                lower = text_content.lower()
                for kw in ["limited", "exclusive", "rare", "last call", "while supplies last"]:
                    if kw in lower:
                        is_limited = True
                        limited_tags.append(kw)

                link_el = el.select_one("a[href]")
                source_url = link_el.get("href", "") if link_el else ""

                items.append(RawBeerItem(
                    source=self.SOURCE,
                    source_url=source_url,
                    brewery_name=brewery_name,
                    beer_name=beer_name,
                    style=style,
                    abv=abv_val,
                    price=price_val,
                    is_limited=is_limited,
                    limited_tags=limited_tags,
                    availability_raw=availability_raw,
                    image_url=image_url,
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                ))
            except Exception:
                continue

        return items

    def _extract_zipcode_patterns(self, text: str) -> str:
        patterns: list[str] = []
        range_matches = re.findall(r"(\d{5})\s*[-–]\s*(\d{5})", text)
        for lo, hi in range_matches:
            patterns.append(f"{lo}-{hi}")

        wildcard_matches = re.findall(r"(\d{3,4})\*+", text)
        patterns.extend(wildcard_matches)

        single_matches = re.findall(r"\b(\d{5})\b", text)
        patterns.extend(single_matches)

        return ",".join(patterns) if patterns else ""

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
