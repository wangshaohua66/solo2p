from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import Any

import aiohttp
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper, RawBeerItem, ScrapeResult, SourcePlatform


class KickstarterScraper(BaseScraper):
    SOURCE = SourcePlatform.KICKSTARTER
    RATE_LIMIT_SECONDS = 3.0
    TIMEOUT_SECONDS = 30.0
    BASE_URL = "https://www.kickstarter.com"

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self._search_terms: list[str] = config.get("search_terms", ["craft beer", "brewery", "brewing"]) if config else ["craft beer", "brewery", "brewing"]
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

        for term in self._search_terms:
            try:
                url = f"{self.BASE_URL}/discover/advanced?term={term}&category_id=16"
                headers = {
                    "User-Agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/122.0.0.0 Safari/537.36"
                    )
                }
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        result.errors.append(f"HTTP {resp.status} for term '{term}'")
                        continue
                    html = await resp.text()
                    items = await self._parse_page(html)
                    result.items.extend(items)
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)
            except Exception as exc:
                result.errors.append(f"Search '{term}': {exc}")

        end = datetime.now(timezone.utc)
        result.duration_seconds = (end - start).total_seconds()
        return result

    async def _parse_page(self, content: str) -> list[RawBeerItem]:
        items: list[RawBeerItem] = []
        soup = BeautifulSoup(content, "html.parser")
        projects = soup.select(".js-react-proj-card, .project-card, [data-project]")

        for proj in projects:
            try:
                title_el = proj.select_one(".project-title, .title a, h2 a")
                title = title_el.get_text(strip=True) if title_el else ""
                link = title_el.get("href", "") if title_el else ""
                source_url = f"{self.BASE_URL}{link}" if link.startswith("/") else link

                desc_el = proj.select_one(".project-desc, .description, p.blurb")
                description = desc_el.get_text(strip=True) if desc_el else None

                pledged_el = proj.select_one(".pledged, [data-pledged]")
                pledged_text = pledged_el.get_text(strip=True) if pledged_el else ""
                pledged_val = None
                pledged_match = re.search(r"[\$€£]?([\d,]+\.?\d*)", pledged_text)
                if pledged_match:
                    pledged_val = float(pledged_match.group(1).replace(",", ""))

                goal_el = proj.select_one(".goal, [data-goal]")
                goal_text = goal_el.get_text(strip=True) if goal_el else ""
                goal_val = None
                goal_match = re.search(r"[\$€£]?([\d,]+\.?\d*)", goal_text)
                if goal_match:
                    goal_val = float(goal_match.group(1).replace(",", ""))

                backers_el = proj.select_one(".backers, [data-backers]")
                backers_text = backers_el.get_text(strip=True) if backers_el else ""
                backer_count = 0
                backers_match = re.search(r"([\d,]+)", backers_text)
                if backers_match:
                    backer_count = int(backers_match.group(1).replace(",", ""))

                days_el = proj.select_one(".days-left, .time-left, [data-hours-left]")
                days_text = days_el.get_text(strip=True) if days_el else ""
                days_left = None
                days_match = re.search(r"(\d+)", days_text)
                if days_match:
                    days_left = int(days_match.group(1))

                brewery_name = title
                brewery_match = re.search(r"(.+?)(?:\s*[-–—|]\s*|:\s*)(brewery|brewing|beer|craft)", title, re.I)
                if brewery_match:
                    brewery_name = brewery_match.group(0)

                is_funded = False
                if pledged_val and goal_val and goal_val > 0:
                    is_funded = pledged_val >= goal_val

                items.append(RawBeerItem(
                    source=self.SOURCE,
                    source_url=source_url or f"{self.BASE_URL}",
                    brewery_name=brewery_name,
                    beer_name=title,
                    description=description,
                    is_limited=True,
                    limited_tags=["kickstarter", "crowdfunding"],
                    raw_data={
                        "pledged_amount": pledged_val,
                        "goal_amount": goal_val,
                        "backer_count": backer_count,
                        "days_left": days_left,
                        "is_funded": is_funded,
                    },
                    scraped_at=datetime.now(timezone.utc).isoformat(),
                ))
            except Exception:
                continue

        return items

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
