from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger

from .base import BaseScraper, RawBeerItem, ScrapeResult, SourcePlatform


class NewsletterScraper(BaseScraper):
    SOURCE = SourcePlatform.NEWSLETTER
    RATE_LIMIT_SECONDS = 5.0
    TIMEOUT_SECONDS = 30.0

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self._newsletter_urls: list[dict[str, str]] = config.get("newsletter_urls", []) if config else []
        self._screenshot_dir = Path(config.get("screenshot_dir", "data/screenshots")) if config else Path("data/screenshots")
        self._screenshot_dir.mkdir(parents=True, exist_ok=True)

    async def fetch(self) -> ScrapeResult:
        result = ScrapeResult(source=self.SOURCE)
        start = datetime.now(timezone.utc)

        for nl in self._newsletter_urls:
            name = nl.get("name", "Unknown")
            url = nl.get("url", "")
            if not url:
                continue
            try:
                items = await self._fetch_with_playwright(name, url)
                result.items.extend(items)
                await asyncio.sleep(self.RATE_LIMIT_SECONDS)
            except Exception as exc:
                result.errors.append(f"Newsletter {name}: {exc}")
                logger.error("Newsletter {name} error: {err}", name=name, err=str(exc))

        end = datetime.now(timezone.utc)
        result.duration_seconds = (end - start).total_seconds()
        return result

    async def _fetch_with_playwright(self, name: str, url: str) -> list[RawBeerItem]:
        from playwright.async_api import async_playwright

        items: list[RawBeerItem] = []
        screenshot_path = self._screenshot_dir / f"{name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"

        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            try:
                await page.goto(url, wait_until="networkidle", timeout=self.TIMEOUT_SECONDS * 1000)
                await page.screenshot(path=str(screenshot_path), full_page=True)
                logger.info("Screenshot saved: {path}", path=screenshot_path)

                ocr_text = await self._ocr_screenshot(screenshot_path)
                html = await page.content()
                items = await self._parse_page(html)
                ocr_items = self._parse_ocr_text(name, url, ocr_text, str(screenshot_path))
                items.extend(ocr_items)
            finally:
                await browser.close()

        return items

    async def _ocr_screenshot(self, screenshot_path: Path) -> str:
        try:
            import pytesseract
            from PIL import Image

            img = Image.open(str(screenshot_path))
            text = pytesseract.image_to_string(img)
            logger.debug("OCR extracted {chars} chars from {path}", chars=len(text), path=screenshot_path)
            return text
        except ImportError:
            logger.warning("pytesseract or Pillow not available, skipping OCR")
            return ""
        except Exception as exc:
            logger.error("OCR failed for {path}: {err}", path=screenshot_path, err=str(exc))
            return ""

    def _parse_ocr_text(self, name: str, url: str, ocr_text: str, screenshot_path: str) -> list[RawBeerItem]:
        if not ocr_text:
            return []

        items: list[RawBeerItem] = []
        lines = ocr_text.split("\n")
        current_beer: dict[str, Any] = {}

        for line in lines:
            line = line.strip()
            if not line:
                if current_beer.get("beer_name"):
                    items.append(RawBeerItem(
                        source=self.SOURCE,
                        source_url=url,
                        brewery_name=current_beer.get("brewery_name", name),
                        beer_name=current_beer["beer_name"],
                        style=current_beer.get("style"),
                        abv=current_beer.get("abv"),
                        description=current_beer.get("description"),
                        is_limited=True,
                        limited_tags=["newsletter", "24h"],
                        screenshot_path=screenshot_path,
                        scraped_at=datetime.now(timezone.utc).isoformat(),
                    ))
                current_beer = {}
                continue

            beer_match = re.match(r"^(.+?)\s*[-–—|]\s*(.+)$", line)
            if beer_match and not current_beer.get("beer_name"):
                current_beer["brewery_name"] = beer_match.group(1).strip()
                current_beer["beer_name"] = beer_match.group(2).strip()
                continue

            style_match = re.match(r"^(.*?)\s*[-–]\s*(\d+\.?\d*)\s*%?\s*ABV", line, re.I)
            if style_match:
                current_beer["style"] = style_match.group(1).strip()
                current_beer["abv"] = float(style_match.group(2))
                continue

            abv_match = re.search(r"(\d+\.?\d*)\s*%?\s*ABV", line, re.I)
            if abv_match:
                current_beer["abv"] = float(abv_match.group(1))
                continue

            if len(line) > 20 and not current_beer.get("description"):
                current_beer["description"] = line[:500]
            elif not current_beer.get("beer_name") and len(line) < 100:
                current_beer["beer_name"] = line

        if current_beer.get("beer_name"):
            items.append(RawBeerItem(
                source=self.SOURCE,
                source_url=url,
                brewery_name=current_beer.get("brewery_name", name),
                beer_name=current_beer["beer_name"],
                style=current_beer.get("style"),
                abv=current_beer.get("abv"),
                description=current_beer.get("description"),
                is_limited=True,
                limited_tags=["newsletter", "24h"],
                screenshot_path=screenshot_path,
                scraped_at=datetime.now(timezone.utc).isoformat(),
            ))

        return items

    async def _parse_page(self, content: str) -> list[RawBeerItem]:
        from bs4 import BeautifulSoup

        items: list[RawBeerItem] = []
        soup = BeautifulSoup(content, "html.parser")

        content_blocks = soup.select(
            "article, .post, .entry, .newsletter-content, "
            ".email-body, .content-block, section"
        )
        if not content_blocks:
            content_blocks = [soup]

        for block in content_blocks:
            text = block.get_text("\n", strip=True)
            paragraphs = text.split("\n")

            for para in paragraphs:
                para = para.strip()
                if not para or len(para) < 5:
                    continue

                beer_match = re.match(r"^(.+?)\s*[-–—|]\s*(.+?)(?:\s*[-–—|]\s*(.+))?$", para)
                if beer_match:
                    brewery_name = beer_match.group(1).strip()
                    beer_name = beer_match.group(2).strip()
                    style = beer_match.group(3).strip() if beer_match.group(3) else None

                    abv_val = None
                    abv_match = re.search(r"(\d+\.?\d*)\s*%?\s*ABV", para, re.I)
                    if abv_match:
                        abv_val = float(abv_match.group(1))

                    items.append(RawBeerItem(
                        source=self.SOURCE,
                        source_url="",
                        brewery_name=brewery_name,
                        beer_name=beer_name,
                        style=style,
                        abv=abv_val,
                        is_limited=True,
                        limited_tags=["newsletter"],
                        description=para[:500],
                        scraped_at=datetime.now(timezone.utc).isoformat(),
                    ))

        return items
