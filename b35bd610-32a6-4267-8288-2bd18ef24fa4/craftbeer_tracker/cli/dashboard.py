from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any

from loguru import logger
from rich.align import Align
from rich.columns import Columns
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.rule import Rule
from rich.table import Table
from rich.text import Text
from rich.layout import Layout

from pipeline.scarcity import ScarcityEngine
from storage.db import Database

SCARCITY_HIGH = 70
SCARCITY_MEDIUM = 40


class Dashboard:
    def __init__(self, db: Database, scarcity_engine: ScarcityEngine, zipcode: str | None = None):
        self.db = db
        self.scarcity = scarcity_engine
        self.zipcode = zipcode
        self._console = Console()
        self._terminal_width = self._detect_width()

    def _detect_width(self) -> int:
        try:
            cols = os.get_terminal_size().columns
            return max(80, min(cols, 200))
        except OSError:
            return 120

    def _scarcity_style(self, score: int) -> str:
        if score >= SCARCITY_HIGH:
            return "bold red"
        elif score >= SCARCITY_MEDIUM:
            return "yellow"
        return "dim"

    def _scarcity_indicator(self, score: int) -> Text:
        if score >= SCARCITY_HIGH:
            return Text("●", style="bold red")
        elif score >= SCARCITY_MEDIUM:
            return Text("●", style="yellow")
        return Text("●", style="dim")

    def render_today_new(self) -> Table:
        beers = self.db.get_beers_today()
        table = Table(
            title="🍺 Today's New Arrivals",
            show_lines=False,
            expand=True,
            title_style="bold cyan",
        )
        table.add_column("Score", width=5, justify="center")
        table.add_column("Brewery", width=20, no_wrap=True)
        table.add_column("Beer", width=25, no_wrap=True)
        table.add_column("Style", width=16, no_wrap=True)
        table.add_column("ABV", width=5, justify="right")
        table.add_column("Limited", width=8, justify="center")
        if self.zipcode:
            table.add_column("Avail", width=6, justify="center")

        for beer in beers[:50]:
            score = beer.get("scarcity_score", 0)
            style = self._scarcity_style(score)
            indicator = self._scarcity_indicator(score)

            row = [
                Text(str(score), style=style),
                Text(beer.get("brewery_name", ""), style=style),
                Text(beer.get("beer_name", ""), style=style),
                Text(beer.get("style", "") or "", style="dim"),
                Text(f"{beer.get('abv', 0) or 0:.1f}" if beer.get("abv") else "", style="dim"),
                Text("✦" if beer.get("is_limited") else "", style="bold yellow" if beer.get("is_limited") else "dim"),
            ]

            if self.zipcode:
                avail = self._check_availability(beer.get("id"), self.zipcode)
                if avail:
                    row.append(Text("✔", style="bold green"))
                else:
                    has_avail = self.db.conn.execute(
                        "SELECT 1 FROM availability WHERE beer_id = ? LIMIT 1",
                        (beer.get("id"),),
                    ).fetchone()
                    if has_avail:
                        row.append(Text("✘", style="red"))
                    else:
                        row.append(Text("?", style="dim"))

            table.add_row(*row)

        return table

    def render_scarcity_top(self, limit: int = 20) -> Table:
        beers = self.db.get_scarcity_top(limit)
        table = Table(
            title="🔥 Scarcity Top 20",
            show_lines=False,
            expand=True,
            title_style="bold red",
        )
        table.add_column("#", width=3, justify="right")
        table.add_column("Score", width=5, justify="center")
        table.add_column("Brewery", width=20, no_wrap=True)
        table.add_column("Beer", width=25, no_wrap=True)
        table.add_column("Tags", width=20, no_wrap=True)
        table.add_column("Release", width=12)

        for i, beer in enumerate(beers, 1):
            score = beer.get("scarcity_score", 0)
            style = self._scarcity_style(score)

            table.add_row(
                Text(str(i), style="dim"),
                Text(str(score), style=style),
                Text(beer.get("brewery_name", ""), style=style),
                Text(beer.get("beer_name", ""), style=style),
                Text(beer.get("limited_tags", ""), style="dim italic"),
                Text(beer.get("release_date", "") or "", style="dim"),
            )

        return table

    def render_release_calendar(self) -> Table:
        conn = self.db.conn
        rows = conn.execute(
            """SELECT b.*, br.name as brewery_name
               FROM beers b
               JOIN breweries br ON b.brewery_id = br.id
               WHERE b.release_date IS NOT NULL
               AND b.release_date >= date('now')
               ORDER BY b.release_date ASC
               LIMIT 30"""
        ).fetchall()

        table = Table(
            title="📅 Release Calendar",
            show_lines=False,
            expand=True,
            title_style="bold magenta",
        )
        table.add_column("Date", width=12)
        table.add_column("Brewery", width=20, no_wrap=True)
        table.add_column("Beer", width=25, no_wrap=True)
        table.add_column("Score", width=5, justify="center")

        for row in rows:
            beer = dict(row)
            score = beer.get("scarcity_score", 0)
            style = self._scarcity_style(score)
            table.add_row(
                Text(beer.get("release_date", ""), style="bold"),
                Text(beer.get("brewery_name", ""), style="dim"),
                Text(beer.get("beer_name", ""), style=style),
                Text(str(score), style=style),
            )

        return table

    def render_kickstarter_alerts(self) -> Table:
        campaigns = self.db.get_kickstarter_active()
        table = Table(
            title="⚠️  Kickstarter Risk Alerts",
            show_lines=False,
            expand=True,
            title_style="bold yellow",
        )
        table.add_column("Risk", width=5, justify="center")
        table.add_column("Campaign", width=30, no_wrap=True)
        table.add_column("Pledged", width=10, justify="right")
        table.add_column("Goal", width=10, justify="right")
        table.add_column("Backers", width=8, justify="right")
        table.add_column("Days", width=5, justify="right")

        for camp in campaigns:
            risk = camp.get("risk_score", 0)
            risk_style = "bold red" if risk >= 60 else ("yellow" if risk >= 30 else "dim")
            pledged = camp.get("pledged_amount", 0) or 0
            goal = camp.get("goal_amount", 0) or 0

            table.add_row(
                Text(str(risk), style=risk_style),
                Text(camp.get("title", ""), style=risk_style),
                Text(f"${pledged:,.0f}" if pledged else "?", style="dim"),
                Text(f"${goal:,.0f}" if goal else "?", style="dim"),
                Text(str(camp.get("backer_count", 0)), style="dim"),
                Text(str(camp.get("days_left", "?")), style="dim"),
            )

        return table

    def render_scrape_status(self, stats: dict[str, Any]) -> Table:
        table = Table(
            title="📡 Scrape Queue Status",
            show_lines=False,
            expand=True,
            title_style="bold blue",
        )
        table.add_column("Source", width=14)
        table.add_column("Status", width=12)
        table.add_column("Last Run", width=22)

        source_status = stats.get("source_status", {})
        last_run = stats.get("last_run", {})

        sources = ["untappd", "ratebeer", "kickstarter", "brewer", "distributor", "newsletter"]
        for src in sources:
            status = source_status.get(src, "idle")
            last = last_run.get(src, "never")
            if len(last) > 19:
                last = last[:19]

            status_style = {
                "running": "bold green",
                "ok": "green",
                "error": "red",
                "manual_queue": "bold red",
            }.get(status, "dim")

            table.add_row(
                Text(src, style="bold"),
                Text(status, style=status_style),
                Text(last, style="dim"),
            )

        return table

    def render_manual_queue(self) -> Table | None:
        queue = self.db.get_manual_queue()
        if not queue:
            return None
        table = Table(title="🚨 Manual Queue", expand=True, title_style="bold red")
        table.add_column("Source", width=14)
        table.add_column("Error", width=40)
        table.add_column("Attempts", width=8, justify="center")
        for item in queue:
            table.add_row(
                item["source"],
                item.get("error_message", "")[:40],
                str(item.get("attempt_count", 1)),
            )
        return table

    def render_price_alerts(self) -> Table | None:
        conn = self.db.conn
        rows = conn.execute(
            """SELECT n.*, b.beer_name, br.name as brewery_name
               FROM notifications n
               JOIN beers b ON n.beer_id = b.id
               JOIN breweries br ON b.brewery_id = br.id
               WHERE n.notification_type = 'discount'
               AND datetime(n.sent_at) >= datetime('now', '-24 hours')
               ORDER BY n.sent_at DESC
               LIMIT 20"""
        ).fetchall()
        if not rows:
            return None

        table = Table(title="💰 Price Alerts (24h)", expand=True, title_style="bold green")
        table.add_column("Beer", width=25)
        table.add_column("Brewery", width=18)
        table.add_column("Message", width=40)
        table.add_column("Time", width=18)

        for row in rows:
            d = dict(row)
            sent = d.get("sent_at", "")[:19]
            table.add_row(
                d.get("beer_name", ""),
                d.get("brewery_name", ""),
                d.get("message", ""),
                sent,
            )
        return table

    def render_blog_feed(self) -> Table | None:
        blogs = self.db.get_recent_blogs(limit=15)
        if not blogs:
            return None

        table = Table(title="📝 Brewery Blog Feed", expand=True, title_style="bold magenta")
        table.add_column("Brewery", width=18)
        table.add_column("Title", width=35)
        table.add_column("Source", width=10)
        table.add_column("Date", width=18)

        for blog in blogs:
            pub = blog.get("published_at") or blog.get("scraped_at", "")[:19]
            table.add_row(
                blog.get("brewery_name", "")[:18],
                blog.get("title", "")[:35],
                blog.get("source_type", ""),
                pub[:19] if pub else "",
            )
        return table

    def _check_availability(self, beer_id: int | None, zipcode: str) -> bool:
        if not beer_id or not zipcode:
            return False
        avail = self.db.get_availability_for_zipcode(beer_id, zipcode)
        return len(avail) > 0

    def render_full(self, stats: dict[str, Any] | None = None) -> Layout:
        width = self._detect_width()
        layout = Layout()
        layout.split_column(
            Layout(name="header", size=3),
            Layout(name="body"),
            Layout(name="footer", size=3),
        )

        layout["header"].update(
            Panel(
                Align.center(
                    Text("🍺 Craft Beer Tracker — Taproom Limited Batch Monitor", style="bold white on blue"),
                    vertical="middle",
                ),
                style="blue",
            )
        )

        left_col_width = width // 2
        right_col_width = width - left_col_width

        layout["body"].split_row(
            Layout(name="left", ratio=1),
            Layout(name="right", ratio=1),
        )

        left_panels = [
            self.render_today_new(),
            self.render_release_calendar(),
        ]
        if stats:
            left_panels.append(self.render_scrape_status(stats))
        manual_q = self.render_manual_queue()
        if manual_q:
            left_panels.append(manual_q)

        right_panels = [
            self.render_scarcity_top(),
            self.render_kickstarter_alerts(),
        ]
        price_alerts = self.render_price_alerts()
        if price_alerts:
            right_panels.append(price_alerts)
        blog_feed = self.render_blog_feed()
        if blog_feed:
            right_panels.append(blog_feed)

        left_group = Group(*left_panels)
        right_group = Group(*right_panels)

        layout["left"].update(Panel(left_group, title="New & Queue", border_style="cyan"))
        layout["right"].update(Panel(right_group, title="Scarcity & Alerts", border_style="red"))

        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        db_size = self.db.check_db_size()
        footer_text = f" {now}  |  DB: {db_size:.1f}MB  |  Zipcode: {self.zipcode or 'not set'}  |  Sources: 6"
        layout["footer"].update(
            Panel(Align.center(Text(footer_text, style="dim")), style="dim")
        )

        return layout

    def render_once(self, stats: dict[str, Any] | None = None) -> None:
        layout = self.render_full(stats)
        self._console.print(layout)

    def render_watch(self, get_stats: Any, refresh_interval: float = 5.0) -> None:
        with Live(console=self._console, refresh_per_second=1 / refresh_interval, screen=True) as live:
            while True:
                try:
                    stats = get_stats() if get_stats else {}
                    layout = self.render_full(stats)
                    live.update(layout)
                except Exception as exc:
                    logger.error("Dashboard render error: {err}", err=str(exc))

    def check_zipcode_availability(self, zipcode: str, beer_name: str | None = None) -> Table:
        conn = self.db.conn
        if beer_name:
            rows = conn.execute(
                """SELECT b.id, b.beer_name, br.name as brewery_name, b.scarcity_score
                   FROM beers b
                   JOIN breweries br ON b.brewery_id = br.id
                   WHERE b.beer_name LIKE ?
                   ORDER BY b.scarcity_score DESC""",
                (f"%{beer_name}%",),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT b.id, b.beer_name, br.name as brewery_name, b.scarcity_score
                   FROM beers b
                   JOIN breweries br ON b.brewery_id = br.id
                   WHERE b.is_limited = 1
                   ORDER BY b.scarcity_score DESC
                   LIMIT 50"""
            ).fetchall()

        table = Table(
            title=f"Availability Check — Zipcode {zipcode}",
            expand=True,
            title_style="bold green",
        )
        table.add_column("Beer", width=25)
        table.add_column("Brewery", width=18)
        table.add_column("Score", width=5, justify="center")
        table.add_column("Can Order", width=10, justify="center")
        table.add_column("Details", width=30)

        for row in rows:
            beer = dict(row)
            avail_list = self.db.get_availability_for_zipcode(beer["id"], zipcode)
            if avail_list:
                details = "; ".join(
                    f"{a.get('region', '')} ({a.get('source', '')})" for a in avail_list[:3]
                )
                table.add_row(
                    beer["beer_name"],
                    beer["brewery_name"],
                    str(beer["scarcity_score"]),
                    Text("✔ YES", style="bold green"),
                    Text(details, style="dim"),
                )
            else:
                table.add_row(
                    beer["beer_name"],
                    beer["brewery_name"],
                    str(beer["scarcity_score"]),
                    Text("✘ NO", style="red"),
                    Text("Not available in your area", style="dim"),
                )

        return table
