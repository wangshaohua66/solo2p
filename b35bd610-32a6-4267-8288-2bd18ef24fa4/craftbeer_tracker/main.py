from __future__ import annotations

import asyncio
import json
import signal
import sys
from pathlib import Path
from typing import Any

import click
from loguru import logger

BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
DATA_DIR = BASE_DIR / "data"
CONFIG_PATH = BASE_DIR / "config.json"


def setup_logging(log_dir: Path, retention_days: int = 30) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    logger.remove()
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO",
        colorize=True,
    )
    logger.add(
        str(log_dir / "craftbeer_{time:YYYY-MM-DD}.log"),
        rotation="00:00",
        retention=f"{retention_days} days",
        compression="gz",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG",
        serialize=True,
    )
    logger.add(
        str(log_dir / "craftbeer_plain_{time:YYYY-MM-DD}.log"),
        rotation="00:00",
        retention=f"{retention_days} days",
        compression="gz",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="INFO",
        serialize=False,
    )


def load_config(config_path: Path) -> dict[str, Any]:
    if config_path.exists():
        with open(config_path) as f:
            return json.load(f)
    return {}


def send_desktop_notification(title: str, message: str, purchase_url: str = "", source_url: str = "") -> None:
    try:
        from plyer import notification
        notify_msg = f"{message}"
        if purchase_url:
            notify_msg += f"\nBuy: {purchase_url}"
        elif source_url:
            notify_msg += f"\nMore: {source_url}"
        notification.notify(
            title=title,
            message=notify_msg[:200],
            app_name="CraftBeer Tracker",
            timeout=5,
        )
    except Exception as exc:
        logger.debug("Desktop notification failed: {err}", err=str(exc))

    actual_url = purchase_url or source_url
    if actual_url:
        try:
            import sys
            osc8_link = f"\033]8;;{actual_url}\033\\{actual_url}\033]8;;\033\\"
            sys.stdout.write(f"\n  🔗 Click to open: {osc8_link}\n\n")
            sys.stdout.flush()
        except Exception as exc:
            logger.debug("OSC8 link failed: {err}", err=str(exc))
            click.echo(f"  🔗 Link: {actual_url}")


def _on_new_beer(beer: dict) -> None:
    name = beer.get("beer_name", "Unknown")
    brewery = beer.get("brewery_name", "Unknown")
    score = beer.get("scarcity_score", 0)
    if score >= 70:
        purchase_url = beer.get("source_url", "")
        send_desktop_notification(
            f"🔥 Rare Beer Alert: {name}",
            f"{brewery} — Scarcity {score}/100",
            purchase_url=purchase_url,
            source_url=purchase_url,
        )


def _on_discount(discount: dict) -> None:
    name = discount.get("beer_name", "")
    pct = discount.get("discount_pct", 0)
    purchase_url = discount.get("purchase_url", "")
    send_desktop_notification(
        f"💰 Price Drop: {name}",
        f"Discount -{pct:.0f}%",
        purchase_url=purchase_url,
    )


def _on_kickstarter_alert(campaign: dict) -> None:
    title = campaign.get("title", "")
    risk = campaign.get("risk_score", 0)
    campaign_url = campaign.get("campaign_url", "")
    send_desktop_notification(
        f"⚠️ Kickstarter Risk: {title}",
        f"Risk score {risk}/100 — may not fund",
        source_url=campaign_url,
    )


async def _run_pipeline(config: dict[str, Any], mode: str, zipcode: str | None) -> None:
    from .cli.dashboard import Dashboard
    from .pipeline.scarcity import ScarcityEngine
    from .pipeline.scheduler import PipelineScheduler
    from .scrapers.base import SourcePlatform
    from .scrapers.brewer import BrewerScraper
    from .scrapers.distributor import DistributorScraper
    from .scrapers.kickstarter import KickstarterScraper
    from .scrapers.newsletter import NewsletterScraper
    from .scrapers.ratebeer import RateBeerScraper
    from .scrapers.untappd import UntappdScraper
    from .storage.db import Database

    db_path = Path(config.get("db_path", str(DATA_DIR / "craftbeer.db")))
    db = Database(db_path)
    db.connect()

    scarcity_engine = ScarcityEngine(db)

    scrapers = [
        UntappdScraper(config.get("untappd")),
        RateBeerScraper(config.get("ratebeer")),
        KickstarterScraper(config.get("kickstarter")),
        BrewerScraper(config.get("brewer")),
        DistributorScraper(config.get("distributor")),
        NewsletterScraper(config.get("newsletter")),
    ]

    pipeline = PipelineScheduler(
        scrapers=scrapers,
        db=db,
        on_new_beer=_on_new_beer,
        on_discount=_on_discount,
        on_kickstarter_alert=_on_kickstarter_alert,
    )

    dashboard = Dashboard(db, scarcity_engine, zipcode=zipcode)

    if mode == "once":
        logger.info("Running single scrape cycle")
        stats = await pipeline.run_all_once()
        scarcity_engine.recalculate_all()
        scarcity_engine.deduplicate_and_score()
        dashboard.render_once(stats=pipeline.get_stats())
    elif mode == "interactive":
        logger.info("Running in interactive mode")
        stats = await pipeline.run_all_once()
        scarcity_engine.recalculate_all()
        scarcity_engine.deduplicate_and_score()
        dashboard.render_interactive(stats=pipeline.get_stats())
    elif mode == "watch":
        pipeline.start()

        def _shutdown(signum, frame):
            logger.info("Shutdown signal received")
            pipeline.stop()
            db.close()
            sys.exit(0)

        signal.signal(signal.SIGINT, _shutdown)
        signal.signal(signal.SIGTERM, _shutdown)

        logger.info("Starting watch mode — dashboard live refresh")
        dashboard.render_watch(get_stats=pipeline.get_stats, refresh_interval=5.0)
    else:
        logger.error("Unknown mode: {mode}", mode=mode)

    db.close()


@click.group()
def cli() -> None:
    pass


@cli.command()
@click.option("--mode", type=click.Choice(["once", "watch", "interactive"]), default="once", help="Run mode")
@click.option("--zipcode", "-z", default=None, help="Your zipcode for availability check")
@click.option("--config", "-c", "config_path", default=None, help="Config file path")
def run(mode: str, zipcode: str | None, config_path: str | None) -> None:
    setup_logging(LOG_DIR)
    cfg_path = Path(config_path) if config_path else CONFIG_PATH
    config = load_config(cfg_path)
    logger.info("Craft Beer Tracker starting in {mode} mode", mode=mode)
    asyncio.run(_run_pipeline(config, mode, zipcode))


@cli.command()
@click.option("--zipcode", "-z", required=True, help="Your zipcode")
@click.option("--beer", "-b", default=None, help="Beer name to check (partial match)")
@click.option("--config", "-c", "config_path", default=None, help="Config file path")
def check(zipcode: str, beer: str | None, config_path: str | None) -> None:
    setup_logging(LOG_DIR)
    cfg_path = Path(config_path) if config_path else CONFIG_PATH
    config = load_config(cfg_path)

    from .cli.dashboard import Dashboard
    from .pipeline.scarcity import ScarcityEngine
    from .storage.db import Database

    db_path = Path(config.get("db_path", str(DATA_DIR / "craftbeer.db")))
    db = Database(db_path)
    db.connect()

    scarcity_engine = ScarcityEngine(db)
    dashboard = Dashboard(db, scarcity_engine, zipcode=zipcode)

    table = dashboard.check_zipcode_availability(zipcode, beer)
    from rich.console import Console
    console = Console()
    console.print(table)

    db.close()


@cli.command()
@click.option("--config", "-c", "config_path", default=None, help="Config file path")
def dedup(config_path: str | None) -> None:
    setup_logging(LOG_DIR)
    cfg_path = Path(config_path) if config_path else CONFIG_PATH
    config = load_config(cfg_path)

    from .pipeline.scarcity import ScarcityEngine
    from .storage.db import Database

    db_path = Path(config.get("db_path", str(DATA_DIR / "craftbeer.db")))
    db = Database(db_path)
    db.connect()

    engine = ScarcityEngine(db)
    merged = engine.deduplicate_and_score()
    recalculated = engine.recalculate_all()

    click.echo(f"Merged {merged} duplicates, recalculated {recalculated} scarcity scores")
    db.close()


@cli.command()
@click.option("--config", "-c", "config_path", default=None, help="Config file path")
def status(config_path: str | None) -> None:
    setup_logging(LOG_DIR)
    cfg_path = Path(config_path) if config_path else CONFIG_PATH
    config = load_config(cfg_path)

    from .storage.db import Database

    db_path = Path(config.get("db_path", str(DATA_DIR / "craftbeer.db")))
    db = Database(db_path)
    db.connect()

    queue_status = db.get_scrape_queue_status()
    today_beers = db.get_beers_today()
    top_scarcity = db.get_scarcity_top(5)
    kickstarter = db.get_kickstarter_active()

    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel

    console = Console()
    console.print(Panel("🍺 Craft Beer Tracker Status", style="bold blue"))
    console.print(f"  DB Size: {queue_status['db_size_mb']:.1f} MB")
    console.print(f"  Manual Queue: {queue_status['manual_queue_count']} sources")
    console.print(f"  Today's New: {len(today_beers)} beers")
    console.print(f"  Active Kickstarter: {len(kickstarter)} campaigns")

    if top_scarcity:
        table = Table(title="Top 5 Scarcity")
        table.add_column("Beer")
        table.add_column("Brewery")
        table.add_column("Score")
        for b in top_scarcity:
            table.add_row(b["beer_name"], b["brewery_name"], str(b["scarcity_score"]))
        console.print(table)

    db.close()


if __name__ == "__main__":
    cli()
