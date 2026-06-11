from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger

from ..parsers.normalize import normalize_beer
from ..scrapers.base import BaseScraper, ScrapeResult, SourcePlatform
from ..storage.db import Database

SOURCE_INTERVALS: dict[SourcePlatform, int] = {
    SourcePlatform.UNTAPPD: 30,
    SourcePlatform.RATEBEER: 45,
    SourcePlatform.KICKSTARTER: 60,
    SourcePlatform.BREWER: 20,
    SourcePlatform.DISTRIBUTOR: 40,
    SourcePlatform.NEWSLETTER: 15,
}


@dataclass
class PipelineStats:
    total_scraped: int = 0
    total_errors: int = 0
    total_upserted: int = 0
    last_run: dict[str, str] = field(default_factory=dict)
    source_status: dict[str, str] = field(default_factory=dict)
    running: bool = False


class PipelineScheduler:
    def __init__(
        self,
        scrapers: list[BaseScraper],
        db: Database,
        on_new_beer: Callable[[dict], None] | None = None,
        on_discount: Callable[[dict], None] | None = None,
        on_kickstarter_alert: Callable[[dict], None] | None = None,
    ):
        self.scrapers = {s.SOURCE: s for s in scrapers}
        self.db = db
        self.on_new_beer = on_new_beer
        self.on_discount = on_discount
        self.on_kickstarter_alert = on_kickstarter_alert
        self._scheduler = AsyncIOScheduler(timezone="UTC")
        self._stats = PipelineStats()
        self._running_tasks: set[asyncio.Task] = set()
        self._rate_limiters: dict[SourcePlatform, asyncio.Semaphore] = {
            src: asyncio.Semaphore(2) for src in SourcePlatform
        }

    @property
    def stats(self) -> PipelineStats:
        return self._stats

    def start(self) -> None:
        for source, scraper in self.scrapers.items():
            interval = SOURCE_INTERVALS.get(source, 30)
            self._scheduler.add_job(
                self._run_scraper,
                trigger=IntervalTrigger(minutes=interval),
                id=f"scraper_{source.value}",
                name=f"Scraper: {source.value}",
                args=[source],
                max_instances=1,
                misfire_grace_time=60,
            )
            logger.info(
                "Scheduled {source} every {interval}min",
                source=source.value,
                interval=interval,
            )

        self._scheduler.add_job(
            self._run_price_recheck,
            trigger=IntervalTrigger(hours=2),
            id="price_recheck",
            name="Price Recheck (48h)",
            max_instances=1,
        )

        self._scheduler.add_job(
            self._run_kickstarter_check,
            trigger=IntervalTrigger(hours=6),
            id="kickstarter_check",
            name="Kickstarter Risk Check",
            max_instances=1,
        )

        self._scheduler.start()
        self._stats.running = True
        logger.info("Pipeline scheduler started")

    def stop(self) -> None:
        self._scheduler.shutdown(wait=False)
        self._stats.running = False
        logger.info("Pipeline scheduler stopped")

    async def run_all_once(self) -> PipelineStats:
        self._stats.running = True
        tasks = []
        for source in self.scrapers:
            task = asyncio.create_task(self._run_scraper(source))
            tasks.append(task)
            self._running_tasks.add(task)
            task.add_done_callback(self._running_tasks.discard)

        await asyncio.gather(*tasks, return_exceptions=True)
        self._stats.running = False
        return self._stats

    async def _run_scraper(self, source: SourcePlatform) -> None:
        scraper = self.scrapers.get(source)
        if scraper is None or scraper.needs_manual_intervention:
            if scraper and scraper.needs_manual_intervention:
                self._stats.source_status[source.value] = "manual_queue"
                logger.warning("Skipping {source}: in manual queue", source=source.value)
            return

        sem = self._rate_limiters.get(source)
        if sem:
            async with sem:
                await self._execute_scraper(scraper)
        else:
            await self._execute_scraper(scraper)

    async def _execute_scraper(self, scraper: BaseScraper) -> None:
        source = scraper.SOURCE
        self._stats.source_status[source.value] = "running"
        try:
            result = await scraper.run()
            self._stats.total_scraped += result.items_count
            self._stats.total_errors += len(result.errors)

            for item in result.items:
                normalized = normalize_beer(item)
                beer_id = self.db.upsert_beer(normalized)
                self._stats.total_upserted += 1

                if item.source == SourcePlatform.KICKSTARTER and item.raw_data:
                    self._process_kickstarter(beer_id, item)

                if self.on_new_beer:
                    try:
                        self.on_new_beer(normalized)
                    except Exception as exc:
                        logger.error("on_new_beer callback error: {err}", err=str(exc))

            if scraper.needs_manual_intervention:
                self.db.add_to_manual_queue(source.value, "Exceeded max failures")
                self._stats.source_status[source.value] = "manual_queue"
            else:
                self._stats.source_status[source.value] = "ok"

            self._stats.last_run[source.value] = datetime.now(timezone.utc).isoformat()
            logger.info(
                "Scraper {source} done: {items} items, {errors} errors",
                source=source.value,
                items=result.items_count,
                errors=len(result.errors),
            )
        except Exception as exc:
            self._stats.source_status[source.value] = "error"
            logger.error("Scraper {source} failed: {err}", source=source.value, err=str(exc))

    def _process_kickstarter(self, beer_id: int, item: Any) -> None:
        raw = item.raw_data
        pledged = raw.get("pledged_amount", 0) or 0
        goal = raw.get("goal_amount", 0) or 0
        backers = raw.get("backer_count", 0) or 0

        risk_score = 0
        if goal > 0:
            pct = (pledged / goal) * 100
            if pct < 25:
                risk_score = 80
            elif pct < 50:
                risk_score = 60
            elif pct < 75:
                risk_score = 40
            elif pct < 100:
                risk_score = 20
            else:
                risk_score = 0

        if backers < 10:
            risk_score = min(risk_score + 20, 100)

        self.db.upsert_kickstarter({
            "beer_id": beer_id,
            "campaign_url": item.source_url,
            "title": item.beer_name,
            "goal_amount": goal,
            "pledged_amount": pledged,
            "backer_count": backers,
            "days_left": raw.get("days_left"),
            "is_funded": raw.get("is_funded", False),
            "deadline": raw.get("deadline"),
            "risk_score": risk_score,
        })

        if risk_score >= 60 and self.on_kickstarter_alert:
            try:
                self.on_kickstarter_alert({
                    "beer_id": beer_id,
                    "title": item.beer_name,
                    "risk_score": risk_score,
                    "pledged": pledged,
                    "goal": goal,
                    "backers": backers,
                })
            except Exception as exc:
                logger.error("on_kickstarter_alert callback error: {err}", err=str(exc))

    async def _run_price_recheck(self) -> None:
        logger.info("Starting price recheck")
        beers = self.db.get_beers_for_price_recheck(hours=48)
        for beer in beers:
            source = beer.get("source")
            scraper = self.scrapers.get(SourcePlatform(source) if source else None)
            if not scraper:
                continue
            try:
                result = await scraper.run()
                for item in result.items:
                    normalized = normalize_beer(item)
                    old_price = beer.get("price")
                    new_price = normalized.get("price")
                    if old_price and new_price and new_price < old_price:
                        discount_pct = ((old_price - new_price) / old_price) * 100
                        if discount_pct >= 10:
                            logger.info(
                                "Discount detected: {beer} {old} -> {new} ({pct}%)",
                                beer=normalized["beer_name"],
                                old=old_price,
                                new=new_price,
                                pct=round(discount_pct, 1),
                            )
                            self.db.add_notification(
                                beer["id"],
                                "discount",
                                f"{normalized['beer_name']}: {old_price} -> {new_price} (-{discount_pct:.0f}%)",
                            )
                            if self.on_discount:
                                try:
                                    self.on_discount({
                                        "beer_id": beer["id"],
                                        "beer_name": normalized["beer_name"],
                                        "old_price": old_price,
                                        "new_price": new_price,
                                        "discount_pct": discount_pct,
                                    })
                                except Exception:
                                    pass
            except Exception as exc:
                logger.error("Price recheck error for {beer}: {err}", beer=beer.get("beer_name"), err=str(exc))
        logger.info("Price recheck complete, checked {count} beers", count=len(beers))

    async def _run_kickstarter_check(self) -> None:
        logger.info("Starting Kickstarter risk check")
        campaigns = self.db.get_kickstarter_active()
        for campaign in campaigns:
            risk = campaign.get("risk_score", 0)
            if risk >= 60:
                logger.warning(
                    "Kickstarter risk alert: {title} risk={risk}",
                    title=campaign.get("title"),
                    risk=risk,
                )
                self.db.add_notification(
                    campaign.get("beer_id", 0),
                    "kickstarter_risk",
                    f"{campaign.get('title')}: risk score {risk}/100",
                )
        logger.info("Kickstarter check complete, {count} active campaigns", count=len(campaigns))

    def get_stats(self) -> dict[str, Any]:
        return {
            "running": self._stats.running,
            "total_scraped": self._stats.total_scraped,
            "total_errors": self._stats.total_errors,
            "total_upserted": self._stats.total_upserted,
            "source_status": dict(self._stats.source_status),
            "last_run": dict(self._stats.last_run),
            "manual_queue": self.db.get_manual_queue(),
        }
