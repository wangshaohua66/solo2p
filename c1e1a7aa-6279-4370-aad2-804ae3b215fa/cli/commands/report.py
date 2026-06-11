import typer
from typing import Optional
from datetime import date, datetime, timedelta
from rich.console import Console
from cli.commands.ui import (
    color_block, get_color_hex, print_success, print_error, print_warning,
    print_info, print_json, create_table, set_no_color, bar_chart,
    print_header, rating_stars
)
from core.journal import JournalManager
from core.inventory import InkManager, InventoryManager
from core.exporter import Exporter
from utils.logger import get_logger

logger = get_logger()
app = typer.Typer(help="Generate usage reports and statistics")
console = Console()


@app.command("usage")
def usage_report(
    period: str = typer.Option("month", "--period", "-p", help="Report period: week, month, quarter, year"),
    start_date: Optional[str] = typer.Option(None, "--from", help="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = typer.Option(None, "--to", help="End date (YYYY-MM-DD)"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Generate ink usage statistics report."""
    try:
        set_no_color(no_color)

        today = date.today()

        if start_date and end_date:
            d_from = date.fromisoformat(start_date)
            d_to = date.fromisoformat(end_date)
        else:
            if period == "week":
                d_from = today - timedelta(days=7)
            elif period == "quarter":
                d_from = today - timedelta(days=90)
            elif period == "year":
                d_from = today - timedelta(days=365)
            else:
                d_from = today - timedelta(days=30)
            d_to = today

        journal_mgr = JournalManager()
        stats = journal_mgr.get_usage_stats(d_from, d_to)

        if json_output:
            print_json(stats)
            return

        print_header(f"Usage Report: {d_from.isoformat()} → {d_to.isoformat()}")

        summary_table = create_table("Summary", ["Metric", "Value"])
        summary_table.add_row("Total Entries", str(stats["total_entries"]))
        summary_table.add_row("Unique Inks Used", str(stats["unique_inks"]))
        summary_table.add_row("Period", f"{d_from.isoformat()} → {d_to.isoformat()}")
        console.print(summary_table)
        console.print()

        if not stats["ink_usage"]:
            print_warning("No usage data found for this period")
            return

        ink_mgr = InkManager()
        usage_table = create_table("Ink Usage Ranking", [
            "Rank", "Ink", "Color", "Uses", "Avg Rating", "Usage %"
        ])

        for rank, usage in enumerate(stats["ink_usage"], 1):
            try:
                ink = ink_mgr.get_ink(usage["ink_id"])
                color_display = f"{color_block(ink.cielab)} {get_color_hex(ink.cielab)}"
                ink_name = ink.full_name()
            except Exception:
                color_display = "N/A"
                ink_name = f"Ink #{usage['ink_id']}"

            pct = (usage["uses"] / stats["total_entries"] * 100) if stats["total_entries"] > 0 else 0

            usage_table.add_row(
                str(rank),
                ink_name,
                color_display,
                str(usage["uses"]),
                f"{rating_stars(int(round(usage['avg_rating'])))} ({usage['avg_rating']:.2f})",
                f"{bar_chart(pct, 100, width=10)} {pct:.1f}%",
            )

        console.print(usage_table)

    except Exception as e:
        logger.error(f"Failed to generate usage report: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("inventory")
def inventory_report(
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
    top_n: int = typer.Option(10, "--top", "-n", help="Number of top consumed inks to show"),
):
    """Generate comprehensive inventory and cost analysis report."""
    try:
        set_no_color(no_color)

        inv_mgr = InventoryManager()
        ink_mgr = InkManager()

        inventory = inv_mgr.list_inventory()
        alerts = inv_mgr.get_stock_alerts()

        total_bottles = sum(inv.bottle_count for inv in inventory)
        total_value = 0.0
        total_ml = 0.0
        total_initial_ml = 0.0
        total_consumed_ml = 0.0
        expiring_count = 0
        low_stock_count = 0

        from datetime import date
        today = date.today()

        consumption_data = []
        for inv in inventory:
            if inv.ink:
                initial_ml = inv.bottle_count * inv.ink.volume_ml
                consumed_ml = max(0, initial_ml - inv.current_ml)
                cost_per_ml = (inv.ink.price / inv.ink.volume_ml) if inv.ink.price and inv.ink.volume_ml > 0 else None

                if inv.ink.price:
                    total_value += inv.ink.price * inv.bottle_count
                total_ml += inv.current_ml
                total_initial_ml += initial_ml
                total_consumed_ml += consumed_ml

                if inv.bottle_count <= 1:
                    low_stock_count += 1
                if inv.ink.expiration_date:
                    days_left = (inv.ink.expiration_date - today).days
                    if days_left <= 180:
                        expiring_count += 1

                is_homemade = "homemade" in [t.lower() for t in inv.ink.tags]
                consumption_data.append({
                    "ink": inv.ink,
                    "consumed_ml": consumed_ml,
                    "initial_ml": initial_ml,
                    "current_ml": inv.current_ml,
                    "cost_per_ml": cost_per_ml,
                    "is_homemade": is_homemade,
                })

        consumption_data.sort(key=lambda x: x["consumed_ml"], reverse=True)

        homemade_data = [c for c in consumption_data if c["is_homemade"]]
        store_data = [c for c in consumption_data if not c["is_homemade"]]

        def _avg_cost_per_ml(items):
            costs = [c["cost_per_ml"] for c in items if c["cost_per_ml"] is not None]
            return sum(costs) / len(costs) if costs else None

        def _total_cost(items):
            total = 0.0
            for c in items:
                if c["cost_per_ml"] is not None and c["ink"].price is not None:
                    idx = consumption_data.index(c)
                    inv = inventory[idx] if idx < len(inventory) else None
                    if inv and inv.ink:
                        total += inv.ink.price * inv.bottle_count
            return total

        homemade_avg_cost = _avg_cost_per_ml(homemade_data)
        store_avg_cost = _avg_cost_per_ml(store_data)

        homemade_count = len(homemade_data)
        store_count = len(store_data)

        if json_output:
            result = {
                "total_inks": len(inventory),
                "total_bottles": total_bottles,
                "total_ml": round(total_ml, 2),
                "total_initial_ml": round(total_initial_ml, 2),
                "total_consumed_ml": round(total_consumed_ml, 2),
                "estimated_value": round(total_value, 2),
                "low_stock_count": low_stock_count,
                "expiring_count": expiring_count,
                "homemade_inks": homemade_count,
                "store_bought_inks": store_count,
                "homemade_avg_cost_per_ml": round(homemade_avg_cost, 4) if homemade_avg_cost else None,
                "store_avg_cost_per_ml": round(store_avg_cost, 4) if store_avg_cost else None,
                "top_consumed": [
                    {
                        "ink_id": c["ink"].id,
                        "ink_name": c["ink"].full_name(),
                        "consumed_ml": round(c["consumed_ml"], 2),
                        "initial_ml": round(c["initial_ml"], 2),
                        "current_ml": round(c["current_ml"], 2),
                        "consumed_pct": round(c["consumed_ml"] / c["initial_ml"] * 100, 1) if c["initial_ml"] > 0 else 0,
                        "cost_per_ml": round(c["cost_per_ml"], 4) if c["cost_per_ml"] else None,
                        "is_homemade": c["is_homemade"],
                    }
                    for c in consumption_data[:top_n]
                ],
                "alerts": [a.model_dump() for a in alerts],
            }
            print_json(result)
            return

        print_header("Inventory Analysis Report")

        summary_table = create_table("Summary", ["Metric", "Value"])
        summary_table.add_row("Total Unique Inks", str(len(inventory)))
        summary_table.add_row("Total Bottles", str(total_bottles))
        summary_table.add_row("Total Volume (Current)", f"{total_ml:.0f}ml")
        summary_table.add_row("Total Volume (Initial)", f"{total_initial_ml:.0f}ml")
        summary_table.add_row("Total Consumed", f"{total_consumed_ml:.0f}ml ({total_consumed_ml/total_initial_ml*100:.1f}%)" if total_initial_ml > 0 else "0ml")
        summary_table.add_row("Estimated Value", f"${total_value:.2f}")
        summary_table.add_row("Low Stock Items", f"[yellow]{low_stock_count}[/]" if low_stock_count > 0 else str(low_stock_count))
        summary_table.add_row("Expiring Soon", f"[yellow]{expiring_count}[/]" if expiring_count > 0 else str(expiring_count))
        console.print(summary_table)
        console.print()

        if homemade_avg_cost and store_avg_cost:
            cost_diff = store_avg_cost - homemade_avg_cost
            cost_diff_pct = (cost_diff / store_avg_cost * 100) if store_avg_cost > 0 else 0

            cost_table = create_table("Cost Comparison: Homemade vs Store-bought", [
                "Category", "Inks", "Avg Cost/ml", "Savings"
            ])
            cost_table.add_row(
                "Store-bought",
                str(store_count),
                f"${store_avg_cost:.4f}/ml",
                "-"
            )
            cost_table.add_row(
                "Homemade",
                str(homemade_count),
                f"${homemade_avg_cost:.4f}/ml",
                f"[green]${cost_diff:.4f}/ml ({cost_diff_pct:.1f}%)[/]" if cost_diff > 0 else "N/A"
            )
            console.print(cost_table)
            console.print()

        if alerts:
            alert_table = create_table("Alerts", ["Ink", "Type", "Message", "Severity"])
            for alert in alerts:
                severity_style = "red" if alert.severity == "error" else "yellow"
                alert_table.add_row(
                    alert.ink_name,
                    alert.alert_type,
                    alert.message,
                    f"[{severity_style}]{alert.severity.upper()}[/]",
                )
            console.print(alert_table)
            console.print()

        if consumption_data:
            top_consumed = consumption_data[:top_n]
            cons_table = create_table(f"Top {min(top_n, len(top_consumed))} Most Consumed Inks", [
                "Rank", "Ink", "Color", "Consumed", "Remaining", "Used %", "Cost/ml"
            ])

            for rank, c in enumerate(top_consumed, 1):
                ink = c["ink"]
                pct = c["consumed_ml"] / c["initial_ml"] * 100 if c["initial_ml"] > 0 else 0
                cost_ml = f"${c['cost_per_ml']:.4f}" if c["cost_per_ml"] else "N/A"
                tag = " [dim](homemade)[/]" if c["is_homemade"] else ""

                cons_table.add_row(
                    str(rank),
                    f"{ink.full_name()}{tag}",
                    f"{color_block(ink.cielab)} {get_color_hex(ink.cielab)}",
                    f"{c['consumed_ml']:.0f}ml",
                    f"{c['current_ml']:.0f}ml",
                    f"{bar_chart(pct, 100, width=10)} {pct:.1f}%",
                    cost_ml,
                )
            console.print(cons_table)
            console.print()

        if inventory:
            stock_table = create_table("Stock by Ink Type", [
                "Type", "Count", "Bottles", "Value", "Distribution"
            ])

            type_counts = {}
            type_bottles = {}
            type_value = {}
            for inv in inventory:
                if inv.ink:
                    ink_type = inv.ink.ink_type.value
                    type_counts[ink_type] = type_counts.get(ink_type, 0) + 1
                    type_bottles[ink_type] = type_bottles.get(ink_type, 0) + inv.bottle_count
                    if inv.ink.price:
                        type_value[ink_type] = type_value.get(ink_type, 0) + inv.ink.price * inv.bottle_count

            for ink_type in sorted(type_counts.keys()):
                pct = type_counts[ink_type] / len(inventory) * 100
                stock_table.add_row(
                    ink_type,
                    str(type_counts[ink_type]),
                    str(type_bottles[ink_type]),
                    f"${type_value.get(ink_type, 0):.2f}",
                    f"{bar_chart(pct, 100, width=15)} {pct:.1f}%",
                )
            console.print(stock_table)

    except Exception as e:
        logger.error(f"Failed to generate inventory report: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)


@app.command("expiration")
def expiration_report(
    days: int = typer.Option(180, "--days", "-d", help="Days until expiration warning"),
    no_color: bool = typer.Option(False, "--no-color", help="Disable color output"),
    json_output: bool = typer.Option(False, "--json", help="Output as JSON"),
):
    """Generate report of inks nearing expiration."""
    try:
        set_no_color(no_color)

        from storage.sqlite_db import get_db
        from datetime import date
        db = get_db()
        today = date.today()
        cutoff = today + timedelta(days=days)

        rows = db.query(
            """
            SELECT i.*, inv.bottle_count, inv.current_ml
            FROM inks i
            JOIN inventory inv ON i.id = inv.ink_id
            WHERE i.expiration_date IS NOT NULL
            AND i.expiration_date <= ?
            ORDER BY i.expiration_date ASC
            """,
            (cutoff.isoformat(),),
        )

        if json_output:
            result = []
            for row in rows:
                exp_date = date.fromisoformat(row["expiration_date"])
                days_left = (exp_date - today).days
                result.append({
                    "ink_id": row["id"],
                    "brand": row["brand"],
                    "color_name": row["color_name"],
                    "expiration_date": row["expiration_date"],
                    "days_left": days_left,
                    "bottle_count": row["bottle_count"],
                    "current_ml": row["current_ml"],
                    "expired": days_left <= 0,
                })
            print_json(result)
            return

        if not rows:
            print_success(f"No inks expiring in the next {days} days")
            return

        print_header(f"Expiration Report (next {days} days)")

        table = create_table(f"Expiring Inks ({len(rows)})", [
            "ID", "Ink", "Expires", "Days Left", "Bottles", "Remaining", "Status"
        ])

        ink_mgr = InkManager()
        for row in rows:
            ink = ink_mgr._row_to_ink(row)
            exp_date = date.fromisoformat(row["expiration_date"])
            days_left = (exp_date - today).days

            if days_left <= 0:
                status = "[red]EXPIRED[/]"
                days_display = f"[red]{days_left}d[/]"
            elif days_left <= 30:
                status = "[red]URGENT[/]"
                days_display = f"[red]{days_left}d[/]"
            elif days_left <= 90:
                status = "[yellow]WARNING[/]"
                days_display = f"[yellow]{days_left}d[/]"
            else:
                status = "[green]OK[/]"
                days_display = f"[green]{days_left}d[/]"

            table.add_row(
                str(row["id"]),
                f"{color_block(ink.cielab)} {ink.full_name()}",
                row["expiration_date"],
                days_display,
                str(row["bottle_count"]),
                f"{row['current_ml']:.0f}ml",
                status,
            )

        console.print(table)

    except Exception as e:
        logger.error(f"Failed to generate expiration report: {e}")
        print_error(str(e))
        raise typer.Exit(code=1)
